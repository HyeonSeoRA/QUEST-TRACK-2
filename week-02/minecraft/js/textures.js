'use strict';
/* =====================================================================
   textures.js — 16x16 픽셀아트 텍스처를 코드로 그려요
   (블록 · 아이템 · 입자 · 금 가는 효과)
   ===================================================================== */
const TEXL={},TEXD=[];
function T(name,fn){const t=new Uint8ClampedArray(1024);fn(t);TEXL[name]=TEXD.length;TEXD.push(t);}
function P(t,x,y,c,a){x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>15||y>15)return;const i=(y*16+x)*4;t[i]=c[0];t[i+1]=c[1];t[i+2]=c[2];t[i+3]=a===undefined?(c[3]===undefined?255:c[3]):a;}
function A(t,x,y){if(x<0||y<0||x>15||y>15)return 0;return t[(y*16+x)*4+3];}
function F(t,fn){for(let y=0;y<16;y++)for(let x=0;x<16;x++){const c=fn(x,y);if(c)P(t,x,y,c);}}
const M=(c,f)=>[Math.min(255,c[0]*f),Math.min(255,c[1]*f),Math.min(255,c[2]*f)];
const q=(v,n)=>Math.round(v*n)/n;
const CLEAR=[0,0,0,0];
function pick(p,w,r){let v=r();for(let i=0;i<p.length;i++){v-=w[i];if(v<=0)return p[i];}return p[p.length-1];}
function tileNoise(r,cell){const n=16/cell,g=[];for(let i=0;i<n*n;i++)g.push(r());const s=t=>t*t*(3-2*t);
  const v=(a,b)=>g[(((b%n)+n)%n)*n+(((a%n)+n)%n)];
  return(x,y)=>{const fx=x/cell,fy=y/cell,x0=Math.floor(fx),y0=Math.floor(fy),tx=s(fx-x0),ty=s(fy-y0);
    return lerp(lerp(v(x0,y0),v(x0+1,y0),tx),lerp(v(x0,y0+1),v(x0+1,y0+1),tx),ty);};}
function voronoi(r,count){const pts=[];for(let i=0;i<count;i++)pts.push([r()*16,r()*16,r()]);
  return(x,y)=>{let d1=1e9,d2=1e9,id=0;for(let i=0;i<count;i++)for(let ox=-16;ox<=16;ox+=16)for(let oy=-16;oy<=16;oy+=16){
    const dx=x+0.5-pts[i][0]-ox,dy=y+0.5-pts[i][1]-oy,d=Math.sqrt(dx*dx+dy*dy);if(d<d1){d2=d1;d1=d;id=i;}else if(d<d2)d2=d;}
    return{d1,d2,v:pts[id][2],edge:d2-d1};};}
function outline(t,col){const m=new Uint8Array(256);for(let y=0;y<16;y++)for(let x=0;x<16;x++)m[y*16+x]=A(t,x,y)>0?1:0;
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){if(m[y*16+x])continue;
    const nb=(x>0&&m[y*16+x-1])||(x<15&&m[y*16+x+1])||(y>0&&m[(y-1)*16+x])||(y<15&&m[(y+1)*16+x]);if(nb)P(t,x,y,col);}}
function line(t,x0,y0,x1,y1,c){const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0))||1;for(let i=0;i<=n;i++)P(t,x0+(x1-x0)*i/n,y0+(y1-y0)*i/n,typeof c==='function'?c(i/n):c);}
function blank(t){F(t,()=>CLEAR);}
function inEll(x,y,cx,cy,rx,ry){const dx=(x+0.5-cx)/rx,dy=(y+0.5-cy)/ry;return dx*dx+dy*dy<=1;}
function fromMap(t,rows,pal){blank(t);rows.forEach((r,y)=>[...r].forEach((ch,x)=>{if(pal[ch])P(t,x,y,pal[ch]);}));}

/* ---------- 블록 ---------- */
const GRASS_C=[96,156,58];
function stoneFn(seed,base=96,range=58){return t=>{const r=mulberry32(seed),n1=tileNoise(r,4),n2=tileNoise(r,8);
  F(t,(x,y)=>{const v=n1(x,y)*0.45+n2(x,y)*0.25+r()*0.3;const g=base+q(v,6)*range;return[g,g,g];});};}
T('stone',stoneFn(11));T('ore_base',stoneFn(12));
T('dirt',t=>{const r=mulberry32(21);const pal=[[134,96,67],[121,85,58],[150,108,74],[108,76,51],[89,61,41],[165,120,84]];
  F(t,()=>pick(pal,[.3,.25,.2,.12,.08,.05],r));});
T('grass_top',t=>{const r=mulberry32(31),n=tileNoise(r,4);F(t,(x,y)=>M(GRASS_C,q(0.76+n(x,y)*0.16+r()*0.22,8)));});
T('grass_side',t=>{const r=mulberry32(41);t.set(TEXD[TEXL.dirt]);for(let x=0;x<16;x++){let h=3+(r()<0.45?1:0)+(r()<0.15?1:0);
  for(let y=0;y<h;y++)P(t,x,y,M(GRASS_C,q(0.78+r()*0.26,8)));if(r()<0.45)P(t,x,h,M(GRASS_C,0.62));}});
T('grass_snow_side',t=>{const r=mulberry32(42);t.set(TEXD[TEXL.dirt]);for(let x=0;x<16;x++){const h=3+(r()<0.5?1:0)+(r()<0.2?1:0);
  for(let y=0;y<h;y++)P(t,x,y,r()<0.2?[222,236,242]:[244,252,252]);}});
function cobbleFn(seed){return t=>{const r=mulberry32(seed),vo=voronoi(r,10);F(t,(x,y)=>{const c=vo(x,y);
  if(c.edge<1.1){const g=54+r()*16;return[g,g,g];}const g=Math.min(200,92+c.v*52+18-c.d1*5+r()*14);return[g,g,g];});};}
