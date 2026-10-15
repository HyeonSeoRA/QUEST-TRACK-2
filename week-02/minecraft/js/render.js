'use strict';
/* =====================================================================
   render.js — WebGL2 그리기 (하늘 · 청크 · 물 · 구름 · 비 · 엔티티 · 손)
   ===================================================================== */
const canvas=$('#gl');
const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'high-performance'});
function fatal(msg){const e=$('#err');e.style.display='flex';e.innerHTML=msg;}
if(!gl)fatal('이 브라우저는 WebGL2 를 지원하지 않아요.<br>최신 크롬이나 엣지에서 열어 주세요.');
function mkShader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function program(vs,fs){const p=gl.createProgram();gl.attachShader(p,mkShader(gl.VERTEX_SHADER,vs));gl.attachShader(p,mkShader(gl.FRAGMENT_SHADER,fs));
  gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
  const u={};const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<n;i++){const a=gl.getActiveUniform(p,i);u[a.name]=gl.getUniformLocation(p,a.name);}return{p,u};}
const LIGHT_GLSL=`
uniform float uDay;uniform vec3 uSkyTint;
float br(float l){return l/(4.0-3.0*l);}
vec3 lightOf(float sky,float blk){float s=br(sky*uDay),b=br(blk);
  vec3 c=max(s*uSkyTint,b*vec3(1.0,0.83,0.6));c=mix(c,1.0-pow(1.0-c,vec3(3.0)),0.5);return c*0.94+0.05;}`;
const ENT_VS=`#version 300 es
layout(location=0) in vec3 aPos;layout(location=1) in vec3 aUV;layout(location=2) in vec3 aL;
uniform mat4 uVP,uModel;uniform vec3 uCam;uniform vec2 uLight;
out vec3 vUV;out vec3 vL;out float vDist;
void main(){vec4 w=uModel*vec4(aPos,1.0);vUV=aUV;vL=vec3(aL.x*uLight.x,aL.y*uLight.y,aL.z);vDist=length(w.xz-uCam.xz);gl_Position=uVP*w;}`;
const P_CHUNK=program(`#version 300 es
layout(location=0) in vec3 aPos;layout(location=1) in vec2 aUV;layout(location=2) in float aLayer;layout(location=3) in vec3 aL;
uniform mat4 uVP;uniform vec3 uOff,uCam;uniform float uScroll;
out vec3 vUV;out vec3 vL;out float vDist;
void main(){vec3 p=aPos*(1.0/64.0)+uOff;vUV=vec3(aUV*(1.0/16.0)+vec2(0.0,uScroll),aLayer);vL=aL;vDist=length((p-uCam).xz);
gl_Position=uVP*vec4(p,1.0);}`,`#version 300 es
precision highp float;precision highp sampler2DArray;
in vec3 vUV;in vec3 vL;in float vDist;uniform sampler2DArray uTex;uniform vec3 uFogCol;uniform vec2 uFog;uniform float uAlpha;
${LIGHT_GLSL}
out vec4 o;
void main(){vec4 c=texture(uTex,vUV);if(uAlpha<0.5){if(c.a<0.5)discard;c.a=1.0;}
vec3 col=c.rgb*lightOf(vL.x,vL.y)*vL.z;o=vec4(mix(col,uFogCol,smoothstep(uFog.x,uFog.y,vDist)),c.a);}`);
const P_ENT=program(ENT_VS,`#version 300 es
precision highp float;precision highp sampler2DArray;
in vec3 vUV;in vec3 vL;in float vDist;uniform sampler2DArray uTex;uniform vec3 uFogCol;uniform vec2 uFog;uniform float uUnlit;uniform vec4 uTint;
${LIGHT_GLSL}
out vec4 o;
void main(){vec4 c=texture(uTex,vUV);if(uUnlit>0.5){o=vec4(c.rgb,1.0);return;}if(c.a<0.5)discard;
vec3 col=c.rgb*lightOf(vL.x,vL.y)*vL.z;col=mix(col,uTint.rgb,uTint.a);o=vec4(mix(col,uFogCol,smoothstep(uFog.x,uFog.y,vDist)),1.0);}`);
const P_MOB=program(ENT_VS,`#version 300 es
precision highp float;
in vec3 vUV;in vec3 vL;in float vDist;uniform sampler2D uTex;uniform vec3 uFogCol;uniform vec2 uFog;uniform float uHurt,uWhite;
${LIGHT_GLSL}
out vec4 o;
void main(){vec4 c=texture(uTex,vUV.xy);if(c.a<0.5)discard;
vec3 col=c.rgb*lightOf(vL.x,vL.y)*vL.z;col=mix(col,vec3(1.0,0.15,0.1),uHurt*0.55);col=mix(col,vec3(1.0),uWhite);
o=vec4(mix(col,uFogCol,smoothstep(uFog.x,uFog.y,vDist)),1.0);}`);
const P_SKY=program(`#version 300 es
layout(location=0) in vec2 aP;out vec2 vP;void main(){vP=aP;gl_Position=vec4(aP,0.9999,1.0);}`,`#version 300 es
precision highp float;in vec2 vP;uniform mat4 uInv;uniform vec3 uZen,uHor,uSunDir;uniform vec4 uSunset;uniform float uStars;
out vec4 o;
float hash(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
void main(){vec4 p=uInv*vec4(vP,1.0,1.0);vec3 d=normalize(p.xyz/p.w);float h=d.y;
vec3 col=mix(uHor,uZen,smoothstep(-0.02,0.42,h));
if(h<0.0)col=mix(uHor,uHor*0.55+uZen*0.15,smoothstep(0.0,-0.35,h));
float sd=max(dot(normalize(vec3(d.x,0.0,d.z)),normalize(vec3(uSunDir.x,0.0,uSunDir.z)+1e-5)),0.0);
col=mix(col,uSunset.rgb,uSunset.a*pow(sd,3.0)*(1.0-smoothstep(0.0,0.45,abs(h-0.05))));
if(uStars>0.01&&h>-0.05){float a=-atan(uSunDir.y,uSunDir.x);float ca=cos(a),sa=sin(a);vec3 rd=vec3(ca*d.x-sa*d.y,sa*d.x+ca*d.y,d.z);
vec3 g=rd*140.0;vec3 cell=floor(g);float hs=hash(cell);if(hs>0.9965){float dd=length(g-cell-0.5);
col+=vec3(smoothstep(0.42,0.0,dd))*uStars*(0.5+0.5*fract(hs*977.0));}}
o=vec4(col,1.0);}`);
const P_FLAT=program(`#version 300 es
layout(location=0) in vec3 aPos;layout(location=1) in vec2 aUV;uniform mat4 uVP,uModel;out vec2 vUV;
void main(){vUV=aUV;gl_Position=uVP*uModel*vec4(aPos,1.0);}`,`#version 300 es
precision highp float;in vec2 vUV;uniform sampler2D uTex;uniform vec4 uColor;out vec4 o;
void main(){o=texture(uTex,vUV)*uColor;if(o.a<0.004)discard;}`);
const P_CLOUD=program(`#version 300 es
layout(location=0) in vec4 aP;uniform mat4 uVP;uniform vec3 uOff,uCam;out float vS;out float vD;
void main(){vec3 p=aP.xyz+uOff;vS=aP.w;vD=length(p.xz-uCam.xz);gl_Position=uVP*vec4(p,1.0);}`,`#version 300 es
precision highp float;in float vS;in float vD;uniform vec3 uColor;uniform float uFade;out vec4 o;
void main(){o=vec4(uColor*vS,0.8*(1.0-smoothstep(uFade*0.55,uFade,vD)));}`);

