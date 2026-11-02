const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"]/g,c=>'&#'+c.charCodeAt(0)+';'),L={draft:'brouillon',active:'actif',blocked:'suspendu'};

let tk=sessionStorage.tk||'',D,MAXUP=24e6;
const msg=t=>$('#msg').textContent=t;
const MAXW=3072,Q=.82;
const shrink=src=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>{const w=Math.min(i.width,MAXW),c=document.createElement('canvas');c.width=w;c.height=Math.round(w*i.height/i.width);c.getContext('2d').drawImage(i,0,0,c.width,c.height);c.toBlob(b=>b?ok(b):no(),'image/jpeg',Q)};i.onerror=no;i.src=src});
const logoBlob=f=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>{const k=Math.min(1,400/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=Math.round(i.width*k);c.height=Math.round(i.height*k);c.getContext('2d').drawImage(i,0,0,c.width,c.height);c.toBlob(ok,'image/png')};i.onerror=no;i.src=URL.createObjectURL(f)});
function fillBrand(){const a=D.agencies.find(x=>x.id==$('#bg').value);if(a){$('#bc').value=a.color||'#c9a96a';$('#bf').value=a.font||'Cairo';$('#bb').value=a.bg||'#0b0b0d';$('#bt').value=a.tx||'#f2f0ec';$('#be').value=a.fx||'none'}}
const api=async(p,m,b)=>{const r=await fetch('/api/admin/'+p,{method:m||'GET',headers:{authorization:'Bearer '+tk},body:b===undefined?undefined:(b instanceof Blob?b:JSON.stringify(b))});if(r.status==401){sessionStorage.tk='';$('#app').hidden=true;$('#login').hidden=false;throw 0}return r.json()};

let nm={},sl={};
const lk=h=>h.slug?'/a/'+sl[h.agency]+'/'+h.slug:'/h/'+h.id;

async function load(){
  D=await api('list');
  MAXUP=((await api('config')).max_upload_mb||24)*1e6;
  $('#login').hidden=true;
  $('#app').hidden=false;
  $('#ags').innerHTML=D.agencies.map(a=>'<div class="r"><b>'+esc(a.name)+'</b><a href="/a/'+a.slug+'" target="_blank">/a/'+a.slug+'</a><span class="s '+a.status+'">'+L[a.status]+'</span><button data-t="agency" data-i="'+a.id+'" data-s="'+(a.status=='active'?'blocked':'active')+'">'+(a.status=='active'?'🚫 Suspendre':'✅ Activer')+'</button><button data-x="'+a.id+'">🗑</button></div>').join('')||'<p>Aucune agence pour le moment.</p>';
  $('#ag').innerHTML=D.agencies.map(a=>'<option value="'+a.id+'">'+esc(a.name)+'</option>').join('');
  const sb=$('#bg').value;$('#bg').innerHTML=$('#ag').innerHTML;if(sb)$('#bg').value=sb;fillBrand();
  
  nm={};sl={};
  D.agencies.forEach(a=>{nm[a.id]=a.name;sl[a.id]=a.slug});
  
  $('#hs').innerHTML=D.houses.map(h=>'<div class="r"><b>'+esc(h.name)+'</b><span>'+esc(nm[h.agency]||'')+' - '+h.n+' pièce'+(h.n>1?'s':'')+'</span><a dir="ltr" href="'+lk(h)+'" target="_blank">'+lk(h)+'</a><button data-qr="'+h.id+'" title="QR code et impression">📱 QR</button><button data-fb="'+h.id+'" title="Photos 360° pour Facebook">🌐</button><button data-s2="'+h.id+'">✎</button><select data-h="'+h.id+'">'+['draft','active','blocked'].map(s=>'<option value="'+s+'"'+(s==h.status?' selected':'')+'>'+L[s]+'</option>').join('')+'</select><button data-p="'+h.id+'">🗺</button><button data-d="'+h.id+'">🗑</button></div>').join('')||'<p>Aucune maison pour le moment.</p>';
}