T('cobblestone',cobbleFn(51));
T('mossy_cobblestone',t=>{cobbleFn(52)(t);const r=mulberry32(53),n=tileNoise(r,4);F(t,(x,y)=>n(x,y)+r()*0.25>0.72?M([72,112,48],0.8+r()*0.35):null);});
T('bedrock',t=>{const r=mulberry32(61),n=tileNoise(r,4);F(t,(x,y)=>{const v=n(x,y)*0.6+r()*0.4;const g=v<0.3?32:v<0.45?62:v<0.6?88:v<0.75?110:140;return[g,g,g];});});
T('sand',t=>{const r=mulberry32(71);F(t,()=>M(r()<0.1?[204,190,142]:[219,207,163],0.94+r()*0.08));});
T('gravel',t=>{const r=mulberry32(81),vo=voronoi(r,16);const pal=[[136,126,126],[110,104,102],[156,146,142],[94,86,82],[126,116,108],[170,160,155]];
  F(t,(x,y)=>{const c=vo(x,y);return M(pal[Math.floor(c.v*pal.length)],c.edge<0.6?0.7:0.94+r()*0.1);});});
function barkFn(base,seed){return t=>{const r=mulberry32(seed);const cols=[];for(let x=0;x<16;x++)cols.push(r());
  F(t,(x,y)=>{let v=0.74+cols[x]*0.3;if(x%4===0&&r()<0.85)v*=0.72;v*=0.92+r()*0.12;return M(base,v);});};}
T('oak_log',barkFn([106,84,50],91));T('spruce_log',barkFn([62,44,26],93));
function logTop(bark,a,b,seed){return t=>{const r=mulberry32(seed);F(t,(x,y)=>{const d=Math.max(Math.abs(x-7.5),Math.abs(y-7.5));
  if(d>6.5)return M(bark,0.85+r()*0.2);return M(Math.floor(d)%2===0?a:b,0.93+r()*0.1);});};}
T('oak_log_top',logTop([106,84,50],[178,144,90],[150,118,70],92));
T('spruce_log_top',logTop([62,44,26],[126,94,58],[104,76,46],94));
T('birch_log',t=>{const r=mulberry32(101);F(t,()=>M([216,215,206],0.9+r()*0.1));
  for(let k=0;k<8;k++){const y=r()*16|0,x=r()*13|0,l=2+(r()*3|0);for(let i=0;i<l;i++)P(t,x+i,y,[52,52,46]);if(r()<0.5)P(t,x+1,y+1,[90,90,80]);}});
T('birch_log_top',logTop([216,215,206],[205,186,128],[180,160,105],102));
function planksFn(base,seed){return t=>{const r=mulberry32(seed);const offs=[3,11,6,14];F(t,(x,y)=>{const row=y>>2;
  if(y%4===3)return M(base,0.6);if(x===offs[row])return M(base,0.7);
  return M(base,q(0.86+(Math.sin((x+row*7)*1.7)+1)*0.04+r()*0.08,12));});};}
T('oak_planks',planksFn([162,130,78],111));T('birch_planks',planksFn([196,178,122],112));T('spruce_planks',planksFn([114,84,50],113));
function leavesFn(base,seed,holes=0.16){return t=>{const r=mulberry32(seed),n=tileNoise(r,2);
  F(t,(x,y)=>{if(r()<holes+n(x,y)*0.14)return CLEAR;return M(base,q(0.66+r()*0.48,6));});};}
T('oak_leaves',leavesFn([62,124,30],121));T('birch_leaves',leavesFn([98,140,58],122));T('spruce_leaves',leavesFn([44,84,52],123,0.08));
T('water',t=>{const r=mulberry32(131);F(t,(x,y)=>{const w=(y+Math.round(Math.sin(x*0.7)*1.5)+16)%6===0;
  const c=M(w?[92,142,238]:[48,94,214],0.9+r()*0.12);return[c[0],c[1],c[2],178];});});
T('lava',t=>{const r=mulberry32(132),vo=voronoi(r,8);F(t,(x,y)=>{const c=vo(x,y);if(c.edge<0.8)return M([160,46,8],0.9+r()*0.2);
  return c.v>0.6?M([255,190,50],0.95+r()*0.08):c.v>0.3?M([236,120,20],0.95+r()*0.08):M([212,84,14],0.95+r()*0.08);});});
T('glass',t=>{F(t,(x,y)=>{if(x===0||y===0||x===15||y===15)return[214,236,244];
  if((x+y===7&&x>=2&&x<=5)||(x+y===8&&x>=3&&x<=5)||(x+y===20&&x>=10&&x<=13))return[236,248,255,210];return CLEAR;});});
function oreFn(col,hl,dk,seed){return t=>{t.set(TEXD[TEXL.ore_base]);const r=mulberry32(seed);
  const shape=[[0,0],[1,0],[0,1],[1,1],[2,1],[1,2],[2,2]];
  for(let k=0;k<5;k++){const cx=1+(r()*12|0),cy=1+(r()*12|0);for(const[ox,oy]of shape){if(r()<0.25)continue;
    P(t,cx+ox,cy+oy,ox+oy===0?hl:ox+oy>=3?dk:col);}}};}
T('coal_ore',oreFn([44,44,44],[78,78,78],[22,22,22],141));
T('iron_ore',oreFn([214,174,146],[236,206,180],[160,122,96],142));
T('gold_ore',oreFn([250,232,72],[255,255,180],[200,150,24],143));
T('diamond_ore',oreFn([92,232,242],[210,255,255],[30,168,178],144));
function panelFn(base,seed){return t=>{const r=mulberry32(seed);F(t,(x,y)=>{if(x===0||y===0)return M(base,1.25);if(x===15||y===15)return M(base,0.62);
  if(x===1||y===1)return M(base,1.1);if(x===14||y===14)return M(base,0.78);return M(base,0.92+r()*0.12);});};}
