// ترتيب الغرف تلقائياً من أبعادها واتجاه الأبواب (يستعمله العارض ومحرّر المخطط)
function autoLayout(rooms,plan){const by={},rs=rooms.map(r=>by[r.id]={id:r.id,n:r.name,w:r.dims[0],l:r.dims[1]}),pl=[],q=[],P=(plan&&plan.r)||{};
const clash=r=>pl.some(o=>o!=r&&Math.abs(o.x-r.x)<(o.w+r.w)/2-.01&&Math.abs(o.z-r.z)<(o.l+r.l)/2-.01);
const run=()=>{while(q.length){const a=q.shift();rooms.find(r=>r.id==a.id).hotspots.forEach(h=>{const b=by[h.to];if(!b||b.ok)return;const dx=Math.cos(h.lon*Math.PI/180),dz=Math.sin(h.lon*Math.PI/180),hx=Math.abs(dx)>=Math.abs(dz);b.x=a.x+(hx?Math.sign(dx)*(a.w+b.w)/2:0);b.z=a.z+(hx?0:Math.sign(dz)*(a.l+b.l)/2);for(let i=0;i<30&&clash(b);i++){if(hx)b.z+=1;else b.x+=1}b.ok=1;pl.push(b);q.push(b)})}};
rs.forEach(r=>{if(P[r.id]){r.x=P[r.id].x;r.z=P[r.id].z;r.ok=1;pl.push(r);q.push(r)}});run();
rs.forEach(r=>{if(r.ok)return;r.x=pl.length?Math.max(...pl.map(o=>o.x+o.w/2))+r.w/2+1:0;r.z=0;r.ok=1;pl.push(r);q.push(r);run()});
const dr=plan&&plan.d?plan.d:[];
if(!(plan&&plan.d))rooms.forEach(a=>{const A=by[a.id];a.hotspots.forEach(h=>{if(!by[h.to])return;const dx=Math.cos(h.lon*Math.PI/180),dz=Math.sin(h.lon*Math.PI/180);if(Math.abs(dx)>=Math.abs(dz))dr.push([A.x+Math.sign(dx)*A.w/2,A.z,'v']);else dr.push([A.x,A.z+Math.sign(dz)*A.l/2,'h'])})});
return{rs,by,dr}}