/* ---------- 텍스처 ---------- */
const texArr=gl.createTexture();
{const L=TEXD.length,data=new Uint8Array(L*1024);TEXD.forEach((t,i)=>data.set(t,i*1024));
  gl.bindTexture(gl.TEXTURE_2D_ARRAY,texArr);gl.texImage3D(gl.TEXTURE_2D_ARRAY,0,gl.RGBA8,16,16,L,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
  gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.NEAREST_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAX_LEVEL,4);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.REPEAT);}
function tex2D(w,h,fn,repeat){const d=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=fn(x,y);if(c){const i=(y*w+x)*4;d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=c[3];}}
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,d);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
  const wr=repeat?gl.REPEAT:gl.CLAMP_TO_EDGE;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wr);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wr);return t;}
function canvasTex(c){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
const sunTex=tex2D(32,32,(x,y)=>{const d=Math.max(Math.abs(x-15.5),Math.abs(y-15.5));if(d<7)return d<5?[255,255,236,255]:[255,250,190,255];
  if(d<12)return[255,214,110,Math.round((12-d)/5*130)];return null;});
const moonTex=(()=>{const r=mulberry32(5);const cr=[];for(let i=0;i<6;i++)cr.push([10+r()*11|0,10+r()*11|0]);
  return tex2D(32,32,(x,y)=>{const d=Math.max(Math.abs(x-15.5),Math.abs(y-15.5));if(d>=6.5)return null;
    for(const[cx,cy]of cr)if(Math.abs(x-cx)<=1&&Math.abs(y-cy)<=1)return[150,150,166,255];return[214,214,226,255];});})();
const whiteTex=tex2D(1,1,()=>[255,255,255,255]);
const rainTex=(()=>{const r=mulberry32(77);const cols=[];for(let x=0;x<32;x++)cols.push(r()<0.35?[r()*64|0,4+(r()*6|0)]:null);
  return tex2D(32,64,(x,y)=>{const c=cols[x];if(!c)return null;const d=(y-c[0]+64)%64;return d<c[1]?[180,200,255,170]:null;},true);})();
const snowTex=(()=>{const r=mulberry32(78);const pts=[];for(let i=0;i<40;i++)pts.push([r()*32|0,r()*64|0]);
  return tex2D(32,64,(x,y)=>pts.some(([a,b])=>Math.abs(a-x)<=0&&Math.abs(b-y)<=1||Math.abs(a-x)<=1&&b===y)?[255,255,255,230]:null,true);})();
const MODEL_TEX={};

/* ---------- 버퍼 ---------- */
const ibo=gl.createBuffer();let iboQuads=0;
function ensureIBO(qn){if(qn<=iboQuads)return;const n=Math.max(qn,iboQuads*2,65536),a=new Uint32Array(n*6);
  for(let i=0;i<n;i++){const v=i*4,o=i*6;a[o]=v;a[o+1]=v+1;a[o+2]=v+2;a[o+3]=v;a[o+4]=v+2;a[o+5]=v+3;}
  gl.bindVertexArray(null);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,a,gl.STATIC_DRAW);iboQuads=n;}
ensureIBO(65536);
function setupChunkVAO(m){gl.bindVertexArray(m.vao);gl.bindBuffer(gl.ARRAY_BUFFER,m.vbo);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.SHORT,false,12,0);
  gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.UNSIGNED_BYTE,false,12,6);
  gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.UNSIGNED_BYTE,false,12,8);
  gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,3,gl.UNSIGNED_BYTE,true,12,9);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);gl.bindVertexArray(null);}
function uploadMesh(c,which,mb){let m=c[which];
  if(!mb.n){if(m){gl.deleteBuffer(m.vbo);gl.deleteVertexArray(m.vao);c[which]=null;}return;}
  ensureIBO(mb.n);
  if(!m){m={vao:gl.createVertexArray(),vbo:gl.createBuffer(),n:0};c[which]=m;setupChunkVAO(m);}
  gl.bindBuffer(gl.ARRAY_BUFFER,m.vbo);gl.bufferData(gl.ARRAY_BUFFER,mb.data(),gl.STATIC_DRAW);m.n=mb.n*6;}
function freeChunk(c){for(const w of['o','w']){const m=c[w];if(m){gl.deleteBuffer(m.vbo);gl.deleteVertexArray(m.vao);c[w]=null;}}}
function mkEntVAO(floats,dynamic){const vao=gl.createVertexArray(),vbo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
  gl.bufferData(gl.ARRAY_BUFFER,floats,dynamic?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,36,0);
  gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,36,12);
  gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,3,gl.FLOAT,false,36,24);
  gl.bindVertexArray(null);return{vao,vbo,n:floats.length/9};}
function pushQ(a,p,uv,layer,sh){for(const k of[0,1,2,0,2,3])a.push(p[k][0],p[k][1],p[k][2],uv[k][0],uv[k][1],layer,1,1,sh);}
function cubeFloats(id,x0=-0.5,y0=-0.5,z0=-0.5,x1=0.5,y1=0.5,z1=0.5,layerOverride,uvBox){const a=[];
  FACES.forEach((f,fi)=>{const p=f.c.map(c=>[c[0]?x1:x0,c[1]?y1:y0,c[2]?z1:z0]);
    let uv=f.c.map(c=>f.uv(c[0],c[1],c[2]));
    if(uvBox){// 상자 위치에 맞는 텍스처 부분 (반 블록 등)
      const[bx0,by0,bz0,bx1,by1,bz1]=uvBox;uv=f.c.map(c=>{const px=c[0]?bx1:bx0,py=c[1]?by1:by0,pz=c[2]?bz1:bz0;let u,v;
        switch(fi){case 0:u=16-pz;v=16-py;break;case 1:u=pz;v=16-py;break;case 2:u=px;v=pz;break;case 3:u=px;v=16-pz;break;case 4:u=px;v=16-py;break;default:u=16-px;v=16-py;}return[u/16,v/16];});}
    pushQ(a,p,uv,layerOverride!==undefined?layerOverride:BTEX[id*6+fi],f.s);});return a;}
