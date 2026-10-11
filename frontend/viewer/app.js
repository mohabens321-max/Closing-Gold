const $=s=>document.querySelector(s),cl=(v,a,b)=>Math.max(a,Math.min(b,v)),esc=s=>String(s).replace(/[&<>"]/g,c=>'&#'+c.charCodeAt(0)+';');

const P=location.pathname.split('/'),K=P[1],note=t=>{const m=$('#msg');m.textContent=t;m.style.display='flex'};
const brand=b=>{if(!b)return;const s=document.documentElement.style;if(/^#[0-9a-f]{6}$/i.test(b.color)){s.setProperty('--ac',b.color);const n=parseInt(b.color.slice(1),16);s.setProperty('--on',((n>>16)*.299+(n>>8&255)*.587+(n&255)*.114)>150?'#17130b':'#fff')}
const H6=/^#[0-9a-f]{6}$/i;if(H6.test(b.bg)){s.setProperty('--bg',b.bg);const m=parseInt(b.bg.slice(1),16);s.setProperty('--pn','rgba('+(m>>16)+','+(m>>8&255)+','+(m&255)+',.82)')}if(H6.test(b.tx))s.setProperty('--tx',b.tx);
if(b.font){const l=document.createElement('link');l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family='+b.font.replace(/ /g,'+')+':wght@400;700&display=swap';document.head.appendChild(l);s.setProperty('--f',"'"+b.font+"'")}};
const fx=(b,d)=>{if(!b||!b.fx||b.fx=='none')return;const e=document.createElement('div');e.id='fx';
if(b.fx=='custom'){if(!b.bgu)return;e.innerHTML=b.bgt.startsWith('video')?'<video src="'+b.bgu+'" autoplay muted loop playsinline></video>':'<img src="'+b.bgu+'" alt="">'}
else if(b.fx=='aurora'){e.className='fx-aurora';e.innerHTML='<i></i><i></i>'}
else if(b.fx=='flow')e.className='fx-flow';
else if(b.fx=='pan'){e.className='fx-pan';const h=d.houses&&d.houses[0];if(h&&h.cover)e.style.backgroundImage='url("'+h.cover+'")'}
else if(b.fx=='dots'&&!matchMedia('(prefers-reduced-motion:reduce)').matches){const c=document.createElement('canvas'),x=c.getContext('2d'),A=[],col=getComputedStyle(document.documentElement).getPropertyValue('--ac').trim()||'#c9a96a',rs=()=>{c.width=innerWidth;c.height=innerHeight};rs();addEventListener('resize',rs);e.appendChild(c);
for(let i=0;i<70;i++)A.push({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*2.5+.8,v:Math.random()*.4+.1});
(function f(){x.clearRect(0,0,c.width,c.height);x.fillStyle=col;x.globalAlpha=.5;A.forEach(p=>{p.y-=p.v;if(p.y<-5){p.y=c.height+5;p.x=Math.random()*c.width}x.beginPath();x.arc(p.x,p.y,p.r,0,7);x.fill()});requestAnimationFrame(f)})()}
document.body.prepend(e)};
const logo=b=>b&&b.logo?'<img class="lg" src="'+b.logo+'" alt="">':'';
fetch('/api/'+K+'/'+P.slice(2).join('/')).then(async r=>{if(!r.ok)return note('هذه الخدمة غير متاحة حالياً');const d=await r.json();brand(d.brand);if(K=='a'&&!P[3]){cat(d);fx(d.brand,d)}else tour(d)}).catch(()=>note('تعذّر الاتصال، حاول مرة أخرى'));
function cat(d){document.body.className='cat';document.title=d.name;$('#cv').remove();$('#hs').remove();const g=document.createElement('div');g.id='grid';g.innerHTML='<h1>'+logo(d.brand)+esc(d.name)+'</h1><div class="gr"></div>';
d.houses.forEach(h=>{const a=document.createElement('a');a.href=h.slug?'/a/'+P[2]+'/'+h.slug:'/h/'+h.id;a.className='card';if(h.cover)a.style.backgroundImage='url("'+h.cover+'")';a.innerHTML='<div><b>'+esc(h.name)+'</b><span>'+h.n+' غرفة</span></div>';g.lastChild.appendChild(a)});
if(!d.houses.length)g.innerHTML+='<p>لا توجد جولات منشورة بعد.</p>';document.body.appendChild(g)}
function tour(d){
const VS='varying vec3 vW;void main(){vW=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);}',FS='uniform sampler2D map;uniform vec3 uCam,uMin,uMax;uniform float op;varying vec3 vW;void main(){vec3 d=normalize(vW-uCam);vec3 t1=(uMin-uCam)/d,t2=(uMax-uCam)/d;vec3 tf=max(t1,t2);float t=min(min(tf.x,tf.y),tf.z);vec3 p=normalize(uCam+d*t);vec2 uv=vec2(fract(atan(p.z,p.x)/6.2831853),1.-acos(clamp(p.y,-1.,1.))/3.1415927);gl_FragColor=vec4(texture2D(map,uv).rgb,op);}';
const rooms=d.rooms;rooms.forEach(r=>{r.hotspots=r.hotspots||[];r.infos=r.infos||[];r.dims=r.dims||[6,8,2.6]});
let R,walking=0,seen=0,lon=180,lat=0,tLon=180,tLat=0,fov=75,tFov=75,cp=[0,0,0],goal=0,fade0=0,joy=[0,0],keys={},hsEls=[];
const mat=t=>new THREE.ShaderMaterial({uniforms:{map:{value:null},uCam:{value:new THREE.Vector3()},uMin:{value:new THREE.Vector3(-3,-1.6,-4)},uMax:{value:new THREE.Vector3(3,1,4)},op:{value:1}},vertexShader:VS,fragmentShader:FS,transparent:t,depthWrite:!t});
const ll2v=(lo,la)=>{const p=(90-la)*Math.PI/180,t=lo*Math.PI/180;return[Math.sin(p)*Math.cos(t),Math.cos(p),Math.sin(p)*Math.sin(t)]};
const box=()=>{const e=R.dims;return[[-e[0]/2,-1.6,-e[1]/2],[e[0]/2,e[2]-1.6,e[1]/2]]};
const hit=(o,v)=>{const[a,b]=box();let t=1e9;[0,1,2].forEach(i=>{if(v[i])t=Math.min(t,((v[i]>0?b[i]:a[i])-o[i])/v[i])});return v.map((x,i)=>o[i]+x*t)};
const rd=new THREE.WebGLRenderer({antialias:true});rd.setPixelRatio(Math.min(devicePixelRatio,2));rd.setSize(innerWidth,innerHeight);$('#cv').appendChild(rd.domElement);
const sc=new THREE.Scene(),cam=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.1,1000),g=new THREE.SphereGeometry(500,60,40);g.scale(-1,1,1);
const m1=new THREE.Mesh(g,mat(0)),m2=new THREE.Mesh(g,mat(1));m2.scale.setScalar(.98);m2.visible=false;m2.renderOrder=1;sc.add(m1,m2);const U1=m1.material.uniforms,U2=m2.material.uniforms;
addEventListener('resize',()=>{rd.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()});
function loop(){requestAnimationFrame(loop);if(!R)return;
if(!seen)tLon-=.015;lon+=(tLon-lon)*.1;lat=cl(lat+(tLat-lat)*.1,-85,85);fov+=(tFov-fov)*.12;const[a,b]=box();
if(goal)cp=cp.map((v,i)=>v+(goal[i]-v)*.05);
else if(!walking){const f=(keys.u?1:0)-(keys.d?1:0)+joy[1],s=(keys.r?1:0)-(keys.l?1:0)+joy[0];if(f||s){const th=lon*Math.PI/180;seen=1;cp[0]=cl(cp[0]+(Math.cos(th)*f-Math.sin(th)*s)*.045,a[0]+.6,b[0]-.6);cp[2]=cl(cp[2]+(Math.sin(th)*f+Math.cos(th)*s)*.045,a[2]+.6,b[2]-.6)}}
U1.uCam.value.set(...cp);cam.position.set(...cp);cam.fov=fov;cam.updateProjectionMatrix();const v=ll2v(lon,lat);cam.lookAt(cp[0]+v[0]*500,cp[1]+v[1]*500,cp[2]+v[2]*500);
if(m2.visible){const k=Math.min(1,(performance.now()-fade0)/1100);U2.op.value=1-k*k*(3-2*k);if(k>=1)m2.visible=false}
rd.render(sc,cam);plr();const fw=new THREE.Vector3();cam.getWorldDirection(fw);
hsEls.forEach(o=>{const w=o.wp,e=new THREE.Vector3(w[0]-cp[0],w[1]-cp[1],w[2]-cp[2]).normalize();if(fw.dot(e)<.2){o.el.style.display='none';return}const p=new THREE.Vector3(...w).project(cam);o.el.style.display='flex';o.el.style.left=(p.x*.5+.5)*innerWidth+'px';o.el.style.top=(-p.y*.5+.5)*innerHeight+'px'})}
const byId=id=>rooms.find(r=>r.id==id);
// ---- المخطط ثنائي الأبعاد: يُرتَّب تلقائياً من أبعاد الغرف واتجاهات الأبواب ----
let PL;const svg=$('#ms');
function drawPlan(){if(!rooms.length)return;const{rs,by,dr}=autoLayout(rooms,d.plan);
const x0=Math.min(...rs.map(r=>r.x-r.w/2))-1,z0=Math.min(...rs.map(r=>r.z-r.l/2))-1,W=Math.max(...rs.map(r=>r.x+r.w/2))+1-x0,Hh=Math.max(...rs.map(r=>r.z+r.l/2))+1-z0,sc=100/Math.max(W,Hh);
svg.setAttribute('viewBox','0 0 '+W*sc+' '+Hh*sc);
svg.innerHTML=rs.map(r=>{const cx=(r.x-x0)*sc;return'<rect data-id="'+r.id+'" x="'+(r.x-r.w/2-x0)*sc+'" y="'+(r.z-r.l/2-z0)*sc+'" width="'+r.w*sc+'" height="'+r.l*sc+'" rx="1"/><text x="'+cx+'" y="'+(r.z-z0)*sc+'"><tspan>'+esc(r.n)+'</tspan><tspan class="m" x="'+cx+'" dy="4.6">'+r.w.toFixed(1)+'×'+r.l.toFixed(1)+' م</tspan></text>'}).join('')
+dr.map(q=>{const X=(q[0]-x0)*sc,Z=(q[1]-z0)*sc,k=.6*sc;return q[2]=='v'?'<line class="dr" x1="'+X+'" y1="'+(Z-k)+'" x2="'+X+'" y2="'+(Z+k)+'"/>':'<line class="dr" x1="'+(X-k)+'" y1="'+Z+'" x2="'+(X+k)+'" y2="'+Z+'"/>'}).join('')+'<g id="pl"><path d="M0 0L10-5V5Z"/><circle r="2.2"/></g>';
PL={x0,z0,sc,by}}
function hl(){svg.querySelectorAll('rect').forEach(e=>e.classList.toggle('on',e.dataset.id==R.id))}
function plr(){const g=svg.querySelector('#pl'),r=PL&&R&&PL.by[R.id];if(g&&r)g.setAttribute('transform','translate('+(r.x+cp[0]-PL.x0)*PL.sc+' '+(r.z+cp[2]-PL.z0)*PL.sc+') rotate('+lon+')')}
$('#mp').onclick=e=>{const g=e.target.closest('[data-id]'),m=$('#mp');if(g&&m.classList.contains('big'))enter(g.dataset.id);else m.classList.toggle('big')};
$('#zm').onclick=()=>$('#mp').classList.toggle('on');if(innerWidth>700)$('#mp').classList.add('on');
const loadTex=s=>new Promise((ok,no)=>{const l=new THREE.TextureLoader();l.setCrossOrigin('anonymous');l.load(s,t=>{t.minFilter=THREE.LinearFilter;t.generateMipmaps=false;ok(t)},0,no)});
function drawHS(){const L=$('#hs');L.innerHTML='';hsEls=[];
const mk=(o,c,lbl,fn)=>{const el=document.createElement('div');el.className='hp '+c;el.innerHTML='<i>'+(c=='i'?'i':'')+'</i><span>'+esc(lbl||'')+'</span>';el.onclick=e=>{e.stopPropagation();fn()};L.appendChild(el);hsEls.push({el,wp:hit([0,0,0],ll2v(o.lon,o.lat)).map(v=>v*.99)})};
R.hotspots.forEach(o=>mk(o,'n',o.label||(byId(o.to)||{}).name,()=>enter(o.to,o)));R.infos.forEach(o=>mk(o,'i',o.title,()=>{$('#it').textContent=o.title;$('#id').textContent=o.desc||'';$('#ic').classList.add('on')}))}
function rail(){const r=$('#rail');r.innerHTML='';rooms.forEach(x=>{const e=document.createElement('div');e.className='th'+(x==R?' on':'');e.style.backgroundImage='url("'+x.image+'")';e.innerHTML='<b>'+esc(x.name)+'</b>';e.onclick=()=>enter(x.id);r.appendChild(e)})}
async function enter(id,hs){const r=byId(id);if(!r||walking)return;walking=1;$('#hs').style.opacity=0;$('#ld').classList.add('on');
const had=!!(U1.map.value&&R),dw=had&&hs;
if(dw){tLon=lon+(((hs.lon-lon+540)%360+360)%360-180);tLat=hs.lat*.5;tFov=55;const q=hit([0,0,0],ll2v(hs.lon,hs.lat));goal=[q[0]*.75,0,q[2]*.75]}
try{const[tex]=await Promise.all([loadTex(r.image),new Promise(o=>setTimeout(o,dw?1000:150))]);
if(had){if(U2.map.value&&U2.map.value!==U1.map.value)U2.map.value.dispose();U2.map.value=U1.map.value;U2.uCam.value.set(...cp);U2.uMin.value.copy(U1.uMin.value);U2.uMax.value.copy(U1.uMax.value);U2.op.value=1;m2.visible=true;fade0=performance.now()}
U1.map.value=tex;goal=0;cp=[0,0,0];R=r;const[a,b]=box();U1.uMin.value.set(...a);U1.uMax.value.set(...b);if(!dw){tLon=lon=r.lon0??180;tLat=lat=0}tFov=75;rail();drawHS();hl()}
catch(e){goal=0;tFov=75}
$('#ld').classList.remove('on');setTimeout(()=>{walking=0;$('#hs').style.opacity=1},had?1100:0)}
$('#bar').innerHTML=logo(d.brand)+esc(d.agency+' — '+d.name);$('#bar').style.display='block';$('#rw').style.display='block';$('#zc').style.display='flex';$('#joy').classList.add('on');
const cv=$('#cv'),Q=new Map();let pd=0,pf=75,sx,sy,sl,st;const dist=()=>{const a=[...Q.values()];return Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1])||1};
cv.onpointerdown=e=>{cv.setPointerCapture(e.pointerId);Q.set(e.pointerId,[e.clientX,e.clientY]);seen=1;if(Q.size==1){sx=e.clientX;sy=e.clientY;sl=tLon;st=tLat}else{pd=dist();pf=tFov}};
cv.onpointermove=e=>{if(!Q.has(e.pointerId))return;Q.set(e.pointerId,[e.clientX,e.clientY]);if(Q.size==2){tFov=cl(pf*pd/dist(),30,100);return}tLon=sl-(e.clientX-sx)*.15;tLat=st+(e.clientY-sy)*.15};
cv.onpointerup=cv.onpointercancel=e=>Q.delete(e.pointerId);
cv.addEventListener('wheel',e=>{e.preventDefault();seen=1;tFov=cl(tFov+e.deltaY*.04,30,100)},{passive:false});
$('#zi').onclick=()=>{seen=1;tFov=cl(tFov-12,30,100)};$('#zo').onclick=()=>{seen=1;tFov=cl(tFov+12,30,100)};$('#zr').onclick=()=>{tLon=R.lon0??180;tLat=0;tFov=75};$('#ix').onclick=()=>$('#ic').classList.remove('on');
const KM={KeyW:'u',ArrowUp:'u',KeyS:'d',ArrowDown:'d',KeyA:'l',ArrowLeft:'l',KeyD:'r',ArrowRight:'r'};
addEventListener('keydown',e=>{if(KM[e.code]){keys[KM[e.code]]=1;e.preventDefault()}});addEventListener('keyup',e=>KM[e.code]&&(keys[KM[e.code]]=0));
const J=$('#joy'),KK=$('#jk');let jo=0;const jm=e=>{if(!jo)return;const r=J.getBoundingClientRect();let dx=e.clientX-r.left-52,dy=e.clientY-r.top-52;const L=Math.min(40,Math.hypot(dx,dy)),a=Math.atan2(dy,dx);dx=Math.cos(a)*L;dy=Math.sin(a)*L;KK.style.transform='translate('+dx+'px,'+dy+'px)';joy=[dx/40,-dy/40]};
J.onpointerdown=e=>{jo=1;J.setPointerCapture(e.pointerId);jm(e)};J.onpointermove=jm;J.onpointerup=J.onpointercancel=()=>{jo=0;joy=[0,0];KK.style.transform=''};
drawPlan();loop();if(rooms.length)enter(rooms[0].id);else note('هذا البيت لا يحتوي غرفاً بعد')}