T('coal_block',panelFn([30,30,32],145));T('iron_block',panelFn([216,216,216],146));T('gold_block',panelFn([246,208,62],147));T('diamond_block',panelFn([98,226,220],148));
T('bricks',t=>{const r=mulberry32(151);F(t,(x,y)=>{const row=y>>2;const mortar=y%4===3||(row%2===0?x%8===7:(x+4)%8===7);
  if(mortar)return M([172,164,152],0.88+r()*0.12);return M(y%4===0?[168,92,72]:[150,74,58],0.86+r()*0.2);});});
T('stone_bricks',t=>{const r=mulberry32(161);F(t,(x,y)=>{const top=y<8,mx=top?15:7;
  if(y===7||y===15||x===mx)return[70,70,70];if(y===6||y===14||x===mx-1)return[98,98,98];
  if(y===0||y===8||x===((mx+1)&15))return[152,152,152];return M([124,124,124],0.9+r()*0.14);});});
T('smooth_stone',t=>{const r=mulberry32(162);F(t,(x,y)=>{if(x===0||y===0||x===15||y===15)return[110,110,110];return M([166,166,166],0.95+r()*0.06);});});
T('smooth_stone_side',t=>{const r=mulberry32(163);F(t,(x,y)=>{if(x===0||x===15||y===0||y===15||y===7||y===8)return y===8?[136,136,136]:[110,110,110];return M([166,166,166],0.95+r()*0.06);});});
T('crafting_table_top',t=>{t.set(TEXD[TEXL.oak_planks]);F(t,(x,y)=>{if(x===0||y===0||x===15||y===15)return[86,56,28];
  if(x===1||y===1||x===14||y===14)return[146,104,58];if((x===5||x===10||y===5||y===10)&&x>1&&x<14&&y>1&&y<14)return[112,80,44];return null;});});
T('crafting_table_side',t=>{t.set(TEXD[TEXL.oak_planks]);F(t,(x,y)=>{if(y<=1)return[86,56,28];if(y===2)return[130,94,52];
  if(x>=2&&x<=6&&y>=4&&y<=9)return(y===9&&x%2===0)?[110,110,110]:[166,166,166];if(x>=2&&x<=6&&y===10)return[88,64,34];
  if(x===11&&y>=5&&y<=13)return[88,60,30];if(x>=9&&x<=13&&y>=3&&y<=4)return[150,150,150];return null;});});
T('snow',t=>{const r=mulberry32(171);F(t,()=>{const v=r();return v<0.1?[220,234,240]:v<0.25?[232,244,248]:[246,252,252];});});
T('ice',t=>{const r=mulberry32(251);F(t,(x,y)=>{const s=(x-y+16)%11===0;const c=M(s?[200,224,255]:[140,180,250],0.95+r()*0.06);return[c[0],c[1],c[2],200];});});
T('clay',t=>{const r=mulberry32(252),n=tileNoise(r,4);F(t,(x,y)=>M([158,164,178],0.9+n(x,y)*0.1+r()*0.06));});
T('torch',t=>{F(t,(x,y)=>{if((x===7||x===8)&&y>=6){if(y===6)return[255,255,170];if(y===7)return[255,212,64];return x===7?[150,113,60]:[108,78,40];}
  if((x===7||x===8)&&y===5)return[255,150,30,170];return CLEAR;});});
T('glowstone',t=>{const r=mulberry32(181),vo=voronoi(r,9);const pal=[[252,228,150],[232,190,100],[255,242,190],[210,160,80]];
  F(t,(x,y)=>{const c=vo(x,y);if(c.edge<0.9)return M([128,94,48],0.9+r()*0.2);return pal[Math.floor(c.v*4)];});});
T('tall_grass',t=>{const r=mulberry32(191);blank(t);for(let k=0;k<10;k++){let x=1.5+r()*13;const h=5+(r()*10|0),lean=(r()-0.5)*0.4;
  for(let i=0;i<h;i++){P(t,clamp(Math.round(x),0,15),15-i,M(GRASS_C,0.62+r()*0.3+i*0.02));x+=lean;}}});
T('dead_bush',t=>{blank(t);const c=[120,80,40];line(t,7,15,7,9,c);line(t,7,10,3,5,c);line(t,7,11,12,5,c);line(t,5,8,6,4,c);line(t,10,7,13,9,c);line(t,4,6,2,7,c);});
function flower(t,head,center,hl,big){blank(t);const st=[64,128,40];for(let y=8;y<16;y++)P(t,7,y,st);
  P(t,6,12,st);P(t,5,11,[84,156,52]);P(t,8,13,st);P(t,9,12,[84,156,52]);
  const x0=big?5:6,x1=big?9:8,y0=big?4:5,y1=big?8:7;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){if((x===x0||x===x1)&&(y===y0||y===y1))continue;P(t,x,y,head);}
  P(t,7,6,center);P(t,x0+1,y0,hl);}
T('dandelion',t=>flower(t,[254,230,60],[240,180,10],[255,255,170],false));
T('poppy',t=>flower(t,[214,32,32],[50,20,20],[255,110,100],true));
function mushroom(t,cap,spot){blank(t);for(let y=10;y<16;y++){P(t,7,y,[220,210,190]);P(t,8,y,[200,190,170]);}
  for(let y=6;y<10;y++)for(let x=4;x<12;x++){if(y===6&&(x<6||x>9))continue;P(t,x,y,y===9?M(cap,0.75):cap);}
  if(spot){P(t,6,7,spot);P(t,9,8,spot);P(t,8,6,spot);}}
