const { app, BrowserWindow, dialog, ipcMain, Menu, screen, Tray } = require('electron');
const { spawn } = require('node:child_process');
const { readFileSync, renameSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { createInterface } = require('node:readline');

const { skills, skillGroups, defaults, normalize } = require('./settings.js');
const { loadPreferences } = require('./preferences-store.cjs');
const { selectDisplay, displayChoices } = require('./display-selection.cjs');
const { createInputPolicy } = require('./desktop-input.cjs');

let overlay, tray, monitor, settingsWindow, preferencesPath;
let preferences = { ...defaults }, activeSkill = defaults.defaultSkill;
const webPreferences = {
  preload: join(__dirname, 'preload.cjs'),
  sandbox: true, contextIsolation: true, nodeIntegration: false
};
let foreground = 'app', ready = false, enabled = true, capturing = false;
let rugHovered = false;
let inputMode = 'none', monitorState = { ctrl: false, alt: false, buttons: 0 };
let hoverProbeTimer;
let lastMonitorAt = 0, monitorWatchdog, rendererHealthy = true;
const inputPolicy = createInputPolicy();

function restrictNavigation(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
}

function openSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.setAlwaysOnTop(preferences.layer === 'top', 'floating');
    settingsWindow.show();
    settingsWindow.moveTop();
    settingsWindow.focus();
    return;
  }
  const window = new BrowserWindow({
    width: Math.min(1040,screen.getPrimaryDisplay().workArea.width-48), height: Math.min(780,screen.getPrimaryDisplay().workArea.height-40), minWidth: 680, minHeight: 430,
    show: false, autoHideMenuBar: true, title: '현빗 러그 · 환경설정',
    icon: join(__dirname, 'app-icon-v2.ico'), backgroundColor: '#161720',
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#161720', symbolColor: '#e7d9ff', height: 36 },
    webPreferences
  });
  settingsWindow = window;
  window.setAlwaysOnTop(preferences.layer === 'top', 'floating');
  restrictNavigation(window);
  window.on('page-title-updated', event => event.preventDefault());
  window.on('focus', updateVisibility);
  window.on('blur', updateVisibility);
  window.on('show', updateVisibility);
  window.on('hide', updateVisibility);
  window.on('closed', () => { settingsWindow = null; updateVisibility(); });
  window.once('ready-to-show', () => { window.show(); window.moveTop(); });
  window.loadFile(join(__dirname, 'index.html'), { query: { mode: 'settings' } }).catch(error => {
    if (!window.isDestroyed()) window.close();
    dialog.showErrorBox('현빗 러그 환경설정', String(error));
  });
}

function commitPreferences(next) {
    const tempPath = preferencesPath + '.tmp';
    writeFileSync(tempPath, JSON.stringify(next), 'utf8');
    renameSync(tempPath, preferencesPath);
    if (next.defaultSkill !== preferences.defaultSkill) activeSkill = next.defaultSkill;
    const displayChanged = next.displayId !== preferences.displayId;
    const layerChanged = next.layer !== preferences.layer;
    preferences = next;
    if (layerChanged) applyWindowLayer();
    if (displayChanged) setBounds();
    if (!overlay.isDestroyed()) overlay.webContents.send('rug:preferences', next);
    updateTray();
    if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.webContents.send('rug:preferences', next);
}

function updateTray() {
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '환경설정', click: openSettings },
    { label: '러그 표시', type: 'checkbox', checked: enabled, click(item) {
      enabled = item.checked;
      updateVisibility();
    } },
    ...skillGroups.map(group => ({
      label: group.label,
      submenu: group.ids.map(id => ({
        label: skills[id], type: 'radio', checked: id === activeSkill, click() {
          activeSkill = id;
          overlay.webContents.send('rug:action', id);
          updateTray();
        }
      }))
    })),
    { label: '러그 원위치 (Ctrl+Shift+R)', click: () => overlay.webContents.send('rug:reset') },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() }
  ]));
}

function capture(value) {
  if (capturing === value || !overlay || overlay.isDestroyed()) return;
  capturing = value;
  if (value) overlay.setIgnoreMouseEvents(false);
  else overlay.setIgnoreMouseEvents(true, { forward: true });
}

function applyWindowLayer() {
  if (!overlay || overlay.isDestroyed()) return;
  const top = preferences.layer === 'top';
  overlay.setAlwaysOnTop(top, 'floating');
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.setAlwaysOnTop(top, 'floating');
    if (settingsWindow.isVisible()) settingsWindow.moveTop();
  }
  updateVisibility();
}

