'use strict';
/* =====================================================================
   blocks.js — 블록 · 아이템 · 제작법 · 화로 · 연료
   ===================================================================== */
const R_NONE=0,R_CUBE=1,R_CROSS=2,R_TORCH=3,R_FLUID=4,R_BOX=5,R_DYN=6,R_CROP=7;
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];          // 0:+x(동) 1:-x(서) 2:+z(남) 3:-z(북)
const DIR_FACE=[0,1,4,5];                         // 방향 → 면 번호 (면: 0+x 1-x 2+y 3-y 4+z 5-z)
const OPP=[1,0,3,2];
const B={AIR:0,GRASS:1,DIRT:2,STONE:3,COBBLE:4,BEDROCK:5,SAND:6,GRAVEL:7,OAK_LOG:8,OAK_LEAVES:9,OAK_PLANKS:10,WATER:11,GLASS:12,
  COAL_ORE:13,IRON_ORE:14,GOLD_ORE:15,DIAMOND_ORE:16,BRICKS:17,TABLE:18,SNOWY_GRASS:19,TORCH:20,GLOWSTONE:21,TALL_GRASS:22,
  DANDELION:23,POPPY:24,CACTUS:25,STONE_BRICKS:26,BIRCH_LOG:27,BIRCH_LEAVES:28,BIRCH_PLANKS:29,SANDSTONE:30,OBSIDIAN:31,
  BOOKSHELF:32,MOSSY:33,SNOW:34,WOOL:35,WALL_TORCH:44,ICE:48,SPRUCE_LOG:49,SPRUCE_LEAVES:50,SPRUCE_PLANKS:51,CLAY:52,SUGAR_CANE:53,
  PUMPKIN:54,JACK:55,TNT:59,FARMLAND:60,FARMLAND_WET:61,WHEAT:62,SAPLING_OAK:70,SAPLING_BIRCH:71,SAPLING_SPRUCE:72,
  OAK_LEAVES_P:73,BIRCH_LEAVES_P:74,SPRUCE_LEAVES_P:75,FURNACE:76,FURNACE_LIT:80,CHEST:84,
  WATER_FLOW:88,WATER_FALL:95,LAVA:96,LAVA_FLOW:97,LAVA_FALL:100,LADDER:101,FENCE:105,PANE:106,
  OAK_SLAB:107,STONE_SLAB:108,COBBLE_SLAB:109,OAK_SLAB_TOP:110,STONE_SLAB_TOP:111,COBBLE_SLAB_TOP:112,
  OAK_STAIRS:113,COBBLE_STAIRS:117,BRICK_STAIRS:121,DOOR:125,BED:141,BROWN_MUSH:149,RED_MUSH:150,
  COAL_BLOCK:151,IRON_BLOCK:152,GOLD_BLOCK:153,DIAMOND_BLOCK:154,DEAD_BUSH:155,SNOW_LAYER:156,SMOOTH_STONE:157};
const I={STICK:256,COAL:257,CHARCOAL:258,IRON:259,GOLD:260,DIAMOND:261,APPLE:262,BREAD:263,WHEAT:264,SEEDS:265,
  PORK:266,COOKED_PORK:267,BEEF:268,STEAK:269,CHICKEN:270,COOKED_CHICKEN:271,MUTTON:272,COOKED_MUTTON:273,ROTTEN:274,
  LEATHER:275,FEATHER:276,STRING:277,BONE:278,BONE_MEAL:279,GUNPOWDER:280,ARROW:281,BOW:282,FLINT:283,FLINT_STEEL:284,
  BUCKET:285,WATER_BUCKET:286,LAVA_BUCKET:287,PAPER:288,BOOK:289,CLAY_BALL:290,BRICK:291,SHEARS:292,DOOR_ITEM:293,BED_ITEM:294,
  PICK:300,AXE:304,SHOVEL:308,SWORD:312,HOE:316,ARMOR:320,EGG:340};
const MOB_TYPES=['pig','cow','sheep','chicken','zombie','skeleton','creeper','spider'];
const MOB_NAMES={pig:'돼지',cow:'소',sheep:'양',chicken:'닭',zombie:'좀비',skeleton:'스켈레톤',creeper:'크리퍼',spider:'거미',player:'플레이어'};

const BLOCKS=[];
const OPQ=new Uint8Array(256),ATTEN=new Uint8Array(256),EMIT=new Uint8Array(256),RTYPE=new Uint8Array(256),SOLID=new Uint8Array(256),
  BTEX=new Uint8Array(256*6),FLUID=new Uint8Array(256),FLEVEL=new Uint8Array(256),REPL=new Uint8Array(256);