T('brown_mushroom',t=>mushroom(t,[150,110,80],null));T('red_mushroom',t=>mushroom(t,[200,40,40],[240,240,240]));
T('cactus_side',t=>{const r=mulberry32(201);F(t,(x,y)=>{if(x===0||x===15)return[12,70,22];const st=(x===3||x===7||x===11);
  if(st&&y%4===1)return[214,220,170];return M(st?[40,150,55]:[18,112,34],0.9+r()*0.15);});});
T('cactus_top',t=>{const r=mulberry32(202);F(t,(x,y)=>{const d=Math.max(Math.abs(x-7.5),Math.abs(y-7.5));if(d>6.5)return[12,70,22];
  return M(Math.floor(d)%3===0?[40,150,55]:[22,118,38],0.9+r()*0.15);});});
T('sugar_cane',t=>{blank(t);const r=mulberry32(203);for(const sx of[3,8,12]){for(let y=0;y<16;y++){const seg=(y+sx)%5===0;
  P(t,sx,y,seg?[110,150,70]:[150,200,100]);P(t,sx+1,y,seg?[90,130,56]:[126,176,82]);}if(r()<0.8)P(t,sx+2,(sx*3)%12+2,[110,170,70]);}});
T('sandstone',t=>{const r=mulberry32(211);F(t,(x,y)=>{let c=[216,203,155];if(y<3)c=[228,216,170];else if(y>=12)c=y===12?[188,174,126]:[206,190,142];
  else if(y===6||y===9)c=[204,190,144];return M(c,0.95+r()*0.07);});});
T('sandstone_top',t=>{const r=mulberry32(212);F(t,()=>M([222,210,162],0.95+r()*0.07));});
T('obsidian',t=>{const r=mulberry32(221),n=tileNoise(r,4);F(t,(x,y)=>{const v=n(x,y)+r()*0.35;return v>1.05?[76,54,108]:v>0.82?[44,32,66]:[18,15,28];});});
T('bookshelf',t=>{const r=mulberry32(231);t.set(TEXD[TEXL.oak_planks]);
  const pal=[[120,40,40],[50,80,140],[60,110,60],[140,110,50],[92,52,112],[150,150,130],[40,40,40]];
  for(const[y0,y1]of[[2,6],[9,13]]){let x=1;while(x<15){const w=1+(r()<0.4?1:0),c=pal[r()*pal.length|0],top=y0+(r()<0.3?1:0);
    for(let xx=x;xx<Math.min(15,x+w);xx++)for(let y=y0;y<=y1;y++)P(t,xx,y,y<top?[58,40,22]:M(c,xx===x?1:0.8));x+=w;}}});
T('wool',t=>{const r=mulberry32(241),n=tileNoise(r,2);F(t,(x,y)=>M([234,236,236],0.86+n(x,y)*0.08+r()*0.08));});
const WOOLS=[['red','빨간색',[160,39,34]],['orange','주황색',[240,118,19]],['yellow','노란색',[248,198,39]],['lime','연두색',[112,185,25]],
  ['light_blue','하늘색',[58,175,217]],['blue','파란색',[53,57,157]],['purple','보라색',[121,42,172]],['black','검은색',[28,28,33]]];
for(const[k,,c]of WOOLS)T('wool_'+k,t=>{const w=TEXD[TEXL.wool];for(let i=0;i<1024;i+=4){t[i]=w[i]*c[0]/234;t[i+1]=w[i+1]*c[1]/236;t[i+2]=w[i+2]*c[2]/236;t[i+3]=255;}});
T('pumpkin_side',t=>{const r=mulberry32(261);F(t,(x,y)=>{const ridge=x%4===0;return M(ridge?[184,104,16]:[226,140,26],0.92+r()*0.1);});});
T('pumpkin_top',t=>{const r=mulberry32(262);F(t,(x,y)=>{const d=Math.max(Math.abs(x-7.5),Math.abs(y-7.5));if(d<1.6)return[96,70,30];
  return M(Math.floor(d)%3===0?[190,108,18]:[226,140,26],0.92+r()*0.1);});});
function pumpkinFace(glow){return t=>{t.set(TEXD[TEXL.pumpkin_side]);const c=glow?[255,214,80]:[40,24,6];
  for(const ex of[3,10]){for(let y=4;y<7;y++)for(let x=ex;x<ex+3;x++)if(y-4<=x-ex&&y-4<=ex+2-x||y===6)P(t,x,y,c);}
  for(let x=3;x<13;x++){P(t,x,10,c);if(x%3!==1)P(t,x,11,c);}P(t,3,9,c);P(t,12,9,c);};}
T('pumpkin_face',pumpkinFace(false));T('jack_face',pumpkinFace(true));
T('tnt_side',t=>{const r=mulberry32(271);F(t,(x,y)=>{if(y>=5&&y<=10){return(y===5||y===10)?[180,180,180]:[236,236,236];}return M(x%4===0?[180,40,30]:[218,56,40],0.92+r()*0.1);});
  const L=['###.#..#.###','.#..##.#..#.','.#..#.##..#.','.#..#..#..#.'];L.forEach((row,yy)=>[...row].forEach((c,xx)=>{if(c==='#')P(t,xx+2,yy+6,[30,30,30]);}));});
T('tnt_top',t=>{const r=mulberry32(272);F(t,(x,y)=>{const d=Math.max(Math.abs(x-7.5),Math.abs(y-7.5));if(d<1.6)return[60,60,60];return M([218,56,40],0.9+r()*0.12);});});
T('tnt_bottom',t=>{const r=mulberry32(273);F(t,()=>M([200,48,36],0.9+r()*0.12));});
function farmland(wet){return t=>{const r=mulberry32(281);F(t,(x,y)=>{const furrow=y%4===0;const b=wet?[78,52,32]:[122,86,58];return M(b,(furrow?0.7:0.95)+r()*0.12);});};}
T('farmland_dry',farmland(false));T('farmland_wet',farmland(true));
for(let s=0;s<8;s++)T('wheat_'+s,t=>{blank(t);const r=mulberry32(290);const h=2+Math.round(s*1.75),ripe=s===7;
  const stem=ripe?[150,140,60]:s>4?[110,160,50]:[70,160,40];
  for(const sx of[1,4,7,10,13]){const hh=h-(r()*2|0);for(let i=0;i<hh;i++)P(t,sx+(i>hh/2&&sx%2?1:0),15-i,stem);
    if(s>=4)for(let i=0;i<3;i++)P(t,sx+1,15-hh+i+1,ripe?[210,180,70]:[120,170,60]);}});