function spriteFloats(layer){const a=[],t=TEXD[layer],d=1/32;
  pushQ(a,[[-0.5,-0.5,d],[0.5,-0.5,d],[0.5,0.5,d],[-0.5,0.5,d]],[[0,1],[1,1],[1,0],[0,0]],layer,1);
  pushQ(a,[[0.5,-0.5,-d],[-0.5,-0.5,-d],[-0.5,0.5,-d],[0.5,0.5,-d]],[[1,1],[0,1],[0,0],[1,0]],layer,0.75);
  const op=(x,y)=>A(t,x,y)>=128;
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){if(!op(x,y))continue;const X0=x/16-0.5,X1=X0+1/16,Y1=0.5-y/16,Y0=Y1-1/16,u=(x+0.5)/16,v=(y+0.5)/16,uv=[[u,v],[u,v],[u,v],[u,v]];
    if(!op(x-1,y))pushQ(a,[[X0,Y0,-d],[X0,Y0,d],[X0,Y1,d],[X0,Y1,-d]],uv,layer,0.7);
    if(!op(x+1,y))pushQ(a,[[X1,Y0,d],[X1,Y0,-d],[X1,Y1,-d],[X1,Y1,d]],uv,layer,0.7);
    if(!op(x,y-1))pushQ(a,[[X0,Y1,d],[X1,Y1,d],[X1,Y1,-d],[X0,Y1,-d]],uv,layer,0.9);
    if(!op(x,y+1))pushQ(a,[[X0,Y0,-d],[X1,Y0,-d],[X1,Y0,d],[X0,Y0,d]],uv,layer,0.6);}
  return a;}
function itemShape(id){// 손/바닥에 보일 모양: 'cube' | 상자 목록 | null(평면 그림)
  if(id>=256)return null;const rt=RTYPE[id];if(rt===R_CUBE)return'cube';if(rt===R_BOX)return BOXES[id];
  if(rt===R_DYN)return dynBoxes(id,[id,id,0,0]).r;return null;}
const meshCache=new Map();
function itemMesh(id){let m=meshCache.get(id);if(m)return m;const sh=itemShape(id);let f;
  if(sh==='cube')f=cubeFloats(id);
  else if(sh){f=[];for(const b of sh)f.push(...cubeFloats(id,b[0]/16-0.5,b[1]/16-0.5,b[2]/16-0.5,b[3]/16-0.5,b[4]/16-0.5,b[5]/16-0.5,undefined,b));}
  else f=spriteFloats(id<256?BTEX[id*6]:ITEMS[id].layer);
  m=mkEntVAO(new Float32Array(f));m.flat=!sh;meshCache.set(id,m);return m;}
const armMesh=mkEntVAO(new Float32Array(cubeFloats(0,-0.125,-0.125,-0.75,0.125,0.125,0,TEXL.skin)));
const dynEnt=mkEntVAO(new Float32Array(9*6*1500),true);
function mkFlatVAO(data,dynamic,bytes){const vao=gl.createVertexArray(),vbo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
  if(data)gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);else gl.bufferData(gl.ARRAY_BUFFER,bytes,gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,20,12);
  gl.bindVertexArray(null);return{vao,vbo};}
const flatQuad=mkFlatVAO(new Float32Array([-1,-1,0,0,1, 1,-1,0,1,1, 1,1,0,1,0, -1,-1,0,0,1, 1,1,0,1,0, -1,1,0,0,0]));
const dynFlat=mkFlatVAO(null,true,4*5*6*6*12*8);
const rainBuf=mkFlatVAO(null,true,4*5*6*800);
const skyVAO=(()=>{const vao=gl.createVertexArray(),vbo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  gl.bindVertexArray(null);return vao;})();
const CLOUD_N=64,CLOUD_S=12,CLOUD_Y=136;
const cloudMesh=(()=>{const n=new Simplex(4242),map=new Uint8Array(CLOUD_N*CLOUD_N);
  for(let z=0;z<CLOUD_N;z++)for(let x=0;x<CLOUD_N;x++){const a=x/CLOUD_N*Math.PI*2,b=z/CLOUD_N*Math.PI*2;
    const v=n.n3(Math.cos(a)*3+Math.sin(b)*0.7,Math.sin(a)*3,Math.cos(b)*3)*0.7+n.n3(Math.cos(a)*7,Math.sin(a)*7+Math.cos(b)*7,Math.sin(b)*7)*0.3;map[z*CLOUD_N+x]=v>0.12?1:0;}
  const has=(x,z)=>map[((z+CLOUD_N)%CLOUD_N)*CLOUD_N+((x+CLOUD_N)%CLOUD_N)];const a=[],S=CLOUD_S,Hh=4;
  const q4=(p,s)=>{for(const k of[0,1,2,0,2,3])a.push(p[k][0],p[k][1],p[k][2],s);};
  for(let z=0;z<CLOUD_N;z++)for(let x=0;x<CLOUD_N;x++){if(!has(x,z))continue;const X0=x*S,X1=X0+S,Z0=z*S,Z1=Z0+S;
    q4([[X0,Hh,Z0],[X0,Hh,Z1],[X1,Hh,Z1],[X1,Hh,Z0]],1.0);q4([[X0,0,Z1],[X0,0,Z0],[X1,0,Z0],[X1,0,Z1]],0.72);
    if(!has(x+1,z))q4([[X1,0,Z0],[X1,Hh,Z0],[X1,Hh,Z1],[X1,0,Z1]],0.86);if(!has(x-1,z))q4([[X0,0,Z1],[X0,Hh,Z1],[X0,Hh,Z0],[X0,0,Z0]],0.86);
    if(!has(x,z+1))q4([[X1,0,Z1],[X1,Hh,Z1],[X0,Hh,Z1],[X0,0,Z1]],0.92);if(!has(x,z-1))q4([[X0,0,Z0],[X0,Hh,Z0],[X1,Hh,Z0],[X1,0,Z0]],0.8);}
  const vao=gl.createVertexArray(),vbo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(a),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,4,gl.FLOAT,false,16,0);
  gl.bindVertexArray(null);return{vao,n:a.length/4};})();
