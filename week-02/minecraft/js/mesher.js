'use strict';
/* =====================================================================
   mesher.js — 청크를 삼각형으로 바꿔요
   (보이는 면만, 부드러운 조명, 모서리 그림자, 반 블록·계단·물 높이)
   ===================================================================== */
class MBuf{constructor(){this.cap=8192;this.alloc();this.n=0;}
  alloc(){this.ab=new ArrayBuffer(this.cap*48);this.i16=new Int16Array(this.ab);this.u8=new Uint8Array(this.ab);}
  grow(){const old=this.u8;this.cap*=2;this.alloc();this.u8.set(old);}
  quad(p,uv,layer,sk,bl,sh,rot){if(this.n>=this.cap)this.grow();const i16=this.i16,u8=this.u8;
    for(let k=0;k<4;k++){const s=(k+rot)&3,v=this.n*4+k,o=v*6,b=v*12;
      i16[o]=p[s*3];i16[o+1]=p[s*3+1];i16[o+2]=p[s*3+2];u8[b+6]=uv[s*2];u8[b+7]=uv[s*2+1];u8[b+8]=layer;u8[b+9]=sk[s];u8[b+10]=bl[s];u8[b+11]=sh[s];}
    this.n++;}
  data(){return new Uint8Array(this.ab,0,this.n*48);}}
const MO=new MBuf(),MW=new MBuf();
const PX=18,PXZ=324,PN=PXZ*(CH+2);
const padB=new Uint8Array(PN),padL=new Uint8Array(PN);
const FACES=[
  {n:[1,0,0],c:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]],s:0.6,ax:[1,2],uv:(x,y,z)=>[1-z,1-y]},
  {n:[-1,0,0],c:[[0,0,1],[0,1,1],[0,1,0],[0,0,0]],s:0.6,ax:[1,2],uv:(x,y,z)=>[z,1-y]},
  {n:[0,1,0],c:[[0,1,0],[0,1,1],[1,1,1],[1,1,0]],s:1.0,ax:[0,2],uv:(x,y,z)=>[x,z]},
  {n:[0,-1,0],c:[[0,0,1],[0,0,0],[1,0,0],[1,0,1]],s:0.5,ax:[0,2],uv:(x,y,z)=>[x,1-z]},
  {n:[0,0,1],c:[[1,0,1],[1,1,1],[0,1,1],[0,0,1]],s:0.8,ax:[0,1],uv:(x,y,z)=>[x,1-y]},
  {n:[0,0,-1],c:[[0,0,0],[0,1,0],[1,1,0],[1,0,0]],s:0.8,ax:[0,1],uv:(x,y,z)=>[1-x,1-y]}];
const AXOFF=[1,PXZ,PX];
const FN=[],FS1=[],FS2=[],FCC=[],FPOS=[],FUV=[];
FACES.forEach((f,fi)=>{FN[fi]=f.n[0]+f.n[1]*PXZ+f.n[2]*PX;FS1[fi]=[];FS2[fi]=[];FCC[fi]=[];FPOS[fi]=[];FUV[fi]=[];
  f.c.forEach(c=>{const s1=(c[f.ax[0]]?1:-1)*AXOFF[f.ax[0]],s2=(c[f.ax[1]]?1:-1)*AXOFF[f.ax[1]];
    FS1[fi].push(s1);FS2[fi].push(s2);FCC[fi].push(s1+s2);FPOS[fi].push(c[0]*64,c[1]*64,c[2]*64);const uv=f.uv(c[0],c[1],c[2]);FUV[fi].push(uv[0]*16,uv[1]*16);});});
const AOF=[0.42,0.62,0.8,1.0];
const LOPQ=new Uint8Array(256);for(let i=0;i<256;i++)LOPQ[i]=ATTEN[i]>=15?1:0;
const tp=new Int16Array(12),tuv=new Uint8Array(8),tsk=new Uint8Array(4),tbl=new Uint8Array(4),tsh=new Uint8Array(4);
function fillPad(world,c){
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const n=world.chunk(c.cx+dx,c.cz+dz);
    const x0=dx<0?15:0,x1=dx>0?0:15,z0=dz<0?15:0,z1=dz>0?0:15;
    for(let y=0;y<CH;y++)for(let z=z0;z<=z1;z++){const pb=(z+dz*16+1)*PX+(y+1)*PXZ+dx*16+1,ci=(y<<8)|(z<<4);
      for(let x=x0;x<=x1;x++){padB[pb+x]=n.b[ci|x];padL[pb+x]=n.l[ci|x];}}}
  for(let i=0;i<PXZ;i++){padB[i]=B.BEDROCK;padL[i]=0;padB[PN-PXZ+i]=0;padL[PN-PXZ+i]=0xF0;}}