function openQr(hid){
  const h=D.houses.find(x=>x.id==hid);
  if(!h)return;
  const fullUrl=location.origin+lk(h);
  $('#qrtitle').textContent=h.name;
  $('#qrsub').textContent=(nm[h.agency]||'')+' — Scannez le code pour ouvrir la visite';
  $('#qrlink').textContent=fullUrl;
  $('#qrarea').innerHTML='';
  
  new QRCode($('#qrarea'),{
    text:fullUrl,
    width:240,
    height:240,
    colorDark:'#0b0b0d',
    colorLight:'#ffffff',
    correctLevel:QRCode.CorrectLevel.H
  });
  
  $('#qrmodal').hidden=false;

  $('#qrdown').onclick=()=>{
    const qrImg=$('#qrarea').querySelector('img')||$('#qrarea').querySelector('canvas');
    if(!qrImg)return;
    const cv=document.createElement('canvas');
    cv.width=800;
    cv.height=1000;
    const ctx=cv.getContext('2d');
    
    // خلفية بيضاء نقية جاهزة للطباعة
    ctx.fillStyle='#ffffff';
    ctx.fillRect(0,0,cv.width,cv.height);
    
    // شريط علوي
    ctx.fillStyle='#0b0b0d';
    ctx.font='bold 36px Cairo, sans-serif';
    ctx.textAlign='center';
    ctx.fillText('MB 360° — Visite virtuelle',400,75);
    
    // اسم العقار
    ctx.fillStyle='#a67c2e';
    ctx.font='bold 32px Cairo, sans-serif';
    ctx.fillText(h.name,400,140);
    
    // اسم الوكالة
    ctx.fillStyle='#555555';
    ctx.font='22px Cairo, sans-serif';
    ctx.fillText(nm[h.agency]||'Agence immobilière',400,180);
    
    // صورة الـ QR في الوسط
    ctx.drawImage(qrImg,175,230,450,450);
    
    // دعوة للمسح
    ctx.fillStyle='#111111';
    ctx.font='bold 26px Cairo, sans-serif';
    ctx.fillText('Scannez avec votre téléphone pour la visite en direct',400,760);
    
    // الرابط
    ctx.fillStyle='#777777';
    ctx.font='18px monospace';
    ctx.fillText(fullUrl,400,815);
    
    const a=document.createElement('a');
    a.download='QR-'+(h.slug||h.id)+'.png';
    a.href=cv.toDataURL('image/png');
    a.click();
  };

  $('#qrcopy').onclick=()=>{
    navigator.clipboard.writeText(fullUrl).then(()=>alert('Lien copié !'));
  };
}