/* ---------- 모델 ---------- */
function initModels(){for(const type in MODEL_DEFS){const def=MODEL_DEFS[type];const c=buildModelTex(type);MODEL_TEX[type]=canvasTex(c);
  for(const pt of def.parts)pt.mesh=mkEntVAO(new Float32Array(partFloats(def,pt)));}}
initModels();

/* =====================================================================
   카메라 · 장면
   ===================================================================== */
let VP=null,camPos=[0,0,0],camYaw=0,camPitch=0,fps=0,fpsAcc=0,fpsN=0,rendered=0;
function resize(){const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);applyGui();if(typeof buildHUD==='function')buildHUD();}
function skyColors(){
  const ang=game.time/24000*Math.PI*2,s=Math.sin(ang),day=clamp(0.5+s*2.2,0,1),rain=game.rainR||0;
  let zen=[lerp(0.01,0.47,day),lerp(0.012,0.65,day),lerp(0.035,1.0,day)],hor=[lerp(0.03,0.75,day),lerp(0.04,0.85,day),lerp(0.08,1.0,day)];
  if(rain>0){const g=(c)=>{const l=(c[0]+c[1]+c[2])/3*0.6;return c.map(v=>lerp(v,l,rain*0.85));};zen=g(zen);hor=g(hor);}
  const ss=clamp(1-Math.abs(s)*3.5,0,1)*(1-rain*0.8);
  return{ang,day:day*(1-rain*0.35),zen,hor,sun:[Math.cos(ang),Math.sin(ang),0.12],sunset:[1.0,0.48,0.18,ss*0.85]};}
function cameraEye(alpha){const p=player,ip=(a,b)=>a+(b-a)*alpha;
  return[ip(p.px,p.x),ip(p.py,p.y)+ip(p.peyeH,p.eyeH),ip(p.pz,p.z)];}
function render(alpha){
  const W=canvas.width,H=canvas.height;gl.viewport(0,0,W,H);
  const p=player;let ex,ey,ez,yaw=p.yaw,pitch=p.pitch;
  if(state==='title'){panoAngle+=0.0006;yaw=panoAngle;pitch=-0.12;ex=p.x;ey=p.y+1.62;ez=p.z;}
  else{[ex,ey,ez]=cameraEye(alpha);
    if(game.cam>0){// 3인칭: 뒤(1) 또는 앞(2)
      const dir=lookDirOf(yaw,pitch),sgn=game.cam===1?-1:1;let dist=4;
      const h=raycast(ex,ey,ez,dir[0]*sgn,dir[1]*sgn,dir[2]*sgn,4.2);if(h)dist=Math.max(0.5,h.t-0.25);
      ex+=dir[0]*sgn*dist;ey+=dir[1]*sgn*dist;ez+=dir[2]*sgn*dist;if(game.cam===2){yaw+=Math.PI;pitch=-pitch;}}}
  camPos=[ex,ey,ez];camYaw=yaw;camPitch=pitch;
  const sc=skyColors();
  const eyeB=state!=='title'?world.get(Math.floor(ex),Math.floor(ey),Math.floor(ez)):0;
  const under=FLUID[eyeB]===1,inLava=FLUID[eyeB]===2;
  let fog=sc.hor.slice();
  {const d=lookDirOf(yaw,pitch);const f=Math.max(0,d[0]*sc.sun[0]+d[2]*sc.sun[2])*sc.sunset[3]*0.6;fog=[lerp(fog[0],sc.sunset[0],f),lerp(fog[1],sc.sunset[1],f),lerp(fog[2],sc.sunset[2],f)];}
  const R=SET.rd*16;let fogR=[R*0.72*(1-(game.rainR||0)*0.3),R-4];
  if(under){fog=[0.05*sc.day+0.02,0.12*sc.day+0.03,0.38*sc.day+0.08];fogR=[0,22];}
  if(inLava){fog=[0.6,0.1,0];fogR=[0,1.5];}
  const bobW=lerp(p.pwalk,p.walk,alpha),bobA=SET.bob&&state==='game'&&game.cam===0?lerp(p.pbob,p.bob,alpha):0;
  const fov=SET.fov*Math.PI/180*(state==='game'?p.fovMul:1);
  const proj=mat.persp(fov,W/H,0.05,Math.max(300,R*2));
  const hurtRoll=state==='game'&&p.hurtAnim>0?Math.sin((p.hurtAnim-alpha)/10*Math.PI)*0.18*(p.hurtDir||1):0;
  const rot=mat.chain(mat.tr(Math.sin(bobW*Math.PI)*bobA*0.5,-Math.abs(Math.cos(bobW*Math.PI)*bobA),0),
    mat.rz(Math.sin(bobW*Math.PI)*bobA*3*Math.PI/180+hurtRoll),mat.rx(Math.abs(Math.cos(bobW*Math.PI-0.2)*bobA)*5*Math.PI/180),
    mat.rx(-pitch),mat.ry(-yaw));
  const view=mat.mul(rot,mat.tr(-ex,-ey,-ez));
  VP=mat.mul(proj,view);const VProt=mat.mul(proj,rot);
  gl.clearColor(fog[0],fog[1],fog[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.disable(gl.BLEND);
  if(!under&&!inLava){gl.depthMask(false);gl.useProgram(P_SKY.p);const u=P_SKY.u;gl.uniformMatrix4fv(u.uInv,false,mat.inv(VProt));
    gl.uniform3fv(u.uZen,sc.zen);gl.uniform3fv(u.uHor,fog);gl.uniform3fv(u.uSunDir,sc.sun);gl.uniform4fv(u.uSunset,sc.sunset);gl.uniform1f(u.uStars,clamp(1-sc.day*1.6,0,1)*(1-(game.rainR||0)));
    gl.bindVertexArray(skyVAO);gl.drawArrays(gl.TRIANGLES,0,3);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.disable(gl.CULL_FACE);gl.useProgram(P_FLAT.p);gl.uniformMatrix4fv(P_FLAT.u.uVP,false,VProt);
    gl.activeTexture(gl.TEXTURE1);gl.uniform1i(P_FLAT.u.uTex,1);
    const vis=1-(game.rainR||0);
    const body=(tex,a,size,col)=>{const m=mat.chain(mat.rz(a),mat.tr(100,0,0),mat.ry(-Math.PI/2),mat.sc(size));
      gl.uniformMatrix4fv(P_FLAT.u.uModel,false,m);gl.uniform4fv(P_FLAT.u.uColor,col);gl.bindTexture(gl.TEXTURE_2D,tex);gl.bindVertexArray(flatQuad.vao);gl.drawArrays(gl.TRIANGLES,0,6);};
    body(sunTex,sc.ang,30,[vis,vis,vis,1]);body(moonTex,sc.ang+Math.PI,22,[1,1,1,clamp(1.2-sc.day,0,1)*vis]);
    gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);gl.depthMask(true);}
  if(!world)return;
  const pl=frustum(VP);gl.useProgram(P_CHUNK.p);const u=P_CHUNK.u;
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D_ARRAY,texArr);gl.uniform1i(u.uTex,0);
  gl.uniformMatrix4fv(u.uVP,false,VP);gl.uniform3f(u.uCam,ex,ey,ez);gl.uniform3fv(u.uFogCol,fog);gl.uniform2fv(u.uFog,fogR);
  const dayMul=0.3+0.7*sc.day;gl.uniform1f(u.uDay,dayMul);const tint=[lerp(0.62,1,sc.day),lerp(0.68,1,sc.day),1];gl.uniform3fv(u.uSkyTint,tint);
  gl.uniform1f(u.uAlpha,0);gl.uniform1f(u.uScroll,0);
  const vis=[];rendered=0;
  for(const c of world.chunks.values()){if(!c.o&&!c.w)continue;const x0=c.cx*16,z0=c.cz*16;
    if(!boxVisible(pl,x0,0,z0,x0+16,CH,z0+16))continue;vis.push(c);
    if(c.o){gl.uniform3f(u.uOff,x0,0,z0);gl.bindVertexArray(c.o.vao);gl.drawElements(gl.TRIANGLES,c.o.n,gl.UNSIGNED_INT,0);rendered++;}}
  const env={fog,fogR,dayMul,tint,alpha};
  renderEntities(env);
  renderMobs(env);
  if(SET.clouds&&!under){gl.useProgram(P_CLOUD.p);const cu=P_CLOUD.u;gl.uniformMatrix4fv(cu.uVP,false,VP);gl.uniform3f(cu.uCam,ex,ey,ez);
    const cc=lerp(0.12,1,sc.day)*(1-(game.rainR||0)*0.4);gl.uniform3f(cu.uColor,cc*lerp(1,sc.sunset[0]*1.1,sc.sunset[3]*0.4),cc*lerp(1,0.8,sc.sunset[3]*0.4),cc*lerp(1,0.75,sc.sunset[3]*0.4));
    gl.uniform1f(cu.uFade,Math.max(160,R*1.6));
    const T=CLOUD_N*CLOUD_S,scroll=(game.ticks+alpha)*0.03,bx=Math.floor((ex-scroll)/T)*T+scroll,bz=Math.floor(ez/T)*T;
    gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.bindVertexArray(cloudMesh.vao);
    for(const pass of[0,1]){gl.colorMask(pass===1,pass===1,pass===1,pass===1);gl.depthMask(pass===0);
      for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){gl.uniform3f(cu.uOff,bx+i*T,CLOUD_Y,bz+j*T);gl.drawArrays(gl.TRIANGLES,0,cloudMesh.n);}}
    gl.colorMask(true,true,true,true);gl.depthMask(true);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);}
  if(state==='game'&&target&&!gui&&!hideHud)renderSelection(env);
  gl.useProgram(P_CHUNK.p);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  gl.uniform1f(u.uAlpha,1);gl.uniform1f(u.uScroll,((game.ticks+alpha)*0.012)%1);gl.disable(gl.CULL_FACE);
  vis.sort((a,b)=>Math.hypot(b.cx*16+8-ex,b.cz*16+8-ez)-Math.hypot(a.cx*16+8-ex,a.cz*16+8-ez));
  for(const c of vis)if(c.w){gl.uniform3f(u.uOff,c.cx*16,0,c.cz*16);gl.bindVertexArray(c.w.vao);gl.drawElements(gl.TRIANGLES,c.w.n,gl.UNSIGNED_INT,0);}
  gl.depthMask(true);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);
  if((game.rainR||0)>0.01&&state==='game')renderRain(env);
  if(state==='game'&&!hideHud&&gui!=='death'&&game.cam===0)renderHand(env);
  gl.bindVertexArray(null);}
