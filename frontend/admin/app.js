const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"]/g,c=>'&#'+c.charCodeAt(0)+';'),L={draft:'brouillon',active:'actif',blocked:'suspendu'};
const AGENCY_MODE=(location.pathname.startsWith('/agency')||new URLSearchParams(location.search).has('t'));
const API_BASE=AGENCY_MODE?'/api/agency/':'/api/admin/';

let tk=AGENCY_MODE?(new URLSearchParams(location.search).get('t')||sessionStorage.at||''):(sessionStorage.tk||''),D,MAXUP=24e6;
const msg=t=>$('#msg').textContent=t;
const MAXW=3072,Q=.82;
const shrink=src=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>{const w=Math.min(i.width,MAXW),c=document.createElement('canvas');c.width=w;c.height=Math.round(w*i.height/i.width);c.getContext('2d').drawImage(i,0,0,c.width,c.height);c.toBlob(b=>b?ok(b):no(),'image/jpeg',Q)};i.onerror=no;i.src=src});
const logoBlob=f=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>{const k=Math.min(1,400/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=Math.round(i.width*k);c.height=Math.round(i.height*k);c.getContext('2d').drawImage(i,0,0,c.width,c.height);c.toBlob(ok,'image/png')};i.onerror=no;i.src=URL.createObjectURL(f)});
function fillBrand(){const a=D.agencies.find(x=>x.id==$('#bg').value);if(a){$('#bc').value=a.color||'#c9a96a';$('#bf').value=a.font||'Cairo';$('#bb').value=a.bg||'#0b0b0d';$('#bt').value=a.tx||'#f2f0ec';$('#be').value=a.fx||'none'}}
const api=async(p,m,b)=>{const r=await fetch(API_BASE+p,{method:m||'GET',headers:{authorization:'Bearer '+tk},body:b===undefined?undefined:(b instanceof Blob?b:JSON.stringify(b))});if(r.status==401){sessionStorage.tk='';$('#app').hidden=true;$('#login').hidden=false;throw 0}return r.json()};

let nm={},sl={},FQ='',LQ='',MY_AGENCY=null;
const lk=h=>h.slug?'/a/'+sl[h.agency]+'/'+h.slug:'/h/'+h.id;

const S='fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const ICO={
  out:'<svg viewBox="0 0 24 24" '+S+'><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>',
  pause:'<svg viewBox="0 0 24 24" '+S+'><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  play:'<svg viewBox="0 0 24 24" '+S+'><path d="M7 4l13 8-13 8z"/></svg>',
  trash:'<svg viewBox="0 0 24 24" '+S+'><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>',
  qr:'<svg viewBox="0 0 24 24" '+S+'><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/><path d="M21 21h-3M21 17v-3M17 21h-3"/></svg>',
  globe:'<svg viewBox="0 0 24 24" '+S+'><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z"/></svg>',
  pencil:'<svg viewBox="0 0 24 24" '+S+'><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  map:'<svg viewBox="0 0 24 24" '+S+'><path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3z"/><path d="M9 3v15M15 6v15"/></svg>',
  info:'<svg viewBox="0 0 24 24" '+S+'><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.6h.01"/></svg>',
  eye:'<svg viewBox="0 0 24 24" '+S+'><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
  phone:'<svg viewBox="0 0 24 24" '+S+'><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.25a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.9z"/></svg>',
  check:'<svg viewBox="0 0 24 24" '+S+'><path d="M20 6 9 17l-5-5"/></svg>',
  mail:'<svg viewBox="0 0 24 24" '+S+'><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>'
};

function toast(text,kind){
  const t=document.createElement('div');
  t.className='tst '+(kind||'');
  t.textContent=text;
  $('#toast').appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transform='translateY(6px)';t.style.transition='.25s';setTimeout(()=>t.remove(),260)},3200);
}