function updateVisibility() {
  if (!ready || !overlay || overlay.isDestroyed()) return;
  const settingsForeground = Boolean(settingsWindow && !settingsWindow.isDestroyed() &&
    settingsWindow.isVisible() && (settingsWindow.isFocused() || foreground === 'owned'));
  const desktop = foreground === 'desktop';
  const healthy = lastMonitorAt > 0 && Date.now() - lastMonitorAt < 750;
  const nextMode = inputPolicy.update({
    ...monitorState, hovered: rugHovered,
    allowed: healthy && rendererHealthy && enabled && !settingsForeground && foreground !== 'owned' &&
      (preferences.layer === 'top' || desktop || monitorState.desktopAtPointer === true)
  });
  if (inputMode !== nextMode) {
    if (inputMode !== 'none') overlay.webContents.send('rug:suspend');
    inputMode = nextMode;
    overlay.webContents.send('rug:input-mode', inputMode);
  }
  // Hover targets only opaque rug pixels, never a gesture already held elsewhere.
  capture(inputMode !== 'none');

  if (enabled) {
    if (!overlay.isVisible()) overlay.showInactive();
  } else if (overlay.isVisible()) overlay.hide();
}

function selectedDisplay() { return selectDisplay(screen.getAllDisplays(),screen.getPrimaryDisplay(),preferences.displayId); }
function setBounds() {
  if (!overlay || overlay.isDestroyed()) return;
  const target=selectedDisplay().workArea,current=overlay.getBounds();
  if(['x','y','width','height'].every(key=>target[key]===current[key]))return;
  rugHovered=false;inputPolicy.reset();capture(false);
  overlay.webContents.send('rug:suspend');
  overlay.setBounds(target);
  overlay.webContents.send('rug:reset');
  updateVisibility();
}
function displaysChanged() {
  const displays=screen.getAllDisplays(),primary=screen.getPrimaryDisplay();
  if(preferences.displayId!=='primary'&&!displays.some(d=>String(d.id)===preferences.displayId)) {
    commitPreferences(normalize({...preferences,displayId:'primary'}));
  } else setBounds();
  if(settingsWindow&&!settingsWindow.isDestroyed())settingsWindow.webContents.send('rug:displays',displayChoices(displays,primary));
}

function startMonitor() {
  const script = readFileSync(join(__dirname, 'desktop-monitor.ps1'), 'utf8');
  const executable = join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const handle = overlay.getNativeWindowHandle();
  const hwnd = handle.length === 8 ? handle.readBigInt64LE() : BigInt(handle.readInt32LE());
  monitor = spawn(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand',
    Buffer.from(script, 'utf16le').toString('base64')], {
    windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
    env: { ...process.env,
      HYEONBIT_RUG_MONITOR_PID: String(process.pid), HYEONBIT_RUG_HWND: hwnd.toString()
    }
  });
  createInterface({ input: monitor.stdout }).on('line', line => {
    let state;
    try { state = JSON.parse(line); } catch { return; }
    if (!state || !['desktop','owned','app'].includes(state.context) ||
        typeof state.ctrl !== 'boolean' || typeof state.alt !== 'boolean' ||
        (state.shift !== undefined && typeof state.shift !== 'boolean') ||
        (state.desktopAtPointer !== undefined && typeof state.desktopAtPointer !== 'boolean') ||
        !Number.isInteger(state.buttons) || state.buttons < 0 || state.buttons > 31) return;
    foreground = state.context;
    monitorState = state;
    lastMonitorAt = Date.now();
    updateVisibility();
    // Desktop scope only: do not reserve a browser/editor's Ctrl+Shift+R.
    if (state.reset === true && (foreground === 'desktop' || state.desktopAtPointer === true) &&
        ready && enabled && !settingsWindow?.isFocused()) overlay.webContents.send('rug:reset');
  });
  monitorWatchdog = setInterval(() => {
    if (Date.now() - lastMonitorAt >= 750) {
      inputPolicy.reset();
      updateVisibility();
    }
  }, 250);
  // Probe in Electron screen coordinates: do not depend on forwarded pointer events.
  hoverProbeTimer = setInterval(() => {
    if (!ready || !enabled || !rendererHealthy || !overlay || overlay.isDestroyed() ||
        Date.now()-lastMonitorAt >= 750 || monitorState.buttons || foreground === 'owned') return;
    const point = screen.getCursorScreenPoint(), bounds = overlay.getBounds();
    overlay.webContents.send('rug:hover-probe', {x:point.x-bounds.x,y:point.y-bounds.y,buttons:monitorState.buttons});
  }, 32);
  monitor.on('error', error => {
    console.error('Desktop monitor failed', error);
    foreground = 'app';lastMonitorAt = 0;inputPolicy.reset();
    updateVisibility();
  });
  monitor.on('exit', code => {
    if (code) console.error('Desktop monitor exited:', code);
    foreground = 'app';lastMonitorAt = 0;inputPolicy.reset();
    updateVisibility();
  });
}