const BOXES=[],COLL=[];
function texFaces(tx,facing){if(!tx)return null;if(typeof tx==='string')return[tx,tx,tx,tx,tx,tx];if(Array.isArray(tx))return tx;
  const s=tx.side||tx.all,f=[s,s,tx.top||s,tx.bottom||tx.top||s,s,s];if(tx.front!==undefined&&facing!==undefined)f[DIR_FACE[facing]]=tx.front;return f;}
function defBlock(id,name,o){
  const d=Object.assign({id,name,opaque:true,solid:true,render:R_CUBE,hard:1,tool:null,need:0,drop:id,light:0,sound:'stone'},o);
  if(d.atten===undefined)d.atten=d.opaque?15:0;
  BLOCKS[id]=d;OPQ[id]=d.opaque?1:0;ATTEN[id]=d.atten;EMIT[id]=d.light;RTYPE[id]=d.render;SOLID[id]=d.solid?1:0;REPL[id]=d.replaceable?1:0;
  const f=texFaces(d.tex,d.facing);if(f)for(let i=0;i<6;i++){if(TEXL[f[i]]===undefined)console.warn('텍스처 없음',f[i]);BTEX[id*6+i]=TEXL[f[i]]||0;}
  if(d.boxes){BOXES[id]=d.boxes;COLL[id]=d.coll||d.boxes;}
  return d;}
