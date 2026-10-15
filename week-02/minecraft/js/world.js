'use strict';
/* =====================================================================
   world.js — 청크, 지형 생성, 빛, 물·용암 흐름, 무작위 틱(자라기)
   ===================================================================== */
const CS=16,CH=128,SEA=62;
const BIO_NAMES=['평원','숲','사막','눈 덮인 평원','바다','해변','산','타이가'];
const ckey=(cx,cz)=>(cx+32768)*65536+(cz+32768);
const DX=[1,-1,0,0,0,0],DY=[0,0,1,-1,0,0],DZ=[0,0,0,0,1,-1],DOWN=3;
const FULL_BOX=[[0,0,0,16,16,16]];
class Chunk{constructor(cx,cz){this.cx=cx;this.cz=cz;this.b=new Uint8Array(CS*CS*CH);this.l=new Uint8Array(CS*CS*CH);
  this.hm=new Uint8Array(256);this.bio=new Uint8Array(256);this.lit=false;this.dirty=true;this.o=null;this.w=null;this.meshed=false;this.spawns=null;}}
function fluidId(f,L){if(f===1)return L===0?B.WATER:L===8?B.WATER_FALL:B.WATER_FLOW+L-1;return L===0?B.LAVA:L===8?B.LAVA_FALL:B.LAVA_FLOW+L-1;}