// ---- Facebook 360 : photo équirectangulaire avec les métadonnées GPano ----
// فيسبوك كيتعرّف على الصورة كـ360 غير إلا كانت فيها بيانات GPano.
function withXmp(src,w,h){
  const xmp='<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>'
   +'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
   +'<rdf:Description rdf:about="" xmlns:GPano="http://ns.google.com/photos/1.0/panorama/">'
   +'<GPano:UsePanoramaViewer>True</GPano:UsePanoramaViewer>'
   +'<GPano:ProjectionType>equirectangular</GPano:ProjectionType>'
   +'<GPano:CroppedAreaImageWidthPixels>'+w+'</GPano:CroppedAreaImageWidthPixels>'
   +'<GPano:CroppedAreaImageHeightPixels>'+h+'</GPano:CroppedAreaImageHeightPixels>'
   +'<GPano:FullPanoWidthPixels>'+w+'</GPano:FullPanoWidthPixels>'
   +'<GPano:FullPanoHeightPixels>'+h+'</GPano:FullPanoHeightPixels>'
   +'<GPano:CroppedAreaLeftPixels>0</GPano:CroppedAreaLeftPixels>'
   +'<GPano:CroppedAreaTopPixels>0</GPano:CroppedAreaTopPixels>'
   +'</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
  const body=new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0'+xmp);
  const len=body.length+2;
  const out=new Uint8Array(src.length+4+body.length);
  out.set(src.subarray(0,2),0);
  out[2]=0xFF;out[3]=0xE1;out[4]=(len>>8)&255;out[5]=len&255;
  out.set(body,6);
  out.set(src.subarray(2),6+body.length);
  return out;
}
function pano360(blob){
  return new Promise((ok,no)=>{
    const img=new Image();
    img.onload=()=>{
      const c=document.createElement('canvas');
      c.width=img.naturalWidth;c.height=img.naturalHeight;
      c.getContext('2d').drawImage(img,0,0);
      c.toBlob(async b=>{
        if(!b)return no();
        const raw=new Uint8Array(await b.arrayBuffer());
        ok(new Blob([withXmp(raw,c.width,c.height)],{type:'image/jpeg'}));
      },'image/jpeg',.9);
    };
    img.onerror=no;
    img.src=URL.createObjectURL(blob);
  });
}
async function export360(hid){
  const h=await api('house/'+hid),rooms=h.rooms||[];
  if(!rooms.length)return alert('Aucune pièce à exporter');
  if(!confirm('Exporter '+rooms.length+' photo(s) 360° pour Facebook ?\n\nCe sont des copies : une fois publiées, bloquer la maison ici ne les retire pas de Facebook.'))return;
  let i=0;
  for(const r of rooms){
    try{
      const jpg=await pano360(await (await fetch(r.image)).blob());
      const a=document.createElement('a');
      a.download='360-'+(h.slug||h.id)+'-'+String(r.name||r.id).replace(/[^\w-]+/g,'_')+'.jpg';
      a.href=URL.createObjectURL(jpg);a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),5000);
      msg('Export 360°… '+(++i)+' / '+rooms.length);
      await new Promise(x=>setTimeout(x,700));
    }catch(e){alert('Échec pour '+(r.name||r.id))}
  }
  msg('Photos 360° prêtes : publiez-les sur Facebook, elles s’ouvrent en 360° dans le fil.');
}
$('#qrclose').onclick=()=>{$('#qrmodal').hidden=true};

document.addEventListener('click',async e=>{
  const b=e.target;
  if(b.dataset.qr) openQr(b.dataset.qr);
  if(b.dataset.fb) export360(b.dataset.fb);
  if(b.dataset.t){await api('status','POST',{type:b.dataset.t,id:b.dataset.i,status:b.dataset.s});load()}
  if(b.dataset.p)editPlan(b.dataset.p);
  if(b.dataset.s2){const s=prompt('Nouvel identifiant de la maison (lettres, chiffres et -)');if(s){const r=await api('slug','POST',{id:b.dataset.s2,slug:s});if(r.e)alert('Identifiant déjà utilisé ou invalide');load()}}
  if(b.dataset.x&&confirm('Supprimer définitivement cette agence ?')){const r=await api('delagency/'+b.dataset.x,'POST',{});if(r.e)alert("Supprimez d'abord les maisons de cette agence");load()}
  if(b.dataset.d&&confirm('Supprimer définitivement cette maison ?')){await api('del/'+b.dataset.d,'POST',{});load()}
});