function lightAt(x,y,z){const l=world.light(Math.floor(x),Math.floor(y),Math.floor(z));return[(l>>4)/15,(l&15)/15];}
function entUniforms(vp,env){gl.useProgram(P_ENT.p);const u=P_ENT.u;gl.uniformMatrix4fv(u.uVP,false,vp);gl.uniform3fv(u.uCam,camPos);
  gl.uniform3fv(u.uFogCol,env.fog);gl.uniform2fv(u.uFog,env.fogR);gl.uniform1f(u.uDay,env.dayMul);gl.uniform3fv(u.uSkyTint,env.tint);gl.uniform1f(u.uUnlit,0);gl.uniform4f(u.uTint,0,0,0,0);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D_ARRAY,texArr);gl.uniform1i(u.uTex,0);return u;}
function drawMesh(u,m,model){gl.uniformMatrix4fv(u.uModel,false,model);gl.bindVertexArray(m.vao);gl.drawArrays(gl.TRIANGLES,0,m.n);}
function billboards(u,list,env){// list: [x,y,z,size,layer,u0,v0,us,sky,blk,shade]
  if(!list.length)return;const cy=Math.cos(camYaw),sy=Math.sin(camYaw),sp=Math.sin(camPitch),cp=Math.cos(camPitch);
  const rx=cy,rz=-sy,ux=sp*sy,uy=cp,uz=sp*cy;const n=Math.min(list.length,1500);const a=new Float32Array(n*54);let o=0;
  for(let i=0;i<n;i++){const[x,y,z,s,layer,u0,v0,us,sk,bl,sh]=list[i];
    const c=[[-1,-1],[1,-1],[1,1],[-1,1]],uv=[[u0,v0+us],[u0+us,v0+us],[u0+us,v0],[u0,v0]];
    for(const k of[0,1,2,0,2,3]){a[o++]=x+(rx*c[k][0]+ux*c[k][1])*s;a[o++]=y+uy*c[k][1]*s;a[o++]=z+(rz*c[k][0]+uz*c[k][1])*s;
      a[o++]=uv[k][0];a[o++]=uv[k][1];a[o++]=layer;a[o++]=sk;a[o++]=bl;a[o++]=sh;}}
  gl.uniform2f(u.uLight,1,1);gl.uniformMatrix4fv(u.uModel,false,mat.id());gl.bindVertexArray(dynEnt.vao);gl.bindBuffer(gl.ARRAY_BUFFER,dynEnt.vbo);
  gl.bufferSubData(gl.ARRAY_BUFFER,0,a);gl.drawArrays(gl.TRIANGLES,0,n*6);}
