'use strict';
/* =====================================================================
   models.js — 동물 · 몬스터 · 플레이어 상자 모델과 피부 그림
   (단위: 픽셀, 발바닥 y=0, 앞쪽은 -z)
   ===================================================================== */
const HUMAN=(arm,leg)=>[
  {n:'head',p:[0,24,0],b:[-4,0,-4,8,8,8]},{n:'body',p:[0,12,0],b:[-4,0,-2,8,12,4]},
  {n:'rarm',p:[-4-arm/2,22,0],b:[-arm/2,-10,-arm/2,arm,12,arm]},{n:'larm',p:[4+arm/2,22,0],b:[-arm/2,-10,-arm/2,arm,12,arm]},
  {n:'rleg',p:[-2,12,0],b:[-leg/2,-12,-leg/2,leg,12,leg]},{n:'lleg',p:[2,12,0],b:[-leg/2,-12,-leg/2,leg,12,leg]}];
const SPIDER_LEGS=[];[-1,1].forEach(s=>[0,1,2,3].forEach(i=>SPIDER_LEGS.push({n:'leg'+(s>0?'L':'R')+i,p:[s*4,9,-2+i*1.4],b:s>0?[0,-1,-1,16,2,2]:[-16,-1,-1,16,2,2],side:s,idx:i})));
const MODEL_DEFS={
  player:{scale:0.9375,w:0.3,h:1.8,parts:HUMAN(4,4)},
  zombie:{scale:0.9375,w:0.3,h:1.95,parts:HUMAN(4,4)},
  skeleton:{scale:0.9375,w:0.3,h:1.99,parts:HUMAN(2,2)},
  creeper:{scale:1,w:0.3,h:1.7,parts:[{n:'head',p:[0,18,0],b:[-4,0,-4,8,8,8]},{n:'body',p:[0,6,0],b:[-4,0,-2,8,12,4]},
    {n:'fl',p:[-2,6,-4],b:[-2,-6,-2,4,6,4]},{n:'fr',p:[2,6,-4],b:[-2,-6,-2,4,6,4]},{n:'bl',p:[-2,6,4],b:[-2,-6,-2,4,6,4]},{n:'br',p:[2,6,4],b:[-2,-6,-2,4,6,4]}]},
  pig:{scale:1,w:0.45,h:0.9,parts:[{n:'body',p:[0,6,0],b:[-5,0,-8,10,8,16]},{n:'head',p:[0,12,-8],b:[-4,-4,-8,8,8,8]},{n:'snout',par:'head',p:[0,12,-8],b:[-2,-3,-9,4,3,1]},
    {n:'fl',p:[-3,6,-5],b:[-2,-6,-2,4,6,4]},{n:'fr',p:[3,6,-5],b:[-2,-6,-2,4,6,4]},{n:'bl',p:[-3,6,6],b:[-2,-6,-2,4,6,4]},{n:'br',p:[3,6,6],b:[-2,-6,-2,4,6,4]}]},
  cow:{scale:1,w:0.45,h:1.4,parts:[{n:'body',p:[0,12,0],b:[-6,0,-9,12,10,18]},{n:'head',p:[0,20,-9],b:[-4,-4,-6,8,8,6]},
    {n:'hornL',par:'head',p:[0,20,-9],b:[-5,2,-4,1,3,1]},{n:'hornR',par:'head',p:[0,20,-9],b:[4,2,-4,1,3,1]},
    {n:'fl',p:[-4,12,-6],b:[-2,-12,-2,4,12,4]},{n:'fr',p:[4,12,-6],b:[-2,-12,-2,4,12,4]},{n:'bl',p:[-4,12,7],b:[-2,-12,-2,4,12,4]},{n:'br',p:[4,12,7],b:[-2,-12,-2,4,12,4]}]},
  sheep:{scale:1,w:0.45,h:1.3,parts:[{n:'body',p:[0,12,0],b:[-5,0,-8,10,9,17]},{n:'head',p:[0,19,-8],b:[-3,-3,-7,6,6,8]},
    {n:'fl',p:[-3,12,-5],b:[-2,-12,-2,4,12,4]},{n:'fr',p:[3,12,-5],b:[-2,-12,-2,4,12,4]},{n:'bl',p:[-3,12,6],b:[-2,-12,-2,4,12,4]},{n:'br',p:[3,12,6],b:[-2,-12,-2,4,12,4]}]},
  chicken:{scale:1,w:0.2,h:0.7,parts:[{n:'body',p:[0,5,0],b:[-3,0,-4,6,6,8]},{n:'head',p:[0,9,-4],b:[-2,0,-3,4,6,3]},
    {n:'beak',par:'head',p:[0,9,-4],b:[-2,2,-5,4,2,2]},{n:'wattle',par:'head',p:[0,9,-4],b:[-1,0,-4,2,2,2]},
    {n:'wingR',p:[-3,10,0],b:[-1,-4,-3,1,4,6]},{n:'wingL',p:[3,10,0],b:[0,-4,-3,1,4,6]},
    {n:'legR',p:[-1.5,5,1],b:[-0.5,-5,-0.5,1,5,1]},{n:'legL',p:[1.5,5,1],b:[-0.5,-5,-0.5,1,5,1]}]},
  spider:{scale:1,w:0.7,h:0.9,parts:[{n:'neck',p:[0,9,0],b:[-3,-3,-3,6,6,6]},{n:'head',p:[0,9,-3],b:[-4,-4,-8,8,8,8]},
    {n:'abdomen',p:[0,9,3],b:[-5,-4,0,10,8,12]},...SPIDER_LEGS]}};
