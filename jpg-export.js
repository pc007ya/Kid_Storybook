'use strict';
function safeFileName(value){let name=String(value||'未命名').normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/[. ]+$/g,'').trim().slice(0,80);if(!name)name='未命名';if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))name='_'+name;return name}
async function jpgImage(ref,urls){if(!urls.has(ref.id)){const blob=await getImageBlob(ref);if(!blob)throw Error('缺少圖片：'+ref.name);urls.set(ref.id,URL.createObjectURL(blob))}const img=document.createElement('img');img.src=urls.get(ref.id);img.alt=ref.name;await img.decode();return img}
async function renderJpgPage(p,w,h,quality,urls){
 prepareLayers(p);const frame=document.createElement('div');frame.className='jpg-render-frame';frame.style.cssText=`position:fixed;left:-20000px;top:0;width:${w}px;height:${h}px;overflow:hidden;background:white;container-type:inline-size;pointer-events:none;box-sizing:border-box;`;
 try{
 if(p.image){const img=await jpgImage(p.image,urls);img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:'+p.fit;frame.append(img)}
 for(const [i,id] of p.layerOrder.entries()){const l=id==='base'?p:p.layers.find(l=>l.id===id),el=document.createElement('div');positionLayer(el,l,i);if(l.type==='image'&&l.image){const img=await jpgImage(l.image,urls);img.style.cssText='width:100%;height:100%;object-fit:contain';el.append(img)}else el.append(textNode(l));frame.append(el)}
 document.body.append(frame);await document.fonts.ready;
 // Resolve container-relative lengths before passing the layout to the rasterizer.
 const properties=['font-size','line-height','padding-top','padding-right','padding-bottom','padding-left','margin-top','margin-right','margin-bottom','margin-left','border-top-width','border-right-width','border-bottom-width','border-left-width','border-top-left-radius','border-top-right-radius','border-bottom-left-radius','border-bottom-right-radius','bottom'];
 const resolved=[...frame.querySelectorAll('*')].map(el=>{const cs=getComputedStyle(el);return [el,properties.map(k=>[k,cs.getPropertyValue(k)])]});for(const [el,values] of resolved)for(const [k,v] of values)el.style.setProperty(k,v);
 // html2canvas does not implement object-fit: lay out images explicitly instead.
 for(const img of frame.querySelectorAll('img')){const parent=img.parentElement,pw=parent.clientWidth,ph=parent.clientHeight||img.clientHeight,fit=img.style.objectFit||'contain',scale=(fit==='cover'?Math.max:Math.min)(pw/img.naturalWidth,ph/img.naturalHeight);img.style.cssText=`position:absolute;width:${img.naturalWidth*scale}px;height:${img.naturalHeight*scale}px;left:${(pw-img.naturalWidth*scale)/2}px;top:${(ph-img.naturalHeight*scale)/2}px;max-width:none;`;if(parent!==frame)parent.style.overflow='hidden'}
 const canvas=await html2canvas(frame,{scale:1,width:w,height:h,backgroundColor:'#ffffff',logging:false,windowWidth:Math.max(w,window.innerWidth),windowHeight:Math.max(h,window.innerHeight)});
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));canvas.width=canvas.height=1;if(!blob)throw Error('JPG 轉換失敗');return new Uint8Array(await blob.arrayBuffer());
 }finally{frame.remove()}
}
let lastJpgZipURL,lastJpgPreviewURL;
$('exportJPG').onclick=async()=>{
 const button=$('exportJPG'),urls=new Map();button.disabled=true;
 try{
 const current=JSON.parse(JSON.stringify(book())),[w,h]=current.pageSize.split('x').map(Number),title=safeFileName(current.title);let zip,firstJpg;
 for(const quality of [.92,.82,.68,.5]){const files={};let index=0;for(const p of current.pages){button.textContent=`JPG ${++index}/${current.pages.length}`;const name=`${title}/${title}_${String(index).padStart(3,'0')}_${safeFileName(p.title)}.jpg`;files[name]=await renderJpgPage(p,w,h,quality,urls);if(index===1)firstJpg=files[name]}zip=fflate.zipSync(files,{level:0});if(zip.byteLength<=HTML_LIMIT)break}
 if(zip.byteLength>HTML_LIMIT)throw Error('ZIP 壓縮後仍超過 50 MB，請減少頁數或調整尺寸後重試。');
 if(lastJpgZipURL)URL.revokeObjectURL(lastJpgZipURL);lastJpgZipURL=URL.createObjectURL(new Blob([zip],{type:'application/zip'}));const filename=`${title}_${w}x${h}_JPG.zip`,a=document.createElement('a');a.href=lastJpgZipURL;a.download=filename;a.click();$('exportResult').replaceChildren();const link=document.createElement('a');link.href=lastJpgZipURL;link.download=filename;link.textContent=`下載 ${filename}（${current.pages.length} 張 · ${(zip.byteLength/1e6).toFixed(2)} MB）`;$('exportResult').append(link);if(lastJpgPreviewURL)URL.revokeObjectURL(lastJpgPreviewURL);lastJpgPreviewURL=URL.createObjectURL(new Blob([firstJpg],{type:'image/jpeg'}));const preview=document.createElement('img');preview.src=lastJpgPreviewURL;preview.alt='匯出 JPG 第一頁預覽';preview.style.cssText='display:block;width:180px;max-width:100%;height:auto;margin:10px auto';$('exportResult').append(preview);toast(`已匯出 ${current.pages.length} 張 ${w} × ${h} JPG，包含文字與圖層。`);
 }catch(e){toast('JPG ZIP 匯出失敗：'+e.message)}finally{for(const url of urls.values())URL.revokeObjectURL(url);button.disabled=false;button.textContent='匯出 JPG ZIP'}
};
