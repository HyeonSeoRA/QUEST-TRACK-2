'use strict';
/* =====================================================================
   util.js — 수학, 난수, 노이즈, 행렬
   ===================================================================== */
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hash2(x,z,s){let h=(Math.imul(x|0,374761393)+Math.imul(z|0,668265263)+Math.imul(s|0,1442695041))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296;}
function hash3(x,y,z,s){return hash2((x|0)+Math.imul(y|0,73856093),z,s);}
function rnd(a,b){return a+Math.random()*(b-a);}
function irnd(a,b){return a+Math.floor(Math.random()*(b-a+1));}
function wrapAngle(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;}

/* ---------- 심플렉스 노이즈 ---------- */
const GRAD3=new Float32Array([1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1]);
class Simplex{
  constructor(seed){const r=mulberry32(seed);const p=new Uint8Array(256);for(let i=0;i<256;i++)p[i]=i;
    for(let i=255;i>0;i--){const j=(r()*(i+1))|0;const t=p[i];p[i]=p[j];p[j]=t;}
    this.perm=new Uint16Array(512);this.pm=new Uint8Array(512);for(let i=0;i<512;i++){this.perm[i]=p[i&255];this.pm[i]=this.perm[i]%12;}}
  n2(xin,yin){const F2=0.3660254037844386,G2=0.21132486540518713,perm=this.perm,pm=this.pm;
    const s=(xin+yin)*F2,i=Math.floor(xin+s),j=Math.floor(yin+s),t=(i+j)*G2,x0=xin-(i-t),y0=yin-(j-t);
    let i1,j1;if(x0>y0){i1=1;j1=0;}else{i1=0;j1=1;}
    const x1=x0-i1+G2,y1=y0-j1+G2,x2=x0-1+2*G2,y2=y0-1+2*G2,ii=i&255,jj=j&255;let n=0;
    let t0=0.5-x0*x0-y0*y0;if(t0>0){t0*=t0;const g=pm[ii+perm[jj]]*3;n+=t0*t0*(GRAD3[g]*x0+GRAD3[g+1]*y0);}
    let t1=0.5-x1*x1-y1*y1;if(t1>0){t1*=t1;const g=pm[ii+i1+perm[jj+j1]]*3;n+=t1*t1*(GRAD3[g]*x1+GRAD3[g+1]*y1);}
    let t2=0.5-x2*x2-y2*y2;if(t2>0){t2*=t2;const g=pm[ii+1+perm[jj+1]]*3;n+=t2*t2*(GRAD3[g]*x2+GRAD3[g+1]*y2);}
    return 70*n;}
  n3(xin,yin,zin){const F3=1/3,G3=1/6,perm=this.perm,pm=this.pm;
    const s=(xin+yin+zin)*F3,i=Math.floor(xin+s),j=Math.floor(yin+s),k=Math.floor(zin+s),t=(i+j+k)*G3;
    const x0=xin-(i-t),y0=yin-(j-t),z0=zin-(k-t);let i1,j1,k1,i2,j2,k2;
    if(x0>=y0){if(y0>=z0){i1=1;j1=0;k1=0;i2=1;j2=1;k2=0;}else if(x0>=z0){i1=1;j1=0;k1=0;i2=1;j2=0;k2=1;}else{i1=0;j1=0;k1=1;i2=1;j2=0;k2=1;}}
    else{if(y0<z0){i1=0;j1=0;k1=1;i2=0;j2=1;k2=1;}else if(x0<z0){i1=0;j1=1;k1=0;i2=0;j2=1;k2=1;}else{i1=0;j1=1;k1=0;i2=1;j2=1;k2=0;}}
    const x1=x0-i1+G3,y1=y0-j1+G3,z1=z0-k1+G3,x2=x0-i2+2*G3,y2=y0-j2+2*G3,z2=z0-k2+2*G3,x3=x0-0.5,y3=y0-0.5,z3=z0-0.5;
    const ii=i&255,jj=j&255,kk=k&255;let n=0;
    let t0=0.6-x0*x0-y0*y0-z0*z0;if(t0>0){t0*=t0;const g=pm[ii+perm[jj+perm[kk]]]*3;n+=t0*t0*(GRAD3[g]*x0+GRAD3[g+1]*y0+GRAD3[g+2]*z0);}
    let t1=0.6-x1*x1-y1*y1-z1*z1;if(t1>0){t1*=t1;const g=pm[ii+i1+perm[jj+j1+perm[kk+k1]]]*3;n+=t1*t1*(GRAD3[g]*x1+GRAD3[g+1]*y1+GRAD3[g+2]*z1);}
    let t2=0.6-x2*x2-y2*y2-z2*z2;if(t2>0){t2*=t2;const g=pm[ii+i2+perm[jj+j2+perm[kk+k2]]]*3;n+=t2*t2*(GRAD3[g]*x2+GRAD3[g+1]*y2+GRAD3[g+2]*z2);}
    let t3=0.6-x3*x3-y3*y3-z3*z3;if(t3>0){t3*=t3;const g=pm[ii+1+perm[jj+1+perm[kk+1]]]*3;n+=t3*t3*(GRAD3[g]*x3+GRAD3[g+1]*y3+GRAD3[g+2]*z3);}
    return 32*n;}
}
function fbm2(n,x,z,o){let s=0,a=1,f=1,t=0;for(let i=0;i<o;i++){s+=a*n.n2(x*f,z*f);t+=a;a*=0.5;f*=2;}return s/t;}