function saplingFn(leaf,trunk){return t=>{blank(t);for(let y=10;y<16;y++)P(t,7,y,trunk);const r=mulberry32(300);
  for(let y=2;y<11;y++)for(let x=3;x<13;x++)if(inEll(x,y,8,6.5,4.8,4.4)&&r()<0.8)P(t,x,y,M(leaf,0.75+r()*0.4));P(t,8,10,trunk);P(t,6,9,trunk);};}
T('sapling_oak',saplingFn([62,124,30],[106,84,50]));T('sapling_birch',saplingFn([98,150,58],[216,215,206]));T('sapling_spruce',saplingFn([44,84,52],[62,44,26]));
T('furnace_side',t=>{const r=mulberry32(310);F(t,(x,y)=>{if(x===0||y===0||x===15||y===15)return[80,80,80];return M([132,132,132],0.88+r()*0.14);});});
T('furnace_top',t=>{const r=mulberry32(311);F(t,(x,y)=>{if(x===0||y===0||x===15||y===15)return[90,90,90];return M([150,150,150],0.9+r()*0.1);});});
function furnaceFront(lit){return t=>{t.set(TEXD[TEXL.furnace_side]);const r=mulberry32(312);
  for(let y=2;y<6;y++)for(let x=3;x<13;x++)P(t,x,y,y===2?[60,60,60]:[100,100,100]);
  for(let y=8;y<14;y++)for(let x=3;x<13;x++){if(y===8||x===3||x===12){P(t,x,y,[56,56,56]);continue;}
    P(t,x,y,lit?(y>10?(r()<0.5?[255,200,60]:[240,110,20]):[60,30,14]):[24,24,24]);}};}
T('furnace_front',furnaceFront(false));T('furnace_front_lit',furnaceFront(true));
function chestFn(kind){return t=>{const r=mulberry32(320);F(t,(x,y)=>{if(x===0||x===15||y===0||y===15)return[62,40,18];
  if(kind!=='top'&&(y===5||y===6))return[62,40,18];return M([164,112,48],0.88+((y*7+x*3)%5)*0.03+r()*0.06);});
  if(kind==='front')for(let y=5;y<9;y++)for(let x=7;x<9;x++)P(t,x,y,y===5?[90,90,90]:[200,200,200]);};}
T('chest_top',chestFn('top'));T('chest_side',chestFn('side'));T('chest_front',chestFn('front'));
T('ladder',t=>{blank(t);const c=[138,104,58],d=[96,72,40];for(let y=0;y<16;y++){P(t,2,y,c);P(t,3,y,d);P(t,12,y,c);P(t,13,y,d);}
  for(const y of[1,5,9,13])for(let x=2;x<14;x++)P(t,x,y,x%2?c:M(c,0.9));});
T('door_bottom',t=>{const r=mulberry32(330);F(t,(x,y)=>{if(x===0||x===15||y===15)return[96,70,38];if(x===2||x===13||y===13||y===2||y===7||y===8)return[120,88,48];
  return M([164,128,74],0.9+r()*0.1);});P(t,13,1,[60,60,60]);P(t,13,0,[180,180,180]);});
T('door_top',t=>{const r=mulberry32(331);F(t,(x,y)=>{if(x===0||x===15||y===0)return[96,70,38];
  if(y>=2&&y<=7&&((x>=2&&x<=6)||(x>=9&&x<=13)))return CLEAR;if(x===7||x===8||y===8||y===1)return[120,88,48];return M([164,128,74],0.9+r()*0.1);});});
T('bed_top_foot',t=>{const r=mulberry32(340);F(t,(x,y)=>{if(x===0||x===15)return[120,20,20];return M([176,30,30],0.92+r()*0.08);});});
T('bed_top_head',t=>{const r=mulberry32(341);F(t,(x,y)=>{if(y<7&&x>1&&x<14&&y>0)return M([236,236,236],0.94+r()*0.06);if(x===0||x===15)return[120,20,20];return M([176,30,30],0.92+r()*0.08);});});
T('bed_side',t=>{blank(t);F(t,(x,y)=>{if(y>=7&&y<=9)return[176,30,30];if(y>=10&&y<=12)return[150,112,62];if(y>=13&&(x<3||x>12))return[120,90,50];return null;});});
T('snow_layer_side',t=>{t.set(TEXD[TEXL.snow]);});
/* ---------- 아이템 ---------- */
const WOODC=[137,103,39],WOODD=[91,66,26];
T('stick',t=>{blank(t);for(let i=0;i<10;i++){P(t,3+i,12-i,WOODC);if(i<9)P(t,4+i,12-i,WOODD);}outline(t,[40,28,10]);});
function lump(col,hl,dk,seed){return t=>{const r=mulberry32(seed);F(t,(x,y)=>{const a=Math.atan2(y-8.5,x-7.5),d=Math.hypot(x-7.5,y-8.5);if(d>4.6+Math.sin(a*3)*0.7)return CLEAR;
  return(x<7&&y<7)?hl:r()<0.3?dk:col;});outline(t,M(dk,0.5));};}