BLOCKS[0]={id:0,name:'공기',opaque:false,solid:false,render:R_NONE,replaceable:true,hard:0};RTYPE[0]=R_NONE;REPL[0]=1;
const PLANT={opaque:false,solid:false,render:R_CROSS,hard:0,drop:0,replaceable:true,plant:true,sound:'grass'};
const PLANT2=Object.assign({},PLANT,{replaceable:false});
defBlock(1,'잔디 블록',{tex:{top:'grass_top',bottom:'dirt',side:'grass_side'},hard:0.6,tool:'shovel',drop:2,sound:'grass'});
defBlock(2,'흙',{tex:'dirt',hard:0.5,tool:'shovel',sound:'gravel'});
defBlock(3,'돌',{tex:'stone',hard:1.5,tool:'pick',need:1,drop:4,blast:6});
defBlock(4,'조약돌',{tex:'cobblestone',hard:2,tool:'pick',need:1,blast:6});
defBlock(5,'기반암',{tex:'bedrock',hard:-1,blast:1e9});
defBlock(6,'모래',{tex:'sand',hard:0.5,tool:'shovel',gravity:true,sound:'sand'});
defBlock(7,'자갈',{tex:'gravel',hard:0.6,tool:'shovel',gravity:true,sound:'gravel'});
defBlock(8,'참나무 원목',{tex:{top:'oak_log_top',side:'oak_log'},hard:2,tool:'axe',sound:'wood',log:true,fuel:300});
defBlock(9,'참나무 잎',{tex:'oak_leaves',opaque:false,atten:1,hard:0.2,drop:0,leaves:true,sapling:70,persist:73,sound:'grass'});
defBlock(10,'참나무 판자',{tex:'oak_planks',hard:2,tool:'axe',sound:'wood',fuel:300});
defBlock(11,'물',{tex:'water',opaque:false,solid:false,render:R_FLUID,atten:2,hard:-1,drop:0,replaceable:true,blast:100});
defBlock(12,'유리',{tex:'glass',opaque:false,hard:0.3,drop:0,cullSame:true,sound:'glass'});
defBlock(13,'석탄 광석',{tex:'coal_ore',hard:3,tool:'pick',need:1,drop:I.COAL,xp:[0,2]});
defBlock(14,'철 광석',{tex:'iron_ore',hard:3,tool:'pick',need:2});
defBlock(15,'금 광석',{tex:'gold_ore',hard:3,tool:'pick',need:3});
defBlock(16,'다이아몬드 광석',{tex:'diamond_ore',hard:3,tool:'pick',need:3,drop:I.DIAMOND,xp:[3,7]});
defBlock(17,'벽돌',{tex:'bricks',hard:2,tool:'pick',need:1,blast:6});
defBlock(18,'제작대',{tex:{top:'crafting_table_top',bottom:'oak_planks',side:'crafting_table_side'},hard:2.5,tool:'axe',sound:'wood',fuel:300});
defBlock(19,'눈 덮인 잔디 블록',{tex:{top:'snow',bottom:'dirt',side:'grass_snow_side'},hard:0.6,tool:'shovel',drop:2,sound:'grass'});
defBlock(20,'횃불',{tex:'torch',opaque:false,solid:false,render:R_TORCH,light:14,hard:0,sound:'wood'});
defBlock(21,'발광석',{tex:'glowstone',hard:0.3,light:15,sound:'glass'});
defBlock(22,'잔디',Object.assign({tex:'tall_grass'},PLANT));
defBlock(23,'민들레',Object.assign({tex:'dandelion'},PLANT2,{drop:23}));
defBlock(24,'양귀비',Object.assign({tex:'poppy'},PLANT2,{drop:24}));
defBlock(25,'선인장',{tex:{top:'cactus_top',side:'cactus_side'},opaque:false,atten:1,render:R_BOX,boxes:[[1,0,1,15,16,15]],coll:[[1,0,1,15,15,15]],hard:0.4,sound:'wool',cactus:true});
defBlock(26,'석재 벽돌',{tex:'stone_bricks',hard:1.5,tool:'pick',need:1,blast:6});
defBlock(27,'자작나무 원목',{tex:{top:'birch_log_top',side:'birch_log'},hard:2,tool:'axe',sound:'wood',log:true,fuel:300});
defBlock(28,'자작나무 잎',{tex:'birch_leaves',opaque:false,atten:1,hard:0.2,drop:0,leaves:true,sapling:71,persist:74,sound:'grass'});
defBlock(29,'자작나무 판자',{tex:'birch_planks',hard:2,tool:'axe',sound:'wood',fuel:300});
defBlock(30,'사암',{tex:{top:'sandstone_top',side:'sandstone'},hard:0.8,tool:'pick',need:1});
defBlock(31,'흑요석',{tex:'obsidian',hard:50,tool:'pick',need:4,blast:1200});
defBlock(32,'책장',{tex:{top:'oak_planks',side:'bookshelf'},hard:1.5,tool:'axe',sound:'wood',fuel:300});
defBlock(33,'이끼 낀 조약돌',{tex:'mossy_cobblestone',hard:2,tool:'pick',need:1,blast:6});
defBlock(34,'눈 블록',{tex:'snow',hard:0.2,tool:'shovel',sound:'snow'});
defBlock(35,'하얀색 양털',{tex:'wool',hard:0.8,sound:'wool',wool:true});
WOOLS.forEach(([k,n],i)=>defBlock(36+i,n+' 양털',{tex:'wool_'+k,hard:0.8,sound:'wool',wool:true}));
for(let i=0;i<4;i++)defBlock(44+i,'횃불',{tex:'torch',opaque:false,solid:false,render:R_TORCH,light:14,hard:0,drop:20,sound:'wood',wall:i,hidden:true});
defBlock(48,'얼음',{tex:'ice',opaque:false,atten:2,hard:0.5,drop:0,cullSame:true,sound:'glass',slip:0.98});
defBlock(49,'가문비나무 원목',{tex:{top:'spruce_log_top',side:'spruce_log'},hard:2,tool:'axe',sound:'wood',log:true,fuel:300});
defBlock(50,'가문비나무 잎',{tex:'spruce_leaves',opaque:false,atten:1,hard:0.2,drop:0,leaves:true,sapling:72,persist:75,sound:'grass'});
defBlock(51,'가문비나무 판자',{tex:'spruce_planks',hard:2,tool:'axe',sound:'wood',fuel:300});
defBlock(52,'점토',{tex:'clay',hard:0.6,tool:'shovel',sound:'gravel'});
defBlock(53,'사탕수수',Object.assign({tex:'sugar_cane'},PLANT2,{drop:53,cane:true}));
defBlock(54,'호박',{tex:{top:'pumpkin_top',side:'pumpkin_side'},hard:1,tool:'axe',sound:'wood'});
for(let f=0;f<4;f++)defBlock(55+f,'잭오랜턴',{tex:{top:'pumpkin_top',side:'pumpkin_side',front:'jack_face'},facing:f,hard:1,tool:'axe',sound:'wood',light:15,drop:55,family:55,hidden:f>0});
defBlock(59,'TNT',{tex:{top:'tnt_top',bottom:'tnt_bottom',side:'tnt_side'},hard:0,sound:'grass',tnt:true});
defBlock(60,'경작지',{tex:{top:'farmland_dry',bottom:'dirt',side:'dirt'},opaque:false,atten:15,render:R_BOX,boxes:[[0,0,0,16,15,16]],hard:0.6,tool:'shovel',drop:2,sound:'gravel',hidden:true});
defBlock(61,'경작지',{tex:{top:'farmland_wet',bottom:'dirt',side:'dirt'},opaque:false,atten:15,render:R_BOX,boxes:[[0,0,0,16,15,16]],hard:0.6,tool:'shovel',drop:2,sound:'gravel',hidden:true});
for(let s=0;s<8;s++)defBlock(62+s,'밀',{tex:'wheat_'+s,opaque:false,solid:false,render:R_CROP,hard:0,drop:0,sound:'grass',crop:s,hidden:true});
[['참나무 묘목','sapling_oak','oak'],['자작나무 묘목','sapling_birch','birch'],['가문비나무 묘목','sapling_spruce','spruce']].forEach(([n,t,k],i)=>
  defBlock(70+i,n,Object.assign({tex:t},PLANT2,{drop:70+i,sapling:k,fuel:100})));
