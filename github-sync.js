'use strict';
const GH_REPO='pc007ya/Kid_Storybook',GH_MANIFEST='stories/saved/library.json',GH_BASE_KEY='kid-storybook.github-base',GH_RECOVERY_KEY='kid-storybook.before-github-load';
let githubBusy=false;
function ghStatus(message){$('githubProgress').textContent=message}
async function ghRequest(path,token,method='GET',body){const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};if(token)headers.Authorization='Bearer '+token;if(body)headers['Content-Type']='application/json';let response;try{response=await fetch('https://api.github.com/repos/'+GH_REPO+path,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(120000)})}catch(e){throw Error('GitHub 連線中斷。請檢查提交紀錄後再重試，避免重複提交。')}if(!response.ok){if(response.status===401)throw Error('權杖無效或已過期。');if(response.status===403)throw Error('權限不足或 API 額度已用完，請確認此專案的 Contents 讀寫權限。');if(response.status===409||response.status===422)throw Error('遠端版本已更新或分支受保護，本次不會強制覆蓋。請重新載入或檢查 GitHub。');if(response.status===404)throw Error('找不到專案或檔案，請確認權杖可存取此專案。');throw Error('GitHub 回應錯誤（'+response.status+'）。')}return response.json()}
async function ghSnapshot(token){const ref=await ghRequest('/git/ref/heads/main',token),commit=await ghRequest('/git/commits/'+ref.object.sha,token),tree=await ghRequest('/git/trees/'+commit.tree.sha+'?recursive=1',token);if(tree.truncated)throw Error('專案檔案清單過大，無法安全確認版本。');return {head:ref.object.sha,tree:commit.tree.sha,entries:new Map(tree.tree.filter(x=>x.type==='blob').map(x=>[x.path,x.sha]))}}
function ghBytes(base64){const raw=atob(base64.replace(/\s/g,''));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function ghUploadSnapshot(snapshot,token,message,progress=ghStatus){
 const remote=await ghSnapshot(token),old=remote.entries.get(GH_MANIFEST)||'',known=localStorage.getItem(GH_BASE_KEY)||'';
 if(old!==known)throw Error('GitHub 書庫與本機基準不同。請先匯出本機備份，再載入 GitHub 版本後整合，避免蓋掉其他裝置的修改。');
 const tree=[],seen=new Map();let count=0;const total=snapshot.books.reduce((n,b)=>n+b.pages.reduce((n,p)=>n+pageImages(p).length,0),0);
 for(const b of snapshot.books)for(const p of b.pages)for(const ref of pageImages(p)){
 progress('準備圖片 '+(++count)+' / '+total);
 if(ref.asset&&remote.entries.has(ref.asset))continue;
 if(seen.has(ref.id)){ref.asset=seen.get(ref.id);continue}
 const blob=await getImageBlob(ref);if(!blob)throw Error('找不到圖片：'+ref.name);if(blob.size>50_000_000)throw Error('單張原圖超過 50 MB，請先縮小後提交。');
 const bytes=await blob.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join(''),ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'}[blob.type];if(!ext)throw Error('不支援的圖片格式：'+ref.name);
 const asset='stories/saved/images/'+hash+'.'+ext;
 if(!remote.entries.has(asset)&&!tree.some(x=>x.path===asset)){const result=await ghRequest('/git/blobs',token,'POST',{content:(await dataURL(blob)).split(',')[1],encoding:'base64'});tree.push({path:asset,mode:'100644',type:'blob',sha:result.sha})}
 ref.asset=asset;seen.set(ref.id,asset);
 }
 const content=JSON.stringify({version:1,books:snapshot.books,bookId:snapshot.bookId,pageId:snapshot.pageId,collapsed:snapshot.collapsed,deletedBooks:snapshot.deletedBooks||[]},null,2);
 const manifest=await ghRequest('/git/blobs',token,'POST',{content,encoding:'utf-8'});
 if(manifest.sha===old)return {unchanged:true,manifest:manifest.sha,head:remote.head};
 tree.push({path:GH_MANIFEST,mode:'100644',type:'blob',sha:manifest.sha});progress('建立 Git 提交…');
 const nextTree=await ghRequest('/git/trees',token,'POST',{base_tree:remote.tree,tree});
 const commit=await ghRequest('/git/commits',token,'POST',{message,tree:nextTree.sha,parents:[remote.head]});
 // A non-forced update refuses a concurrent branch change; unrelated files remain in base_tree.
 await ghRequest('/git/refs/heads/main',token,'PATCH',{sha:commit.sha,force:false});
 return {manifest:manifest.sha,head:commit.sha};
}
async function ghLoadSnapshot(token){const remote=await ghSnapshot(token),sha=remote.entries.get(GH_MANIFEST);if(!sha)throw Error('GitHub 尚未有透過此按鈕提交的書庫。');const manifest=await ghRequest('/git/blobs/'+sha,token);const incoming=validate(JSON.parse(new TextDecoder().decode(ghBytes(manifest.content))));const images=new Map();
 for(const b of incoming.books)for(const p of b.pages)for(const ref of pageImages(p)){const imageSha=remote.entries.get(ref.asset);if(!imageSha)throw Error('遠端缺少圖片：'+ref.name);if(!images.has(imageSha)){ghStatus('載入圖片 '+(images.size+1));const result=await ghRequest('/git/blobs/'+imageSha,token);const blob=new Blob([ghBytes(result.content)],{type:ref.type||'image/png'});const bitmap=await createImageBitmap(blob);bitmap.close();const id=uid();await imageStore('readwrite',s=>s.put(blob,id));images.set(imageSha,id)}ref.id=images.get(imageSha);delete ref.asset;}
 localStorage.setItem(GH_RECOVERY_KEY,JSON.stringify(state));localStorage.setItem(KEY,JSON.stringify(incoming));state=incoming;localStorage.setItem(GH_BASE_KEY,sha);applyCollapse();render();save();return remote.head;
}
$('githubOpen').onclick=()=>{$('githubToken').value='';$('githubMessage').value='更新故事書：'+book().title;ghStatus('尚未提交。目的地：'+GH_REPO+' · main');$('githubDialog').showModal()};
$('githubDialog').addEventListener('cancel',e=>{if(githubBusy)e.preventDefault()});$('githubDialog').addEventListener('close',()=>$('githubToken').value='');$('githubClose').onclick=()=>$('githubDialog').close();
async function githubAction(action){if(githubBusy)return;githubBusy=true;for(const id of ['githubCommit','githubLoad','githubRestore','githubClose','githubVerify'])$(id).disabled=true;let token=$('githubToken').value.trim();$('githubToken').value='';try{await action(token)}catch(e){ghStatus(e.message)}finally{token='';githubBusy=false;for(const id of ['githubCommit','githubLoad','githubRestore','githubClose','githubVerify'])$(id).disabled=false}}
$('githubCommit').onclick=()=>githubAction(async token=>{if(!token)throw Error('提交需要 GitHub 權杖。請僅在此網頁輸入，不要貼到對話中。');const snapshot=JSON.parse(JSON.stringify(state));const result=await ghUploadSnapshot(snapshot,token,$('githubMessage').value.trim()||'更新故事書');localStorage.setItem(GH_BASE_KEY,result.manifest);ghStatus(result.unchanged?'內容相同，不需新增提交。':'✓ 已提交到 GitHub。網頁素材部署可能需要約一分鐘。');const a=document.createElement('a');a.href='https://github.com/'+GH_REPO+'/commit/'+result.head;a.target='_blank';a.rel='noopener';a.textContent=' 查看提交紀錄';$('githubProgress').append(a)});
$('githubLoad').onclick=()=>githubAction(async token=>{await ghLoadSnapshot(token);ghStatus('✓ 已載入 GitHub 書庫。原本機書庫已保留為還原點。')});
$('githubRestore').onclick=()=>{try{const raw=localStorage.getItem(GH_RECOVERY_KEY);if(!raw)throw Error('尚無載入前的還原點。');const restored=validate(JSON.parse(raw));localStorage.setItem(KEY,JSON.stringify(restored));state=restored;localStorage.removeItem(GH_BASE_KEY);applyCollapse();render();save();ghStatus('已還原載入前的本機書庫。')}catch(e){ghStatus(e.message)}};

$('githubInspect').onclick=()=>{$('githubLayout').hidden=false;$('githubLayout').value=JSON.stringify(state,null,2)};
function layoutFingerprint(data){const copy=JSON.parse(JSON.stringify(data));delete copy.images;for(const b of copy.books)for(const p of b.pages)for(const ref of pageImages(p))delete ref.asset;return JSON.stringify(copy)}
$('githubVerify').onclick=()=>githubAction(async token=>{const remote=await ghSnapshot(token),sha=remote.entries.get(GH_MANIFEST);if(!sha)throw Error('GitHub 尚無已提交書庫。');const blob=await ghRequest('/git/blobs/'+sha,token);const saved=JSON.parse(new TextDecoder().decode(ghBytes(blob.content)));if(layoutFingerprint(saved)!==layoutFingerprint(state))throw Error('本機與 GitHub 內容不同；未修改本機資料。');localStorage.setItem(GH_BASE_KEY,sha);ghStatus('✓ 已核對：GitHub 與本機文字、版面及圖片參照一致。本機內容未變更。')});