T('coal',lump([46,46,46],[86,86,86],[24,24,24],401));T('charcoal',lump([56,48,40],[96,84,70],[30,24,20],402));
T('flint',t=>{F(t,(x,y)=>{if(!(y>3&&y<13&&x>3+(12-y)*0.3&&x<12-(y-4)*0.2))return CLEAR;return x+y<14?[110,110,110]:[50,50,54];});outline(t,[20,20,22]);});
function ingot(col){return t=>{F(t,(x,y)=>{if(y>=5&&y<=7&&x>=4&&x>=11-y&&x<=12)return M(col,1.2);
  if(y>=8&&y<=10&&x>=3&&x<=11)return y===10?M(col,0.75):col;if(y>=8&&y<=9&&x===12)return M(col,0.6);return CLEAR;});outline(t,M(col,0.3));};}
T('iron_ingot',ingot([214,214,214]));T('gold_ingot',ingot([250,214,40]));T('brick',ingot([170,84,58]));
T('diamond',t=>{F(t,(x,y)=>{if(Math.abs(x-7.5)+Math.abs(y-8)*1.1>6.2)return CLEAR;if(x===6&&y===5)return[255,255,255];
  if(y<6)return[180,255,250];return x<7.5?[92,232,242]:[40,186,198];});outline(t,[16,80,86]);});
T('apple',t=>{F(t,(x,y)=>{const d=Math.hypot(x-7.5,y-9.5);if(d>5.3)return CLEAR;if((x===7||x===8)&&y===4)return CLEAR;
  if(x<7&&y<9&&d<4.2&&d>2)return[255,112,100];if(x+y>18)return[150,16,20];return[212,30,30];});
  P(t,8,2,[92,60,20]);P(t,8,3,[92,60,20]);P(t,9,2,[64,150,40]);P(t,10,2,[64,150,40]);P(t,10,3,[48,120,30]);outline(t,[60,8,8]);});
function meat(col,fat,bone){return t=>{const r=mulberry32(410);F(t,(x,y)=>{const dx=x-8,dy=y-8.5,rx=dx*0.8-dy*0.6,ry=dx*0.6+dy*0.8;
  if((rx/6.3)**2+(ry/4.2)**2>1)return CLEAR;if((rx/6.3)**2+(ry/4.2)**2>0.62)return fat;return M(col,0.86+r()*0.24);});
  if(bone){P(t,2,13,[236,232,220]);P(t,3,12,[236,232,220]);P(t,2,12,[236,232,220]);}outline(t,M(col,0.35));};}
T('porkchop',meat([236,124,120],[250,200,190],true));T('cooked_porkchop',meat([184,120,70],[230,190,130],true));
T('beef',meat([200,46,40],[240,150,140],false));T('steak',meat([126,72,40],[168,110,64],false));
T('mutton',meat([206,60,56],[240,170,160],true));T('cooked_mutton',meat([140,82,48],[184,126,80],true));
T('rotten_flesh',meat([120,110,60],[150,70,50],false));
const DRUM_MAP=['................','.........###....','........#bbb#...','.......#bBbbb#..','......#bBbbbb#..','......#bbbbbb#..',
  '.....#bbbbbbb#..','.....#bbbbbb#...','....#mbbbbb#....','...#wmmmm##.....','..#ww#####......','.#ww#...........','#ww#............','#w#.............','.#..............','................'];
T('chicken',t=>fromMap(t,DRUM_MAP,{'#':[80,40,30],b:[236,190,170],B:[255,226,210],m:[214,160,140],w:[240,236,224]}));
T('cooked_chicken',t=>fromMap(t,DRUM_MAP,{'#':[60,30,10],b:[200,130,60],B:[236,180,100],m:[160,96,40],w:[240,236,224]}));
T('bread',t=>{const r=mulberry32(420);F(t,(x,y)=>{if(!inEll(x,y,8,9,7.4,3.6))return CLEAR;if(y<8)return M([214,160,80],0.95+r()*0.08);return M([176,116,48],0.95+r()*0.08);});
  for(const sx of[4,8,12])P(t,sx,7,[150,96,40]);outline(t,[80,48,18]);});
T('wheat',t=>{blank(t);for(let k=0;k<4;k++){line(t,3+k,14,9+k,4-k,i=>i>0.6?[220,190,80]:[180,160,70]);}outline(t,[90,70,20]);});
T('seeds',t=>{blank(t);for(const[x,y]of[[5,6],[9,5],[7,9],[11,9],[4,11],[8,12],[10,12]]){P(t,x,y,[90,150,50]);P(t,x+1,y,[60,110,30]);}});
T('leather',t=>{F(t,(x,y)=>{if(!(x>2&&x<13&&y>2&&y<13)||((x===3||x===12)&&(y===3||y===12))||(x>6&&x<9&&(y===3||y===12)))return CLEAR;return M([150,84,44],0.9+((x+y)%3)*0.05);});outline(t,[70,36,16]);});
T('feather',t=>{blank(t);line(t,3,13,12,3,[200,200,200]);for(let i=0;i<7;i++){P(t,6+i,8-i,[240,240,240]);P(t,5+i,10-i,[236,236,236]);P(t,7+i,6-i,[226,226,226]);}outline(t,[110,110,110]);});
T('string',t=>{blank(t);for(let x=2;x<14;x++)P(t,x,8+Math.round(Math.sin(x*0.9)*2.5),[236,236,236]);outline(t,[90,90,90]);});
T('bone',t=>{blank(t);line(t,4,11,11,4,[236,232,220]);line(t,5,11,11,5,[210,206,190]);for(const[x,y]of[[3,11],[4,12],[3,12],[11,3],[12,4],[12,3]])P(t,x,y,[236,232,220]);outline(t,[100,96,84]);});
T('bone_meal',t=>{const r=mulberry32(430);F(t,(x,y)=>inEll(x,y,8,10,5.5,3.6)&&r()<0.9?M([236,236,230],0.88+r()*0.12):CLEAR);outline(t,[120,120,110]);});
T('gunpowder',t=>{const r=mulberry32(431);F(t,(x,y)=>inEll(x,y,8,10,5.5,3.6)&&r()<0.9?M([90,90,90],0.8+r()*0.4):CLEAR);outline(t,[30,30,30]);});
T('arrow',t=>{blank(t);line(t,3,12,12,3,[130,96,50]);P(t,12,3,[200,200,200]);P(t,11,3,[160,160,160]);P(t,12,4,[160,160,160]);P(t,13,2,[220,220,220]);
  for(const[x,y]of[[2,12],[3,13],[2,13],[1,13],[2,14],[4,13]])P(t,x,y,[240,240,240]);outline(t,[40,30,20]);});