function renderEntities(env){
  const u=entUniforms(VP,env),al=env.alpha,ip=(a,b)=>a+(b-a)*al,t=game.ticks+al;
  gl.disable(gl.CULL_FACE);
  for(const e of items){const x=ip(e.px,e.x),y=ip(e.py,e.y),z=ip(e.pz,e.z),m=itemMesh(e.id);
    const bob=Math.sin((t+e.rot*10)*0.1)*0.08+0.1;const copies=e.n>16?3:e.n>1?2:1;
    gl.uniform2fv(u.uLight,lightAt(x,y+0.2,z));
    for(let k=0;k<copies;k++)drawMesh(u,m,mat.chain(mat.tr(x+k*0.06,y+bob+0.12+k*0.04,z+k*0.05),mat.ry(t*0.05+e.rot),mat.sc(m.flat?0.4:0.25)));}
  for(const f of falling){const y=ip(f.py,f.y),m=itemMesh(f.id);gl.uniform2fv(u.uLight,lightAt(f.x,y+0.5,f.z));drawMesh(u,m,mat.chain(mat.tr(f.x,y+0.5,f.z),mat.sc(0.999)));}
  for(const tn of tnts){const x=ip(tn.px,tn.x),y=ip(tn.py,tn.y),z=ip(tn.pz,tn.z),m=itemMesh(B.TNT);
    const sw=tn.fuse<10?1+(1-tn.fuse/10)*0.15:1;gl.uniform2fv(u.uLight,lightAt(x,y+0.5,z));
    gl.uniform4f(u.uTint,1,1,1,((tn.fuse/5|0)%2)?0.6:0);drawMesh(u,m,mat.chain(mat.tr(x,y+0.5,z),mat.sc(sw)));gl.uniform4f(u.uTint,0,0,0,0);}
  const am=itemMesh(I.ARROW);
  for(const ar of arrows){const x=ip(ar.px,ar.x),y=ip(ar.py,ar.y),z=ip(ar.pz,ar.z);gl.uniform2fv(u.uLight,lightAt(x,y,z));
    drawMesh(u,am,mat.chain(mat.tr(x,y,z),mat.ry(ar.yaw),mat.rx(ar.pitch),mat.ry(Math.PI/2),mat.rz(-Math.PI/4),mat.sc(0.55)));}
  const bb=[];
  for(const q of particles){const x=ip(q.px,q.x),y=ip(q.py,q.y),z=ip(q.pz,q.z);let sk=1,bl=1;
    if(!q.bright){const l=world.light(Math.floor(x),Math.floor(y),Math.floor(z));sk=(l>>4)/15;bl=(l&15)/15;}
    const s=q.grow?q.s*(1+(1-q.life/q.max)*q.grow):q.s;bb.push([x,y,z,s,q.layer,q.u,q.v,q.us||0.25,sk,bl,q.shade||0.95]);}
  for(const o of orbs){const x=ip(o.px,o.x),y=ip(o.py,o.y),z=ip(o.pz,o.z);bb.push([x,y+0.1,z,0.1+Math.min(0.08,o.v*0.01)+Math.sin(t*0.3+o.rot)*0.02,TEXL.p_xp,0,0,1,1,1,1]);}
  billboards(u,bb,env);
  gl.enable(gl.CULL_FACE);}
function renderMobs(env){
  const list=mobs.filter(m=>Math.hypot(m.x-camPos[0],m.z-camPos[2])<SET.rd*16+8);
  if(game.cam>0&&state==='game')list.push(player);
  if(!list.length)return;
  gl.useProgram(P_MOB.p);const u=P_MOB.u;gl.uniformMatrix4fv(u.uVP,false,VP);gl.uniform3fv(u.uCam,camPos);gl.uniform3fv(u.uFogCol,env.fog);gl.uniform2fv(u.uFog,env.fogR);
  gl.uniform1f(u.uDay,env.dayMul);gl.uniform3fv(u.uSkyTint,env.tint);gl.activeTexture(gl.TEXTURE1);gl.uniform1i(u.uTex,1);
  const pl=frustum(VP);gl.disable(gl.CULL_FACE);
  for(const m of list){const al=env.alpha,x=lerp(m.px,m.x,al),y=lerp(m.py,m.y,al),z=lerp(m.pz,m.z,al),def=MODEL_DEFS[m.type];
    if(!boxVisible(pl,x-1.5,y-0.5,z-1.5,x+1.5,y+2.5,z+1.5))continue;
    gl.bindTexture(gl.TEXTURE_2D,MODEL_TEX[m.type]);gl.uniform2fv(u.uLight,lightAt(x,y+def.h*0.6,z));
    gl.uniform1f(u.uHurt,m.hurt>0||m.dead>0?1:0);
    const swell=m.type==='creeper'?lerp(m.pswell||0,m.swell||0,al):0;
    gl.uniform1f(u.uWhite,swell>0&&(Math.floor(swell*30)%2)?0.5:0);
    let base=mat.chain(mat.tr(x,y,z),mat.ry(lerp(m.pbody,m.body,al)));
    if(m.dead>0){const d=Math.min(1,(m.dead+al)/20);base=mat.mul(base,mat.rz(d*Math.PI/2));}
    const s=def.scale/16*(1+swell*0.25);base=mat.mul(base,mat.sc(s,s*(1+swell*0.05),s));
    const rots=animate(m,al);
    for(const pt of def.parts){const r=rots[pt.par||pt.n]||[0,0,0];
      gl.uniformMatrix4fv(u.uModel,false,mat.chain(base,mat.tr(pt.p[0],pt.p[1],pt.p[2]),mat.ry(r[1]),mat.rx(r[0]),mat.rz(r[2])));
      gl.bindVertexArray(pt.mesh.vao);gl.drawArrays(gl.TRIANGLES,0,pt.mesh.n);}
    // 들고 있는 아이템 (플레이어 · 스켈레톤)
    const hid=m===player?(held()?held().id:0):m.type==='skeleton'?I.BOW:0;
    if(hid){const r=rots.rarm||[0,0,0],im=itemMesh(hid);const eu=entUniforms(VP,env);gl.uniform2fv(eu.uLight,lightAt(x,y+1,z));
      const arm=def.parts.find(p=>p.n==='rarm');
      drawMesh(eu,im,mat.chain(base,mat.tr(arm.p[0],arm.p[1],arm.p[2]),mat.ry(r[1]),mat.rx(r[0]),mat.rz(r[2]),mat.tr(0,-9,-2),mat.sc(16*(im.flat?0.6:0.375)),
        im.flat?mat.chain(mat.rx(-Math.PI/2),mat.ry(Math.PI/2),mat.rz(Math.PI/4)):mat.id()));
      gl.useProgram(P_MOB.p);gl.activeTexture(gl.TEXTURE1);}}
  gl.uniform1f(u.uHurt,0);gl.uniform1f(u.uWhite,0);gl.enable(gl.CULL_FACE);}