document.addEventListener('change',async e=>{if(e.target.dataset.h){await api('status','POST',{type:'house',id:e.target.dataset.h,status:e.target.value});load()}});
$('#go').onclick=async()=>{tk=$('#tk').value.trim();sessionStorage.tk=tk;
try{await load()}catch(e){
  let m='Mot de passe incorrect';
  try{const h=await (await fetch('/api/admin/ping')).json();if(!h.configured)m="Le serveur n'utilise pas ADMIN_TOKEN (mot de passe par défaut actif). Définissez ADMIN_TOKEN sur Vercel puis redéployez."}catch(_){}
  alert(m);
}};
$('#aa').onclick=async()=>{const r=await api('agency','POST',{name:$('#an').value.trim(),slug:$('#as').value.trim()});if(r.e)return alert('Nom ou identifiant manquant ou déjà utilisé');$('#an').value=$('#as').value='';load()};
$('#up').onclick=async()=>{const f=$('#jf').files[0],ag=$('#ag').value;if(!f||!ag)return alert("Choisissez le fichier et l'agence");
try{const j=JSON.parse(await f.text()),h=await api('house','POST',{agency:ag,name:j.name,slug:$('#hsg').value.trim()}),rooms=[];let i=0;
for(const r of j.rooms){msg('Envoi '+(++i)+' / '+j.rooms.length+' ...');let img=r.image;if(img.startsWith('data:')){await api('img/'+h.id+'/'+r.id,'PUT',await shrink(img));img='/img/'+h.id+'/'+r.id}
rooms.push({id:r.id,name:r.name,image:img,dims:r.dims,lon0:r.lon0,desc:r.desc,hotspots:r.hotspots,infos:r.infos})}
await api('data/'+h.id,'POST',rooms);msg('Import terminé. La maison est en « brouillon » : personne ne la voit avant activation.');load()}catch(x){msg("Échec de l'import : vérifiez que le fichier est un export valide")}};