if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(async () => {
  if (process.platform !== 'win32') {
    dialog.showErrorBox('Hyeonbit Rug', 'Windows에서 실행해 주세요. 웹 데모는 index.html입니다.');
    app.quit();
    return;
  }

  app.setAppUserModelId('com.hyeonbit.rug');
  preferencesPath = join(app.getPath('userData'), 'rug-settings.json');
  try { preferences = loadPreferences(preferencesPath); }
  catch (error) { if (error.code !== 'ENOENT') console.warn('Settings could not be loaded:', error.message); }
  // Every launch starts with Giyu, including installations with an older saved skill.
  preferences.defaultSkill = 'water';
  activeSkill = 'water';

  overlay = new BrowserWindow({
    ...selectedDisplay().workArea, show: false,
    frame: false, transparent: true, focusable: false,
    resizable: false, skipTaskbar: true, hasShadow: false,
    icon: join(__dirname, 'app-icon-v2.ico'),
    webPreferences
  });
  overlay.setIgnoreMouseEvents(true, { forward: true });
  restrictNavigation(overlay);
  overlay.webContents.on('render-process-gone', () => {
    inputPolicy.reset();capture(false);ready = false;
  });
  overlay.on('unresponsive', () => { rendererHealthy = false;inputPolicy.reset();updateVisibility(); });
  overlay.on('responsive', () => { rendererHealthy = true;updateVisibility(); });
  ipcMain.on('rug:hover', (event, value) => {
    if (event.sender !== overlay.webContents || typeof value !== 'boolean') return;
    if (rugHovered === value) return;
    rugHovered = value;
    updateVisibility();
  });
  ipcMain.on('rug:set-action', (event, id) => {
    if (event.sender !== overlay.webContents || typeof id !== 'string' || !Object.hasOwn(skills, id)) return;
    activeSkill = id;updateTray();
  });

  ipcMain.handle('rug:get-displays', event => {
    if(event.sender!==settingsWindow?.webContents && event.sender!==overlay.webContents)throw Error('Unknown window');
    return displayChoices(screen.getAllDisplays(),screen.getPrimaryDisplay());
  });
  ipcMain.handle('rug:get-preferences', event => {
    if (event.sender !== overlay.webContents && event.sender !== settingsWindow?.webContents) throw Error('Unknown window');
    return preferences;
  });
  ipcMain.handle('rug:set-size', (event, size) => {
    if (event.sender !== overlay.webContents || typeof size !== 'number' || !Number.isFinite(size)) throw Error('Invalid rug size request');
    const next = normalize({ ...preferences, size });
    commitPreferences(next);
    return next.size;
  });

  ipcMain.handle('rug:save-preferences', (event, value) => {
    if (event.sender !== settingsWindow?.webContents) throw Error('Unknown settings window');
    const next = normalize(value);
    if(next.displayId!=='primary'&&!screen.getAllDisplays().some(d=>String(d.id)===next.displayId))next.displayId='primary';
    commitPreferences(next);
  });

  tray = new Tray(join(__dirname, 'tray-v2.png'));
  tray.setToolTip('현빗 러그');
  tray.on('double-click', openSettings);
  updateTray();

  screen.on('display-added', displaysChanged);
  screen.on('display-removed', displaysChanged);
  screen.on('display-metrics-changed', displaysChanged);
  try {
    await overlay.loadFile(join(__dirname, 'index.html'));
    ready = true;
    applyWindowLayer();
    startMonitor();
  } catch (error) {
    dialog.showErrorBox('Hyeonbit Rug', String(error));
    app.quit();
  }
});
app.on('before-quit', () => { clearInterval(monitorWatchdog);clearInterval(hoverProbeTimer);monitor?.kill(); });
