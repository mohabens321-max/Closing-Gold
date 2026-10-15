const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"]/g,c=>'&#'+c.charCodeAt(0)+';'),L={draft:'مسودة',active:'فعّال',blocked:'موقوف'};

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
  $('#ags').innerHTML=D.agencies.map(a=>'<div class="r"><b>'+esc(a.name)+'</b><a href="/a/'+a.slug+'" target="_blank">/a/'+a.slug+'</a><span class="s '+a.status+'">'+L[a.status]+'</span><button data-t="agency" data-i="'+a.id+'" data-s="'+(a.status=='active'?'blocked':'active')+'">'+(a.status=='active'?'🚫 إيقاف الوكالة':'✅ تفعيل')+'</button><button data-x="'+a.id+'">🗑</button></div>').join('')||'<p>لا وكالات بعد.</p>';
  $('#ag').innerHTML=D.agencies.map(a=>'<option value="'+a.id+'">'+esc(a.name)+'</option>').join('');
  const sb=$('#bg').value;$('#bg').innerHTML=$('#ag').innerHTML;if(sb)$('#bg').value=sb;fillBrand();
  
  nm={};sl={};
  D.agencies.forEach(a=>{nm[a.id]=a.name;sl[a.id]=a.slug});
  
  $('#hs').innerHTML=D.houses.map(h=>'<div class="r"><b>'+esc(h.name)+'</b><span>'+esc(nm[h.agency]||'')+' - '+h.n+' غرفة</span><a dir="ltr" href="'+lk(h)+'" target="_blank">'+lk(h)+'</a><button data-qr="'+h.id+'" title="رمز QR والطباعة">📱 QR</button><button data-s2="'+h.id+'">✎</button><select data-h="'+h.id+'">'+['draft','active','blocked'].map(s=>'<option value="'+s+'"'+(s==h.status?' selected':'')+'>'+L[s]+'</option>').join('')+'</select><button data-p="'+h.id+'">🗺</button><button data-d="'+h.id+'">🗑</button></div>').join('')||'<p>لا بيوت بعد.</p>';
}

function openQr(hid){
  const h=D.houses.find(x=>x.id==hid);
  if(!h)return;
  const fullUrl=location.origin+lk(h);
  $('#qrtitle').textContent=h.name;
  $('#qrsub').textContent=(nm[h.agency]||'')+' — امسح الرمز لزيارة العقار افتراضياً';
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
    ctx.fillText('MB 360° — جولة افتراضية',400,75);
    
    // اسم العقار
    ctx.fillStyle='#a67c2e';
    ctx.font='bold 32px Cairo, sans-serif';
    ctx.fillText(h.name,400,140);
    
    // اسم الوكالة
    ctx.fillStyle='#555555';
    ctx.font='22px Cairo, sans-serif';
    ctx.fillText(nm[h.agency]||'وكالة عقارية',400,180);
    
    // صورة الـ QR في الوسط
    ctx.drawImage(qrImg,175,230,450,450);
    
    // دعوة للمسح
    ctx.fillStyle='#111111';
    ctx.font='bold 26px Cairo, sans-serif';
    ctx.fillText('امسح الرمز بكاميرا الهاتف للمعاينة المباشرة',400,760);
    
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
    navigator.clipboard.writeText(fullUrl).then(()=>alert('تم نسخ الرابط!'));
  };
}

$('#qrclose').onclick=()=>{$('#qrmodal').hidden=true};

document.addEventListener('click',async e=>{
  const b=e.target;
  if(b.dataset.qr) openQr(b.dataset.qr);
  if(b.dataset.t){await api('status','POST',{type:b.dataset.t,id:b.dataset.i,status:b.dataset.s});load()}
  if(b.dataset.p)editPlan(b.dataset.p);
  if(b.dataset.s2){const s=prompt('رابط البيت الجديد (أحرف إنجليزية وأرقام و-)');if(s){const r=await api('slug','POST',{id:b.dataset.s2,slug:s});if(r.e)alert('الرابط مستعمل أو غير صالح');load()}}
  if(b.dataset.x&&confirm('حذف هذه الوكالة نهائياً؟')){const r=await api('delagency/'+b.dataset.x,'POST',{});if(r.e)alert('احذف بيوت هذه الوكالة أولاً');load()}
  if(b.dataset.d&&confirm('حذف هذا البيت نهائياً؟')){await api('del/'+b.dataset.d,'POST',{});load()}
});

document.addEventListener('change',async e=>{if(e.target.dataset.h){await api('status','POST',{type:'house',id:e.target.dataset.h,status:e.target.value});load()}});
$('#go').onclick=()=>{tk=$('#tk').value.trim();sessionStorage.tk=tk;load().catch(()=>alert('رمز خاطئ أو خطأ في الاتصال'))};
$('#aa').onclick=async()=>{const r=await api('agency','POST',{name:$('#an').value.trim(),slug:$('#as').value.trim()});if(r.e)return alert('الاسم أو الرابط ناقص أو مستعمل');$('#an').value=$('#as').value='';load()};
$('#up').onclick=async()=>{const f=$('#jf').files[0],ag=$('#ag').value;if(!f||!ag)return alert('اختر الملف والوكالة');
try{const j=JSON.parse(await f.text()),h=await api('house','POST',{agency:ag,name:j.name,slug:$('#hsg').value.trim()}),rooms=[];let i=0;
for(const r of j.rooms){msg('رفع '+(++i)+' / '+j.rooms.length+' ...');let img=r.image;if(img.startsWith('data:')){await api('img/'+h.id+'/'+r.id,'PUT',await shrink(img));img='/img/'+h.id+'/'+r.id}
rooms.push({id:r.id,name:r.name,image:img,dims:r.dims,lon0:r.lon0,desc:r.desc,hotspots:r.hotspots,infos:r.infos})}
await api('data/'+h.id,'POST',rooms);msg('تم الرفع. البيت «مسودة» ولن يراه أحد حتى تفعّله بعد الدفع.');load()}catch(x){msg('فشل الرفع: تأكد أن الملف هو تصدير صحيح')}};

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
$('#psave').onclick=async()=>{const r={};E.rs.forEach(q=>r[q.id]={x:q.x,z:q.z});const x=await api('plan/'+E.id,'POST',{plan:{r,d:E.dr},dims:E.dims});alert(x.ok?'تم حفظ المخطط':'فشل الحفظ');load()};
$('#bg').onchange=fillBrand;
$('#bs').onclick=async()=>{const id=$('#bg').value;if(!id)return alert('أضف وكالة أولاً');try{const f=$('#lf').files[0];if(f)await api('logo/'+id,'POST',await logoBlob(f));const k=$('#bk').files[0];if(k){if(k.size>MAXUP)return alert('الملف أكبر من '+Math.floor(MAXUP/1e6)+' ميغابايت، اختر ملفاً أخف');await api('bg/'+id,'POST',k)}await api('brand','POST',{id,color:$('#bc').value,font:$('#bf').value,logo:!!f,bg:$('#bb').value,tx:$('#bt').value,fx:$('#be').value,bgt:k?k.type:''});const a=D.agencies.find(x=>x.id==id);Object.assign(a,{color:$('#bc').value,font:$('#bf').value,bg:$('#bb').value,tx:$('#bt').value,fx:$('#be').value});if(f)a.logo=1;if(k)a.bgType=k.type;$('#msg2').textContent='تم حفظ الهوية، وتظهر على صفحات الوكالة خلال دقيقة تقريباً.';$('#lf').value='';$('#bk').value=''}catch(x){$('#msg2').textContent='فشل الحفظ'}};
if(tk)load().catch(()=>{});