class World{
  constructor(seed,mode){this.seed=seed|0;this.mode=mode;this.chunks=new Map();this.edits=new Map();this.lastK=-1;this.lastC=null;
    this.be=new Map();this.fq=new Map();this.populated=new Set();this.tick=0;
    const r=mulberry32(this.seed);const S=()=>new Simplex((r()*2147483647)|0);
    this.nC=S();this.nH=S();this.nM=S();this.nD=S();this.nT=S();this.nW=S();this.nA=S();this.nB=S();this.nE=S();this.nG=S();this.nK=S();}
  chunk(cx,cz){const k=ckey(cx,cz);if(k===this.lastK)return this.lastC;const c=this.chunks.get(k)||null;this.lastK=k;this.lastC=c;return c;}
  resetCache(){this.lastK=-1;this.lastC=null;}
  get(x,y,z){if(y<0)return B.BEDROCK;if(y>=CH)return 0;const c=this.chunk(x>>4,z>>4);if(!c)return 0;return c.b[(x&15)|((z&15)<<4)|(y<<8)];}
  light(x,y,z){if(y>=CH)return 0xF0;if(y<0)return 0;const c=this.chunk(x>>4,z>>4);if(!c||!c.lit)return 0xF0;return c.l[(x&15)|((z&15)<<4)|(y<<8)];}
  loaded(x,z){const c=this.chunk(x>>4,z>>4);return!!(c&&c.lit);}
  topY(x,z){const c=this.chunk(x>>4,z>>4);if(!c)return 0;return c.hm[(x&15)+(z&15)*16];}
  /* ---------- 모양 ---------- */
  shape(id,x,y,z,coll){// 1/16 단위 상자 목록
    const rt=RTYPE[id];
    if(rt===R_CUBE)return FULL_BOX;
    if(rt===R_BOX)return coll?COLL[id]:BOXES[id];
    if(rt===R_DYN){const d=dynBoxes(id,[this.get(x+1,y,z),this.get(x-1,y,z),this.get(x,y,z+1),this.get(x,y,z-1)]);return coll?d.col:d.r;}
    return null;}
  /* ---------- 지형 ---------- */
  column(x,z){
    const c=fbm2(this.nC,x*0.0021,z*0.0021,4),hills=fbm2(this.nH,x*0.009,z*0.009,3),mR=fbm2(this.nM,x*0.0032,z*0.0032,4);
    let h=67+c*44+hills*7+this.nD.n2(x*0.05,z*0.05)*1.2;
    const land=clamp((c+0.02)*5,0,1);if(mR>0.1){const t=(mR-0.1)/0.45;h+=t*t*58*land;}
    h=Math.floor(clamp(h,6,CH-14));
    const temp=fbm2(this.nT,x*0.0016,z*0.0016,2),hum=fbm2(this.nW,x*0.0016,z*0.0016,2);let bio;
    if(h<SEA)bio=4;else if(h<=SEA+1)bio=5;else if(h>=96)bio=6;else if(temp>0.18&&hum<0.08)bio=2;else if(temp<-0.22)bio=3;
    else if(temp<-0.08)bio=7;else if(hum>0.08)bio=1;else bio=0;
    return h*8+bio;}
  treePlan(kind,x,y,z,th,seed){// [x,y,z,id,onlyAir]
    const out=[];
    if(kind==='spruce'){const top=y+th;
      for(let i=0;i<=th-2;i++){const ly=top+1-i;const r=i===0?0:i===1?1:(i%2===0?Math.min(3,1+(i>>1)):1);
        for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){if(r>0&&Math.abs(dx)===r&&Math.abs(dz)===r)continue;out.push([x+dx,ly,z+dz,B.SPRUCE_LEAVES,true]);}}
      for(let i=0;i<th;i++)out.push([x,y+i,z,B.SPRUCE_LOG,false]);return out;}
    const birch=kind==='birch',log=birch?B.BIRCH_LOG:B.OAK_LOG,lv=birch?B.BIRCH_LEAVES:B.OAK_LEAVES,top=y+th-1;
    for(let ly=top-2;ly<=top+1;ly++){const rad=ly>=top?1:2;
      for(let dz=-rad;dz<=rad;dz++)for(let dx=-rad;dx<=rad;dx++){
        if(Math.abs(dx)===rad&&Math.abs(dz)===rad){if(ly===top+1||hash3(x+dx,ly,z+dz,seed)<0.5)continue;}
        out.push([x+dx,ly,z+dz,lv,true]);}}
    for(let i=0;i<th;i++)out.push([x,y+i,z,log,false]);return out;}
  generate(c){
    const b=c.b,wx0=c.cx*16,wz0=c.cz*16,seed=this.seed;
    const H=new Int16Array(256);
    for(let z=0;z<16;z++)for(let x=0;x<16;x++){const v=this.column(wx0+x,wz0+z);H[x+z*16]=v>>3;c.bio[x+z*16]=v&7;}
    const GY=CH/4+1,cave=new Float32Array(25*GY);
    for(let iz=0;iz<5;iz++)for(let ix=0;ix<5;ix++)for(let iy=0;iy<GY;iy++){const wx=wx0+ix*4,wz=wz0+iz*4,y=iy*4;
      const a=this.nA.n3(wx*0.021,y*0.042,wz*0.021),bb=this.nB.n3(wx*0.021,y*0.042,wz*0.021);let v=a*a+bb*bb;
      if(y<44){const big=this.nE.n3(wx*0.012,y*0.024,wz*0.012);if(big>0.58)v=0;}
      cave[(iz*5+ix)*GY+iy]=v;}
    const cv=(x,y,z)=>{const fx=x/4,fy=y/4,fz=z/4,ix=fx|0,iy=fy|0,iz=fz|0,tx=fx-ix,ty=fy-iy,tz=fz-iz;
      const g=(a,b2,cc)=>cave[((iz+cc)*5+ix+a)*GY+iy+b2];
      const c00=lerp(g(0,0,0),g(1,0,0),tx),c10=lerp(g(0,1,0),g(1,1,0),tx),c01=lerp(g(0,0,1),g(1,0,1),tx),c11=lerp(g(0,1,1),g(1,1,1),tx);
      return lerp(lerp(c00,c10,ty),lerp(c01,c11,ty),tz);};
    for(let z=0;z<16;z++)for(let x=0;x<16;x++){
      const h=H[x+z*16],bio=c.bio[x+z*16],wx=wx0+x,wz=wz0+z;
      const grav=this.nG.n2(wx*0.08,wz*0.08)>0.35,clay=this.nK.n2(wx*0.06,wz*0.06)>0.5;
      for(let y=0;y<CH;y++){let id=0;
        if(y===0)id=B.BEDROCK;
        else if(y<4&&hash3(wx,y,wz,seed)<(4-y)*0.22)id=B.BEDROCK;
        else if(y<=h){const dp=h-y;
          if(bio===2)id=dp<4?B.SAND:dp<8?B.SANDSTONE:B.STONE;
          else if(h<=SEA+1)id=dp<4?(dp===0&&clay&&h<SEA-1?B.CLAY:(h<SEA-3&&grav)?B.GRAVEL:B.SAND):B.STONE;
          else if(bio===6)id=dp===0?(h>=106?B.SNOW:h<101?B.GRASS:B.STONE):(dp<3&&h<101)?B.DIRT:B.STONE;
          else id=dp===0?(bio===3?B.SNOWY_GRASS:B.GRASS):dp<4?B.DIRT:B.STONE;
          if(y<h-4&&cv(x,y,z)<0.0065)id=y<=10?B.LAVA:0;}
        else if(y<=SEA)id=(y===SEA&&bio===3)?B.ICE:B.WATER;
        if(id)b[x|(z<<4)|(y<<8)]=id;}
      if((bio===3||(bio===6&&h>=104))&&h+1<CH&&!b[x|(z<<4)|((h+1)<<8)])b[x|(z<<4)|((h+1)<<8)]=B.SNOW_LAYER;}
    const r=mulberry32((Math.imul(c.cx,73856093)^Math.imul(c.cz,19349663)^seed)|0);
    const vein=(id,count,size,y0,y1)=>{for(let k=0;k<count;k++){let x=r()*16|0,y=y0+(r()*(y1-y0)|0),z=r()*16|0;
      for(let s=0;s<size;s++){if(x>=0&&x<16&&z>=0&&z<16&&y>0&&y<CH){const i=x|(z<<4)|(y<<8);if(b[i]===B.STONE)b[i]=id;}
        x+=(r()*3|0)-1;y+=(r()*3|0)-1;z+=(r()*3|0)-1;}}};
    vein(B.COAL_ORE,18,10,5,110);vein(B.IRON_ORE,10,7,5,64);vein(B.GOLD_ORE,2,7,4,32);vein(B.DIAMOND_ORE,r()<0.6?1:2,6,3,16);
    vein(B.GRAVEL,4,18,5,70);vein(B.DIRT,4,18,5,80);
    const set=(x,y,z,id,onlyAir)=>{x-=wx0;z-=wz0;if(x<0||x>15||z<0||z>15||y<1||y>=CH)return;const i=x|(z<<4)|(y<<8);
      if(onlyAir&&b[i]&&!REPL[b[i]]&&!BLOCKS[b[i]].leaves)return;if(onlyAir&&FLUID[b[i]])return;b[i]=id;};
    for(let gz=Math.floor((wz0-3)/4);gz<=Math.floor((wz0+18)/4);gz++)for(let gx=Math.floor((wx0-3)/4);gx<=Math.floor((wx0+18)/4);gx++){
      const hr=hash2(gx,gz,seed+77),tx=gx*4+(hash2(gx,gz,seed+78)*4|0),tz=gz*4+(hash2(gx,gz,seed+79)*4|0);
      if(tx<wx0-3||tx>wx0+18||tz<wz0-3||tz>wz0+18)continue;
      const v=this.column(tx,tz),h=v>>3,bio=v&7;if(h<=SEA+1)continue;
      const prob=bio===1?0.55:bio===0?0.035:bio===3?0.07:bio===7?0.42:bio===6?(h<100?0.05:0):bio===2?0.05:0;
      if(hr>=prob)continue;
      const lx=tx-wx0,lz=tz-wz0;
      if(lx>=0&&lx<16&&lz>=0&&lz<16){const top=b[lx|(lz<<4)|(h<<8)];if(top!==B.GRASS&&top!==B.SNOWY_GRASS&&top!==B.SAND&&top!==B.DIRT)continue;}
      const hv=hash2(tx,tz,seed+80);
      if(bio===2){const ch=1+(hv*3|0);for(let i=1;i<=ch;i++)set(tx,h+i,tz,B.CACTUS,true);continue;}
      const kind=(bio===3||bio===7||bio===6)?'spruce':((bio===1&&hv<0.35)||(bio===0&&hv<0.12))?'birch':'oak';
      const th=kind==='spruce'?6+(hash2(tx,tz,seed+81)*4|0):4+(hash2(tx,tz,seed+81)*3|0)+(kind==='birch'?1:0);
      for(const[px,py,pz,id,oa]of this.treePlan(kind,tx,h+1,tz,th,seed+82))set(px,py,pz,id,oa);
      set(tx,h,tz,B.DIRT,false);}
    for(let z=0;z<16;z++)for(let x=0;x<16;x++){const h=H[x+z*16],bio=c.bio[x+z*16];if(h+2>=CH)continue;
      const i=x|(z<<4)|(h<<8),top=b[i],up=b[i+256],wx=wx0+x,wz=wz0+z,hv=hash2(wx,wz,seed+99);
      if(top===B.GRASS&&!up){const g=bio===0?0.14:bio===1?0.07:bio===7?0.1:bio===6?0.03:0;
        if(hv<g)b[i+256]=B.TALL_GRASS;else if(hv<g+0.012)b[i+256]=B.DANDELION;else if(hv<g+0.024)b[i+256]=B.POPPY;
        else if(hv<g+0.0262&&(bio===0||bio===1))b[i+256]=B.PUMPKIN;else if(bio===1&&hv<g+0.03)b[i+256]=hv<g+0.028?B.BROWN_MUSH:B.RED_MUSH;}
      else if(top===B.SAND&&!up&&bio===2&&hv<0.012)b[i+256]=B.DEAD_BUSH;
      if((top===B.SAND||top===B.GRASS||top===B.DIRT)&&!up&&h>=SEA&&h<=SEA+2&&x>0&&x<15&&z>0&&z<15&&hv>0.96){
        const wet=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>b[(x+dx)|((z+dz)<<4)|(h<<8)]===B.WATER);
        if(wet){const ch=1+(hash2(wx,wz,seed+98)*3|0);for(let k=1;k<=ch;k++)b[i+256*k]=B.SUGAR_CANE;}}}
    // 동물 (처음 만들어질 때만)
    if(!this.populated.has(ckey(c.cx,c.cz))&&r()<0.12){const types=['pig','cow','sheep','chicken'];const t=types[r()*4|0];const n=2+(r()*3|0);c.spawns=[];
      for(let k=0;k<n;k++){const x=1+(r()*14|0),z=1+(r()*14|0),h=H[x+z*16];const top=b[x|(z<<4)|(h<<8)];
        if((top===B.GRASS||top===B.SNOWY_GRASS)&&h>SEA)c.spawns.push({type:t,x:wx0+x+0.5,y:h+1,z:wz0+z+0.5});}}
    const ed=this.edits.get(ckey(c.cx,c.cz));if(ed)for(const[i,id]of ed)b[i]=id;
  }
  /* ---------- 빛 ---------- */
  propagate(q,sky){
    for(let h=0;h<q.length;h+=3){const x=q[h],y=q[h+1],z=q[h+2];const c=this.chunk(x>>4,z>>4);if(!c||!c.lit)continue;
      const v=c.l[(x&15)|((z&15)<<4)|(y<<8)],L=sky?v>>4:v&15;if(L<=1)continue;
      for(let d=0;d<6;d++){const nx=x+DX[d],ny=y+DY[d],nz=z+DZ[d];if(ny<0||ny>=CH)continue;
        const nc=((nx>>4)===(x>>4)&&(nz>>4)===(z>>4))?c:this.chunk(nx>>4,nz>>4);if(!nc||!nc.lit)continue;
        const ni=(nx&15)|((nz&15)<<4)|(ny<<8),att=ATTEN[nc.b[ni]];if(att>=15)continue;
        const nl=(sky&&d===DOWN&&L===15&&att===0)?15:L-1-att;const nv=nc.l[ni],cur=sky?nv>>4:nv&15;
        if(nl>cur){nc.l[ni]=sky?(nl<<4)|(nv&15):(nv&0xF0)|nl;this.dirtyAt(nc,nx,nz);q.push(nx,ny,nz);}}}}
  removeLight(x,y,z,sky){
    const rq=[],aq=[];const c=this.chunk(x>>4,z>>4);if(!c)return;const i0=(x&15)|((z&15)<<4)|(y<<8),v0=c.l[i0];
    const L0=sky?v0>>4:v0&15;c.l[i0]=sky?(v0&15):(v0&0xF0);rq.push(x,y,z,L0);
    for(let h=0;h<rq.length;h+=4){const px=rq[h],py=rq[h+1],pz=rq[h+2],L=rq[h+3];
      for(let d=0;d<6;d++){const nx=px+DX[d],ny=py+DY[d],nz=pz+DZ[d];if(ny<0||ny>=CH)continue;
        const nc=this.chunk(nx>>4,nz>>4);if(!nc||!nc.lit)continue;const ni=(nx&15)|((nz&15)<<4)|(ny<<8),nv=nc.l[ni],nl=sky?nv>>4:nv&15;
        if(nl===0)continue;
        if(nl<L||(sky&&d===DOWN&&L===15&&nl===15)){nc.l[ni]=sky?(nv&15):(nv&0xF0);this.dirtyAt(nc,nx,nz);rq.push(nx,ny,nz,nl);
          if(!sky&&EMIT[nc.b[ni]]){nc.l[ni]=(nc.l[ni]&0xF0)|EMIT[nc.b[ni]];aq.push(nx,ny,nz);}}
        else aq.push(nx,ny,nz);}}
    this.propagate(aq,sky);}
  initLight(c){
    const b=c.b,l=c.l,wx0=c.cx*16,wz0=c.cz*16;l.fill(0);c.lit=true;
    for(let z=0;z<16;z++)for(let x=0;x<16;x++){let L=15,hm=CH;
      for(let y=CH-1;y>=0;y--){const i=x|(z<<4)|(y<<8),a=ATTEN[b[i]];if(a>=15)break;if(a>0)L=Math.max(0,L-a);if(L===15)hm=y;l[i]=L<<4;if(L===0)break;}
      c.hm[x+z*16]=Math.min(hm,CH-1);}
    const q=[];
    const nbh=(x,z)=>{if(x>=0&&x<16&&z>=0&&z<16)return c.hm[x+z*16];const n=this.chunk((wx0+x)>>4,(wz0+z)>>4);
      if(n&&n.lit)return n.hm[((wx0+x)&15)+((wz0+z)&15)*16];return -1;};
    for(let z=0;z<16;z++)for(let x=0;x<16;x++){const h=c.hm[x+z*16];
      const mx=Math.max(h,nbh(x+1,z),nbh(x-1,z),nbh(x,z+1),nbh(x,z-1));
      for(let y=h;y<=mx&&y<CH;y++)q.push(wx0+x,y,wz0+z);
      for(let y=h-1;y>=0;y--){const L=l[x|(z<<4)|(y<<8)]>>4;if(L===0)break;if(L>1)q.push(wx0+x,y,wz0+z);}}
    const bq=[];
    for(let i=0;i<b.length;i++)if(EMIT[b[i]]){l[i]|=EMIT[b[i]];bq.push(wx0+(i&15),i>>8,wz0+((i>>4)&15));}
    const pull=(n,fx)=>{if(!n||!n.lit)return;const nwx=n.cx*16,nwz=n.cz*16;
      for(let y=0;y<CH;y++)for(let k=0;k<16;k++){const[lx,lz]=fx(k);const v=n.l[lx|(lz<<4)|(y<<8)];
        if((v>>4)>1)q.push(nwx+lx,y,nwz+lz);if((v&15)>1)bq.push(nwx+lx,y,nwz+lz);}};
    pull(this.chunk(c.cx-1,c.cz),k=>[15,k]);pull(this.chunk(c.cx+1,c.cz),k=>[0,k]);
    pull(this.chunk(c.cx,c.cz-1),k=>[k,15]);pull(this.chunk(c.cx,c.cz+1),k=>[k,0]);
    this.propagate(q,true);this.propagate(bq,false);}
  dirtyAt(c,x,z){c.dirty=true;const lx=x&15,lz=z&15;if(lx>0&&lx<15&&lz>0&&lz<15)return;
    const ex=lx===0?-1:lx===15?1:0,ez=lz===0?-1:lz===15?1:0;let n;
    if(ex&&(n=this.chunk(c.cx+ex,c.cz)))n.dirty=true;if(ez&&(n=this.chunk(c.cx,c.cz+ez)))n.dirty=true;
    if(ex&&ez&&(n=this.chunk(c.cx+ex,c.cz+ez)))n.dirty=true;}
  set(x,y,z,id,record=true){
    if(y<0||y>=CH)return;const c=this.chunk(x>>4,z>>4);if(!c)return;const i=(x&15)|((z&15)<<4)|(y<<8),old=c.b[i];if(old===id)return;
    c.b[i]=id;this.dirtyAt(c,x,z);
    if(record){const k=ckey(c.cx,c.cz);let m=this.edits.get(k);if(!m){m=new Map();this.edits.set(k,m);}m.set(i,id);}
    // 높이 지도 (비가 내리는 곳)
    const hi=(x&15)+(z&15)*16;
    if(ATTEN[id]>0&&y>=c.hm[hi])c.hm[hi]=Math.min(CH-1,y+1);
    else if(ATTEN[id]===0&&y===c.hm[hi]-1){let yy=y;while(yy>0&&ATTEN[c.b[(x&15)|((z&15)<<4)|(yy<<8)]]===0)yy--;c.hm[hi]=yy+1;}
    // 물 · 용암 이웃 깨우기
    for(let d=-1;d<6;d++){const nx=d<0?x:x+DX[d],ny=d<0?y:y+DY[d],nz=d<0?z:z+DZ[d];const nb=d<0?id:this.get(nx,ny,nz);
      if(FLUID[nb])this.schedule(nx,ny,nz,FLUID[nb]===1?5:30);}
    if(!c.lit)return;
    if(EMIT[old]>0||ATTEN[id]>ATTEN[old]||EMIT[id]<EMIT[old])this.removeLight(x,y,z,false);
    if(EMIT[id]>0){c.l[i]=(c.l[i]&0xF0)|EMIT[id];this.propagate([x,y,z],false);}
    const nbq=()=>{const a=[];for(let d=0;d<6;d++)if(y+DY[d]>=0&&y+DY[d]<CH)a.push(x+DX[d],y+DY[d],z+DZ[d]);return a;};
    if(ATTEN[id]<ATTEN[old])this.propagate(nbq(),false);
    if(ATTEN[id]>ATTEN[old])this.removeLight(x,y,z,true);else if(ATTEN[id]<ATTEN[old])this.propagate(nbq(),true);}
  /* ---------- 물 · 용암 ---------- */
  schedule(x,y,z,delay){const k=x+','+y+','+z,due=this.tick+delay;const cur=this.fq.get(k);if(cur===undefined||cur>due)this.fq.set(k,due);}
  tickFluids(onBreak){this.tick++;if(!this.fq.size)return;const due=[];
    for(const[k,t]of this.fq)if(t<=this.tick){due.push(k);if(due.length>600)break;}
    for(const k of due){this.fq.delete(k);const[x,y,z]=k.split(',').map(Number);if(this.loaded(x,z))this.updateFluid(x,y,z,onBreak);}}
  flowInto(x,y,z,f,L,onBreak){const cur=this.get(x,y,z);
    if(FLUID[cur]&&FLUID[cur]!==f){if(f===2){this.set(x,y,z,B.STONE);return true;}return false;}
    if(FLUID[cur]===f){const cl=FLEVEL[cur];if(cl===0||cl===8||cl<=L)return false;}
    else if(SOLID[cur]||(cur&&!REPL[cur]&&RTYPE[cur]===R_CUBE))return false;
    else if(cur&&!FLUID[cur]&&onBreak)onBreak(x,y,z,cur);
    this.set(x,y,z,fluidId(f,L));this.schedule(x,y,z,f===1?5:30);return true;}
  updateFluid(x,y,z,onBreak){
    const id=this.get(x,y,z),f=FLUID[id];if(!f)return;const maxL=f===1?7:3;let L=FLEVEL[id];
    if(f===2){// 용암 + 물 = 흑요석 / 조약돌
      for(const[dx,dy,dz]of[[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0]])if(FLUID[this.get(x+dx,y+dy,z+dz)]===1){this.set(x,y,z,L===0?B.OBSIDIAN:B.COBBLE);return;}}
    if(L!==0){let nl;const above=this.get(x,y+1,z);
      if(FLUID[above]===f)nl=8;
      else{let best=99,src=0;for(let d=0;d<4;d++){const n=this.get(x+DIRS[d][0],y,z+DIRS[d][1]);if(FLUID[n]!==f)continue;const k=FLEVEL[n];if(k===0)src++;best=Math.min(best,(k===0||k===8)?1:k+1);}
        nl=best<=maxL?best:-1;const below=this.get(x,y-1,z);
        if(f===1&&src>=2&&(SOLID[below]||(FLUID[below]===1&&FLEVEL[below]===0)))nl=0;}
      if(nl<0){this.set(x,y,z,0);return;}
      if(nl!==L){this.set(x,y,z,fluidId(f,nl));L=nl;}}
    if(y>0){const below=this.get(x,y-1,z);
      if(FLUID[below]===f){if(L!==0)return;}
      else if(!SOLID[below]){if(this.flowInto(x,y-1,z,f,8,onBreak)&&L!==0)return;}}
    const nl=(L===0||L===8)?1:L+1;if(nl>maxL)return;
    for(let d=0;d<4;d++)this.flowInto(x+DIRS[d][0],y,z+DIRS[d][1],f,nl,onBreak);}
}