T('bow',t=>{blank(t);for(let i=0;i<=20;i++){const a=i/20*Math.PI/2;P(t,2+Math.round(Math.cos(a)*0)+Math.round(11*(1-Math.cos(a))*0)+Math.round(11*Math.sin(a)),13-Math.round(11*(1-Math.cos(a))),WOODC);}
  line(t,2,13,13,2,[220,220,220]);outline(t,[50,36,16]);});
T('flint_and_steel',t=>{blank(t);for(let i=0;i<9;i++){const a=i/8*Math.PI*1.5;P(t,6+Math.round(Math.cos(a)*3),6+Math.round(Math.sin(a)*3),[190,190,190]);}
  for(let y=9;y<14;y++)for(let x=9;x<13;x++)if(x+y<23)P(t,x,y,[70,70,74]);outline(t,[30,30,30]);});
function bucketFn(fill){return t=>{F(t,(x,y)=>{if(y<4||y>13)return CLEAR;const w=6-(y-4)*0.25;if(Math.abs(x-7.5)>w)return CLEAR;
  if(y<=5){if(fill&&Math.abs(x-7.5)<w-1)return fill;return y===4?[200,200,200]:[60,60,60];}return x<7.5?[200,200,200]:[160,160,160];});
  for(let x=3;x<13;x++)P(t,x,2+Math.round(Math.abs(x-7.5)*0.25),[120,120,120]);outline(t,[50,50,50]);};}
T('bucket',bucketFn(null));T('water_bucket',bucketFn([50,100,220]));T('lava_bucket',bucketFn([240,120,20]));
T('paper',t=>{F(t,(x,y)=>{const u=x+(y>>2);return(u>2&&u<14&&y>2&&y<14)?M([236,236,226],y%3===0?0.93:1):CLEAR;});outline(t,[120,120,110]);});
T('book',t=>{F(t,(x,y)=>{if(x<3||x>12||y<2||y>13)return CLEAR;if(x===12||y===13)return[236,232,220];if(x===3)return[90,46,24];return M([140,72,36],0.92+((x*y)%4)*0.03);});outline(t,[50,24,10]);});
T('clay_ball',t=>{F(t,(x,y)=>inEll(x,y,8,8.5,4.5,4)?(x+y<15?[180,186,200]:[140,146,160]):CLEAR);outline(t,[80,84,96]);});
T('shears',t=>{blank(t);line(t,4,4,11,11,[200,200,200]);line(t,4,11,11,4,[170,170,170]);for(const[x,y]of[[3,3],[3,12],[12,12],[12,3]])P(t,x,y,[90,60,40]);outline(t,[40,40,40]);});
T('door_item',t=>{F(t,(x,y)=>{if(x<4||x>11||y<1||y>14)return CLEAR;if(y>2&&y<7&&x>4&&x<11&&x!==7&&x!==8)return[200,220,230];if(x===10&&y===9)return[80,80,80];return M([164,128,74],y%4===0?0.85:1);});outline(t,[70,50,20]);});
T('bed_item',t=>{F(t,(x,y)=>{if(y<6||y>12||x<1||x>14)return CLEAR;if(y>=11&&(x>2&&x<13))return CLEAR;if(y>=11)return[120,90,50];if(x<5&&y<9)return[236,236,236];return y<9?[190,36,36]:[140,24,24];});outline(t,[50,14,14]);});
function swordFn(col){return t=>{blank(t);for(let i=0;i<9;i++){P(t,5+i,10-i,M(col,1.2));P(t,6+i,10-i,col);P(t,5+i,9-i,M(col,0.85));}
  line(t,2,10,5,13,[60,40,20]);line(t,3,13,5,11,WOODC);P(t,2,14,WOODD);P(t,1,14,WOODD);P(t,2,13,WOODC);outline(t,[24,20,16]);};}
function hoeFn(col){return t=>{blank(t);for(let i=0;i<10;i++){P(t,2+i,13-i,WOODC);P(t,3+i,13-i,WOODD);}for(let x=6;x<13;x++){P(t,x,2,M(col,1.2));P(t,x,3,col);}P(t,6,4,M(col,0.7));outline(t,[30,24,16]);};}
const TIERS=[['wood','나무',[150,114,48]],['stone','돌',[128,128,128]],['iron','철',[220,220,220]],['diamond','다이아몬드',[54,232,204]]];
function toolFn(type,col){return t=>{blank(t);
  for(let i=0;i<9;i++){P(t,2+i,13-i,WOODC);P(t,3+i,13-i,WOODD);}
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){const px=x+0.5,py=y+0.5,a=((px-1.5)+(14.5-py))/Math.SQRT2,b=((px-1.5)-(14.5-py))/Math.SQRT2;let c=null;
    if(type==='pick'){const r=Math.hypot(px-1.5,14.5-py),ang=Math.atan2(14.5-py,px-1.5)*180/Math.PI;
      if(r>=10.3&&r<=12.6&&ang>=7&&ang<=83)c=r>11.8?M(col,0.62):r<10.9?M(col,1.25):col;}
    else if(type==='axe'){if(a>=8.6&&a<=13.4&&b<=0.9&&b>=-4.8+Math.max(0,a-12.4)*1.2)c=b<-3.6?M(col,1.25):a>12.6?M(col,0.62):col;}
    else if(type==='shovel'){if(a>=10.4&&a<=15.6&&Math.abs(b)<=2.3-Math.max(0,a-14.2)*0.9)c=b<-1?M(col,1.25):b>1?M(col,0.62):col;}
    if(c)P(t,x,y,c);}
  outline(t,[30,24,16]);};}