/* ---------- 4x4 행렬 (열 우선) ---------- */
const mat={
  id(){const m=new Float32Array(16);m[0]=m[5]=m[10]=m[15]=1;return m;},
  mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;}return o;},
  persp(fy,asp,n,f){const t=1/Math.tan(fy/2),m=new Float32Array(16);m[0]=t/asp;m[5]=t;m[10]=(f+n)/(n-f);m[11]=-1;m[14]=2*f*n/(n-f);return m;},
  rx(a){const c=Math.cos(a),s=Math.sin(a),m=mat.id();m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m;},
  ry(a){const c=Math.cos(a),s=Math.sin(a),m=mat.id();m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m;},
  rz(a){const c=Math.cos(a),s=Math.sin(a),m=mat.id();m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m;},
  tr(x,y,z){const m=mat.id();m[12]=x;m[13]=y;m[14]=z;return m;},
  sc(x,y,z){const m=mat.id();m[0]=x;m[5]=y===undefined?x:y;m[10]=z===undefined?x:z;return m;},
  chain(...ms){return ms.reduce((a,b)=>mat.mul(a,b));},
  inv(m){const a=m,o=new Float32Array(16);
    const a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15];
    const b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,
      b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
    let d=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;if(!d)return o;d=1/d;
    o[0]=(a11*b11-a12*b10+a13*b09)*d;o[1]=(a02*b10-a01*b11-a03*b09)*d;o[2]=(a31*b05-a32*b04+a33*b03)*d;o[3]=(a22*b04-a21*b05-a23*b03)*d;
    o[4]=(a12*b08-a10*b11-a13*b07)*d;o[5]=(a00*b11-a02*b08+a03*b07)*d;o[6]=(a32*b02-a30*b05-a33*b01)*d;o[7]=(a20*b05-a22*b02+a23*b01)*d;
    o[8]=(a10*b10-a11*b08+a13*b06)*d;o[9]=(a01*b08-a00*b10-a03*b06)*d;o[10]=(a30*b04-a31*b02+a33*b00)*d;o[11]=(a21*b02-a20*b04-a23*b00)*d;
    o[12]=(a11*b07-a10*b09-a12*b06)*d;o[13]=(a00*b09-a01*b07+a02*b06)*d;o[14]=(a31*b01-a30*b03-a32*b00)*d;o[15]=(a20*b03-a21*b01+a22*b00)*d;return o;}};
function frustum(m){const p=[];for(const[s,r]of[[1,0],[-1,0],[1,1],[-1,1],[1,2],[-1,2]])
  p.push([m[3]+s*m[r],m[7]+s*m[4+r],m[11]+s*m[8+r],m[15]+s*m[12+r]]);return p;}
function boxVisible(pl,x0,y0,z0,x1,y1,z1){for(const p of pl){if(p[0]*(p[0]>0?x1:x0)+p[1]*(p[1]>0?y1:y0)+p[2]*(p[2]>0?z1:z0)+p[3]<0)return false;}return true;}
