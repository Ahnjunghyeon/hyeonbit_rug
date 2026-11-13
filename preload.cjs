const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rugDesktop', {
  onHoverProbe: callback => ipcRenderer.on('rug:hover-probe', (_, point) => callback(point)),
  setHover: hit => ipcRenderer.send('rug:hover', hit === true),
  setAction: action => ipcRenderer.send('rug:set-action', action),
  setSize: size => ipcRenderer.invoke('rug:set-size', size),
  getDisplays: () => ipcRenderer.invoke('rug:get-displays'),
  onDisplays: callback => ipcRenderer.on('rug:displays', (_, displays) => callback(displays)),
  getPreferences: () => ipcRenderer.invoke('rug:get-preferences'),
  savePreferences: preferences => ipcRenderer.invoke('rug:save-preferences', preferences),
  onPreferences: callback => ipcRenderer.on('rug:preferences', (_, preferences) => callback(preferences)),
  onInputMode: callback => ipcRenderer.on('rug:input-mode', (_, mode) => callback(mode)),
  onAction: callback => ipcRenderer.on('rug:action', (_, action) => callback(action)),
  onReset: callback => ipcRenderer.on('rug:reset', () => callback()),
  onSuspend: callback => ipcRenderer.on('rug:suspend', () => callback())
});