/* ---------- 피부 색칠 ---------- */
function noiseC(c,r,amt=0.12){const f=1-amt/2+r()*amt;return[c[0]*f,c[1]*f,c[2]*f];}
const EYE=[[240,240,240],[30,30,30]];
const PAINT={
  player(p,face,x,y,w,h,r){
    if(p==='head'){if(face==='top'||face==='back'||y<2||(face!=='front'&&y<4&&(face!=='bottom')))return noiseC([66,44,22],r,0.2);
      if(face==='bottom')return[176,124,94];
      if(face==='front'){if(y===4&&(x===1||x===6))return[240,240,240];if(y===4&&(x===2||x===5))return[70,60,160];if(y===6&&(x===3||x===4))return[140,84,64];if(y===2&&x>0&&x<7)return[66,44,22];}
      return noiseC([198,144,112],r,0.06);}
    if(p==='body')return noiseC([0,168,168],r,0.12);
    if(p==='rarm'||p==='larm')return y<4&&face!=='bottom'||face==='top'?noiseC([0,168,168],r,0.12):noiseC([198,144,112],r,0.06);
    return y>=h-2&&face!=='top'||face==='bottom'?noiseC([90,90,96],r,0.1):noiseC([54,64,170],r,0.12);},
  zombie(p,face,x,y,w,h,r){
    if(p==='head'){if(face==='front'){if(y===4&&(x===1||x===2||x===5||x===6))return[20,30,20];if(y===6&&x>2&&x<5)return[40,70,40];}
      if(face==='top'||y<2)return noiseC([50,100,46],r,0.2);return noiseC([84,144,74],r,0.14);}
    if(p==='body')return noiseC([40,160,170],r,0.15);
    if(p==='rarm'||p==='larm')return y<3&&face!=='bottom'?noiseC([40,160,170],r,0.15):noiseC([84,144,74],r,0.14);
    return noiseC([64,62,160],r,0.14);},
  skeleton(p,face,x,y,w,h,r){const bone=noiseC([196,196,196],r,0.12);
    if(p==='head'&&face==='front'){if((y===3||y===4)&&(x===1||x===2||x===5||x===6))return[30,30,30];if(y===5&&(x===3||x===4))return[60,60,60];if(y===6&&x>1&&x<6&&x%2===0)return[70,70,70];}
    if(p==='body'&&(face==='front'||face==='back')){if(y%2===1&&y<9&&x>0&&x<7)return[60,60,60];if(y>=9)return[90,90,90];}
    if(p==='body'&&face!=='front'&&face!=='back')return[80,80,80];
    return bone;},
  creeper(p,face,x,y,w,h,r){
    if(p==='head'&&face==='front'){const F=['........','........','.##..##.','.##..##.','...##...','..####..','..####..','..#..#..'];if(F[y]&&F[y][x]==='#')return[16,20,16];}
    const pal=[[80,180,80],[100,204,90],[60,150,60],[126,222,120],[44,112,44]];return pal[r()*pal.length|0];},
  pig(p,face,x,y,w,h,r){
    if(p==='head'&&face==='front'&&y===3){if(x===1||x===6)return EYE[0];if(x===2||x===5)return EYE[1];}
    if(p==='snout'&&face==='front'){if(y===1&&(x===0||x===3))return[150,80,80];return[250,184,184];}
    if((p[0]==='f'||p[0]==='b')&&p.length===2&&y>=h-1&&face!=='top')return[190,110,110];
    return noiseC([240,162,160],r,0.08);},
  cow(p,face,x,y,w,h,r){
    if(p==='hornL'||p==='hornR')return[220,220,210];
    if(p==='head'){if(face==='front'){if(y>=5)return y===6&&(x===2||x===5)?[60,30,30]:[214,170,160];if(y===2&&(x===1||x===6))return EYE[0];if(y===2&&(x===2||x===5))return EYE[1];
      if(x>=3&&x<=4)return[236,236,236];}return noiseC([44,38,34],r,0.15);}
    if(p.length===2){if(y>=h-2&&face!=='top')return[40,36,30];if(y>=h-6)return[230,230,230];}
    const n=Math.sin(x*0.9+(face==='front'?3:0))*Math.cos(y*0.7+p.length);return n>0.35?noiseC([236,236,236],r,0.06):noiseC([46,40,36],r,0.15);},
  sheep(p,face,x,y,w,h,r){
    if(p==='head'){if(face==='front'||face==='bottom'){if(face==='front'&&y===2&&(x===1||x===4))return EYE[1];if(face==='front'&&y===2&&(x===0||x===5))return EYE[0];return noiseC([214,186,168],r,0.06);}
      return noiseC([236,236,236],r,0.08);}
    if(p.length===2)return y<5&&face!=='bottom'?noiseC([236,236,236],r,0.08):noiseC([214,186,168],r,0.06);
    return noiseC([238,238,238],r,0.1);},
  chicken(p,face,x,y,w,h,r){
    if(p==='beak')return[236,170,40];if(p==='wattle')return[210,30,30];if(p==='legR'||p==='legL')return[236,170,40];
    if(p==='head'&&face==='front'&&y===1&&(x===0||x===3))return[20,20,20];
    return noiseC([244,244,244],r,0.06);},
  spider(p,face,x,y,w,h,r){
    if(p==='head'&&face==='front'){const eyes=[[1,3],[2,3],[5,3],[6,3],[3,2],[4,2],[2,1],[5,1]];if(eyes.some(([a,b])=>a===x&&b===y))return[200,10,10];}
    return noiseC(r()<0.2?[80,70,60]:[50,42,38],r,0.2);}};