function renderStats(){
  const on=D.houses.filter(h=>h.status=='active').length;
  const dr=D.houses.filter(h=>h.status=='draft').length;
  const st=D.stats||{views:0,today:0,leads:0,leadsNew:0};
  $('#stats').innerHTML=
    '<div class="stat"><b>'+D.agencies.length+'</b><span>Agences</span></div>'+
    '<div class="stat"><b>'+D.houses.length+'</b><span>Maisons</span></div>'+
    '<div class="stat ok"><b>'+on+'</b><span>En ligne</span></div>'+
    '<div class="stat"><b>'+st.views+'</b><span>Vues totales</span></div>'+
    '<div class="stat"><b>'+st.today+'</b><span>Vues aujourd\'hui</span></div>'+
    '<div class="stat gold"><b>'+st.leads+'</b><span>Demandes</span>'+(st.leadsNew?'<small>'+st.leadsNew+' nouvelle(s)</small>':'')+'</div>';
  const nb=document.querySelector('#nav a[href="#s-leads"]');
  if(nb){const old=nb.querySelector('.nb');if(old)old.remove();
    if(st.leadsNew){const b=document.createElement('span');b.className='nb';b.textContent=st.leadsNew;nb.appendChild(b)}}
}

function ago(ts){
  const s=Math.max(0,Math.floor(Date.now()/1000)-ts);
  if(s<60)return "à l'instant";
  if(s<3600)return 'il y a '+Math.floor(s/60)+' min';
  if(s<86400)return 'il y a '+Math.floor(s/3600)+' h';
  if(s<604800)return 'il y a '+Math.floor(s/86400)+' j';
  return new Date(ts*1000).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
}
function fdate(d){
  try{return new Date(d+'T00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})}catch(_) {return d}
}

function renderLeads(){
  const q=LQ.trim().toLowerCase();
  const rows=(D.leads||[]).filter(r=>!q||(r.name+' '+r.phone+' '+(r.houseName||'')+' '+(r.agencyName||'')).toLowerCase().includes(q));
  $('#ls').innerHTML=rows.map(r=>{
    const ini=esc((r.name||'?').trim().slice(0,2).toUpperCase());
    const h=D.houses.find(x=>x.id==r.house);
    const link=h?lk(h):'/h/'+esc(r.house);
    const wa='https://wa.me/'+esc(r.phoneDigits||r.phone.replace(/\D/g,''))+'?text='+encodeURIComponent('Bonjour '+r.name+', je vous recontacte pour '+r.houseName+' sur MB 360°.');
    return '<div class="lrow'+(r.done?' done':'')+'">'
      +'<div class="ava">'+ini+'</div>'
      +'<div class="meta"><b>'+esc(r.name)+'<span class="when">'+ago(r.at||0)+'</span></b>'
        +'<span>'+esc(r.houseName||'')+' · '+esc(r.agencyName||'')+'</span>'
        +'<a class="lnk" dir="ltr" href="'+link+'" target="_blank" rel="noreferrer">'+link+'</a>'
        +(r.date?'<p class="pref">Visite souhaitée : '+fdate(r.date)+'</p>':'')
        +(r.msg?'<p class="msg">'+esc(r.msg)+'</p>':'')
        +'<span dir="ltr">'+esc(r.phone)+'</span></div>'
      +'<span class="pill '+(r.done?'active':'blocked')+'">'+(r.done?'Contacté':'Nouveau')+'</span>'
      +'<div class="acts">'
        +'<a class="btn icon" href="'+wa+'" target="_blank" rel="noreferrer" title="Répondre sur WhatsApp">'+ICO.phone+'</a>'
        +'<a class="btn icon" href="tel:+'+esc(r.phoneDigits||r.phone.replace(/\D/g,''))+'" title="Appeler">'+ICO.phone+'</a>'
        +'<button class="btn icon" data-ld="'+r.id+'" data-done="'+(r.done?0:1)+'" title="'+(r.done?'Marquer comme nouveau':'Marquer comme contacté')+'">'+ICO.check+'</button>'
        +'<button class="btn icon danger" data-ldel="'+r.id+'" title="Supprimer">'+ICO.trash+'</button>'
      +'</div></div>';
  }).join('')||'<div class="empty">'+(q?'Aucun résultat pour « '+esc(LQ)+' ».':'Aucune demande pour le moment. Les demandes des visiteurs apparaîtront ici.')+'</div>';
}

function renderAgencies(){
  if(AGENCY_MODE){$('#ags').innerHTML='';return}
  $('#ags').innerHTML=D.agencies.map(a=>{
    const ini=esc((a.name||'?').trim().slice(0,2).toUpperCase());
    return '<div class="arow">'
      +'<div class="ava">'+ini+'</div>'
      +'<div class="meta"><b>'+esc(a.name)+'</b><span dir="ltr">/a/'+esc(a.slug)+'</span></div>'
      +'<span class="pill '+a.status+'">'+L[a.status]+'</span>'
      +'<div class="acts">'
        +'<a class="btn icon" href="/a/'+esc(a.slug)+'" target="_blank" rel="noreferrer" title="Ouvrir la plateforme">'+ICO.out+'</a>'
        +'<button class="btn icon" data-t="agency" data-i="'+a.id+'" data-s="'+(a.status=='active'?'blocked':'active')+'" title="'+(a.status=='active'?'Suspendre':'Activer')+'">'+(a.status=='active'?ICO.pause:ICO.play)+'</button>'
        +'<button class="btn icon" data-agencylink="'+a.id+'" title="Copier le lien d acces de l agence">'+ICO.mail+'</button>'
        +'<button class="btn icon danger" data-x="'+a.id+'" title="Supprimer">'+ICO.trash+'</button>'
      +'</div></div>';
  }).join('')||'<div class="empty">Aucune agence pour le moment.</div>';
}

function renderHouses(){
  const q=FQ.trim().toLowerCase();
  const rows=D.houses.filter(h=>!q||(h.name+' '+(nm[h.agency]||'')+' '+(h.slug||'')).toLowerCase().includes(q));
  $('#hs').innerHTML=rows.map(h=>{
    const live=h.status=='active'&&h.cover;
    return '<div class="hrow">'
      +'<div class="thumb'+(live?'':' ph')+'"'+(live?' style="background-image:url('+esc(h.cover)+')"':'')+'></div>'
      +'<div class="meta"><b>'+esc(h.name)+'</b>'
        +'<span>'+esc(nm[h.agency]||'')+' · '+h.n+' pièce'+(h.n>1?'s':'')+(h.price?' · '+esc(h.price):'')+'</span>'
        +'<a class="lnk" dir="ltr" href="'+lk(h)+'" target="_blank" rel="noreferrer">'+lk(h)+'</a>'
        +'<span class="biz">'+ICO.eye+' '+(h.views||0)+' vue'+((h.views||0)>1?'s':'')+(h.today?' · '+h.today+' aujourd\'hui':'')+'</span>'
        +(h.leads?'<button class="biz gold" data-lfh="'+esc(h.name)+'" title="Voir les demandes">'+ICO.mail+' '+h.leads+' demande'+(h.leads>1?'s':'')+'</button>':'')
        +'</div>'
      +'<div class="acts">'
        +'<button class="btn icon'+(h.desc?' has':'')+'" data-inf="'+h.id+'" title="'+(h.desc?'Modifier la description et les informations':'Ajouter une description')+'">'+ICO.info+'</button>'
        +'<button class="btn icon" data-qr="'+h.id+'" title="QR code et impression">'+ICO.qr+'</button>'
        +'<button class="btn icon" data-fb="'+h.id+'" title="Photos 360° pour Facebook">'+ICO.globe+'</button>'
        +'<button class="btn icon" data-s2="'+h.id+'" title="Modifier l\'identifiant">'+ICO.pencil+'</button>'
        +'<button class="btn icon" data-p="'+h.id+'" title="Plan des pièces">'+ICO.map+'</button>'
        +'<button class="btn icon danger" data-d="'+h.id+'" title="Supprimer">'+ICO.trash+'</button>'
      +'</div>'
      +'<select class="sel" data-h="'+h.id+'">'+['draft','active','blocked'].map(s=>'<option value="'+s+'"'+(s==h.status?' selected':'')+'>'+L[s]+'</option>').join('')+'</select>'
      +'</div>';
  }).join('')||'<div class="empty">'+(q?'Aucun résultat pour « '+esc(FQ)+' ».':'Aucune maison pour le moment.')+'</div>';
}

async function load(){
  if(AGENCY_MODE){
    if(!tk){$('#login').hidden=false;$('#app').hidden=true;return}
    sessionStorage.at=tk;
    D=await api('me');
    MAXUP=((await api('config')).max_upload_mb||24)*1e6;
    MY_AGENCY=D.agency;
    D.agencies=[D.agency];
    D.stats=D.stats||{views:0,today:0,leads:0,leadsNew:0};
    nm={};sl={};nm[D.agency.id]=D.agency.name;sl[D.agency.id]=D.agency.slug;
    $('#login').hidden=true;$('#app').hidden=false;
    const sa=document.querySelector('#s-agencies');if(sa)sa.hidden=true;
    const navAg=document.querySelector('#nav a[href="#s-agencies"]');if(navAg)navAg.hidden=true;
    renderStats();renderAgencies();renderHouses();renderLeads();
    $('#ag').innerHTML='<option value="'+D.agency.id+'">'+esc(D.agency.name)+'</option>';
    $('#bg').innerHTML='<option value="'+D.agency.id+'">'+esc(D.agency.name)+'</option>';
    $('#bg').value=D.agency.id;fillBrand();
    const vs=$('#view-site');vs.href='/a/'+D.agency.slug;vs.hidden=false;vs.textContent="Voir ma plateforme ↗";
    document.title='Espace agence — '+D.agency.name;
    const h1=document.querySelector('.topbar h1');if(h1)h1.textContent='Bonjour, '+D.agency.name;
    const p=document.querySelector('.topbar p');if(p)p.textContent='Gérez vos biens, vos demandes et votre identité.';
    if(!document.querySelector('#rotatetok')){
      const b=document.createElement('button');b.id='rotatetok';b.className='btn ghost';b.textContent="Régénérer le lien d'accès";
      b.onclick=async()=>{if(!confirm("Régénérer le lien ? L'ancien lien cessera de fonctionner."))return;
        const r=await api('token/rotate','POST',{});if(r.token){tk=r.token;sessionStorage.at=tk;const u=new URL(location.href);u.searchParams.set('t',tk);history.replaceState({},'',u);toast('Nouveau lien généré — copiez-le maintenant','ok');showAgencyLink()}};
      document.querySelector('.topbar').appendChild(b);
    }
    showAgencyLink();
    return;
  }
  D=await api('list');
  MAXUP=((await api('config')).max_upload_mb||24)*1e6;
  $('#login').hidden=true;
  $('#app').hidden=false;
  nm={};sl={};
  D.agencies.forEach(a=>{nm[a.id]=a.name;sl[a.id]=a.slug});
  renderStats();renderAgencies();renderHouses();renderLeads();
  $('#ag').innerHTML=D.agencies.map(a=>'<option value="'+a.id+'">'+esc(a.name)+'</option>').join('');
  const sb=$('#bg').value;$('#bg').innerHTML=$('#ag').innerHTML;if(sb)$('#bg').value=sb;fillBrand();
  const first=D.agencies.find(a=>a.status=='active'),vs=$('#view-site');
  if(first){vs.href='/a/'+first.slug;vs.hidden=false}else vs.hidden=true;
}

function showAgencyLink(){
  if(!AGENCY_MODE||!MY_AGENCY)return;
  const tok=tk,slug=MY_AGENCY.slug;
  const url=location.origin+'/agency/'+slug+'?t='+tok;
  if(!document.querySelector('#agencylink')){
    const box=document.createElement('div');box.id='agencylink';box.className='card';box.style.marginBottom='18px';
    box.innerHTML='<div class="card-head"><h2>Votre lien d acces</h2><span class="muted tiny">Partagez ce lien avec votre equipe</span></div>'
      +'<div class="row" style="margin-top:0"><input id="agencylinkinput" readonly dir="ltr" style="flex:1;font-family:monospace;font-size:12.5px"><button class="btn primary" id="agencylinkcopy">Copier</button></div>'
      +'<p class="muted small" style="margin:8px 0 0">Ce lien donne acces a cet espace. Ne le partagez qu avec vos collaborateurs. Si vous pensez qu il a fuite, cliquez sur Regenerer.</p>';
    document.querySelector('main').insertBefore(box,document.querySelector('#s-overview'));
    $('#agencylinkcopy').onclick=()=>{navigator.clipboard.writeText($('#agencylinkinput').value).then(()=>toast('Lien copié','ok'))};
  }
  $('#agencylinkinput').value=url;
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
    navigator.clipboard.writeText(fullUrl).then(()=>toast('Lien copié','ok'));
  };
}

// ---- Facebook 360 : photo équirectangulaire avec les métadonnées GPano ----
// فيسبوك كيتعرّف على الصورة كـ360 غير إلا كانت فيها بيانات GPano.
function withXmp(src,w,h){
  const xmp='<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>'
   +'<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.6-c140 79.160451, 2017/05/06-01:08:21">'
   +'<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
   +'<rdf:Description rdf:about="" xmlns:GPano="http://ns.google.com/photos/1.0/panorama/">'
   +'<GPano:UsePanoramaViewer>True</GPano:UsePanoramaViewer>'
   +'<GPano:StitchingSoftware>MB 360</GPano:StitchingSoftware>'
   +'<GPano:ProjectionType>equirectangular</GPano:ProjectionType>'
   +'<GPano:PoseHeadingDegrees>0.0</GPano:PoseHeadingDegrees>'
   +'<GPano:InitialViewHeadingDegrees>0.0</GPano:InitialViewHeadingDegrees>'
   +'<GPano:InitialViewPitchDegrees>0.0</GPano:InitialViewPitchDegrees>'
   +'<GPano:InitialViewRollDegrees>0.0</GPano:InitialViewRollDegrees>'
   +'<GPano:InitialHorizontalFOVDegrees>75.0</GPano:InitialHorizontalFOVDegrees>'
   +'<GPano:CroppedAreaImageWidthPixels>'+w+'</GPano:CroppedAreaImageWidthPixels>'
   +'<GPano:CroppedAreaImageHeightPixels>'+h+'</GPano:CroppedAreaImageHeightPixels>'
   +'<GPano:FullPanoWidthPixels>'+w+'</GPano:FullPanoWidthPixels>'
   +'<GPano:FullPanoHeightPixels>'+h+'</GPano:FullPanoHeightPixels>'
   +'<GPano:CroppedAreaLeftPixels>0</GPano:CroppedAreaLeftPixels>'
   +'<GPano:CroppedAreaTopPixels>0</GPano:CroppedAreaTopPixels>'
   +'<GPano:SourcePhotosCount>1</GPano:SourcePhotosCount>'
   +'</rdf:Description></rdf:RDF></x:xmpmeta>'+' '.repeat(1024)+'<?xpacket end="w"?>';
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
      // فيسبوك كيقبل غير 2:1 بالضبط، و كيرفض الصور الصغيرة: نرفعوها لـ2048 على الأقل
      const W=Math.min(6000,Math.max(2048,img.naturalWidth)),H=Math.round(W/2);
      const c=document.createElement('canvas');
      c.width=W;c.height=H;
      const x=c.getContext('2d');
      x.imageSmoothingQuality='high';
      x.drawImage(img,0,0,W,H);
      c.toBlob(async b=>{
        if(!b)return no();
        const raw=new Uint8Array(await b.arrayBuffer());
        const out=new Blob([withXmp(raw,W,H)],{type:'image/jpeg'});
        out.w=W;out.h=H;
        ok(out);
      },'image/jpeg',.92);
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
      msg('Export 360°… '+(++i)+' / '+rooms.length+' · '+jpg.w+'×'+jpg.h);
      await new Promise(x=>setTimeout(x,700));
    }catch(e){alert('Échec pour '+(r.name||r.id))}
  }
  msg('Photos 360° prêtes. Publiez-les depuis facebook.com sur ordinateur (pas l’appli mobile) : Facebook les ouvre en 360° dans le fil.');
}
$('#qrclose').onclick=()=>{$('#qrmodal').hidden=true};