for(const ty of['pick','axe','shovel'])for(const[k,,c]of TIERS)T(ty+'_'+k,toolFn(ty,c));
for(const[k,,c]of TIERS){T('sword_'+k,swordFn(c));T('hoe_'+k,hoeFn(c));}
const ARMOR_MAT=[['leather','가죽',[150,84,44]],['iron','철',[214,214,214]],['diamond','다이아몬드',[80,226,214]]];
const ARMOR_MAPS={
  helmet:['................','................','...##########...','..#cccccccccc#..','..#cCCCCCCCCc#..','..#cc######cc#..','..#cc#....#cc#..','..#cc#....#cc#..','...##......##...'],
  chest:['................','..###......###..','.#cc#......#cc#.','.#ccc######ccc#.','.#cCcccccccccc#.','..##cccccccc##..','...#cccccccc#...','...#cCcccccc#...','...#cccccccc#...','...#cccccccc#...','...#cccccccc#...','...##########...'],
  legs:['................','...##########...','...#cCcccccc#...','...#cccccccc#...','...#ccc##ccc#...','...#ccc##ccc#...','...#cCc##cCc#...','...#ccc##ccc#...','...#ccc##ccc#...','...#ccc##ccc#...','...#####.####...'],
  boots:['................','................','................','................','................','................','..####....####..','..#cc#....#cc#..','..#cc#....#cc#..','.#ccc#....#ccc#.','.#cCc#....#cCc#.','.#####....#####.']};
for(const[k,,c]of ARMOR_MAT)for(const p of Object.keys(ARMOR_MAPS))T(p+'_'+k,t=>fromMap(t,ARMOR_MAPS[p].concat(new Array(16-ARMOR_MAPS[p].length).fill('................')),{'#':M(c,0.4),c:c,C:M(c,1.3)}));
function eggFn(a,b){return t=>{const r=mulberry32(a[0]*7+b[1]);F(t,(x,y)=>{if(!inEll(x,y,8,8.8,4.6,6.2))return CLEAR;return r()<0.18?b:(x+y<13?M(a,1.15):a);});outline(t,M(a,0.35));};}
const MOB_EGG={pig:[[240,160,160],[200,110,110]],cow:[[70,52,40],[180,180,180]],sheep:[[230,230,230],[250,190,180]],chicken:[[220,220,220],[230,40,40]],
  zombie:[[0,170,170],[90,140,80]],skeleton:[[190,190,190],[80,80,80]],creeper:[[80,190,80],[20,20,20]],spider:[[60,50,44],[180,20,20]]};
for(const k in MOB_EGG)T('egg_'+k,eggFn(...MOB_EGG[k]));
T('skin',t=>{const r=mulberry32(471);F(t,()=>M([198,144,112],0.93+r()*0.07));});
/* ---------- 입자 ---------- */
T('p_smoke',t=>{F(t,(x,y)=>{const d=Math.hypot(x-7.5,y-7.5);return d<6.5?[200,200,200,d<4?255:180]:CLEAR;});});
T('p_flame',t=>{F(t,(x,y)=>{const w=5-Math.abs(y-10)*0.5;if(y<2||Math.abs(x-7.5)>w*(y<6?(y-1)/5:1))return CLEAR;return y>9&&Math.abs(x-7.5)<2.5?[255,250,180]:y>6?[255,180,40]:[240,90,20];});});
T('p_crit',t=>{blank(t);for(let i=0;i<16;i++){P(t,i,7,[200,240,255]);P(t,7,i,[200,240,255]);}for(let i=4;i<12;i++){P(t,i,i,[160,200,255]);P(t,15-i,i,[160,200,255]);}});
T('p_heart',t=>fromMap(t,['................','................','...###...###....','..#####.#####...','..###########...','..###########...','...#########....','....#######.....','.....#####......','......###.......','.......#........','................','................','................','................','................'],{'#':[230,30,40]}));
T('p_xp',t=>{F(t,(x,y)=>{const d=Math.hypot(x-7.5,y-7.5);return d<5?(d<2.5?[255,255,160]:[180,240,40]):d<6?[90,140,10]:CLEAR;});});
T('p_splash',t=>{F(t,(x,y)=>inEll(x,y,8,9,3,4.5)?[90,140,240,220]:CLEAR);});
T('p_explode',t=>{const r=mulberry32(480);F(t,(x,y)=>{const d=Math.hypot(x-7.5,y-7.5);return d<7.5&&r()<0.85?M([230,230,230],0.7+r()*0.3):CLEAR;});});
T('p_note',t=>{F(t,(x,y)=>Math.hypot(x-7.5,y-7.5)<7?[60,60,60]:CLEAR);});
{const r=mulberry32(301);const br=[];for(let b=0;b<7;b++){let x=7.5+(r()-0.5)*3,y=7.5+(r()-0.5)*3;const ang=r()*Math.PI*2,pts=[];
  for(let s=0;s<12;s++){const a=ang+(r()-0.5)*1.3;x+=Math.cos(a);y+=Math.sin(a);pts.push([Math.floor(x),Math.floor(y)]);}br.push(pts);}
  for(let k=0;k<10;k++)T('destroy_'+k,t=>{F(t,()=>[128,128,128]);const n=Math.ceil(12*(k+1)/10);
    for(const pts of br)for(let i=0;i<n;i++){const[x,y]=pts[i];P(t,x+1,y,[96,96,96]);P(t,x,y,[36,36,36]);}});}