function renderSelection(env){
  const t=target;const shape=world.shape(t.b,t.x,t.y,t.z,false)||[blockBoundsPx(t.b)];const e=0.002;
  if(mining&&mining.p>0&&mining.x===t.x&&mining.y===t.y&&mining.z===t.z){
    const u=entUniforms(VP,env);gl.uniform1f(u.uUnlit,1);gl.uniform2f(u.uLight,1,1);
    const stage=Math.min(9,Math.floor(mining.p*10));const f=[];
    for(const b of shape)f.push(...cubeFloats(0,t.x+b[0]/16-e,t.y+b[1]/16-e,t.z+b[2]/16-e,t.x+b[3]/16+e,t.y+b[4]/16+e,t.z+b[5]/16+e,TEXL['destroy_'+stage]));
    gl.uniformMatrix4fv(u.uModel,false,mat.id());gl.bindVertexArray(dynEnt.vao);gl.bindBuffer(gl.ARRAY_BUFFER,dynEnt.vbo);gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array(f));
    gl.enable(gl.BLEND);gl.blendFunc(gl.DST_COLOR,gl.SRC_COLOR);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1,-1);gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLES,0,f.length/9);gl.disable(gl.POLYGON_OFFSET_FILL);gl.depthMask(true);gl.disable(gl.BLEND);}
  const d=Math.hypot(t.x+0.5-camPos[0],t.y+0.5-camPos[1],t.z+0.5-camPos[2]),w=0.0028+d*0.0016;const a=[];
  const bar=(ax,ay,az,bx,by,bz)=>{const X0=Math.min(ax,bx)-w,X1=Math.max(ax,bx)+w,Y0=Math.min(ay,by)-w,Y1=Math.max(ay,by)+w,Z0=Math.min(az,bz)-w,Z1=Math.max(az,bz)+w;
    for(const f of FACES){const p=f.c.map(c=>[c[0]?X1:X0,c[1]?Y1:Y0,c[2]?Z1:Z0]);for(const k of[0,1,2,0,2,3])a.push(p[k][0],p[k][1],p[k][2],0,0);}};
  for(const b of shape.slice(0,8)){const x0=t.x+b[0]/16-e,y0=t.y+b[1]/16-e,z0=t.z+b[2]/16-e,x1=t.x+b[3]/16+e,y1=t.y+b[4]/16+e,z1=t.z+b[5]/16+e;
    for(const y of[y0,y1]){bar(x0,y,z0,x1,y,z0);bar(x0,y,z1,x1,y,z1);bar(x0,y,z0,x0,y,z1);bar(x1,y,z0,x1,y,z1);}
    for(const x of[x0,x1])for(const z of[z0,z1])bar(x,y0,z,x,y1,z);}
  gl.useProgram(P_FLAT.p);gl.uniformMatrix4fv(P_FLAT.u.uVP,false,VP);gl.uniformMatrix4fv(P_FLAT.u.uModel,false,mat.id());gl.uniform4f(P_FLAT.u.uColor,0,0,0,0.5);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,whiteTex);gl.uniform1i(P_FLAT.u.uTex,1);
  gl.bindVertexArray(dynFlat.vao);gl.bindBuffer(gl.ARRAY_BUFFER,dynFlat.vbo);gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array(a));
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.TRIANGLES,0,a.length/5);gl.disable(gl.BLEND);
  gl.activeTexture(gl.TEXTURE0);}
function renderRain(env){
  const R=8,cx=Math.floor(camPos[0]),cz=Math.floor(camPos[2]),cy=camPos[1],t=game.ticks+env.alpha;const rain=[],snow=[];
  for(let dz=-R;dz<=R;dz++)for(let dx=-R;dx<=R;dx++){const x=cx+dx,z=cz+dz;const d=Math.hypot(dx,dz);if(d>R)continue;
    const c=world.chunk(x>>4,z>>4);if(!c)continue;const top=c.hm[(x&15)+(z&15)*16];const y0=Math.max(top,Math.floor(cy)-10),y1=Math.floor(cy)+12;if(y1<=y0)continue;
    const bio=c.bio[(x&15)+(z&15)*16],isSnow=bio===3||(bio===6&&top>100);
    const vx=x+0.5-camPos[0],vz=z+0.5-camPos[2],l=Math.hypot(vx,vz)||1,px=-vz/l*0.5,pz=vx/l*0.5;
    const h=hash2(x,z,7),sp=isSnow?0.02:0.25,v0=(y0/4-t*sp+h*4),v1=(y1/4-t*sp+h*4),u0=h,u1=h+0.5;
    const ox=isSnow?Math.sin(t*0.02+h*6)*0.3:0;
    const q=[[x+0.5-px+ox,y0,z+0.5-pz,u0,v1],[x+0.5+px+ox,y0,z+0.5+pz,u1,v1],[x+0.5+px+ox,y1,z+0.5+pz,u1,v0],[x+0.5-px+ox,y1,z+0.5-pz,u0,v0]];
    const arr=isSnow?snow:rain;for(const k of[0,1,2,0,2,3])arr.push(...q[k]);}
  gl.useProgram(P_FLAT.p);gl.uniformMatrix4fv(P_FLAT.u.uVP,false,VP);gl.uniformMatrix4fv(P_FLAT.u.uModel,false,mat.id());
  gl.activeTexture(gl.TEXTURE1);gl.uniform1i(P_FLAT.u.uTex,1);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.CULL_FACE);gl.depthMask(false);
  const b=env.dayMul;
  for(const[arr,tex]of[[rain,rainTex],[snow,snowTex]]){if(!arr.length)continue;gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform4f(P_FLAT.u.uColor,b,b,b,game.rainR*0.8);
    gl.bindVertexArray(rainBuf.vao);gl.bindBuffer(gl.ARRAY_BUFFER,rainBuf.vbo);const f=new Float32Array(arr.slice(0,4*5*6*800/4));gl.bufferSubData(gl.ARRAY_BUFFER,0,f);gl.drawArrays(gl.TRIANGLES,0,f.length/5);}
  gl.depthMask(true);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);gl.activeTexture(gl.TEXTURE0);}