// ---- fiche d'informations de la maison ----
let IH='';
async function openInfo(hid){
  const h=await api('house/'+hid);
  if(!h||h.e)return toast('Maison introuvable','err');
  const i=h.info||{};
  IH=hid;
  $('#ifname').textContent=(nm[h.agency]||'')+' · /a/'+(sl[h.agency]||'')+'/'+(h.slug||h.id);
  $('#i_type').value=i.type||'';
  $('#i_price').value=i.price||'';
  $('#i_surface').value=i.surface||'';
  $('#i_floor').value=i.floor||'';
  $('#i_beds').value=i.beds||'';
  $('#i_baths').value=i.baths||'';
  $('#i_address').value=i.address||'';
  $('#i_phone').value=i.phone||'';
  $('#i_desc').value=i.desc||'';
  $('#infom').hidden=false;
  $('#i_price').focus();
}
$('#i_cancel').onclick=()=>{$('#infom').hidden=true};
$('#infom').onclick=e=>{if(e.target.id=='infom')$('#infom').hidden=true};
$('#i_save').onclick=async()=>{
  if(!IH)return;
  const r=await api('info/'+IH,'POST',{
    type:$('#i_type').value,price:$('#i_price').value.trim(),surface:$('#i_surface').value.trim(),
    floor:$('#i_floor').value.trim(),beds:$('#i_beds').value,baths:$('#i_baths').value,
    address:$('#i_address').value.trim(),phone:$('#i_phone').value.trim(),desc:$('#i_desc').value.trim()
  });
  if(r.ok){$('#infom').hidden=true;toast('Informations enregistrées','ok');load()}
  else toast("Échec de l'enregistrement",'err');
};
addEventListener('keydown',e=>{if(e.key=='Escape'&&!$('#infom').hidden){$('#infom').hidden=true}});

