const { readFileSync, writeFileSync, renameSync } = require('node:fs');
const { defaults, upgradeAppearance } = require('./settings.js');
function loadPreferences(file) {
  let original;
  try { original = readFileSync(file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return { ...defaults }; throw error; }
  const { preferences, changed } = upgradeAppearance(JSON.parse(original));
  if (changed) {
    const backup = file.replace(/\.json$/i, '') + '.before-appearance-v2.json';
    // Preserve the first pre-upgrade version. Never overwrite a user's backup.
    try { writeFileSync(backup, original, { encoding: 'utf8', flag: 'wx' }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    const temporary = file + '.tmp';
    writeFileSync(temporary, JSON.stringify(preferences), 'utf8');
    renameSync(temporary, file);
  }
  return preferences;
}
module.exports = { loadPreferences };