function renderHand(env){
  gl.clear(gl.DEPTH_BUFFER_BIT);
  const al=env.alpha,ip=(a,b)=>a+(b-a)*al,proj=mat.persp(70*Math.PI/180,canvas.width/canvas.height,0.05,10);
  const u=entUniforms(proj,Object.assign({},env,{fogR:[1000,1001]}));gl.uniform3f(u.uCam,0,0,0);
  const h=held();const id=lastHeldId>0?lastHeldId:0;const sp=swinging?ip(pswing,swing):0;
  const s1=Math.sin(sp*sp*Math.PI),s2=Math.sin(Math.sqrt(sp)*Math.PI);
  const eq=ip(pequip,equip);const p=player;
  const bobW=ip(p.pwalk,p.walk),bobA=SET.bob?ip(p.pbob,p.bob):0;
  let m=mat.chain(mat.tr(Math.sin(bobW*Math.PI)*bobA*0.5,-Math.abs(Math.cos(bobW*Math.PI)*bobA),0),
    mat.tr(-0.4*s2,0.2*Math.sin(Math.sqrt(sp)*Math.PI*2),-0.2*Math.sin(sp*Math.PI)));
  const eatBob=using.kind==='eat'?Math.abs(Math.cos(using.t/4*Math.PI))*0.1:0;
  gl.uniform2fv(u.uLight,lightAt(p.x,p.y+p.eyeH,p.z));
  if(!id||!h){m=mat.chain(m,mat.tr(0.62,-0.6-eq*0.6,-0.5),mat.ry(0.42-s1*0.35),mat.rx(0.55-s2*0.9),mat.rz(-0.1+s2*0.2),mat.sc(0.7));
    drawMesh(u,armMesh,m);return;}
  const mesh=itemMesh(id),D=Math.PI/180,sw=mat.chain(mat.ry(-s1*20*D),mat.rz(-s2*20*D),mat.rx(-s2*80*D));
  const ea=using.kind==='eat'?mat.chain(mat.tr(-0.35,0.15,0.1),mat.ry(-0.6)):mat.id();
  const pull=using.kind==='bow'?Math.min(1,using.t/20):0;
  if(!mesh.flat)m=mat.chain(m,mat.tr(0.56,-0.52-eq*0.6+eatBob,-0.72),ea,mat.ry(Math.PI/4),sw,mat.sc(0.4));
  else if(ITEMS[id].bow)m=mat.chain(m,mat.tr(0.4-pull*0.2,-0.3-eq*0.6,-0.8+pull*0.15),mat.ry(Math.PI-0.3),mat.rz(-0.55),sw,mat.sc(0.6));
  else m=mat.chain(m,mat.tr(0.52,-0.34-eq*0.6+eatBob,-0.9),ea,sw,mat.ry(Math.PI-0.55),mat.rz(0.3),mat.sc(0.46));
  gl.disable(gl.CULL_FACE);drawMesh(u,mesh,m);gl.enable(gl.CULL_FACE);}

/* =====================================================================
   아이콘 (블록은 WebGL 로 3D 그림을 찍어요)
   ===================================================================== */
const ICON={};
const iconFBO=(()=>{const S=96,fb=gl.createFramebuffer(),tx=gl.createTexture(),rb=gl.createRenderbuffer();
  gl.bindTexture(gl.TEXTURE_2D,tx);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,S,S*2,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.bindRenderbuffer(gl.RENDERBUFFER,rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,S,S*2);
  gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tx,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,rb);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);return{fb,S};})();
function readFBO(w,h){const px=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,px);
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');const img=g.createImageData(w,h);
  for(let y=0;y<h;y++)img.data.set(px.subarray((h-1-y)*w*4,(h-y)*w*4),y*w*4);g.putImageData(img,0,0);return c;}
function texCanvas(layer,shade=1){const c=document.createElement('canvas');c.width=c.height=16;const g=c.getContext('2d');
  g.putImageData(new ImageData(new Uint8ClampedArray(TEXD[layer]),16,16),0,0);
  if(shade<1){g.globalCompositeOperation='source-atop';g.fillStyle=`rgba(0,0,0,${1-shade})`;g.fillRect(0,0,16,16);}return c;}
function makeIcon(id){
  if(!itemShape(id))return texCanvas(id<256?BTEX[id*6]:ITEMS[id].layer).toDataURL();
  const S=iconFBO.S;gl.bindFramebuffer(gl.FRAMEBUFFER,iconFBO.fb);gl.viewport(0,0,S,S);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);
  const k=0.62,proj=new Float32Array([1/k,0,0,0, 0,1/k,0,0, 0,0,-0.2,0, 0,0,0,1]);
  const vp=mat.mul(proj,mat.chain(mat.rx(0.6155),mat.ry(-Math.PI/4)));
  const u=entUniforms(vp,{fog:[0,0,0],fogR:[1000,1001],dayMul:1,tint:[1,1,1]});gl.uniform2f(u.uLight,1,0);
  drawMesh(u,itemMesh(id),mat.chain(mat.tr(0,-0.02,0),mat.sc(0.98)));
  const c=readFBO(S,S);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);return c.toDataURL();}
function icon(id){return ICON[id]||(ICON[id]=makeIcon(id));}
function playerPortrait(){const S=iconFBO.S;gl.bindFramebuffer(gl.FRAMEBUFFER,iconFBO.fb);gl.viewport(0,0,S,S*2);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);const proj=new Float32Array([1/1.05,0,0,0, 0,1/2.1,0,0, 0,0,-0.2,0, 0,-0.9/2.1*2*0.45,0,1]);
  const vp=mat.mul(proj,mat.chain(mat.rx(0.15),mat.ry(-0.5)));
  gl.useProgram(P_MOB.p);const u=P_MOB.u;gl.uniformMatrix4fv(u.uVP,false,vp);gl.uniform3f(u.uCam,0,0,0);gl.uniform3f(u.uFogCol,0,0,0);gl.uniform2f(u.uFog,1000,1001);
  gl.uniform1f(u.uDay,1);gl.uniform3f(u.uSkyTint,1,1,1);gl.uniform1f(u.uHurt,0);gl.uniform1f(u.uWhite,0);gl.uniform2f(u.uLight,1,0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,MODEL_TEX.player);gl.uniform1i(u.uTex,1);
  const def=MODEL_DEFS.player,base=mat.chain(mat.tr(0,-0.94,0),mat.sc(def.scale/16));
  for(const pt of def.parts){const sw=pt.n==='rarm'?0.12:pt.n==='larm'?-0.12:0;
    gl.uniformMatrix4fv(u.uModel,false,mat.chain(base,mat.tr(pt.p[0],pt.p[1],pt.p[2]),mat.rz(sw)));gl.bindVertexArray(pt.mesh.vao);gl.drawArrays(gl.TRIANGLES,0,pt.mesh.n);}
  const c=readFBO(S,S*2);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.activeTexture(gl.TEXTURE0);return c.toDataURL();}