[[73,'참나무 잎','oak_leaves'],[74,'자작나무 잎','birch_leaves'],[75,'가문비나무 잎','spruce_leaves']].forEach(([id,n,t])=>
  defBlock(id,n,{tex:t,opaque:false,atten:1,hard:0.2,drop:0,leaves:true,sapling:BLOCKS[id-64]?BLOCKS[id-64].sapling:70,sound:'grass',hidden:true,persistent:true}));
BLOCKS[73].sapling=70;BLOCKS[74].sapling=71;BLOCKS[75].sapling=72;
for(let f=0;f<4;f++){
  defBlock(76+f,'화로',{tex:{top:'furnace_top',side:'furnace_side',front:'furnace_front'},facing:f,hard:3.5,tool:'pick',need:1,drop:76,family:76,hidden:f>0,furnace:true});
  defBlock(80+f,'화로',{tex:{top:'furnace_top',side:'furnace_side',front:'furnace_front_lit'},facing:f,hard:3.5,tool:'pick',need:1,drop:76,family:76,light:13,hidden:true,furnace:true});
  defBlock(84+f,'상자',{tex:{top:'chest_top',side:'chest_side',front:'chest_front'},facing:f,opaque:false,atten:0,render:R_BOX,boxes:[[1,0,1,15,14,15]],hard:2.5,tool:'axe',drop:84,family:84,hidden:f>0,sound:'wood',chest:true,fuel:300});}
for(let l=1;l<=7;l++)defBlock(87+l,'물',{tex:'water',opaque:false,solid:false,render:R_FLUID,atten:2,hard:-1,drop:0,replaceable:true,hidden:true,blast:100});
defBlock(95,'물',{tex:'water',opaque:false,solid:false,render:R_FLUID,atten:2,hard:-1,drop:0,replaceable:true,hidden:true,blast:100});
defBlock(96,'용암',{tex:'lava',opaque:false,solid:false,render:R_FLUID,atten:2,light:15,hard:-1,drop:0,replaceable:true,blast:100});
for(let l=1;l<=3;l++)defBlock(96+l,'용암',{tex:'lava',opaque:false,solid:false,render:R_FLUID,atten:2,light:15,hard:-1,drop:0,replaceable:true,hidden:true,blast:100});
defBlock(100,'용암',{tex:'lava',opaque:false,solid:false,render:R_FLUID,atten:2,light:15,hard:-1,drop:0,replaceable:true,hidden:true,blast:100});
for(let i=88;i<=95;i++){FLUID[i]=1;FLEVEL[i]=i===95?8:i-87;}FLUID[11]=1;FLEVEL[11]=0;
for(let i=96;i<=100;i++){FLUID[i]=2;FLEVEL[i]=i===100?8:i-96;}
const LADDER_BOX=[[[0,0,0,2,16,16]],[[14,0,0,16,16,16]],[[0,0,0,16,16,2]],[[0,0,14,16,16,16]]];
for(let f=0;f<4;f++)defBlock(101+f,'사다리',{tex:'ladder',opaque:false,atten:0,render:R_BOX,boxes:LADDER_BOX[f],hard:0.4,tool:'axe',drop:101,family:101,hidden:f>0,sound:'wood',ladder:f,fuel:300});
defBlock(105,'참나무 울타리',{tex:'oak_planks',opaque:false,atten:0,render:R_DYN,hard:2,tool:'axe',sound:'wood',fence:true,fuel:300});
defBlock(106,'유리판',{tex:'glass',opaque:false,atten:0,render:R_DYN,hard:0.3,drop:0,sound:'glass',pane:true});
const SLAB_B=[[0,0,0,16,8,16]],SLAB_T=[[0,8,0,16,16,16]];
[[107,'참나무 반 블록','oak_planks','axe',10,'wood'],[108,'돌 반 블록',{top:'smooth_stone',side:'smooth_stone_side'},'pick',157,'stone'],[109,'조약돌 반 블록','cobblestone','pick',4,'stone']].forEach(([id,n,tx,tool,dbl,snd])=>{
  defBlock(id,n,{tex:tx,opaque:false,atten:1,render:R_BOX,boxes:SLAB_B,hard:2,tool,need:tool==='pick'?1:0,sound:snd,slab:'bottom',double:dbl,fuel:tool==='axe'?150:0});
  defBlock(id+3,n,{tex:tx,opaque:false,atten:1,render:R_BOX,boxes:SLAB_T,hard:2,tool,need:tool==='pick'?1:0,sound:snd,slab:'top',double:dbl,drop:id,hidden:true});});
