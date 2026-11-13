(() => {
  const skills = {
  "water": "수주 - 토미오카 기유",
  "ember": "염주 - 렌고쿠 쿄쥬로",
  "mist": "하주 - 토키토 무이치로",
  "insect": "충주 - 코쵸우 시노부",
  "love": "연주 - 칸로지 미츠리",
  "serpent": "사주 - 이구로 오바나이",
  "sound": "음주 - 우즈이 텐겐",
  "stone": "암주 - 히메지마 교메이",
  "spin": "풍주 - 시나즈가와 사네미",
  "zap": "번개의 호흡 - 젠이츠",
  "hinokami": "히노카미 카구라 - 탄지로"
};
  const skillGroups = [{"label": "9주 검기", "ids": ["water", "ember", "mist", "insect", "love", "serpent", "sound", "stone", "spin"]}, {"label": "기타 호흡", "ids": ["zap"]}, {"label": "히노카미 카구라", "ids": ["hinokami"]}];
  const appearanceRevision = 2;
  const scaleRevision = 1;
  const defaults = { rugSizeRevision: 3, scaleRevision, appearanceRevision, displayId: 'primary', art: '', size: 100, effectSize: 100, defaultSkill: 'water', animate: true, layer: 'bottom' };
  function percent(value, min, max) {
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.round(Math.max(min, Math.min(max, value))) : 100;
  }
  function normalize(value) {
    const { art, size, effectSize, defaultSkill, animate, layer, appearanceRevision: revision, scaleRevision: savedScale, rugSizeRevision, displayId } = value ?? {};
    return {
      rugSizeRevision: rugSizeRevision === 3 ? 3 : 0,
      scaleRevision: savedScale === scaleRevision ? scaleRevision : 0,
      appearanceRevision: revision === appearanceRevision ? appearanceRevision : 0,
      art: typeof art === 'string' && art.length <= 1600000 &&
        /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(art) ? art : '',
      displayId: typeof displayId==='string' && (displayId==='primary'||/^-?\d{1,20}$/.test(displayId)) ? displayId : 'primary',
      size: percent(size, 60, 300),
      effectSize: percent(effectSize, 25, 150),
      defaultSkill: typeof defaultSkill === 'string' && Object.hasOwn(skills, defaultSkill) ? defaultSkill : defaults.defaultSkill,
      animate: animate !== false,
      layer: layer === 'top' ? 'top' : 'bottom'
    };
  }
  function upgradeAppearance(value) {
    const preferences = normalize(value);
    let changed = preferences.appearanceRevision !== appearanceRevision;
    if (preferences.scaleRevision !== scaleRevision) {
      preferences.size = 100; preferences.effectSize = 100; preferences.scaleRevision = scaleRevision;
      changed = true;
    }
    if (preferences.rugSizeRevision !== 3) { preferences.size = 100; preferences.rugSizeRevision = 3; changed = true; }
    if (preferences.appearanceRevision !== appearanceRevision) { preferences.art = ''; preferences.appearanceRevision = appearanceRevision; }
    return { preferences, changed };
  }
  const api = { skills, skillGroups, defaults, normalize, upgradeAppearance };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else window.rugPreferences = api;
})();