function shouldDraw(b,nb){if(nb===0)return true;if(OPQ[nb])return false;if(nb===b&&BLOCKS[b].cullSame)return false;return true;}
function lightOfCell(i){return LOPQ[padB[i]]?padL[i+PXZ]:padL[i];}
// 물 높이 (0~1)
function fluidH(id,above,f){if(FLUID[id]!==f)return -1;if(FLUID[above]===f)return 1;const L=FLEVEL[id];
  if(L===0||L===8)return 0.889;return f===1?(8-L)/9:(8-2*L)/9;}
function cornerH(pi,cx,cz,f){let sum=0,w=0;
  for(let dz=cz-1;dz<=cz;dz++)for(let dx=cx-1;dx<=cx;dx++){const i=pi+dx+dz*PX,h=fluidH(padB[i],padB[i+PXZ],f);
    if(h===1)return 1;if(h>=0){const wt=h>=0.88?10:1;sum+=h*wt;w+=wt;}else if(!SOLID[padB[i]]){w+=1;}}
  return w?sum/w:0.889;}
function emitBoxes(mb,boxes,x,y,z,b,pi){
  for(const bx of boxes){const[x0,y0,z0,x1,y1,z1]=bx;
    for(let f=0;f<6;f++){
      const onEdge=(f===0&&x1===16)||(f===1&&x0===0)||(f===2&&y1===16)||(f===3&&y0===0)||(f===4&&z1===16)||(f===5&&z0===0);
      const npi=pi+FN[f];if(onEdge&&OPQ[padB[npi]])continue;
      const L=OPQ[padB[npi]]||LOPQ[padB[npi]]?padL[pi]:padL[npi];
      tsk.fill((L>>4)*17);tbl.fill((L&15)*17);tsh.fill(Math.round(255*FACES[f].s));
      const fc=FACES[f].c;
      for(let k=0;k<4;k++){const c=fc[k];const px=c[0]?x1:x0,py=c[1]?y1:y0,pz=c[2]?z1:z0;
        tp[k*3]=x*64+px*4;tp[k*3+1]=y*64+py*4;tp[k*3+2]=z*64+pz*4;
        let u,v;switch(f){case 0:u=16-pz;v=16-py;break;case 1:u=pz;v=16-py;break;case 2:u=px;v=pz;break;case 3:u=px;v=16-pz;break;case 4:u=px;v=16-py;break;default:u=16-px;v=16-py;}
        tuv[k*2]=u;tuv[k*2+1]=v;}
      mb.quad(tp,tuv,BTEX[b*6+f],tsk,tbl,tsh,0);}}}