const STAIR_BOX=f=>[[0,0,0,16,8,16],[[8,8,0,16,16,16],[0,8,0,8,16,16],[0,8,8,16,16,16],[0,8,0,16,16,8]][f]];
[[113,'참나무 계단','oak_planks','axe','wood'],[117,'조약돌 계단','cobblestone','pick','stone'],[121,'석재 벽돌 계단','stone_bricks','pick','stone']].forEach(([id,n,tx,tool,snd])=>{
  for(let f=0;f<4;f++)defBlock(id+f,n,{tex:tx,opaque:false,atten:1,render:R_BOX,boxes:STAIR_BOX(f),hard:2,tool,need:tool==='pick'?1:0,sound:snd,drop:id,family:id,hidden:f>0,stairs:f,fuel:tool==='axe'?300:0});});
const DOOR_CLOSED=[[13,0,0,16,16,16],[0,0,0,3,16,16],[0,0,13,16,16,16],[0,0,0,16,16,3]],DOOR_OPEN=[[0,0,0,16,16,3],[0,0,13,16,16,16],[13,0,0,16,16,16],[0,0,0,3,16,16]];
for(let up=0;up<2;up++)for(let f=0;f<4;f++)for(let op=0;op<2;op++)
  defBlock(125+up*8+f*2+op,'참나무 문',{tex:up?'door_top':'door_bottom',opaque:false,atten:0,render:R_BOX,boxes:[op?DOOR_OPEN[f]:DOOR_CLOSED[f]],hard:3,tool:'axe',drop:up?0:I.DOOR_ITEM,sound:'wood',door:{up,f,open:op},hidden:true});
for(let head=0;head<2;head++)for(let f=0;f<4;f++)
  defBlock(141+head*4+f,'침대',{tex:{top:head?'bed_top_head':'bed_top_foot',bottom:'oak_planks',side:'bed_side'},opaque:false,atten:0,render:R_BOX,boxes:[[0,0,0,16,9,16]],hard:0.2,drop:head?0:I.BED_ITEM,sound:'wool',bed:{head,f},hidden:true});
defBlock(149,'갈색 버섯',Object.assign({tex:'brown_mushroom'},PLANT2,{drop:149,light:1,mushroom:true}));
defBlock(150,'빨간 버섯',Object.assign({tex:'red_mushroom'},PLANT2,{drop:150,mushroom:true}));
defBlock(151,'석탄 블록',{tex:'coal_block',hard:5,tool:'pick',need:1,fuel:16000});
defBlock(152,'철 블록',{tex:'iron_block',hard:5,tool:'pick',need:2,blast:6});
defBlock(153,'금 블록',{tex:'gold_block',hard:3,tool:'pick',need:3,blast:6});
defBlock(154,'다이아몬드 블록',{tex:'diamond_block',hard:5,tool:'pick',need:3,blast:6});
defBlock(155,'마른 덤불',Object.assign({tex:'dead_bush'},PLANT,{deadbush:true}));
defBlock(156,'눈',{tex:'snow',opaque:false,atten:0,render:R_BOX,boxes:[[0,0,0,16,2,16]],coll:[],solid:false,hard:0.1,tool:'shovel',drop:0,replaceable:true,sound:'snow',snowLayer:true});
defBlock(157,'매끄러운 돌',{tex:{top:'smooth_stone',side:'smooth_stone_side'},hard:2,tool:'pick',need:1,blast:6});

/* 동적 모양 (울타리 · 유리판) */
function fenceConnect(id,nb){if(BLOCKS[id].fence)return nb===B.FENCE||OPQ[nb];return nb===B.PANE||nb===B.GLASS||OPQ[nb];}
function dynBoxes(id,nb){// nb: [+x,-x,+z,-z] 이웃 블록 id
  const c=nb.map(n=>fenceConnect(id,n)?1:0);
  if(BLOCKS[id].fence){const r=[[6,0,6,10,16,10]],col=[[6,0,6,10,24,10]];
    const arm=[[10,7,16,9],[0,7,6,9],[7,10,9,16],[7,0,9,6]],carm=[[10,0,6,16,24,10],[0,0,6,6,24,10],[6,0,10,10,24,16],[6,0,0,10,24,6]];
    for(let d=0;d<4;d++)if(c[d]){const[x0,z0,x1,z1]=arm[d];r.push([x0,6,z0,x1,9,z1],[x0,12,z0,x1,15,z1]);col.push(carm[d]);}
    return{r,col};}
  const r=[[7,0,7,9,16,9]];const any=c.some(v=>v);const arm=[[9,0,7,16,16,9],[0,0,7,7,16,9],[7,0,9,9,16,16],[7,0,0,9,16,7]];
  for(let d=0;d<4;d++)if(c[d]||!any)r.push(arm[d]);return{r,col:r};}