document.addEventListener('click',async e=>{
  const b=e.target.closest('button,a');
  if(!b)return;
  if(b.dataset.lfh){LQ=b.dataset.lfh;$('#leadsearch').value=LQ;renderLeads();document.querySelector('#s-leads').scrollIntoView({behavior:'smooth'})}
  if(b.dataset.ld){await api('lead/'+b.dataset.ld,'POST',{done:+b.dataset.done});toast('Demande mise à jour','ok');load()}
  if(b.dataset.ldel&&confirm('Supprimer cette demande ?')){await api('dellead/'+b.dataset.ldel,'POST',{});load()}
  if(b.dataset.agencylink){
    const a=D.agencies.find(x=>x.id==b.dataset.agencylink);
    if(a&&!a.token){const r=await api('agencytoken/'+a.id,'POST',{});a.token=r.token}
    if(a&&a.token){navigator.clipboard.writeText(location.origin+'/agency/'+a.slug+'?t='+a.token).then(()=>toast('Lien copie - envoyez-le a l agence','ok'))}
  }
  if(b.dataset.inf) openInfo(b.dataset.inf);
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
await api('data/'+h.id,'POST',rooms);msg('Import terminé. La maison est en « brouillon » : personne ne la voit avant activation.');toast('Maison importée en brouillon','ok');load()}catch(x){msg("Échec de l'import : vérifiez que le fichier est un export valide");toast("Échec de l'import",'err')}};

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
$('#pdoor').onclick=()=>{E.mode=!E.mode;$('#pdoor').classList.toggle('primary',!!E.mode)};$('#pfit').onclick=()=>pdraw(1);$('#pclose').onclick=()=>{$('#pe').hidden=true;E=null};
$('#psave').onclick=async()=>{const r={};E.rs.forEach(q=>r[q.id]={x:q.x,z:q.z});const x=await api('plan/'+E.id,'POST',{plan:{r,d:E.dr},dims:E.dims});x.ok?toast('Plan enregistré','ok'):toast("Échec de l'enregistrement",'err');load()};
$('#bg').onchange=fillBrand;
$('#bs').onclick=async()=>{const id=$('#bg').value;if(!id)return alert("Ajoutez d'abord une agence");try{const f=$('#lf').files[0];if(f)await api('logo/'+id,'POST',await logoBlob(f));const k=$('#bk').files[0];if(k){if(k.size>MAXUP)return alert('Fichier trop lourd (max '+Math.floor(MAXUP/1e6)+' Mo), choisissez un fichier plus léger');await api('bg/'+id,'POST',k)}await api('brand','POST',{id,color:$('#bc').value,font:$('#bf').value,logo:!!f,bg:$('#bb').value,tx:$('#bt').value,fx:$('#be').value,bgt:k?k.type:''});const a=D.agencies.find(x=>x.id==id);Object.assign(a,{color:$('#bc').value,font:$('#bf').value,bg:$('#bb').value,tx:$('#bt').value,fx:$('#be').value});if(f)a.logo=1;if(k)a.bgType=k.type;$('#msg2').textContent="Identité enregistrée. Elle apparaît sur les pages de l'agence sous une minute environ.";$('#lf').value='';$('#bk').value=''}catch(x){$("#msg2").textContent="Échec de l'enregistrement"}};
// ---- interface ----
$('#search').oninput=()=>{FQ=$('#search').value;renderHouses()};
$('#leadsearch').oninput=()=>{LQ=$('#leadsearch').value;renderLeads()};
document.querySelectorAll('#nav .nav').forEach(a=>a.addEventListener('click',()=>{
  document.querySelectorAll('#nav .nav').forEach(x=>x.classList.remove('on'));
  a.classList.add('on');
}));
$('#out').onclick=()=>{sessionStorage.tk='';tk='';location.reload()};
function bindFile(id,fallback){
  const el=$('#'+id),w=el.closest('.file'),s=w.querySelector('span');
  const upd=()=>{const f=el.files[0];s.textContent=f?f.name:fallback;w.classList.toggle('has',!!f)};
  el.addEventListener('change',upd);el._upd=upd;
}
bindFile('jf','Choisir un fichier .json');
bindFile('lf','Logo');
bindFile('bk','Fond personnalisé');
$('#bs').addEventListener('click',()=>setTimeout(()=>{['lf','bk'].forEach(id=>{const el=$('#'+id);if(!el.files[0])el._upd()})},900));
if(AGENCY_MODE){
  if(!tk){
    $('#login').hidden=false;$('#app').hidden=true;
    document.querySelector('.login-card h1').textContent="Lien d'accès requis";
    const pm=document.querySelector('.login-card p.muted');if(pm)pm.textContent="Ouvrez cet espace via le lien fourni par l'administrateur (paramètre ?t=...).";
    $('#go').hidden=true;$('#tk').hidden=true;
  } else load().catch(()=>{});
} else if(tk)load().catch(()=>{});