/* 상자 펼침 좌표 자동 배치 + 그림 */
function buildModelTex(type){
  const def=MODEL_DEFS[type],paint=PAINT[type];let u=0,v=0,rowH=0;const TW=128;
  for(const pt of def.parts){const[, , ,w,h,d]=pt.b;const bw=Math.ceil(2*(d+w)),bh=Math.ceil(d+h);
    if(u+bw>TW){u=0;v+=rowH;rowH=0;}pt.uv=[u,v];u+=bw;rowH=Math.max(rowH,bh);}
  const TH=Math.max(32,1<<Math.ceil(Math.log2(v+rowH)));
  const c=document.createElement('canvas');c.width=TW;c.height=TH;const g=c.getContext('2d');const img=g.createImageData(TW,TH);
  const r=mulberry32(type.length*977+type.charCodeAt(0));
  for(const pt of def.parts){const[, , ,w0,h0,d0]=pt.b;const w=Math.ceil(w0),h=Math.ceil(h0),d=Math.ceil(d0),[u0,v0]=pt.uv;
    const regions={nx:[u0,v0+d,d,h],front:[u0+d,v0+d,w,h],px:[u0+d+w,v0+d,d,h],back:[u0+2*d+w,v0+d,w,h],top:[u0+d,v0,w,d],bottom:[u0+d+w,v0,w,d]};
    for(const face in regions){const[ru,rv,rw,rh]=regions[face];
      for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){const col=paint(pt.n,face,x,y,rw,rh,r)||[255,0,255];const i=((rv+y)*TW+ru+x)*4;
        img.data[i]=col[0];img.data[i+1]=col[1];img.data[i+2]=col[2];img.data[i+3]=255;}}}
  g.putImageData(img,0,0);def.tw=TW;def.th=TH;return c;}
const FACE_KEYS=['px','nx','top','bottom','back','front'];
function partFloats(def,pt){const[x0,y0,z0,w,h,d]=pt.b,x1=x0+w,y1=y0+h,z1=z0+d;const W=Math.ceil(w),H=Math.ceil(h),D=Math.ceil(d),[u0,v0]=pt.uv;
  const regions={nx:[u0,v0+D,D,H],front:[u0+D,v0+D,W,H],px:[u0+D+W,v0+D,D,H],back:[u0+2*D+W,v0+D,W,H],top:[u0+D,v0,W,D],bottom:[u0+D+W,v0,W,D]};
  const a=[];
  FACES.forEach((f,fi)=>{const[ru,rv,rw,rh]=regions[FACE_KEYS[fi]];
    const p=f.c.map(c=>[c[0]?x1:x0,c[1]?y1:y0,c[2]?z1:z0]),uv=f.c.map(c=>{const t=f.uv(c[0],c[1],c[2]);return[(ru+t[0]*rw)/def.tw,(rv+t[1]*rh)/def.th];});
    for(const k of[0,1,2,0,2,3])a.push(p[k][0],p[k][1],p[k][2],uv[k][0],uv[k][1],0,1,1,f.s);});
  return a;}