/* ---------- 아이템 ---------- */
const ITEMS=[];
for(const d of BLOCKS)if(d&&d.id)ITEMS[d.id]={id:d.id,name:d.name,stack:64,block:true,fuel:d.fuel};
function defItem(id,name,tex,o){ITEMS[id]=Object.assign({id,name,stack:64,layer:TEXL[tex]},o);if(TEXL[tex]===undefined)console.warn('아이템 텍스처 없음',tex);}
defItem(I.STICK,'막대기','stick',{fuel:100});defItem(I.COAL,'석탄','coal',{fuel:1600});defItem(I.CHARCOAL,'숯','charcoal',{fuel:1600});
defItem(I.IRON,'철 주괴','iron_ingot');defItem(I.GOLD,'금 주괴','gold_ingot');defItem(I.DIAMOND,'다이아몬드','diamond');
defItem(I.APPLE,'사과','apple',{food:4,sat:2.4});defItem(I.BREAD,'빵','bread',{food:5,sat:6});defItem(I.WHEAT,'밀','wheat');defItem(I.SEEDS,'밀 씨앗','seeds');
defItem(I.PORK,'익히지 않은 돼지고기','porkchop',{food:3,sat:1.8});defItem(I.COOKED_PORK,'익힌 돼지고기','cooked_porkchop',{food:8,sat:12.8});
defItem(I.BEEF,'익히지 않은 소고기','beef',{food:3,sat:1.8});defItem(I.STEAK,'스테이크','steak',{food:8,sat:12.8});
defItem(I.CHICKEN,'익히지 않은 닭고기','chicken',{food:2,sat:1.2});defItem(I.COOKED_CHICKEN,'익힌 닭고기','cooked_chicken',{food:6,sat:7.2});
defItem(I.MUTTON,'익히지 않은 양고기','mutton',{food:2,sat:1.2});defItem(I.COOKED_MUTTON,'익힌 양고기','cooked_mutton',{food:6,sat:9.6});
defItem(I.ROTTEN,'썩은 살점','rotten_flesh',{food:4,sat:0.8});
defItem(I.LEATHER,'가죽','leather');defItem(I.FEATHER,'깃털','feather');defItem(I.STRING,'실','string');defItem(I.BONE,'뼈','bone');
defItem(I.BONE_MEAL,'뼛가루','bone_meal');defItem(I.GUNPOWDER,'화약','gunpowder');defItem(I.ARROW,'화살','arrow');
defItem(I.BOW,'활','bow',{stack:1,dur:384,bow:true});defItem(I.FLINT,'부싯돌','flint');defItem(I.FLINT_STEEL,'부싯돌과 부시','flint_and_steel',{stack:1,dur:64});
defItem(I.BUCKET,'양동이','bucket',{stack:16});defItem(I.WATER_BUCKET,'물 양동이','water_bucket',{stack:1});defItem(I.LAVA_BUCKET,'용암 양동이','lava_bucket',{stack:1,fuel:20000});
defItem(I.PAPER,'종이','paper');defItem(I.BOOK,'책','book');defItem(I.CLAY_BALL,'점토 덩이','clay_ball');defItem(I.BRICK,'벽돌','brick');
defItem(I.SHEARS,'가위','shears',{stack:1,dur:238});defItem(I.DOOR_ITEM,'참나무 문','door_item',{fuel:200});defItem(I.BED_ITEM,'침대','bed_item',{stack:1});
const TIER_SPEED=[1,2,4,6,8],TIER_DUR=[0,59,131,250,1561];
const TOOL_DMG={pick:[2,3,4,5],axe:[3,4,5,6],shovel:[1.5,2.5,3.5,4.5],sword:[4,5,6,7],hoe:[1,1,1,1]};
[['pick','곡괭이',I.PICK],['axe','도끼',I.AXE],['shovel','삽',I.SHOVEL],['sword','검',I.SWORD],['hoe','괭이',I.HOE]].forEach(([ty,nm,base])=>TIERS.forEach(([k,kn],t)=>
  defItem(base+t,kn+' '+nm,ty+'_'+k,{stack:1,tool:{type:ty,tier:t+1},dur:TIER_DUR[t+1],damage:TOOL_DMG[ty][t],fuel:t===0?200:0})));
