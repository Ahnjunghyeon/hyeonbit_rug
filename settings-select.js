/* Settings-only listboxes. Native selects remain the source of saved values. */
(function(root){
  'use strict';
  function enhance(dialog){
    const doc=dialog.ownerDocument,win=doc.defaultView;
    let opened=null;
    const controls=[];
    function close(focus=false){
      if(!opened)return;
      const c=opened;opened=null;
      if(c.topLayer){c.menu.hidePopover();c.topLayer=false;}
      c.menu.hidden=true;c.button.setAttribute('aria-expanded','false');
      c.button.removeAttribute('aria-activedescendant');
      if(focus&&!c.button.disabled)c.button.focus();
    }
    for(const select of dialog.querySelectorAll('select')){
      if(select.dataset.rugSelect)continue;
      select.dataset.rugSelect='true';
      const button=doc.createElement('button'),text=doc.createElement('span');
      button.type='button';button.id=select.id+'-trigger';button.className='rug-select-trigger';
      button.setAttribute('role','combobox');button.setAttribute('aria-haspopup','listbox');
      button.setAttribute('aria-expanded','false');
      const label=select.labels?.[0];
      const caption=select.getAttribute('aria-label')||(label?Array.from(label.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' '):select.id);
      button.setAttribute('aria-label',caption);button.append(text);
      if(label)label.htmlFor=button.id;
      const menu=doc.createElement('div');menu.className='rug-select-menu';
      menu.id=select.id+'-listbox';menu.setAttribute('role','listbox');menu.setAttribute('aria-label',caption);
      menu.setAttribute('popover','manual');menu.hidden=true;
      button.setAttribute('aria-controls',menu.id);
      select.after(button);dialog.append(menu);
      select.hidden=true;select.tabIndex=-1;select.setAttribute('aria-hidden','true');
      const c={select,button,menu,text,items:[],active:-1};controls.push(c);
      function place(){
        const r=button.getBoundingClientRect(),gap=6,pad=10;
        // Prefer downward opening; reserve the native caption area at all times.
        const caption=doc.body.classList.contains('settings-mode')?44:pad;
        const width=Math.min(Math.max(r.width,320),win.innerWidth-pad*2);
        const top=Math.max(caption,Math.min(r.bottom+gap,win.innerHeight-120));
        menu.style.width=width+'px';
        menu.style.maxHeight=Math.max(48,Math.min(300,win.innerHeight-top-pad))+'px';
        menu.style.left=Math.max(pad,Math.min(r.left,win.innerWidth-width-pad))+'px';
        menu.style.top=top+'px';
      }
      function active(index){
        c.active=index;
        c.items.forEach((item,i)=>item.classList.toggle('is-active',i===index));
        if(index>=0){
          const item=c.items[index];button.setAttribute('aria-activedescendant',item.id);
          // Scroll only this list, never the settings dialog behind the popup.
          if(item.offsetTop<menu.scrollTop)menu.scrollTop=item.offsetTop;
          else if(item.offsetTop+item.offsetHeight>menu.scrollTop+menu.clientHeight)menu.scrollTop=item.offsetTop+item.offsetHeight-menu.clientHeight;
        }
      }
      function enabled(){return Array.from(select.options).map((o,i)=>!o.disabled&&!o.parentElement?.disabled?i:-1).filter(i=>i>=0);}
      function refresh(){
        button.disabled=select.disabled;
        text.textContent=select.selectedOptions[0]?.textContent||'선택해 주세요';
        button.title=text.textContent;
        if(opened===c)close();
      }
      c.refresh=refresh;
      function open(){
        if(button.disabled)return;
        if(opened===c)return;
        close();opened=c;menu.replaceChildren();
        c.items=Array.from(select.options,(option,i)=>{
          const item=doc.createElement('div');item.id=menu.id+'-'+i;item.className='rug-select-option';
          item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.selected));
          item.setAttribute('aria-disabled',String(option.disabled||!!option.parentElement?.disabled));
          item.textContent=option.textContent;item.title=option.textContent;
          item.addEventListener('pointerdown',event=>event.preventDefault());
          item.addEventListener('pointermove',()=>{if(enabled().includes(i))active(i);});
          item.addEventListener('click',()=>commit(i));menu.append(item);return item;
        });
        menu.hidden=false;
        if(typeof menu.showPopover==='function'){menu.showPopover();c.topLayer=true;}
        button.setAttribute('aria-expanded','true');place();
        active(enabled().includes(select.selectedIndex)?select.selectedIndex:enabled()[0]??-1);
      }
      function commit(index){
        if(!enabled().includes(index))return;
        const changed=select.selectedIndex!==index;select.selectedIndex=index;
        close(true);refresh();
        if(changed){select.dispatchEvent(new win.Event('input',{bubbles:true}));select.dispatchEvent(new win.Event('change',{bubbles:true}));}
      }
      button.addEventListener('click',()=>{if(opened===c)close();else open();});
      let typed='',typedAt=0;
      button.addEventListener('keydown',event=>{
        const keys=['ArrowDown','ArrowUp','Home','End','Enter',' ','Escape','Tab'];
        if(keys.includes(event.key)){
          if(event.key==='Tab'){close();return;}
          if(event.key==='Escape'){if(opened===c){event.preventDefault();event.stopPropagation();close(true);}return;}
          event.preventDefault();
          if(event.key==='Enter'||event.key===' '){if(opened===c)commit(c.active);else open();return;}
          const wasOpen=opened===c;open();const choices=enabled();if(!choices.length)return;
          if(event.key==='Home')active(choices[0]);
          else if(event.key==='End')active(choices[choices.length-1]);
          else if(wasOpen){const step=event.key==='ArrowDown'?1:-1;active(choices[Math.max(0,Math.min(choices.length-1,choices.indexOf(c.active)+step))]);}
          return;
        }
        if(event.key.length===1&&!event.ctrlKey&&!event.altKey&&!event.metaKey){
          event.preventDefault();open();const now=Date.now();typed=now-typedAt<700?typed+event.key:event.key;typedAt=now;
          const found=enabled().find(i=>select.options[i].textContent.trim().toLocaleLowerCase().startsWith(typed.toLocaleLowerCase()));
          if(found!==undefined)active(found);
        }
      });
      select.addEventListener('change',refresh);
      new win.MutationObserver(refresh).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','label','selected']});
      refresh();
    }
    doc.addEventListener('pointerdown',event=>{if(opened&&!opened.button.contains(event.target)&&!opened.menu.contains(event.target))close();},true);
    doc.addEventListener('focusin',event=>{if(opened&&!opened.button.contains(event.target)&&!opened.menu.contains(event.target))close();});
    doc.addEventListener('scroll',event=>{if(opened&&!opened.menu.contains(event.target))close();},true);
    win.addEventListener('resize',()=>close());
    dialog.addEventListener('close',()=>close());
    dialog.addEventListener('cancel',()=>close());
    return {refresh(){controls.forEach(c=>c.refresh());},close};
  }
  root.RugSettingsSelect={enhance};
})(typeof window==='undefined'?globalThis:window);