function meshChunk(world,c){
  fillPad(world,c);MO.n=0;MW.n=0;
  for(let y=0;y<CH;y++)for(let z=0;z<16;z++)for(let x=0;x<16;x++){
    const pi=(x+1)+(z+1)*PX+(y+1)*PXZ,b=padB[pi];if(!b)continue;const rt=RTYPE[b];
    if(rt===R_CUBE){
      for(let f=0;f<6;f++){const npi=pi+FN[f],nb=padB[npi];if(!shouldDraw(b,nb))continue;
        const L0=lightOfCell(npi),fs=FACES[f].s,pos=FPOS[f],uvs=FUV[f];
        for(let k=0;k<4;k++){
          const a1=npi+FS1[f][k],a2=npi+FS2[f][k],a3=npi+FCC[f][k];
          const o1=OPQ[padB[a1]],o2=OPQ[padB[a2]],o3=(o1&&o2)?1:OPQ[padB[a3]];
          let ss=L0>>4,bs=L0&15,cnt=1;
          if(!o1&&!LOPQ[padB[a1]]){ss+=padL[a1]>>4;bs+=padL[a1]&15;cnt++;}
          if(!o2&&!LOPQ[padB[a2]]){ss+=padL[a2]>>4;bs+=padL[a2]&15;cnt++;}
          if(!o3&&!LOPQ[padB[a3]]){ss+=padL[a3]>>4;bs+=padL[a3]&15;cnt++;}
          const ao=(o1&&o2)?0:3-o1-o2-o3;
          tsk[k]=Math.round(ss*17/cnt);tbl[k]=Math.round(bs*17/cnt);tsh[k]=Math.round(255*fs*AOF[ao]);
          tp[k*3]=pos[k*3]+x*64;tp[k*3+1]=pos[k*3+1]+y*64;tp[k*3+2]=pos[k*3+2]+z*64;tuv[k*2]=uvs[k*2];tuv[k*2+1]=uvs[k*2+1];}
        const flip=(tsh[0]+tsh[2]+tsk[0]+tsk[2]+tbl[0]+tbl[2])<(tsh[1]+tsh[3]+tsk[1]+tsk[3]+tbl[1]+tbl[3])?1:0;
        MO.quad(tp,tuv,BTEX[b*6+f],tsk,tbl,tsh,flip);}}
    else if(rt===R_BOX)emitBoxes(MO,BOXES[b],x,y,z,b,pi);
    else if(rt===R_DYN)emitBoxes(MO,dynBoxes(b,[padB[pi+1],padB[pi-1],padB[pi+PX],padB[pi-PX]]).r,x,y,z,b,pi);
    else if(rt===R_CROSS||rt===R_CROP){const L=padL[pi],layer=BTEX[b*6];tsk.fill((L>>4)*17);tbl.fill((L&15)*17);tsh.fill(235);
      const Y0=y*64-(BLOCKS[padB[pi-PXZ]]&&padB[pi-PXZ]>=60&&padB[pi-PXZ]<=61?4:0),Y1=Y0+64;
      let quads;
      if(rt===R_CROSS){const X0=x*64+5,X1=x*64+59,Z0=z*64+5,Z1=z*64+59;quads=[[X0,Z0,X1,Z1],[X1,Z1,X0,Z0],[X0,Z1,X1,Z0],[X1,Z0,X0,Z1]];}
      else{const X=x*64,Z=z*64;quads=[[X+16,Z,X+16,Z+64],[X+16,Z+64,X+16,Z],[X+48,Z,X+48,Z+64],[X+48,Z+64,X+48,Z],[X,Z+16,X+64,Z+16],[X+64,Z+16,X,Z+16],[X,Z+48,X+64,Z+48],[X+64,Z+48,X,Z+48]];}
      for(const[ax,az,bx,bz]of quads){tp.set([ax,Y0,az,ax,Y1,az,bx,Y1,bz,bx,Y0,bz]);tuv.set([0,16,0,0,16,0,16,16]);MO.quad(tp,tuv,layer,tsk,tbl,tsh,0);}}
    else if(rt===R_TORCH){const L=padL[pi];tsk.fill((L>>4)*17);tbl.fill((L&15)*17);torchMesh(MO,x,y,z,b,BTEX[b*6]);}
    else if(rt===R_FLUID){
      const f=FLUID[b],mb=f===1?MW:MO,above=padB[pi+PXZ];
      const h00=cornerH(pi,0,0,f),h10=cornerH(pi,1,0,f),h11=cornerH(pi,1,1,f),h01=cornerH(pi,0,1,f);
      const HC=(cx,cz)=>cx?(cz?h11:h10):(cz?h01:h00);
      for(let fi=0;fi<6;fi++){const npi=pi+FN[fi],nb=padB[npi];
        if(FLUID[nb]===f||OPQ[nb])continue;if(fi===2&&nb===B.ICE)continue;
        const L0=lightOfCell(npi),pos=FPOS[fi],uvs=FUV[fi],fc=FACES[fi].c;
        for(let k=0;k<4;k++){const c=fc[k];tp[k*3]=pos[k*3]+x*64;tp[k*3+1]=(c[1]?Math.round(HC(c[0],c[2])*64):0)+y*64;tp[k*3+2]=pos[k*3+2]+z*64;
          tuv[k*2]=uvs[k*2];tuv[k*2+1]=uvs[k*2+1];tsk[k]=(L0>>4)*17;tbl[k]=(L0&15)*17;tsh[k]=Math.round(255*FACES[fi].s);}
        mb.quad(tp,tuv,BTEX[b*6+fi],tsk,tbl,tsh,0);
        if(fi===2&&f===1){const t2=new Int16Array(12),u2=new Uint8Array(8);for(let k=0;k<4;k++){const s=3-k;t2.set(tp.subarray(s*3,s*3+3),k*3);u2[k*2]=tuv[s*2];u2[k*2+1]=tuv[s*2+1];}
          tsh.fill(200);mb.quad(t2,u2,BTEX[b*6+fi],tsk,tbl,tsh,0);}}}
  }
  uploadMesh(c,'o',MO);uploadMesh(c,'w',MW);c.dirty=false;c.meshed=true;}
function torchMesh(mb,x,y,z,b,layer){
  const w=BLOCKS[b].wall,dir=w===undefined?null:DIRS[w];
  const box=[7,0,7,9,10,9];
  const tf=(px,py,pz)=>{let X=px,Y=py,Z=pz;if(dir){X+=dir[0]*(-7+py*0.38);Z+=dir[1]*(-7+py*0.38);Y+=3.5;}
    return[Math.round(X*4)+x*64,Math.round(Y*4)+y*64,Math.round(Z*4)+z*64];};
  for(let f=0;f<6;f++){const fc=FACES[f].c;
    for(let k=0;k<4;k++){const c=fc[k];const px=c[0]?box[3]:box[0],py=c[1]?box[4]:box[1],pz=c[2]?box[5]:box[2];
      const v=tf(px,py,pz);tp[k*3]=v[0];tp[k*3+1]=v[1];tp[k*3+2]=v[2];
      let u,vv;if(f===2){u=c[0]?9:7;vv=c[2]?8:6;}else if(f===3){u=c[0]?9:7;vv=c[2]?16:14;}else{u=(f===0||f===5)?(1-c[f===0?2:0])*2+7:c[f===1?2:0]*2+7;vv=c[1]?6:16;}
      tuv[k*2]=u;tuv[k*2+1]=vv;tsh[k]=Math.round(255*FACES[f].s);}
    mb.quad(tp,tuv,layer,tsk,tbl,tsh,0);}}