const ARMOR_PTS=[[1,3,2,1],[2,6,5,2],[3,8,6,3]],ARMOR_DUR=[[55,80,75,65],[165,240,225,195],[363,528,495,429]];
const ARMOR_SLOT_NAMES=['투구','흉갑','레깅스','부츠'],ARMOR_TEX=['helmet','chest','legs','boots'];
ARMOR_MAT.forEach(([k,kn],m)=>ARMOR_TEX.forEach((p,s)=>defItem(I.ARMOR+m*4+s,kn+' '+ARMOR_SLOT_NAMES[s],p+'_'+k,{stack:1,armor:{slot:s,pts:ARMOR_PTS[m][s]},dur:ARMOR_DUR[m][s]})));
MOB_TYPES.forEach((m,i)=>defItem(I.EGG+i,MOB_NAMES[m]+' 생성 알','egg_'+m,{egg:m}));
function itemName(id){return ITEMS[id]?ITEMS[id].name:'?';}
function maxStack(id){return ITEMS[id]?ITEMS[id].stack:64;}
function isCubeItem(id){return id<256&&RTYPE[id]===R_CUBE;}

/* ---------- 크리에이티브 탭 ---------- */
const CREATIVE_TABS=[
  ['건축 블록',B.GRASS,[1,2,3,4,5,6,7,8,27,49,10,29,51,17,26,30,31,33,34,48,52,157,151,152,153,154,13,14,15,16,12,35,36,37,38,39,40,41,42,43,107,108,109,113,117,121]],
  ['장식 블록',B.POPPY,[9,28,50,22,23,24,155,149,150,70,71,72,25,53,54,55,21,20,32,18,76,84,101,105,106,I.DOOR_ITEM,I.BED_ITEM,59]],
  ['도구',I.PICK+2,[300,301,302,303,304,305,306,307,308,309,310,311,316,317,318,319,I.SHEARS,I.FLINT_STEEL,I.BUCKET,I.WATER_BUCKET,I.LAVA_BUCKET]],
  ['전투',I.SWORD+2,[312,313,314,315,I.BOW,I.ARROW,...Array.from({length:12},(_,i)=>I.ARMOR+i)]],
  ['음식',I.APPLE,[I.APPLE,I.BREAD,I.PORK,I.COOKED_PORK,I.BEEF,I.STEAK,I.CHICKEN,I.COOKED_CHICKEN,I.MUTTON,I.COOKED_MUTTON,I.ROTTEN]],
  ['재료',I.STICK,[I.STICK,I.COAL,I.CHARCOAL,I.IRON,I.GOLD,I.DIAMOND,I.FLINT,I.WHEAT,I.SEEDS,I.LEATHER,I.FEATHER,I.STRING,I.BONE,I.BONE_MEAL,I.GUNPOWDER,I.PAPER,I.BOOK,I.CLAY_BALL,I.BRICK,...MOB_TYPES.map((_,i)=>I.EGG+i)]]];

/* ---------- 제작법 ---------- */
const RECIPES=[];
function rec(shape,key,out,n=1){RECIPES.push({shape,key,out,n});}
function shapeless(list,out,n=1){RECIPES.push({list,out,n});}
const TAGS={planks:[10,29,51],log:[8,27,49],wool:[35,36,37,38,39,40,41,42,43],coal:[I.COAL,I.CHARCOAL]};
function keyMatch(k,id){if(typeof k==='string')return TAGS[k].includes(id);return k===id;}
shapeless([8],10,4);shapeless([27],29,4);shapeless([49],51,4);
rec(['P','P'],{P:'planks'},I.STICK,4);rec(['PP','PP'],{P:'planks'},B.TABLE);
rec(['C','S'],{C:'coal',S:I.STICK},B.TORCH,4);
rec(['PPP','P P','PPP'],{P:'planks'},B.CHEST);rec(['CCC','C C','CCC'],{C:B.COBBLE},B.FURNACE);
const MATS=['planks',B.COBBLE,I.IRON,I.DIAMOND];
MATS.forEach((m,t)=>{const k={M:m,S:I.STICK};
  rec(['MMM',' S ',' S '],k,I.PICK+t);rec(['MM','MS',' S'],k,I.AXE+t);rec(['M','S','S'],k,I.SHOVEL+t);rec(['M','M','S'],k,I.SWORD+t);rec(['MM',' S',' S'],k,I.HOE+t);});
[I.LEATHER,I.IRON,I.DIAMOND].forEach((m,i)=>{const k={M:m},b=I.ARMOR+i*4;
  rec(['MMM','M M'],k,b);rec(['M M','MMM','MMM'],k,b+1);rec(['MMM','M M','M M'],k,b+2);rec(['M M','M M'],k,b+3);});