let E;const snap=v=>Math.round(v*4)/4;
async function editPlan(id){const h=await api('house/'+id);h.rooms.forEach(r=>{r.dims=r.dims||[6,8,2.6];r.hotspots=r.hotspots||[]});const L=autoLayout(h.rooms,h.plan),dims={};h.rooms.forEach(r=>dims[r.id]=r.dims.slice());
E={id,rs:L.rs,by:L.by,dr:L.dr,dims,sel:null,mode:0,vb:null};$('#pt').textContent=h.name;$('#pe').hidden=false;pdraw(1)}
function pdraw(fit,noinp){const rs=E.rs;if(fit||!E.vb){const x0=Math.min(...rs.map(r=>r.x-r.w/2))-2,z0=Math.min(...rs.map(r=>r.z-r.l/2))-2;E.vb=[x0,z0,Math.max(...rs.map(r=>r.x+r.w/2))+2-x0,Math.max(...rs.map(r=>r.z+r.l/2))+2-z0]}
$('#pc').setAttribute('viewBox',E.vb.join(' '));
$('#pc').innerHTML='<defs><pattern id="gp" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="rgba(255,255,255,.1)" stroke-width=".02"/></pattern></defs><rect class="gr" x="-300" y="-300" width="600" height="600"/>'
+rs.map(r=>'<rect data-id="'+r.id+'" class="'+(E.sel==r.id?'on':'')+'" x="'+(r.x-r.w/2)+'" y="'+(r.z-r.l/2)+'" width="'+r.w+'" height="'+r.l+'"/><text x="'+r.x+'" y="'+r.z+'">'+esc(r.n)+' - '+r.w+'×'+r.l+'</text>').join('')
+E.dr.map((q,i)=>q[2]=='v'?'<line class="dr" data-di="'+i+'" x1="'+q[0]+'" y1="'+(q[1]-.6)+'" x2="'+q[0]+'" y2="'+(q[1]+.6)+'"/>':'<line class="dr" data-di="'+i+'" x1="'+(q[0]-.6)+'" y1="'+q[1]+'" x2="'+(q[0]+.6)+'" y2="'+q[1]+'"/>').join('');
const r=E.by[E.sel];if(r&&!noinp){$('#pw').value=r.w;$('#pl2').value=r.l;$('#ph').value=E.dims[r.id][2]}}
const pc=$('#pc');let dg=null;
const spt=e=>{const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(pc.getScreenCTM().inverse());return[p.x,p.y]};
pc.onpointerdown=e=>{if(!E)return;const[px,pz]=spt(e),t=e.target;
if(t.dataset.di!==undefined){E.dr.splice(+t.dataset.di,1);return pdraw()}
if(E.mode){let best=null;E.rs.forEach(r=>{[[r.x-r.w/2,'v',1],[r.x+r.w/2,'v',1],[r.z-r.l/2,'h',0],[r.z+r.l/2,'h',0]].forEach(([c,o,ix])=>{const ins=ix?(pz>=r.z-r.l/2&&pz<=r.z+r.l/2):(px>=r.x-r.w/2&&px<=r.x+r.w/2),dd=Math.abs((ix?px:pz)-c);if(ins&&(!best||dd<best.d))best={d:dd,c,o}})});
if(best&&best.d<1.5){E.dr.push(best.o=='v'?[best.c,snap(pz),'v']:[snap(px),best.c,'h']);pdraw()}return}
if(t.dataset.id){E.sel=t.dataset.id;const r=E.by[E.sel];dg={r,ox:px-r.x,oz:pz-r.z,carry:E.dr.filter(q=>q[2]=='v'?(Math.abs(q[0]-r.x-r.w/2)<.05||Math.abs(q[0]-r.x+r.w/2)<.05)&&Math.abs(q[1]-r.z)<=r.l/2+.05:(Math.abs(q[1]-r.z-r.l/2)<.05||Math.abs(q[1]-r.z+r.l/2)<.05)&&Math.abs(q[0]-r.x)<=r.w/2+.05)};pc.setPointerCapture(e.pointerId);pdraw()}};
pc.onpointermove=e=>{if(!dg)return;const[px,pz]=spt(e),nx=snap(px-dg.ox),nz=snap(pz-dg.oz),dx=nx-dg.r.x,dz=nz-dg.r.z;dg.carry.forEach(q=>{q[0]+=dx;q[1]+=dz});dg.r.x=nx;dg.r.z=nz;pdraw(0,1)};
pc.onpointerup=pc.onpointercancel=()=>{dg=null};
['pw','pl2','ph'].forEach(i=>$('#'+i).oninput=()=>{const r=E&&E.by[E.sel];if(!r)return;const a=parseFloat($('#pw').value),b=parseFloat($('#pl2').value),c=parseFloat($('#ph').value);if(a>=1)r.w=E.dims[r.id][0]=a;if(b>=1)r.l=E.dims[r.id][1]=b;if(c>=1)E.dims[r.id][2]=c;pdraw(0,1)});
$('#pdoor').onclick=()=>{E.mode=!E.mode;$('#pdoor').classList.toggle('g',!!E.mode)};$('#pfit').onclick=()=>pdraw(1);$('#pclose').onclick=()=>{$('#pe').hidden=true;E=null};
$('#psave').onclick=async()=>{const r={};E.rs.forEach(q=>r[q.id]={x:q.x,z:q.z});const x=await api('plan/'+E.id,'POST',{plan:{r,d:E.dr},dims:E.dims});alert(x.ok?'Plan enregistré':"Échec de l'enregistrement");load()};
$('#bg').onchange=fillBrand;
$('#bs').onclick=async()=>{const id=$('#bg').value;if(!id)return alert("Ajoutez d'abord une agence");try{const f=$('#lf').files[0];if(f)await api('logo/'+id,'POST',await logoBlob(f));const k=$('#bk').files[0];if(k){if(k.size>MAXUP)return alert('Fichier trop lourd (max '+Math.floor(MAXUP/1e6)+' Mo), choisissez un fichier plus léger');await api('bg/'+id,'POST',k)}await api('brand','POST',{id,color:$('#bc').value,font:$('#bf').value,logo:!!f,bg:$('#bb').value,tx:$('#bt').value,fx:$('#be').value,bgt:k?k.type:''});const a=D.agencies.find(x=>x.id==id);Object.assign(a,{color:$('#bc').value,font:$('#bf').value,bg:$('#bb').value,tx:$('#bt').value,fx:$('#be').value});if(f)a.logo=1;if(k)a.bgType=k.type;$('#msg2').textContent="Identité enregistrée. Elle apparaît sur les pages de l'agence sous une minute environ.";$('#lf').value='';$('#bk').value=''}catch(x){$("#msg2").textContent="Échec de l'enregistrement"}};
if(tk)load().catch(()=>{});
