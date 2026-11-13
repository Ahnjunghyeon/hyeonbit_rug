// One settings controller for Windows and browser; no cloth/render dependencies.
(function(root){
'use strict';
const TEX_WIDTH=640,TEX_HEIGHT=400;
async function importRugArt(file){
  if(file.size>16*1024*1024)throw Error('16MB 이하의 이미지를 선택해 주세요.');
  const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const png=[137,80,78,71,13,10,26,10].every((byte,i)=>bytes[i]===byte);
  const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&
    String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if(!png&&!webp)throw Error('PNG 또는 WebP 이미지를 선택해 주세요.');
  const bitmap=await createImageBitmap(file).catch(()=>{throw Error('이미지를 열 수 없습니다.');});
  try{
    if(bitmap.width*bitmap.height>24000000)throw Error('이미지의 해상도를 낮춰 주세요.');
    const probe=document.createElement('canvas');
    const scale=Math.min(1,TEX_WIDTH/bitmap.width,TEX_HEIGHT/bitmap.height);
    probe.width=Math.max(1,Math.round(bitmap.width*scale));
    probe.height=Math.max(1,Math.round(bitmap.height*scale));
    const source=probe.getContext('2d',{willReadFrequently:true});
    source.drawImage(bitmap,0,0,probe.width,probe.height);
    const alpha=source.getImageData(0,0,probe.width,probe.height).data;
    let left=probe.width,top=probe.height,right=-1,bottom=-1;
    for(let y=0;y<probe.height;y++)for(let x=0;x<probe.width;x++){
      if(alpha[(y*probe.width+x)*4+3]<32)continue;
      left=Math.min(left,x);right=Math.max(right,x);
      top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    if(right<left)throw Error('이미지에 보이는 부분이 없습니다.');
    const sx=left*bitmap.width/probe.width,sy=top*bitmap.height/probe.height;
    const sw=(right-left+1)*bitmap.width/probe.width,sh=(bottom-top+1)*bitmap.height/probe.height;
    const fit=Math.min((TEX_WIDTH-12)/sw,(TEX_HEIGHT-12)/sh);
    const texture=document.createElement('canvas');
    texture.width=TEX_WIDTH;texture.height=TEX_HEIGHT;
    texture.getContext('2d').drawImage(bitmap,sx,sy,sw,sh,
      (TEX_WIDTH-sw*fit)/2,(TEX_HEIGHT-sh*fit)/2,sw*fit,sh*fit);
    return texture.toDataURL('image/png');
  }finally{bitmap.close();}
}
function sizeLabel(percent){return percent+'%';}
function mount({standalone=false,bridge:nativeDesktop,atlasStore,defaultArtSource,getPreferences,applyPreferences,onOpen}){
  const {defaults,normalize,skills}=root.rugPreferences;
  const $=id=>document.querySelector('#hyeonbit-rug #'+id);
  const skillSelect=$('defaultSkill');
  skillSelect.replaceChildren();
  for(const [value,title]of Object.entries(skills)){const option=document.createElement('option');option.value=value;option.textContent=title;skillSelect.append(option);}
  skillSelect.value=defaults.defaultSkill;
  const dialog=$('settings'),form=$('settingsForm'),file=$('rugFile');
  const preview=$('artPreview'),fallback=$('artDefault'),status=$('settingsStatus');
  const preset=$('rugPreset'),presets=root.rugPresets;
  for(const [i,p]of presets.entries()){const o=document.createElement('option');o.value=String(i);o.textContent=p.title;preset.append(o);}
  const custom=document.createElement('option');custom.value='custom';custom.textContent='사용자 이미지';preset.append(custom);
  const selectMenus=window.RugSettingsSelect.enhance(dialog);
  let draft={...defaults},busy=false,pending=null,saving=null,timer=null,failed=false;
  function drawArt(){
    const selected=presets.findIndex(p=>p.art===draft.art);preset.value=selected<0?'custom':String(selected);selectMenus.refresh();
    preview.hidden=false;fallback.hidden=true;
    const src=draft.art||defaultArtSource;if(preview.getAttribute('src')!==src)preview.src=src;
  }
  const displaySelect=$('rugDisplay');
  let displayList=[];
  function drawDisplays(){
    displaySelect.replaceChildren();
    const automatic=document.createElement('option');automatic.value='primary';automatic.textContent='주 모니터 (자동)';displaySelect.append(automatic);
    for(const item of displayList){const option=document.createElement('option');option.value=item.id;option.textContent=item.label;displaySelect.append(option);}
    displaySelect.value=draft.displayId;
    if(!displaySelect.value)displaySelect.value='primary';
    displaySelect.disabled=busy||!standalone||!displayList.length;
  }
  let previewRevision=0,lastPreviewKind=null;
  async function drawSkillPreview(){
    const revision=++previewRevision,kind=$('defaultSkill').value;
    if(kind===lastPreviewKind)return;
    const image=atlasStore.get(kind);
    try{await atlasStore.ready(kind);if(revision!==previewRevision)return;
      lastPreviewKind=kind;
      const c=$('skillPreview'),g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);
      const f=12;g.drawImage(image,f%6*480,Math.floor(f/6)*240,480,240,0,0,c.width,c.height);
    }catch{if(revision===previewRevision)$('settingsStatus').textContent='검기 이미지를 읽지 못했습니다. 파일 전체를 교체해 주세요.';}
  }
  function fill(value){
    draft=normalize(value);file.value='';drawDisplays();
    $('rugSize').value=draft.size;$('effectSize').value=draft.effectSize;
    $('rugLayer').value=draft.layer;
    $('defaultSkill').value=draft.defaultSkill;$('animateReset').checked=draft.animate;
    $('sizeValue').value=sizeLabel(draft.size);$('effectValue').value=draft.effectSize+'%';
    selectMenus.refresh();drawArt();void drawSkillPreview();status.textContent='변경하면 자동으로 적용됩니다.';
  }
  function setBusy(value){
    busy=value;file.disabled=value;$('chooseRug').disabled=value;
    for(const id of ['rugSize','effectSize','rugLayer','defaultSkill','animateReset','rugPreset'])$(id).disabled=value;
    displaySelect.disabled=value||!standalone||!displayList.length;selectMenus.refresh();
    $('clearArt').disabled=value;$('defaultSettings').disabled=value;$('closeSettings').disabled=value;
  }
  function snapshot(){
    return normalize({...draft,size:Number($('rugSize').value),effectSize:Number($('effectSize').value),
      displayId:standalone?displaySelect.value:'primary',layer:$('rugLayer').value,defaultSkill:$('defaultSkill').value,animate:$('animateReset').checked});
  }
  function flush(){
    clearTimeout(timer);timer=null;
    if(saving)return saving;
    saving=(async()=>{
      while(pending){
        const next=pending;pending=null;
        try{
          if(standalone)await nativeDesktop.savePreferences(next);
          else{
            localStorage.setItem('hyeonbit-rug.settings',JSON.stringify(next));
            await applyPreferences(next);
          }
          failed=false;status.textContent='자동 적용되었습니다.';
        }catch{
          failed=true;status.textContent='저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.';
        }
      }
    })().finally(()=>{saving=null;});
    return saving;
  }
  function changed(delay=0){
    if(busy)return;
    pending=snapshot();clearTimeout(timer);
    status.textContent='적용 중…';
    if(delay)timer=setTimeout(flush,delay);
    else void flush();
  }
  async function close(){
    if(busy)return;
    if(pending||saving)await flush();
    if(failed)return;
    selectMenus.close();
    if(standalone)window.close();
    else dialog.close();
  }
  $('closeSettings').onclick=close;
  preset.onchange=()=>{if(busy||preset.value==='custom')return;draft.art=presets[Number(preset.value)].art;drawArt();changed();};
  $('chooseRug').onclick=()=>{if(!busy)file.click();};
  dialog.addEventListener('cancel',event=>{event.preventDefault();void close();});
  $('clearArt').onclick=()=>{draft.art='';file.value='';drawArt();changed();};
  $('defaultSettings').onclick=()=>{fill(defaults);changed();};
  $('rugSize').oninput=()=>{$('sizeValue').value=sizeLabel(Number($('rugSize').value));changed(80);};
  $('effectSize').oninput=()=>{$('effectValue').value=$('effectSize').value+'%';changed(80);};
  $('rugSize').onchange=$('effectSize').onchange=()=>changed();
  displaySelect.onchange=()=>changed();
  $('rugLayer').onchange=$('animateReset').onchange=()=>changed();
  $('defaultSkill').onchange=()=>{void drawSkillPreview();changed();};
  file.onchange=async()=>{
    const selected=file.files[0];
    if(!selected)return;
    setBusy(true);
    let imported=false;
    try{
      draft.art=await importRugArt(selected);
      drawArt();imported=true;
    }catch(error){status.textContent=error.message;file.value='';}
    finally{setBusy(false);}
    if(imported)changed();
  };
  form.onsubmit=event=>{event.preventDefault();changed();};
  if(standalone){
    document.body.classList.add('settings-mode');
    fill(defaults);setBusy(true);dialog.show();
    nativeDesktop.onPreferences(value=>fill(value));
    nativeDesktop.onDisplays?.(items=>{displayList=items;drawDisplays();});
    Promise.all([nativeDesktop.getPreferences(),nativeDesktop.getDisplays()]).then(([value,items])=>{displayList=items;fill(value);}).catch(()=>{status.textContent='저장된 설정을 불러오지 못했습니다.';})
      .finally(()=>setBusy(false));
  }else{
    $('openSettings').onclick=()=>{
      onOpen?.();fill(getPreferences());dialog.showModal();
    };
  }
}

root.RugSettingsUI={mount};
})(typeof window!=='undefined'?window:globalThis);