rec([' TS','T S',' TS'],{T:I.STICK,S:I.STRING},I.BOW);rec(['F','S','E'],{F:I.FLINT,S:I.STICK,E:I.FEATHER},I.ARROW,4);
rec(['I I',' I '],{I:I.IRON},I.BUCKET);shapeless([I.IRON,I.FLINT],I.FLINT_STEEL);rec([' I','I '],{I:I.IRON},I.SHEARS);
rec(['WWW'],{W:I.WHEAT},I.BREAD);rec(['WWW','PPP'],{W:'wool',P:'planks'},I.BED_ITEM);rec(['PP','PP','PP'],{P:'planks'},I.DOOR_ITEM,3);
rec(['S S','SSS','S S'],{S:I.STICK},B.LADDER,3);rec(['PSP','PSP'],{P:'planks',S:I.STICK},B.FENCE,3);rec(['GGG','GGG'],{G:B.GLASS},B.PANE,16);
rec(['PPP'],{P:'planks'},B.OAK_SLAB,6);rec(['SSS'],{S:B.SMOOTH_STONE},B.STONE_SLAB,6);rec(['SSS'],{S:B.STONE},B.STONE_SLAB,6);rec(['CCC'],{C:B.COBBLE},B.COBBLE_SLAB,6);
rec(['P  ','PP ','PPP'],{P:'planks'},B.OAK_STAIRS,4);rec(['C  ','CC ','CCC'],{C:B.COBBLE},B.COBBLE_STAIRS,4);rec(['C  ','CC ','CCC'],{C:B.STONE_BRICKS},B.BRICK_STAIRS,4);
rec(['GSG','SGS','GSG'],{G:I.GUNPOWDER,S:B.SAND},B.TNT);rec(['BB','BB'],{B:I.BRICK},B.BRICKS);rec(['CC','CC'],{C:I.CLAY_BALL},B.CLAY);
rec(['SS','SS'],{S:B.STONE},B.STONE_BRICKS,4);rec(['SS','SS'],{S:B.SAND},B.SANDSTONE);rec(['SS','SS'],{S:I.STRING},B.WOOL);
rec(['CCC'],{C:B.SUGAR_CANE},I.PAPER,3);shapeless([I.PAPER,I.PAPER,I.PAPER,I.LEATHER],I.BOOK);
rec(['PPP','BBB','PPP'],{P:'planks',B:I.BOOK},B.BOOKSHELF);shapeless([I.BONE],I.BONE_MEAL,3);rec(['P','T'],{P:B.PUMPKIN,T:B.TORCH},B.JACK);
[[I.COAL,151],[I.IRON,152],[I.GOLD,153],[I.DIAMOND,154]].forEach(([it,bl])=>{rec(['XXX','XXX','XXX'],{X:it},bl);shapeless([bl],it,9);});
function craftResult(grid,n){
  let x0=n,y0=n,x1=-1,y1=-1;const items=[];
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(grid[y*n+x]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);items.push(grid[y*n+x].id);}
  if(x1<0)return null;const w=x1-x0+1,h=y1-y0+1;
  for(const r of RECIPES){
    if(r.list){if(r.list.length!==items.length)continue;const left=items.slice();let ok=true;
      for(const k of r.list){const i=left.findIndex(id=>keyMatch(k,id));if(i<0){ok=false;break;}left.splice(i,1);}
      if(ok)return{id:r.out,n:r.n,d:0};continue;}
    if(r.shape.length!==h||r.shape[0].length!==w)continue;
    for(const mir of[false,true]){let ok=true;
      for(let y=0;y<h&&ok;y++)for(let x=0;x<w&&ok;x++){const ch=r.shape[y][mir?w-1-x:x],s=grid[(y0+y)*n+x0+x];
        if(ch===' '){if(s)ok=false;}else if(!s||!keyMatch(r.key[ch],s.id))ok=false;}
      if(ok)return{id:r.out,n:r.n,d:0};}}
  return null;}

/* ---------- 화로 ---------- */
const SMELT={[B.IRON_ORE]:[I.IRON,0.7],[B.GOLD_ORE]:[I.GOLD,1],[B.SAND]:[B.GLASS,0.1],[B.COBBLE]:[B.STONE,0.1],[B.STONE]:[B.SMOOTH_STONE,0.1],
  [I.CLAY_BALL]:[I.BRICK,0.3],[B.CLAY]:[B.BRICKS,0.3],[B.OAK_LOG]:[I.CHARCOAL,0.15],[B.BIRCH_LOG]:[I.CHARCOAL,0.15],[B.SPRUCE_LOG]:[I.CHARCOAL,0.15],
  [I.PORK]:[I.COOKED_PORK,0.35],[I.BEEF]:[I.STEAK,0.35],[I.CHICKEN]:[I.COOKED_CHICKEN,0.35],[I.MUTTON]:[I.COOKED_MUTTON,0.35],[B.CACTUS]:[B.CACTUS,0.1]};
delete SMELT[B.CACTUS];
function fuelOf(id){const it=ITEMS[id];return it&&it.fuel?it.fuel:0;}
