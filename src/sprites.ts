// 部品（楕円・カプセル・多角形・線・点）から、陰影と輪郭線つきのドット絵を作る。
// 生き物の各コマはここで生成し、atlas.ts で1枚のテクスチャにまとめる。PNGへの書き出しは tools/export-sprites.ts。
/* eslint-disable */
// @ts-nocheck

const RAMP={
 fur:[[34,26,28],[66,52,50],[102,84,76],[142,122,108],[180,162,142]],
 furD:[[26,20,22],[48,38,38],[70,58,54],[96,82,74],[122,106,96]],
 furB:[[70,58,52],[130,112,98],[170,150,132],[200,184,164],[224,212,194]],
 pink:[[86,42,50],[146,86,92],[192,124,124],[224,166,162],[244,204,198]],
 liz:[[20,32,20],[40,66,34],[70,106,48],[112,148,70],[160,190,104]],
 lizD:[[14,22,14],[30,48,26],[48,74,36],[74,100,50],[100,128,68]],
 lizB:[[64,58,34],[122,112,66],[168,158,100],[202,194,138],[228,220,170]],
 spi:[[14,10,16],[34,26,38],[58,46,62],[90,74,92],[126,108,128]],
 spiD:[[10,8,12],[24,18,28],[40,32,44],[60,50,62],[82,70,84]],
 bat:[[16,10,18],[34,24,40],[58,42,66],[110,90,124],[176,150,186]],
 mem:[[28,14,24],[50,26,40],[74,40,58],[110,70,90],[150,104,120]],
 memD:[[26,14,22],[48,26,38],[68,40,54],[88,56,68],[106,72,82]],
 // 段階4
 zfur:[[30,30,26],[56,60,48],[84,92,70],[114,122,94],[144,152,120]],
 zfurD:[[22,22,20],[42,46,38],[62,68,54],[84,90,72],[106,112,90]],
 zfurB:[[60,58,46],[104,104,82],[140,140,112],[168,168,138],[192,192,166]],
 zpink:[[60,40,44],[100,70,72],[134,98,94],[164,128,118],[190,160,146]],
 zliz:[[22,26,22],[42,52,40],[68,82,58],[100,114,82],[132,146,108]],
 zlizD:[[16,18,16],[30,36,28],[48,56,42],[68,78,58],[88,100,74]],
 zlizB:[[58,56,44],[104,100,78],[140,136,106],[170,166,134],[198,192,164]],
 zmem:[[30,24,26],[54,44,46],[78,64,66],[102,86,86],[124,108,106]],
 zbat:[[22,20,22],[40,36,40],[62,56,62],[86,78,84],[110,102,108]],
 zspi:[[18,18,18],[36,36,36],[58,56,56],[84,82,80],[110,108,104]],
 bone:[[70,62,52],[130,120,100],[178,168,146],[216,208,186],[240,234,216]],
 sli:[[28,24,58],[54,50,116],[88,92,172],[136,146,220],[206,216,250]],
 ghost:[[54,64,96],[100,118,160],[156,176,214],[204,218,244],[236,242,252]],
 // 段階5a
 kob:[[34,28,24],[70,56,44],[110,90,68],[150,126,96],[188,164,130]],
 kobD:[[26,20,18],[52,42,34],[82,66,52],[110,92,72],[138,118,94]],
 cloth:[[40,20,20],[80,36,32],[120,56,46],[156,82,64],[180,110,90]],
 wood:[[40,26,16],[78,52,30],[116,80,46],[150,108,64],[180,140,90]],
 iron:[[36,38,44],[70,74,84],[110,116,128],[152,158,170],[200,206,214]],
 ant:[[24,10,8],[60,24,18],[104,44,30],[150,72,48],[190,110,80]],
 antD:[[18,8,6],[44,18,14],[76,32,22],[108,52,36],[140,78,56]],
 // 地形の岩と同じ色の段（src/shaders.ts の cK〜cd）。rockS は柔らかい層（茶色がかる）、rockH は硬い岩（青みがかる）。ワームが押し上げる岩 wormMound に使う
 rock:[[20,16,24],[34,30,40],[52,46,60],[74,66,84],[100,92,110]],
 rockS:[[24,16,18],[41,30,30],[63,46,44],[90,66,62],[122,92,81]],
 rockH:[[15,13,26],[25,25,44],[38,39,66],[55,55,92],[74,77,121]],
 soil:[[34,26,22],[62,48,38],[94,74,58],[126,102,80],[156,130,104]],
 stem:[[70,62,70],[130,120,124],[176,166,166],[212,204,198],[236,230,222]],
 cap:[[40,20,52],[78,40,100],[118,66,150],[160,100,196],[200,150,230]],
 sal:[[34,8,10],[84,18,22],[136,32,30],[180,54,40],[214,90,58]],
 salD:[[24,6,8],[60,14,16],[98,24,22],[130,40,30],[160,64,44]],
 salB:[[80,30,12],[150,70,24],[200,120,40],[230,160,64],[244,196,100]],
 char:[[16,8,8],[38,18,14],[62,28,20],[88,40,26],[114,54,32]],
 fireO:[[200,60,20],[236,100,28],[255,136,40],[255,166,64],[255,196,100]],
 fireI:[[240,170,60],[255,198,96],[255,224,140],[255,240,190],[255,250,224]],
 // 段階5b-1
 gob:[[22,36,14],[48,78,30],[82,122,48],[122,160,70],[164,196,104]],
 gobD:[[16,26,10],[36,58,22],[60,90,36],[88,118,52],[118,146,76]],
 rag:[[34,26,18],[66,50,34],[98,76,50],[128,104,72],[156,132,96]],
 orc:[[24,30,24],[52,64,50],[84,98,74],[116,130,98],[148,160,124]],
 orcD:[[18,22,18],[38,46,36],[60,70,54],[82,94,72],[106,118,92]],
 leather:[[24,16,14],[50,32,24],[78,52,36],[106,74,52],[132,98,70]],
 lzm:[[12,30,30],[24,62,58],[40,98,86],[70,136,112],[112,176,140]],
 lzmD:[[10,22,22],[18,46,44],[30,72,64],[50,100,84],[80,130,106]],
 lzmB:[[70,80,50],[120,132,84],[164,170,118],[196,200,150],[222,224,182]],
 reed:[[40,34,16],[78,66,30],[118,100,48],[156,136,72],[190,172,104]],
 bull:[[30,18,12],[64,38,24],[100,62,38],[136,90,56],[170,120,80]],
 bullD:[[22,12,8],[46,28,18],[72,44,28],[98,64,40],[124,88,56]],
 horn:[[60,54,44],[120,110,90],[176,166,140],[216,208,184],[242,236,216]],
 // 段階5b-2
 trl:[[24,30,26],[50,62,52],[78,94,76],[106,122,98],[136,150,120]],
 trlD:[[18,22,20],[36,46,38],[56,70,56],[78,92,74],[100,116,94]],
 moss2:[[20,40,20],[36,70,34],[56,100,50],[80,128,66],[110,156,86]],
 bas:[[26,24,16],[56,52,30],[90,84,46],[124,116,66],[160,150,92]],
 basD:[[18,16,10],[40,36,22],[64,58,34],[88,80,48],[112,104,64]],
 basB:[[70,60,40],[120,106,72],[160,146,104],[192,180,138],[218,208,170]],
 crest:[[60,14,14],[110,26,22],[160,44,30],[200,72,44],[230,110,70]],
 stone:[[34,36,44],[62,66,76],[94,98,110],[128,132,142],[164,168,176]],
 stoneD:[[24,26,32],[46,48,58],[70,72,84],[96,98,110],[122,124,136]],
 pale:[[60,52,60],[120,108,120],[172,160,170],[210,200,206],[236,228,232]],
 cape:[[10,8,14],[24,18,30],[40,28,48],[60,40,66],[84,56,90]],
 capeR:[[40,6,10],[80,12,18],[120,20,26],[160,34,38],[190,56,56]],
 // 段階5c-1
 gold:[[70,44,10],[132,90,20],[190,140,36],[232,190,70],[255,232,140]],
 gemR:[[60,8,16],[120,16,30],[180,30,50],[230,70,90],[255,150,160]],
 gemB:[[10,24,70],[20,50,130],[40,90,190],[90,150,240],[170,210,255]],
 gemG:[[8,50,24],[16,96,46],[30,150,70],[80,200,110],[160,240,180]],
 chest:[[36,22,12],[72,44,22],[108,68,34],[142,94,50],[172,122,70]],
 golem:[[40,38,36],[72,68,62],[104,98,88],[136,128,114],[166,158,142]],
 golemD:[[30,28,26],[54,50,46],[78,72,64],[102,94,84],[126,118,104]],
 gst:[[28,28,32],[58,56,58],[92,88,86],[128,122,114],[164,156,142]],
 gmoss:[[22,40,22],[40,70,34],[62,100,48],[90,128,64],[124,156,86]],
 worm:[[30,20,16],[64,40,30],[100,62,44],[136,88,60],[170,118,84]],
 wormD:[[22,14,12],[46,28,22],[72,44,32],[98,62,44],[124,82,58]],
 wormB:[[80,62,40],[132,106,70],[176,148,100],[208,184,134],[232,214,170]],
 // 段階6a：冒険者
 hskin:[[70,40,30],[130,82,60],[184,128,96],[220,168,132],[240,200,168]],
 hair:[[30,20,14],[62,40,24],[96,64,36],[126,88,50],[150,110,64]],
 mail:[[34,38,46],[70,78,92],[112,120,136],[156,164,178],[196,204,214]],
 tabard:[[40,16,18],[90,26,30],[140,40,40],[180,64,56],[210,96,80]],
 robeB:[[16,18,44],[30,36,84],[48,58,126],[72,86,164],[104,120,196]],
 robeW:[[90,86,80],[150,144,132],[196,190,176],[226,222,210],[244,242,234]],
 hood:[[18,18,22],[36,36,42],[56,56,64],[78,78,88],[100,100,110]],
 goldT:[[90,62,16],[150,108,30],[200,156,50],[236,198,90],[252,228,150]],
 stole:[[14,28,60],[24,50,104],[40,78,150],[70,112,186],[110,150,214]],
 beard:[[110,108,104],[160,158,152],[200,198,192],[228,226,220],[246,244,240]],
 boot:[[20,14,12],[42,28,20],[66,44,30],[90,62,42],[114,82,56]],
 // 段階6b
 forest:[[16,30,18],[30,56,32],[48,84,46],[74,114,62],[104,142,84]],
 bardR:[[50,14,40],[96,26,72],[142,42,104],[180,70,134],[212,110,166]],
 bardY:[[90,70,14],[150,118,26],[206,166,44],[236,204,90],[252,232,150]],
 plate:[[40,44,54],[84,92,108],[136,144,160],[184,192,206],[228,234,242]],
 lichR:[[18,10,24],[36,20,48],[58,32,74],[82,48,100],[108,68,128]],
 // 段階7c：ドワーフ
 dbeard:[[86,30,8],[150,58,16],[206,96,30],[236,136,52],[252,180,96]],
 dbeardK:[[16,12,14],[34,26,28],[56,44,46],[80,66,66],[106,92,90]],
 dbeardW:[[120,118,116],[170,168,164],[212,210,204],[236,234,228],[250,249,246]],
 dtunic:[[26,32,40],[44,58,72],[66,86,104],[92,114,134],[122,144,162]],
 apron:[[34,22,16],[64,42,28],[92,62,40],[118,84,56],[142,106,74]],
 dstone:[[44,40,46],[76,70,76],[108,100,104],[140,132,132],[172,164,160]],
 // 外とつながる口、卵、子
 pup:[[110,62,70],[196,130,136],[226,166,170],[242,196,198],[252,220,220]],
 silk:[[88,84,96],[160,156,168],[204,200,210],[230,228,236],[248,246,250]],
 eggL:[[96,84,60],[176,160,118],[214,200,160],[236,226,192],[250,244,222]],
 grass:[[30,60,26],[56,100,44],[86,138,62],[120,172,82],[160,204,110]],
 crystal:[[60,20,90],[110,56,170],[170,100,230],[210,150,255],[240,210,255]],
 flesh:[[48,28,30],[94,60,58],[140,98,90],[182,138,122],[216,180,160]],
 fleshD:[[34,18,22],[66,40,42],[100,66,64],[132,96,88],[162,128,116]],
 maw:[[20,4,8],[48,10,16],[84,20,28],[120,36,40],[150,60,60]],
 // 段階5c-2
 drg:[[26,10,12],[62,20,22],[100,32,30],[138,48,38],[170,72,52]],
 drgD:[[18,8,10],[44,14,16],[72,24,24],[100,36,32],[128,52,42]],
 drgB:[[60,40,22],[104,74,38],[142,106,58],[176,140,86],[200,170,116]],
 drgW:[[20,8,12],[42,14,20],[66,22,28],[90,32,38],[114,46,48]],
 drgS:[[60,24,22],[132,56,42],[186,90,62],[222,128,84],[244,170,120]],
 drgSB:[[96,70,40],[160,124,76],[206,170,112],[232,206,150],[248,232,190]],
 drgSW:[[70,28,34],[128,58,64],[176,92,92],[210,130,120],[236,170,150]],
 drgY:[[34,12,14],[86,28,28],[132,44,38],[172,66,48],[204,96,66]],
 drgYW:[[30,10,14],[62,20,26],[96,32,38],[128,48,50],[158,66,62]],
 wyv:[[20,30,26],[44,62,52],[72,96,76],[104,128,98],[140,160,124]],
 wyvD:[[14,22,20],[30,44,38],[50,68,56],[72,92,74],[96,118,94]],
 wyvW:[[24,26,30],[48,54,58],[74,82,84],[104,112,110],[134,140,132]],
 charB:[[36,14,8],[72,28,12],[110,46,18],[142,66,26],[170,92,38]],
};
const COL={rot:[66,30,34],flesh:[132,58,58],zeye:[196,212,96],K:[16,12,18],red:[200,36,40],redL:[255,110,90],yel:[236,204,70],white:[236,232,220],tongue:[210,64,74],bone:[214,206,186],gum:[120,30,40]};
const E=(x,y,rx,ry,m,o={})=>({t:'e',x,y,rx,ry,m,...o});
const C=(x0,y0,x1,y1,r,m,o={})=>({t:'c',x0,y0,x1,y1,r,m,...o});
const PL=(pts,m,i=2,o={})=>({t:'p',pts,m,i,...o});
const LN=(x0,y0,x1,y1,m,i=2,o={})=>({t:'l',x0,y0,x1,y1,m,i,...o});
const D=(x,y,c)=>({t:'d',x:Math.round(x),y:Math.round(y),c});
// 光を帯びたときに光る模様の点
const GD=(x,y,c)=>({t:'d',x:Math.round(x),y:Math.round(y),c,glw:1});
const LV=[-0.5,-0.72,0.55],LN_=Math.hypot(...LV);
function sh(nx,ny,nz){const s=(nx*LV[0]+ny*LV[1]+nz*LV[2])/LN_;return s>0.7?4:s>0.4?3:s>0.08?2:1}
function raster(W,H,prims){
 const N=W*H,id=new Int16Array(N).fill(-1),mat=new Array(N).fill(null),ix=new Int8Array(N),col=new Array(N).fill(null),gw=new Uint8Array(N);
 const set=(x,y,i,m,k,c)=>{if(x<0||y<0||x>=W||y>=H)return;const p=y*W+x;id[p]=i;mat[p]=m;ix[p]=k;col[p]=c||null;gw[p]=prims[i].glw?1:0};
 prims.forEach((p,i)=>{
  if(p.t==='e'){for(let y=Math.floor(p.y-p.ry-1);y<=p.y+p.ry+1;y++)for(let x=Math.floor(p.x-p.rx-1);x<=p.x+p.rx+1;x++){const nx=(x+.5-p.x)/p.rx,ny=(y+.5-p.y)/p.ry,d=nx*nx+ny*ny;if(d<=1)set(x,y,i,p.m,p.flat!=null?p.flat:sh(nx,ny,Math.sqrt(1-d)))}}
  else if(p.t==='c'){const dx=p.x1-p.x0,dy=p.y1-p.y0,L2=dx*dx+dy*dy||1e-6;for(let y=Math.floor(Math.min(p.y0,p.y1)-p.r-1);y<=Math.max(p.y0,p.y1)+p.r+1;y++)for(let x=Math.floor(Math.min(p.x0,p.x1)-p.r-1);x<=Math.max(p.x0,p.x1)+p.r+1;x++){const px=x+.5,py=y+.5;let u=((px-p.x0)*dx+(py-p.y0)*dy)/L2;u=Math.max(0,Math.min(1,u));const cx=p.x0+u*dx,cy=p.y0+u*dy,ex=(px-cx)/p.r,ey=(py-cy)/p.r,d=ex*ex+ey*ey;if(d<=1)set(x,y,i,p.m,p.flat!=null?p.flat:sh(ex,ey,Math.sqrt(1-d)))}}
  else if(p.t==='p'){let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;p.pts.forEach(([a,b])=>{x0=Math.min(x0,a);x1=Math.max(x1,a);y0=Math.min(y0,b);y1=Math.max(y1,b)});for(let y=Math.floor(y0);y<=y1;y++)for(let x=Math.floor(x0);x<=x1;x++){const px=x+.5,py=y+.5;let ins=false;for(let a=0,b=p.pts.length-1;a<p.pts.length;b=a++){const [xa,ya]=p.pts[a],[xb,yb]=p.pts[b];if((ya>py)!==(yb>py)&&px<(xb-xa)*(py-ya)/(yb-ya)+xa)ins=!ins}if(ins)set(x,y,i,p.m,p.i)}}
  else if(p.t==='l'){let x=Math.round(p.x0),y=Math.round(p.y0);const X=Math.round(p.x1),Y=Math.round(p.y1),dx=Math.abs(X-x),dy=-Math.abs(Y-y),sx=x<X?1:-1,sy=y<Y?1:-1;let e=dx+dy;for(;;){set(x,y,i,p.m,p.i);if(x===X&&y===Y)break;const e2=2*e;if(e2>=dy){e+=dy;x+=sx}if(e2<=dx){e+=dx;y+=sy}}}
  else if(p.t==='d')set(p.x,p.y,i,null,0,p.c);
 });
 const ix2=Int8Array.from(ix);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=y*W+x,a=id[p];if(a<0||!prims[a].ol)continue;for(const [qx,qy] of [[1,0],[-1,0],[0,1],[0,-1]]){const X=x+qx,Y=y+qy;if(X<0||Y<0||X>=W||Y>=H)continue;const b=id[Y*W+X];if(b>=0&&b<a&&prims[b].t!=='d'&&!prims[b].no){ix2[p]=Math.min(ix2[p],1)}}}
 const out=new Uint8ClampedArray(N*4),m2=new Array(N).fill(null);
 for(let p=0;p<N;p++){const a=id[p];if(a<0)continue;const c=col[p]||RAMP[mat[p]][ix2[p]];out[p*4]=c[0];out[p*4+1]=c[1];out[p*4+2]=c[2];out[p*4+3]=255;m2[p]=gw[p]?'glw':mat[p]}
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=y*W+x;if(id[p]>=0)continue;let best=-1;for(const [qx,qy] of [[1,0],[-1,0],[0,1],[0,-1]]){const X=x+qx,Y=y+qy;if(X<0||Y<0||X>=W||Y>=H)continue;const b=id[Y*W+X];if(b>best&&!prims[b].no)best=b}if(best<0)continue;const pr=prims[best];const c=pr.m?RAMP[pr.m][0]:COL.K;out[p*4]=c[0];out[p*4+1]=c[1];out[p*4+2]=c[2];out[p*4+3]=255;m2[p]='ol'}
 return {W,H,px:out,mat:m2};
}
const mod=(f,n)=>((f%n)+n)%n;
// ===== 大ネズミ =====
function rat(dir,act,f){
 if(act==='death')return ratDead(f);
 const mv=act==='move',at=act==='attack',id=act==='idle',P=[];
 const bob=mv?[0,-1,0,-1][mod(f,4)]:0, sw=[0,0.7,0,-0.7][mod(f,4)]*(mv||id?1:0.3);
 const lunge=at?[0,1,3,1][mod(f,4)]:0, open=at&&(mod(f,4)===1||mod(f,4)===2), sn=id?[0,-1,0,0][mod(f,4)]:0;
 const fl=mv?[-1,0,1,0][mod(f,4)]:0;
 if(dir==='side'){
  P.push(C(5,9.5+bob,2.2,10+sw,0.6,'pink',{glw:1}),C(2.2,10+sw,0.6,8+sw*1.5,0.5,'pink',{glw:1}));
  P.push(C(7,11+bob,7-fl,13.2,0.7,'furD'),C(13,11+bob,13+fl,13.2,0.7,'furD'));
  P.push(E(9.5,9+bob,6,3.6,'fur',{ol:1}));
  const hx=15+lunge,hy=8+bob+sn;
  if(lunge>0)P.push(C(13,8.8+bob,hx-1,hy+0.3,2.4,'fur'));
  P.push(E(hx-0.4,hy-2.4,1.3,1.7,'pink'));
  P.push(E(hx,hy,3.5,2.8,'fur',{ol:1}),E(hx+3,hy+1,1.6,1.3,'fur'));
  P.push(E(hx+0.6,hy-2.8,1.5,1.9,'pink',{ol:1}));
  P.push(GD(hx+1,hy-1,COL.K),D(hx+4,hy+1,RAMP.pink[3]));
  if(open)P.push(D(hx+3,hy+2,COL.gum),D(hx+4,hy+2,COL.white));
  P.push(C(8,11.5+bob,8+fl,13.3,0.8,'fur'),C(14,11.5+bob,14-fl,13.3,0.8,'fur'));
  P.push(D(8+fl,13,RAMP.pink[2]),D(14-fl,13,RAMP.pink[2]));
  return {...raster(23,14,P),ax:10,ay:13};
 }
 const pl=mv?[0,-1,0,0][mod(f,4)]:0,pr=mv?[0,0,0,-1][mod(f,4)]:0;
 if(dir==='down'){
  const ly=at?lunge*0.4:0;
  P.push(C(12,5+bob,15,3+sw,0.6,'pink',{glw:1}),C(15,3+sw,16,0.8+sw,0.5,'pink',{glw:1}));
  P.push(E(10,7+bob,4.8,4,'fur',{ol:1}));
  P.push(E(6.8,6.6+bob+sn,1.6,1.8,'pink',{ol:1}),E(13.2,6.6+bob+sn,1.6,1.8,'pink',{ol:1}));
  P.push(E(10,9.6+bob+sn+ly,3.6,3,'fur',{ol:1}),E(10,11.7+bob+sn+ly,1.8,1.3,'fur'));
  P.push(GD(8,9+bob+sn+ly,COL.K),GD(11,9+bob+sn+ly,COL.K));
  P.push(D(9,12+bob+sn+ly-(open?1:0),RAMP.pink[3]),D(10,12+bob+sn+ly-(open?1:0),RAMP.pink[3]));
  if(open)P.push(D(9,12+bob+ly,COL.gum),D(10,12+bob+ly,COL.white));
  P.push(C(7.5,11.5+bob,7,13.3+pl,0.8,'fur'),C(12.5,11.5+bob,13,13.3+pr,0.8,'fur'));
  return {...raster(20,15,P),ax:10,ay:14};
 }
 P.push(E(10,4.8+bob,3,2.4,'fur',{ol:1}));
 P.push(E(7.8,3+bob,1.5,1.7,'pink',{ol:1}),E(12.2,3+bob,1.5,1.7,'pink',{ol:1}));
 P.push(E(10,8.2+bob,4.8,4.2,'fur',{ol:1}));
 P.push(C(6.8,11+bob,6.6,13.3+pl,0.8,'fur'),C(13.2,11+bob,13.4,13.3+pr,0.8,'fur'));
 P.push(C(10,11.8+bob,11+sw,13.2,0.65,'pink',{glw:1}),C(11+sw,13.2,13.5+sw,13.6,0.5,'pink',{glw:1}));
 return {...raster(20,15,P),ax:10,ay:14};
}
function ratDead(f){
 const P=[];
 if(mod(f,4)===0){
  P.push(C(5,10.5,1,11.5,0.55,'pink'));
  P.push(E(10,10.5,6,3.2,'fur',{ol:1}),E(15.5,10.5,3.3,2.6,'fur',{ol:1}),E(18.4,11.4,1.5,1.2,'fur'),E(15.5,8,1.4,1.6,'pink',{ol:1}));
  P.push(D(16,10,COL.K),D(17,10,COL.K));
  P.push(C(8,12.5,6,13.3,0.7,'fur'),C(14,12.5,16,13.3,0.7,'fur'));
 } else {
  P.push(C(5,11.5,1,12.5,0.55,'pink'));
  P.push(C(7,9.5,6,6.5,0.7,'fur'),C(9.5,9.5,9.5,6.3,0.7,'fur'),C(12.5,9.5,12.5,6.3,0.7,'fur'),C(14.5,9.5,15.5,6.6,0.7,'fur'));
  P.push(D(6,6,RAMP.pink[2]),D(9,6,RAMP.pink[2]),D(12,6,RAMP.pink[2]),D(15,6,RAMP.pink[2]));
  P.push(E(10,11,5.8,2.8,'furB',{ol:1}),E(16,11.2,3.2,2.4,'fur',{ol:1}),E(18.8,11.8,1.4,1.1,'fur'),E(15,13.2,1.4,0.9,'pink'));
  P.push(D(16,10,COL.K),D(17,10,COL.K));
 }
 return {...raster(23,14,P),ax:10,ay:13};
}
// ===== 大トカゲ =====
function lizard(dir,act,f){
 if(act==='death')return lizDead(f);
 const mv=act==='move',at=act==='attack',id=act==='idle',P=[],q=mod(f,4);
 const s=mv?[-0.7,0,0.7,0][q]:id?[0,0,0.35,0][q]:0, lunge=at?[0,2,4,1][q]:0, open=at&&(q===1||q===2), tg=id&&q===2;
 const lA=mv?[1.2,0,-1.2,0][q]:0,lB=-lA;
 if(dir==='side'){
  const tp=[[8,10.5],[5,11.5+s],[2.5,12.6+s*1.8],[0.6,13.2+s*2.2]];
  P.push(C(...tp[0],...tp[1],1.7,'liz'),C(...tp[1],...tp[2],1.2,'liz'),C(...tp[2],...tp[3],0.7,'liz'));
  P.push(C(10,11,9+lB,13.6,0.8,'lizD'),C(17,11,18+lA,13.6,0.8,'lizD'));
  P.push(E(13,10.5,7,3,'liz',{ol:1}),E(13,12.4,5.4,1.1,'lizB',{flat:2}));
  [[9,8,1],[12,8,1],[15,8,1],[18,8,1],[10,9,3],[13,9,3],[16,9,3],[7,9,1]].forEach(([x,y,i])=>P.push(GD(x,y,RAMP.liz[i])));
  const hx=21.5+lunge;
  P.push(E(hx,9.6,3.8,2.4,'liz',{ol:1}),C(hx+0.5,10.2,hx+4,10.5,1.5,'liz'));
  P.push(D(hx+1,8,COL.yel),D(hx+1,7,RAMP.liz[0]),D(hx+4,9,RAMP.liz[0]));
  if(open){for(let x=1;x<=4;x++)P.push(D(hx+x,11,COL.gum));P.push(D(hx+4,10,COL.white),D(hx+2,11,COL.white))}
  if(tg)P.push(D(hx+5.6,10,COL.tongue),D(hx+6.6,10,COL.tongue),D(hx+7.6,9,COL.tongue),D(hx+7.6,11,COL.tongue));
  P.push(C(11,11.6,9+lA,13.4,0.9,'liz'),C(9+lA,13.4,8.5+lA,14.8,0.7,'liz'));
  P.push(C(17.5,11.6,19+lB,13.4,0.9,'liz'),C(19+lB,13.4,19.5+lB,14.8,0.7,'liz'));
  return {...raster(34,16,P),ax:13,ay:15};
 }
 const m=(x)=>24-x;
 const legs=(fy,by,lf,lb)=>{
  const toe=(x,y,sx)=>{P.push(D(x-sx,y+0.8,RAMP.liz[1]),D(x,y+1.2,RAMP.liz[1]),D(x+sx,y+0.8,RAMP.liz[1]))};
  P.push(C(9.4,by,6.4,by-0.8+lb,1.25,'liz'),C(6.4,by-0.8+lb,5.6,by+1.4+lb,0.95,'liz'));toe(5.6,by+1.4+lb,1);
  P.push(C(m(9.4),by,m(6.4),by-0.8-lb,1.25,'liz'),C(m(6.4),by-0.8-lb,m(5.6),by+1.4-lb,0.95,'liz'));toe(m(5.6),by+1.4-lb,-1);
  P.push(C(9.4,fy,6.2,fy+0.2+lf,1.25,'liz'),C(6.2,fy+0.2+lf,5.6,fy+2.2+lf,0.95,'liz'));toe(5.6,fy+2.2+lf,1);
  P.push(C(m(9.4),fy,m(6.2),fy+0.2-lf,1.25,'liz'),C(m(6.2),fy+0.2-lf,m(5.6),fy+2.2-lf,0.95,'liz'));toe(m(5.6),fy+2.2-lf,-1);
 };
 const lf=mv?[-1,0,1,0][q]:0;
 if(dir==='down'){
  const ly=at?lunge*0.5:0;
  P.push(C(12,4,12+s,1.8,1.1,'liz'),C(12+s,1.8,12+2*s,0.3,0.6,'liz'));
  legs(10.5,4.8,lf,-lf);
  P.push(E(12,7.6,4.1,5.4,'liz',{ol:1}));
  [[11,4],[12,5],[11,6],[12,7],[11,8]].forEach(([x,y])=>P.push(GD(x,y,RAMP.liz[2])));
  [[9,6],[14,6],[9,8],[14,8]].forEach(([x,y])=>P.push(GD(x,y,RAMP.liz[3])));
  P.push(C(12,10.4,12,11.6+ly,2.2,'liz'),E(12,12.8+ly,3.3,2.4,'liz',{ol:1}),PL([[9.6,13.6+ly],[14.4,13.6+ly],[13.4,16+ly],[10.6,16+ly]],'liz',2,{ol:1}));
  P.push(D(9,11.6+ly,COL.yel),D(14,11.6+ly,COL.yel),D(9,10.6+ly,RAMP.liz[0]),D(14,10.6+ly,RAMP.liz[0]));
  if(open)P.push(D(11,15+ly,COL.gum),D(12,15+ly,COL.gum),D(10,15+ly,COL.white),D(13,15+ly,COL.white));
  if(tg)P.push(D(11,16,COL.tongue),D(12,16,COL.tongue));
  return {...raster(24,18,P),ax:12,ay:16};
 }
 P.push(E(12,2.8,2.7,2.1,'liz',{ol:1}),PL([[10.2,1.2],[13.8,1.2],[13,-0.4],[11,-0.4]],'liz',2),C(12,4,12,5,1.8,'liz'),D(9,2,COL.yel),D(14,2,COL.yel));
 legs(5,11,lf,-lf);
 P.push(E(12,8.4,4.1,5.4,'liz',{ol:1}));
 [[11,5],[12,6],[11,7],[12,8],[11,9],[12,10]].forEach(([x,y])=>P.push(GD(x,y,RAMP.liz[2])));
 [[9,6],[14,6],[9,9],[14,9],[10,11],[13,11]].forEach(([x,y])=>P.push(GD(x,y,RAMP.liz[3])));
 P.push(C(12,12.5,12+s,15,1.5,'liz'),C(12+s,15,12+2*s,17.4,0.9,'liz'),C(12+2*s,17.4,12+3*s,18.6,0.5,'liz'));
 return {...raster(24,19,P),ax:12,ay:16};
}
function lizDead(f){
 const P=[];
 if(mod(f,4)===0){
  P.push(C(8,11.5,1,13.5,1.2,'liz'),E(13,11.5,7,2.6,'liz',{ol:1}),E(21,11.8,3.6,2.2,'liz',{ol:1}),C(21,12,24.5,12.4,1.3,'liz'),D(22,10,COL.K));
  P.push(C(10,13,8,14.6,0.8,'liz'),C(17,13,19,14.6,0.8,'liz'));
 } else {
  P.push(C(7,12.5,1,13.5,1.1,'liz'));
  P.push(C(10,10.5,9,7.5,0.8,'liz'),C(12,10.5,12.5,7.5,0.8,'liz'),C(15,10.5,15,7.5,0.8,'liz'),C(17,10.5,18,7.5,0.8,'liz'));
  P.push(E(13.5,11.6,6.8,2.4,'lizB',{ol:1}),E(21.5,12.2,3.5,2,'liz',{ol:1}),C(21.5,12.5,25,12.8,1.2,'liz'),D(22,11,COL.K),D(23,11,COL.K));
 }
 return {...raster(34,16,P),ax:13,ay:15};
}
// ===== 大グモ =====
function spider(dir,act,f){
 const P=[],q=mod(f,4),mv=act==='move',at=act==='attack',id=act==='idle',dead=act==='death';
 const rise=at?[0,-1,-1,0][q]:mv?[0,-1,0,-1][q]:0;
 const leg=(h,ft,lift,mat='spi')=>{const kx=(h[0]+ft[0])/2+(ft[0]>h[0]?1.4:-1.4),ky=(h[1]+ft[1])/2-2.4-lift;const fy=ft[1]-lift;P.push(LN(h[0],h[1],kx,ky,mat,2,{no:1}),LN(kx,ky,ft[0],fy,mat,2,{no:1}),GD(kx,ky,RAMP[mat][3]))};
 if(dir==='side'){
  const W=26,hips=[[13,10.5],[14,10.6],[15,10.6],[16,10.5]],feet=[[5,15],[9.5,15],[17,15],[22,15]];
  hips.forEach((h,i)=>{const lift=mv&&((i%2)===(q%2))&&q%2===0?0:0;leg([h[0]+0.5,h[1]-0.5],[feet[i][0]+(i<2?1:-1),feet[i][1]-0.5],(mv&&((i+q)%2===0))?1:0,'spiD')});
  P.push(E(7.5,8+rise,4.6,3.8,'spi',{ol:1}));
  [[6,6],[7,6],[8,6],[7,7]].forEach(([x,y])=>P.push(GD(x,y+rise,COL.red)));
  P.push(E(14,10+rise,3,2.2,'spi',{ol:1}),GD(16,9+rise,COL.redL),GD(15,9+rise,COL.red),D(17,11+rise,COL.bone));
  if(dead){P.length=0;P.push(E(12,12.4,5.6,2.4,'spi',{ol:1}));[[8,11,6,7.6,8.4,6.4],[10,10.6,9.4,7,11,5.8],[14,10.6,14.6,7,13,5.8],[16,11,18,7.6,15.6,6.4]].forEach(([a,b,c,d,e,g])=>{P.push(LN(a,b,c,d,'spi',3,{no:1}),LN(c,d,e,g,'spi',3,{no:1}),D(c,d,RAMP.spi[4]))});P.push(D(16,12,COL.gum));return {...raster(W,16,P),ax:12,ay:15}}
  hips.forEach((h,i)=>{let ft=feet[i];if(at&&i===3)ft=[23,6];leg(h,ft,(mv&&((i+q)%2===1))?1:0)});
  return {...raster(W,16,P),ax:12,ay:15};
 }
 const flip=dir==='up';
 const Y=(y)=>flip?16-y:y;
 let feetR=[[17,15],[20.5,12],[21,8],[18.5,4]],hipsR=[[12.5,11.5],[13.2,10.6],[13.2,9.6],[12.5,8.6]];
 const mx=(p)=>[22-p[0],p[1]];
 if(dead){
  P.push(E(11,11,4.6,3,'spi',{ol:1}),E(11,13,2.8,1.6,'spi',{ol:1}));
  [[8,9.5,6,6,8.4,4.6],[9.5,9,8.6,5.4,10.2,4],[12.5,9,13.4,5.4,11.8,4],[14,9.5,16,6,13.6,4.6]].forEach(([a,b,c,d,e,g])=>{P.push(LN(a,b,c,d,'spi',3,{no:1}),LN(c,d,e,g,'spi',3,{no:1}),D(c,d,RAMP.spi[4]))});
  [[7,11,4.4,10,5,8],[15,11,17.6,10,17,8]].forEach(([a,b,c,d,e,g])=>{P.push(LN(a,b,c,d,'spi',2,{no:1}),LN(c,d,e,g,'spi',2,{no:1}))});
  P.push(D(10,12,COL.gum),D(11,12,COL.gum),D(10,10,COL.red),D(11,10,COL.red));
  return {...raster(22,17,P),ax:11,ay:15};
 }
 hipsR.forEach((h,i)=>{
  const liftR=mv&&((i+q)%2===0)&&q%2===0?1:(mv&&((i+q)%2===1)&&q%2===1?1:0), liftL=mv&&!liftR&&q%2===0?1:0;
  let fR=feetR[i],fL=mx(feetR[i]);
  if(at&&i===0){fR=[17,6];fL=[5,6]}
  if(id&&q===2&&i===1)fR=[fR[0]+1,fR[1]];
  leg([h[0],Y(h[1])],[fR[0],Y(fR[1])],liftR?1:0);
  leg([22-h[0],Y(h[1])],[fL[0],Y(fL[1])],liftL?1:0);
 });
 if(!flip){
  P.push(E(11,6.5+rise,4.6,4.2,'spi',{ol:1}));
  [[4,[9,10,11,12]],[5,[10,11]],[6,[10,11]],[7,[9,10,11,12]]].forEach(([y,xs])=>xs.forEach(x=>P.push(GD(x,y+rise,COL.red))));
  P.push(E(11,11+rise,3.2,2.4,'spi',{ol:1}));
  P.push(GD(9,10+rise,COL.red),GD(12,10+rise,COL.red),GD(10,10+rise,COL.redL),GD(11,10+rise,COL.redL));
  if(at&&(q===1||q===2))P.push(D(9,13+rise,COL.bone),D(12,13+rise,COL.bone));else P.push(D(10,13+rise,COL.bone),D(11,13+rise,COL.bone));
 } else {
  P.push(E(11,4.8+rise,3,2.2,'spi',{ol:1}));
  P.push(E(11,10+rise,4.8,4.4,'spi',{ol:1}));
  [[10,8],[11,8],[10,10],[11,10],[10,12],[11,12]].forEach(([x,y])=>P.push(GD(x,y+rise,COL.red)));
 }
 return {...raster(22,17,P),ax:11,ay:15};
}
// ===== コウモリ =====
const WING={up:{e:[14,2],t:[19,0.4],tr:[[18.6,5.2],[16.6,4.4],[15.6,7.4],[13.6,6.4],[11.4,8.6]]},mid:{e:[14.6,3.4],t:[19.8,4.2],tr:[[19.4,8.4],[17.4,7.2],[16.2,9.8],[13.8,8.6],[11.4,9.2]]},down:{e:[14.6,6.6],t:[18.4,10.8],tr:[[16.4,12.4],[15.2,10.2],[13.8,11.8],[12.6,10.2],[11.2,9.6]]}};
function bat(dir,act,f){
 const P=[],q=mod(f,4);
 if(act==='idle')return batRoost(f);
 if(act==='death')return batDead(f);
 const pose=act==='attack'?(q===0?'mid':'up'):['up','mid','down','mid'][q];
 const w=WING[pose],dy=act==='attack'?[0,1,2,1][q]:0;
 if(dir==='side'){
  const wp={up:[[10,6],[9,2],[6,0.2],[2,1],[4,3],[2.6,5],[6,4.6],[8,6.6]],mid:[[10,6.6],[6,4.4],[1,4.4],[3,6.4],[1.6,8.4],[5,7.4],[7,9],[9,7.6]],down:[[10,7],[8,9.6],[5,12.4],[3.6,9.6],[1.4,10.6],[3,7.6],[7,7.4]]};
  const far={up:'down',mid:'mid',down:'up'}[pose];
  P.push(PL(wp[far].map(([x,y])=>[x+1.4,y-0.6+dy]),'memD',1));
  P.push(C(7,7.4+dy,4.6,8.2+dy,1,'bat'));
  P.push(E(10,7+dy,3.2,2.3,'bat',{ol:1}),E(13.8,6+dy,2.1,1.9,'bat',{ol:1}),C(15,6.6+dy,16.4,7+dy,0.9,'bat'));
  P.push(PL([[12.6,5+dy],[13.2,1.2+dy],[14.8,4.6+dy]],'bat',2,{ol:1}),D(13,3+dy,RAMP.pink[1]),D(13,4+dy,RAMP.pink[1]));
  P.push(GD(15,5+dy,COL.red),D(16,7+dy,RAMP.bat[0]));
  if(act==='attack'&&q>0)P.push(D(16,8+dy,COL.white),D(15,8+dy,COL.gum));
  const W=wp[pose].map(([x,y])=>[x,y+dy]);
  P.push(PL(W,'mem',2,{ol:1}));
  P.push(LN(W[0][0],W[0][1],W[1][0],W[1][1],'bat',4,{no:1,glw:1}),LN(W[1][0],W[1][1],W[2][0],W[2][1],'bat',4,{no:1,glw:1}),LN(W[1][0],W[1][1],W[4][0],W[4][1],'bat',4,{no:1,glw:1}),LN(W[1][0],W[1][1],W[6][0],W[6][1],'bat',4,{no:1,glw:1}));
  P.push(D(W[1][0],W[1][1],RAMP.bat[3]));
  return {...raster(20,13,P),ax:10,ay:12};
 }
 const back=dir==='up',mm=back?'memD':'mem';
 const wing=(sx)=>{const X=(x)=>sx>0?x:20-x;const pts=[[X(10.6),4.6+dy],[X(w.e[0]),w.e[1]+dy],[X(w.t[0]),w.t[1]+dy],...w.tr.map(([x,y])=>[X(x),y+dy])];P.push(PL(pts,mm,2,{ol:1}));P.push(LN(X(11),5+dy,X(w.e[0]),w.e[1]+dy,'bat',4,{no:1,glw:1}),LN(X(w.e[0]),w.e[1]+dy,X(w.t[0]),w.t[1]+dy,'bat',4,{no:1,glw:1}));[w.tr[0],w.tr[2]].forEach(([x,y])=>P.push(LN(X(w.e[0]),w.e[1]+dy,X(x),y+dy,'bat',4,{no:1,glw:1})))};
 wing(1);wing(-1);
 P.push(E(10,7.4+dy,2.5,3,'bat',{ol:1}),E(10,4.5+dy,2.4,2,'bat',{ol:1}));
 P.push(PL([[7.6,4+dy],[7.8,0.4+dy],[9.6,3+dy]],'bat',2,{ol:1}),PL([[12.4,4+dy],[12.2,0.4+dy],[10.4,3+dy]],'bat',2,{ol:1}));
 if(!back)P.push(D(8,2,RAMP.pink[1]),D(11,2,RAMP.pink[1]));
 if(!back){P.push(GD(9,4+dy,COL.red),GD(10,4+dy,COL.red));if(act==='attack'&&q>0)P.push(D(9,6+dy,COL.white),D(10,6+dy,COL.white))}
 return {...raster(20,13,P),ax:10,ay:12};
}
function batRoost(f){
 const P=[],q=mod(f,4),br=q<2?0:0.35,sw=[0,0,1,0][q];
 P.push(LN(0,0,12,0,'spi',3,{no:1}));
 P.push(D(5,1,COL.bone),D(7,1,COL.bone),D(5,2,RAMP.bat[2]),D(7,2,RAMP.bat[2]));
 P.push(E(6,7,3.1+br,4.8,'mem',{ol:1}));
 P.push(LN(4,3.6,3.4,8.6,'bat',1,{no:1,glw:1}),LN(8,3.6,8.6,8.6,'bat',1,{no:1,glw:1}),LN(6,3,6,10.4,'memD',1,{no:1}));
 P.push(D(3,4,COL.bone),D(9,4,COL.bone));
 P.push(E(6,12+sw*0.2,2.3,2,'bat',{ol:1}));
 P.push(PL([[4,12.6],[3.8,15.6],[5.4,13.4]],'bat',2,{ol:1}),PL([[8,12.6],[8.2,15.6],[6.6,13.4]],'bat',2,{ol:1}));
 P.push(D(4,14,RAMP.pink[1]),D(8,14,RAMP.pink[1]));
 P.push(D(5,12,COL.red),D(7,12,COL.red),D(6,11,RAMP.bat[0]));
 return {...raster(13,17,P),ax:6,ay:16};
}
function batDead(f){
 const P=[];
 P.push(PL([[9,5],[3,3],[0.5,6],[3,5.5],[8,6.5]],'memD',1,{ol:1}),PL([[11,5],[16,2.5],[19.5,4.5],[16.5,5.5],[12,6.5]],'mem',2,{ol:1}));
 P.push(E(10,5.5,2.4,1.8,'bat',{ol:1}),E(12.6,5.2,1.6,1.4,'bat',{ol:1}),D(13,5,COL.K));
 return {...raster(20,8,P),ax:10,ay:7};
}
// ===== ウィスプ（光の粒） =====
function wisp(dir,act,f,g){
 const W=14,H=16,px=new Uint8ClampedArray(W*H*4),mat=new Array(W*H).fill(null),q=mod(f,4);
 const L=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
 const core=L([120,200,190],[248,255,252],g),mid=L([40,110,120],[150,240,220],g),out=L([20,60,70],[70,180,170],g);
 const put=(x,y,c)=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=W||y>=H)return;const p=y*W+x;px[p*4]=c[0];px[p*4+1]=c[1];px[p*4+2]=c[2];px[p*4+3]=255;mat[p]='wisp'};
 let cx=7,cy=8+(act==='attack'?[0,1,1,0][q]:0);
 if(act==='death'){
  const R=[0,2.5,4.5,6][q],n=[0,6,5,3][q];
  if(q===0){for(let y=0;y<H;y++)for(let x=0;x<W;x++){const d=Math.hypot(x+.5-cx,y+.5-cy);if(d<1.2)put(x,y,core);else if(d<2)put(x,y,mid)}}
  for(let i=0;i<n;i++){const a=i*2.4+q;put(cx+Math.cos(a)*R,cy+Math.sin(a)*R-q*0.6,q<3?mid:out)}
  return {W,H,px,mat,ax:7,ay:14};
 }
 const r=1.7+[0,0.3,0.5,0.3][q]*(act==='idle'?1:0.4);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const d=Math.hypot(x+.5-cx,y+.5-cy);if(d<r*0.6)put(x,y,core);else if(d<r)put(x,y,mid);else if(d<r+1.4&&((x+y)&1))put(x,y,out)}
 if(act==='move'){const tl=[[-3,0.5],[-4.5,-0.5],[-6,0.3]],wob=[0,0.6,0,-0.6][q];tl.forEach(([a,b],i)=>{let x=a,y=b+wob*(i+1)*0.5;if(dir==='down'){[x,y]=[y,-a]}if(dir==='up'){[x,y]=[y,a]}put(cx+x,cy+y,i<2?mid:out)})}
 if(act==='attack'&&q>0){[[-3,-2],[3,-1],[2,3],[-2,3]].forEach(([a,b],i)=>{if((i+q)%2)put(cx+a,cy+b,[255,255,240])})}
 if(dir==='down'&&act!=='death'){put(cx-1,cy-0.2,[30,60,70]);put(cx+0.6,cy-0.2,[30,60,70])}
 if(dir==='side'&&act!=='death'){put(cx+0.6,cy-0.2,[30,60,70])}
 return {W,H,px,mat,ax:7,ay:14};
}

// ===== 段階4：腐らせる（色の付け替えと傷） =====
const ZMAP={fur:'zfur',furD:'zfurD',furB:'zfurB',pink:'zpink',liz:'zliz',lizD:'zlizD',lizB:'zlizB',mem:'zmem',memD:'zmem',bat:'zbat',spi:'zspi',spiD:'zspi',kob:'zfur',kobD:'zfurD',cloth:'zmem',ant:'zspi',antD:'zspi',sal:'zmem',salD:'zmem',salB:'zfurB',gob:'zliz',gobD:'zlizD',rag:'zmem',orc:'zliz',orcD:'zlizD',leather:'zmem',lzm:'zliz',lzmD:'zlizD',lzmB:'zlizB',reed:'zfurB',bull:'zfur',bullD:'zfurD',trl:'zliz',trlD:'zlizD',moss2:'zliz',bas:'zliz',basD:'zlizD',basB:'zlizB',pale:'zfurB',cape:'zmem',capeR:'zmem'};
function hz(x,y,s){let n=Math.imul(x+s*31,374761393)+Math.imul(y,668265263)|0;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296}
function rotFrame(fr,rot,seed,eyes){
 const {W,H,px,mat}=fr,out=new Uint8ClampedArray(px),m2=mat.slice();
 const lut=new Map();
 for(const k of Object.keys(ZMAP))RAMP[k].forEach((c,i)=>lut.set(c.join(','),RAMP[ZMAP[k]][i]));
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=y*W+x;if(!px[p*4+3])continue;
  const key=px[p*4]+','+px[p*4+1]+','+px[p*4+2];let c=lut.get(key);
  if(key===COL.K.join(',')&&eyes&&m2[p]!=='ol')c=COL.zeye;
  if(c){out[p*4]=c[0];out[p*4+1]=c[1];out[p*4+2]=c[2]}
  const body=m2[p]&&m2[p]!=='ol';
  if(body&&rot>0){const h=hz(x,y,seed);if(h<rot*0.45){out[p*4]=COL.rot[0];out[p*4+1]=COL.rot[1];out[p*4+2]=COL.rot[2]}else if(h<rot*0.7){const b=RAMP.bone[3];out[p*4]=b[0];out[p*4+1]=b[1];out[p*4+2]=b[2]}else if(h<rot){out[p*4]=COL.flesh[0];out[p*4+1]=COL.flesh[1];out[p*4+2]=COL.flesh[2]}}
  if(m2[p]==='glw')m2[p]='zfur';
 }
 return {...fr,px:out,mat:m2};
}
function zrat(dir,act,f){return rotFrame(rat(dir,act,f),0.12,7,true)}
function zlizard(dir,act,f){return rotFrame(lizard(dir,act,f),0.12,11,true)}
// ===== 骨 =====
function bones(sp){
 const P=[];
 if(sp==='rat'){P.push(LN(4,7,12,7,'bone',2,{no:1}),LN(1,8,4,7,'bone',2,{no:1}));[5,7,9,11].forEach(x=>P.push(LN(x,5,x,9,'bone',3,{no:1})));P.push(E(15,6.5,2.8,2.1,'bone',{ol:1}),C(16,7.2,18.6,7.6,1,'bone'),D(15,6,COL.K),D(17,8,COL.K));return {...raster(20,11,P),ax:9,ay:10}}
 if(sp==='lizard'){P.push(LN(1,7,21,6,'bone',2,{no:1}));[6,8,10,12,14,16,18].forEach(x=>P.push(LN(x,4,x,9,'bone',3,{no:1})));[[9,9,7,11],[16,9,18,11],[9,4,7,2],[16,4,18,2]].forEach(([a,b,c,d])=>P.push(LN(a,b,c,d,'bone',2,{no:1})));P.push(E(24,6,3.4,1.8,'bone',{ol:1}),C(25,6.4,28.4,6.8,1.1,'bone'),D(24,5,COL.K));return {...raster(31,12,P),ax:13,ay:10}}
 if(sp==='kobold'){P.push(LN(5,9,14,9,'bone',2,{no:1}));[7,9,11].forEach(x=>P.push(LN(x,7,x,11,'bone',3,{no:1})));[[5,9,2,11],[5,9,2,7],[14,9,17,11],[14,9,17,7]].forEach(([a,b,c,d])=>P.push(LN(a,b,c,d,'bone',2,{no:1})));P.push(E(17.6,8.6,2.6,2.2,'bone',{ol:1}),C(19,9.4,21,9.8,0.9,'bone'),D(17,8,COL.K));return {...raster(23,13,P),ax:11,ay:11}}
 if(sp==='bat'){[[10,5,2,2],[10,5,4,7],[10,5,18,1],[10,5,17,6],[10,5,7,8]].forEach(([a,b,c,d])=>P.push(LN(a,b,c,d,'bone',2,{no:1})));P.push(E(12,4.5,1.7,1.4,'bone',{ol:1}),D(12,4,COL.K));return {...raster(20,9,P),ax:10,ay:7}}
 P.push(E(11,8,4.2,2.6,'zspi',{ol:1,flat:2}));[[8,8,5,4,7,2],[9.5,7,9,3,11,1.6],[12.5,7,13,3,11,1.6],[14,8,17,4,15,2],[7,9,3,9,4,6],[15,9,19,9,18,6]].forEach(([a,b,c,d,e,g])=>P.push(LN(a,b,c,d,'bone',1,{no:1}),LN(c,d,e,g,'bone',1,{no:1})));return {...raster(22,12,P),ax:11,ay:11};
}
const DEADF={rat:()=>ratDead(1),lizard:()=>lizDead(1),bat:()=>batDead(0),spider:()=>spider('side','death',3),kobold:()=>kobold('side','death',3),ant:()=>ant('side','death',0),salamander:()=>salamander('side','death',3),goblin:()=>goblin('side','death',3),orc:()=>orc('side','death',3),lizardman:()=>lizardman('side','death',3),minotaur:()=>minotaur('side','death',3),troll:()=>troll('side','death',3),basilisk:()=>basilisk('side','death',3),gargoyle:()=>gargoyle('side','death',3),vampire:()=>vampire('side','death',3),mimic:()=>mimic('side','death',3),golem:()=>golem('side','death',3),wyvern:()=>wyvern('side','death',3),dragon:()=>dragon('side','death',3),adventurer:()=>adventurer('warrior','side','death',3,false),skeleton:()=>skeleton('none','side','death',3),lich:()=>lich('side','death',3),dwarf:()=>dwarf('miner','side','death',3)};
/** 死骸の段階：0 新しい、1 腐りかけ、2 骨 */
function corpse(sp,stage){if(stage===2){if(sp==='ant')return rotFrame(ant('side','death',0),0.5,3,false);if(sp==='gargoyle')return gargoyle('side','death',3);if(sp==='wyvern'||sp==='dragon')return bones('lizard');if(sp==='adventurer'||sp==='skeleton'||sp==='lich'||sp==='dwarf')return bones('kobold');if(sp==='mimic')return mimic('side','death',3);if(sp==='golem')return golem('side','death',3);if(sp==='salamander'||sp==='lizardman'||sp==='basilisk')return bones('lizard');if(sp==='goblin'||sp==='orc'||sp==='minotaur'||sp==='troll'||sp==='vampire')return bones('kobold');return bones(sp)}const fr=DEADF[sp]();return stage===0?fr:rotFrame(fr,0.28,13,false)}
// ===== スライム =====
function slime(dir,act,f,size){
 const P=[],q=mod(f,4),s=size;
 let rx=7*s,ry=5*s,lift=0,open=false;
 if(act==='move'){const a=[0,1,0,-1][q];rx*=1+0.14*a;ry*=1-0.14*a;lift=[0,-1,-2,-1][q]*s}
 if(act==='idle'){const a=[0,0.5,0,-0.5][q];rx*=1+0.06*a;ry*=1-0.06*a}
 if(act==='attack'){const a=[0,1,1.4,0.6][q];rx*=1+0.12*a;ry*=1+0.18*a;open=q>0}
 if(act==='death'){ry*=[0.7,0.45,0.28,0.16][q];rx*=[1.05,1.15,1.2,1.1][q]}
 const W=22,H=17,cx=11,base=16;
 const cy=base-ry+lift;
 // 床に広がった裾（ぺたりと座った形）
 if(lift===0)P.push(E(cx,base-0.8,rx*1.14,Math.max(1,1.5*s),act==='death'&&q>1?'zspi':'sli',{flat:1}));
 P.push(E(cx,cy,rx,ry,act==='death'&&q>1?'zspi':'sli',{ol:1}));
 if(act!=='death'||q<2){
  P.push(E(cx-rx*0.38,cy-ry*0.45,Math.max(0.8,rx*0.22),Math.max(0.6,ry*0.16),'sli',{flat:4}));
  [[0.3,0.2],[-0.2,0.35],[0.45,-0.1]].forEach(([a,b],i)=>{if(s>0.7||i===0)P.push(D(cx+rx*a,cy+ry*b,RAMP.sli[3]))});
  if(dir!=='up'){
   const ey=cy-ry*0.05;
   if(dir==='down'){P.push(D(cx-2*s,ey,COL.K),D(cx+1.6*s,ey,COL.K))}else{P.push(D(cx+2.2*s,ey,COL.K),D(cx+4*s,ey,COL.K))}
   if(open){if(dir==='down'){P.push(D(cx-1,ey+2*s,RAMP.sli[0]),D(cx,ey+2*s,RAMP.sli[0]))}else{P.push(D(cx+3.6*s,ey+2*s,RAMP.sli[0]),D(cx+4.6*s,ey+2*s,RAMP.sli[0]))}}
  }
 }
 return {...raster(W,H,P),ax:11,ay:16};
}
// ===== ゴースト =====
function ghost(dir,act,f){
 const W=20,H=24,q=mod(f,4),px=new Uint8Array(0);
 const P=[];
 const bob=act==='death'?0:[0,-1,-1,0][q],wave=[0,1,0,-1][q];
 const grow=act==='attack'?[0,1,1.5,0.6][q]:0;
 const hy=7+bob;
 // 衣の裾（波打つ）
 const tail=[[10-4.6-grow*0.5,hy+2],[10+4.6+grow*0.5,hy+2],[10+4+wave,hy+10],[10+2.4-wave,hy+13],[10+0.6+wave,hy+15],[10-1.4-wave,hy+13],[10-3.4+wave,hy+12.4]];
 P.push(PL(tail,'ghost',2));
 P.push(E(10,hy,4.6+grow*0.6,4.4+grow*0.5,'ghost',{flat:3}));
 P.push(E(9,hy-1.5,2.4,1.8,'ghost',{flat:4}));
 // 腕
 const arm=act==='attack'?-3.5:0;
 P.push(C(6,hy+4,3+wave*0.4,hy+7+arm,0.9,'ghost',{flat:2}),C(14,hy+4,17-wave*0.4,hy+7+arm,0.9,'ghost',{flat:2}));
 if(dir!=='up'){
  if(dir==='down'){P.push(D(8,hy,RAMP.ghost[0]),D(11,hy,RAMP.ghost[0]),D(8,hy+1,RAMP.ghost[0]),D(11,hy+1,RAMP.ghost[0]));if(act==='attack'&&q>0)P.push(E(9.5,hy+3.4,1.2,1.4,'ghost',{flat:0}))}
  else{P.push(D(12,hy,RAMP.ghost[0]),D(12,hy+1,RAMP.ghost[0]),D(14,hy,RAMP.ghost[0]));if(act==='attack'&&q>0)P.push(E(13,hy+3,1,1.2,'ghost',{flat:0}))}
 }
 P.forEach(p=>{p.no=1});
 const fr=raster(W,H,P);
 // 透けて見える：下ほど、また消えていくほど網点で抜く
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=y*W+x;if(!fr.px[p*4+3])continue;fr.mat[p]='ghost';
  const fade=act==='death'?[0.15,0.4,0.65,0.85][q]:0;const low=Math.max(0,(y-(hy+5))/12)*0.6;
  const thr=fade+low;if(thr>0&&((x+y)%2===0?0.25:0.75)<thr*1.2||(fade>0.5&&hz(x,y,3)<fade-0.3)){fr.px[p*4+3]=0}}
 return {...fr,ax:10,ay:22};
}


// ===== 人型の骨組み（コボルト、ゴブリン、オーク、リザードマン、ミノタウロス、のちに冒険者） =====
// o.s で全体の大きさを変えられる（1 = 20×24 のコマ）
function humanoid(dir,act,f,o){
 const P=[],q=mod(f,4),mv=act==='move',at=act==='attack',k=o.s||1;
 const W=Math.ceil(20*k),H=Math.ceil(24*k)+(o.top||0),cx=W/2,feet=H-2,leg=(o.leg||6)*k,bw=(o.bw||3.3)*k,bh=(o.bh||3.6)*k,hh=(o.hh||9.4)*k,r=(o.limb||1)*k;
 const sk=o.skin,skD=o.skinD||o.skin,cl=o.cloth,aL=(o.armL||0)*k,hu=(o.hunch||0)*k;
 if(act==='death'){
  if(q===0){P.push(C(cx-2*k,feet-1,cx+2*k,feet-1,r,skD),E(cx,feet-4*k,bw,bh*0.8,cl,{ol:1}));o.head('down',P,cx,feet-4*k-hh*0.7,true,false,k)}
  else{if(o.tail)P.push(C(cx-4*k,feet-1,cx-9*k,feet-1.5,0.9*r,sk));P.push(C(cx-7*k,feet-1,cx-3*k,feet-1,r,skD),C(cx-7*k,feet-2.5*k,cx-3*k,feet-2.5*k,r,sk),E(cx,feet-2*k,bw+k,2.2*k,cl,{ol:1}),C(cx-k,feet-4*k,cx+2*k,feet-5*k,0.9*r,sk));o.head('side',P,cx+5*k,feet-3*k,true,false,k)}
  return {...raster(W,H,P),ax:Math.round(cx),ay:feet};
 }
 const bob=mv?[0,-1,0,-1][q]:0, st=mv?[1.4,0,-1.4,0][q]*k:0, sw=mv?[-1,0,1,0][q]*k:0;
 const swing=at?[0,-1,1,0.5][q]:0;
 const hip=feet-leg+bob;
 const sh=hip-bh*1.15;
 if(dir==='side'){
  P.push(C(cx-0.5*k,hip,cx-0.5*k-st,feet,r,skD),C(cx-0.5*k-st,feet,cx+0.7*k-st,feet,0.8*r,skD));
  if(o.cape)o.cape('side',P,cx,sh,hip,feet,q,mv,k);
  P.push(C(cx-0.6*k,sh,cx-1.4*k-sw,hip-0.6*k+aL,0.85*r,skD));
  if(o.off&&!o.offFront)o.off('side',P,cx-1.4*k-sw,hip-0.6*k+aL,k,q);
  if(o.tail)P.push(C(cx-2*k,hip-k,cx-(o.tail+2)*k,hip+1.6*k+bob,(o.tailR||0.7)*k,sk));
  const hx=cx+k+sw+(at?[0,-2,3,1.5][q]*k:0)+hu*0.5,hy=hip-0.6*k+aL+(at?[0,-5,-1,0][q]*k:0);
  if(o.tool&&!at)o.tool('side',P,hx,hy,0,true,k);
  P.push(E(cx,hip-bh*0.9,bw*0.82,bh,cl,{ol:1}));
  P.push(C(cx+0.5*k,hip,cx+0.5*k+st,feet,r*1.05,sk),C(cx+0.5*k+st,feet,cx+1.8*k+st,feet,0.85*r,sk));
  if(o.boot)P.push(C(cx-0.5*k-st,feet-0.6*k,cx+0.9*k-st,feet,0.95*r,o.boot),C(cx+0.5*k+st,feet-0.6*k,cx+2*k+st,feet,0.95*r,o.boot));
  if(o.decor)o.decor('side',P,cx,hip,sh,bw,bh,k,q,mv);
  o.head('side',P,cx+0.6*k+hu,hip-hh+hu*0.5,false,at&&q>0,k);
  // 松明は掲げて顔の前へ（頭より手前に描く）
  if(o.off&&o.offFront)o.off('side',P,cx+1.6*k-sw*0.5,hip-1.4*k+aL,k,q);
  P.push(C(cx+0.8*k,sh,hx,hy,0.9*r,sk));
  if(o.hand)P.push(E(hx,hy,0.95*k,0.95*k,o.hand,{ol:1}));
  if(o.pad)P.push(E(cx+0.6*k,sh+0.4*k,1.6*k,1.3*k,o.pad,{ol:1}));
  if(o.tool&&at)o.tool('side',P,hx,hy,swing,false,k);
  return {...raster(W,H,P),ax:Math.round(cx),ay:feet};
 }
 const back=dir==='up';
 const lA=mv?[-1,0,1,0][q]:0;
 const ar=at?[0,-5,-1,0][q]*k:0;
 const hx=cx+bw+0.6*k,hy=hip-0.6*k+sw+ar+aL;
 if(o.tool&&(!at||back))o.tool(back?'up':'down',P,hx,hy,0,true,k);
 if(o.cape&&!back)o.cape('down',P,cx,sh,hip,feet,q,mv,k);
 if(!back&&o.tail)P.push(C(cx,hip-k,cx+(o.tail*0.5)*k+sw,hip+2*k,(o.tailR||0.7)*k,skD));
 P.push(C(cx-1.5*k,hip,cx-1.7*k,feet+(lA>0?-1:0),r*1.05,back?skD:sk),C(cx+1.5*k,hip,cx+1.7*k,feet+(lA<0?-1:0),r*1.05,back?skD:sk));
 if(o.boot)P.push(C(cx-1.7*k,feet-1.2*k+(lA>0?-1:0),cx-1.7*k,feet+(lA>0?-1:0),r*1.15,o.boot),C(cx+1.7*k,feet-1.2*k+(lA<0?-1:0),cx+1.7*k,feet+(lA<0?-1:0),r*1.15,o.boot));
 P.push(E(cx,hip-bh*0.9,bw,bh,cl,{ol:1}));
 if(o.decor)o.decor(back?'up':'down',P,cx,hip,sh,bw,bh,k,q,mv);
 if(back&&o.tail)P.push(C(cx,hip-k,cx+sw*0.5,hip+(o.tail*0.6)*k,(o.tailR||0.7)*k,sk));
 P.push(C(cx-bw+0.2*k,sh,cx-bw-0.6*k,hip-0.6*k-sw+aL+(o.armL&&at?ar:0),0.9*r,sk),C(cx+bw-0.2*k,sh,hx,hy,0.9*r,sk));
 if(o.hand)P.push(E(cx-bw-0.6*k,hip-0.6*k-sw+aL+(o.armL&&at?ar:0),0.95*k,0.95*k,o.hand,{ol:1}),E(hx,hy,0.95*k,0.95*k,o.hand,{ol:1}));
 if(o.pad)P.push(E(cx-bw+0.2*k,sh+0.3*k,1.6*k,1.2*k,o.pad,{ol:1}),E(cx+bw-0.2*k,sh+0.3*k,1.6*k,1.2*k,o.pad,{ol:1}));
 o.head(back?'up':'down',P,cx,hip-hh+hu*0.6,false,at&&q>0,k);
 if(o.cape&&back)o.cape('up',P,cx,sh,hip,feet,q,mv,k);
 if(o.off)o.off(back?'up':'down',P,back?cx+bw+0.6*k:cx-bw-0.6*k,hip-0.6*k-sw+aL,k,q);
 if(o.tool&&at&&!back)o.tool('down',P,hx,hy,swing,false,k);
 return {...raster(W,H,P),ax:Math.round(cx),ay:feet};
}
// コボルト：犬の頭をした小柄な人型。つるはしを持つ
function kobHead(dir,P,x,y,dead,open){
 if(dir==='side'){
  P.push(PL([[x-2.2,y-1],[x-1.6,y-5.4],[x+0.4,y-1.8]],'kobD',2,{ol:1}));
  P.push(E(x,y+0.6,3.5,3.1,'kob',{ol:1}),C(x+2.4,y+1.8,x+5.6,y+2.4,1.5,'kob'),E(x+4.6,y+3,1.3,0.7,'furB',{flat:3}),D(x+6.2,y+1.8,COL.K));
  P.push(GD(x+1.4,y-0.2,dead?RAMP.kob[0]:COL.K));
  if(open)P.push(D(x+4.2,y+3.6,COL.gum),D(x+5,y+3.6,COL.white));
  return;
 }
 P.push(PL([[x-3.6,y-0.4],[x-3,y-5],[x-0.8,y-1.8]],'kobD',2,{ol:1}),PL([[x+3.6,y-0.4],[x+3,y-5],[x+0.8,y-1.8]],'kobD',2,{ol:1}));
 P.push(E(x,y+0.4,3.6,3.2,'kob',{ol:1}));
 if(dir==='down'){P.push(E(x,y+2.6,2.2,1.6,'furB',{flat:3}),D(x-0.5,y+2,COL.K),D(x+0.5,y+2,COL.K),GD(x-1.8,y-0.2,dead?RAMP.kob[0]:COL.K),GD(x+1.6,y-0.2,dead?RAMP.kob[0]:COL.K));if(open)P.push(D(x-0.6,y+3.8,COL.gum),D(x+0.4,y+3.8,COL.gum))}
 else P.push(D(x,y-1,RAMP.kob[1]),D(x,y,RAMP.kob[1]));
}
function pick(dir,P,hx,hy,sw,rest){
 // 休んでいるときは肩にかつぎ（体の後ろ）、振るときは頭上から振り下ろす
 let tx,ty;
 if(rest){tx=hx-(dir==='side'?4:3);ty=hy-8}else{tx=hx+(dir==='side'?1+sw*2.5:0.6);ty=hy-6+Math.abs(sw)*1.5}
 P.push(LN(hx,hy+1,tx,ty,'wood',2,{no:1}));
 P.push(LN(tx-2.2,ty+0.8,tx+2.2,ty-0.8,'iron',3,{no:1}),D(tx+2.4,ty-0.6,RAMP.iron[4]));
}
function kobold(dir,act,f){return humanoid(dir,act,f,{skin:'kob',skinD:'kobD',cloth:'cloth',head:kobHead,tool:pick,tail:true,leg:4,bw:3.4,bh:2.8,hh:7.8})}
// ===== ジャイアントアント =====
function ant(dir,act,f,carry){
 const P=[],q=mod(f,4),mv=act==='move',at=act==='attack';
 const g=mv?(q%2):0;
 if(act==='death'){
  P.push(E(4,7,2.4,1.8,'antD',{ol:1}),E(7.6,7,1.5,1.2,'ant',{ol:1}),E(10.6,7.2,1.6,1.4,'ant',{ol:1}));
  [[5,6,4,3],[7,6,7.6,3],[9,6,10,3]].forEach(([a,b,c,d])=>P.push(LN(a,b,c,d,'antD',2,{no:1})));
  return {...raster(14,10,P),ax:7,ay:9};
 }
 if(dir==='side'){
  const legs=[[6,6,4.4,8.6],[7.4,6,7.6,8.8],[8.6,6,10.6,8.6]];
  legs.forEach(([a,b,c,d],i)=>P.push(LN(a,b,c+((i+g)%2?0.8:-0.8),d,'antD',2,{no:1})));
  P.push(E(3.6,5,2.6,2.1,'ant',{ol:1}),E(7.4,5.4,1.6,1.2,'ant',{ol:1}),E(10.8,4.8,1.8,1.6,'ant',{ol:1}));
  P.push(LN(11.6,3.6,13,1.2,'antD',2,{no:1}),D(11.4,4.4,COL.K));
  const mo=at?[0,1,1,0][q]:0;P.push(D(12.6,5.6+mo,RAMP.ant[0]),D(13,5-mo,RAMP.ant[0]));
  if(carry)P.push(D(13,5,RAMP.zfur[3]),D(13.6,5.4,RAMP.zfur[2]));
  return {...raster(15,10,P),ax:7,ay:9};
 }
 const flip=dir==='up',Y=(y)=>flip?10-y:y;
 [[6,2.4,4.6],[6,1,6.4],[6,2.4,8.2]].forEach(([y,x0,y1],i)=>{const o=(i+g)%2?0.8:-0.8;P.push(LN(5.6,Y(y),x0,Y(y1+o),'antD',2,{no:1}),LN(8.4,Y(y),14-x0,Y(y1-o),'antD',2,{no:1}))});
 P.push(E(7,Y(2.8),2.2,2,'ant',{ol:1}),E(7,Y(5.6),1.4,1.2,'ant',{ol:1}),E(7,Y(8),1.8,1.6,'ant',{ol:1}));
 if(!flip){P.push(LN(6,9,4.6,10,'antD',2,{no:1}),LN(8,9,9.4,10,'antD',2,{no:1}),D(6,8,COL.K),D(8,8,COL.K));if(carry)P.push(D(7,10,RAMP.zfur[3]))}
 return {...raster(14,11,P),ax:7,ay:flip?9:9};
}
function anthill(){
 const P=[];
 P.push(E(12,9,11,4.6,'soil',{ol:1}),E(12,7.4,7,2.6,'soil',{flat:3}),E(12,6.8,2.4,1.4,'soil',{flat:0}),E(12,7.2,1.6,0.8,'soil',{flat:0}));
 [[4,10],[7,11],[17,10],[20,9],[9,8],[15,8]].forEach(([x,y])=>P.push(D(x,y,RAMP.soil[4])));
 return {...raster(24,14,P),ax:12,ay:12};
}
// ===== マイコニド =====
function myconid(dir,act,f){
 const P=[],q=mod(f,4),mv=act==='move',at=act==='attack';
 const W=20,H=24,cx=10,feet=22;
 if(act==='death'){
  const k=[0,1,2,3][q];
  P.push(E(cx,feet-2-Math.max(0,3-k)*1.2,3,Math.max(1.2,4-k),'stem',{ol:1}));
  P.push(E(cx+k*0.6,feet-5+k*1.2,7-k*0.6,3.6-k*0.5,'cap',{ol:1}));
  [[-3,0],[1,-1],[4,0.5]].forEach(([a,b])=>P.push({...D(cx+a+k*0.6,feet-5+k*1.2+b,[235,210,255]),glow:1}));
  const fr=raster(W,H,P);[[-3,0],[1,-1],[4,0.5]].forEach(([a,b])=>{const x=Math.round(cx+a+k*0.6),y=Math.round(feet-5+k*1.2+b),p=y*W+x;if(fr.px[p*4+3])fr.mat[p]='wisp'});
  return {...fr,ax:cx,ay:feet};
 }
 const bob=mv?[0,-1,0,-1][q]:0,wd=mv?[-1,0,1,0][q]:0,puff=at?[0,1,1.5,0.5][q]:0;
 P.push(C(cx-1.6,feet-4,cx-1.8+wd*0.6,feet,1.1,'stem'),C(cx+1.6,feet-4,cx+1.8-wd*0.6,feet,1.1,'stem'));
 P.push(C(cx,feet-4+bob,cx,feet-10+bob,3.1,'stem',{ol:1}));
 P.push(C(cx-3,feet-8+bob,cx-4.4,feet-5+bob-wd*0.5,0.8,'stem'),C(cx+3,feet-8+bob,cx+4.4,feet-5+bob+wd*0.5,0.8,'stem'));
 if(dir!=='up')P.push(D(dir==='side'?cx+1:cx-1.2,feet-9+bob,COL.K),D(dir==='side'?cx+2.4:cx+1.2,feet-9+bob,COL.K));
 const cy=feet-13+bob-puff*0.5;
 P.push(E(cx+(dir==='side'?0.6:0),cy,7+puff,4+puff*0.6,'cap',{ol:1}));
 P.push(LN(cx-5,cy+2.6,cx+5,cy+2.6,'cap',1,{no:1}));
 const spots=[[-3.6,-1],[0,-2.4],[3.4,-0.6],[-1,0.6],[5,1.2]];
 const fr0=P;
 const fr=raster(W,H,fr0);
 spots.forEach(([a,b])=>{const x=Math.round(cx+a+(dir==='side'?0.6:0)),y=Math.round(cy+b),p=y*W+x;if(x>=0&&y>=0&&x<W&&y<H&&fr.px[p*4+3]){fr.px[p*4]=235;fr.px[p*4+1]=212;fr.px[p*4+2]=255;fr.mat[p]='wisp'}});
 if(at&&q>0){[[-7,-4],[6,-5],[-4,-7],[8,-2],[0,-8]].forEach(([a,b],i)=>{if((i+q)%2)return;const x=Math.round(cx+a),y=Math.round(cy+b-q),p=y*W+x;if(x>=0&&y>=0&&x<W&&y<H){fr.px[p*4]=220;fr.px[p*4+1]=190;fr.px[p*4+2]=255;fr.px[p*4+3]=255;fr.mat[p]='wisp'}})}
 return {...fr,ax:cx,ay:feet};
}
// ===== サラマンダー（ずんぐりした赤い体に、炎のひれと光る斑点） =====
const SMAP={};
function flame(P,x,y,h,w,q,tilt){
 // 炎の舌（外側は橙、内側は黄）。q で揺らぐ
 const s=[0,0.6,0,-0.6][q]+(tilt||0);
 P.push(PL([[x-w,y],[x-w*0.6,y-h*0.5],[x+s,y-h],[x+w*0.7,y-h*0.45],[x+w,y]],'fireO',2));
 P.push(PL([[x-w*0.45,y],[x+s*0.6,y-h*0.6],[x+w*0.45,y]],'fireI',2));
}
function salamander(dir,act,f){
 const P=[],q=mod(f,4),mv=act==='move',at=act==='attack',dead=act==='death';
 const lA=mv?[1,0,-1,0][q]:0,s=mv?[-0.6,0,0.6,0][q]:0;
 const lunge=at?[0,1,2,1][q]:0;
 let W,H,ax,ay;
 if(dir==='side'||dead){
  W=30;H=22;ax=13;ay=20;const by=dead?16.5:15;
  // 尾と尾の先の炎
  P.push(C(9,by,5.4,by+0.6+s,1.7,'sal'),C(5.4,by+0.6+s,2.6,by-0.6+s*1.6,1.1,'sal'));
  if(!dead)flame(P,2.4,by-1+s*1.6,5,1.6,q,-0.8);
  // 奥の脚
  P.push(C(10.5,by+1,10-lA,by+3.4,0.9,'salD'),C(16,by+1,16.6+lA,by+3.4,0.9,'salD'));
  // 背中の炎のひれ（体より奥）
  if(!dead){flame(P,9.6,by-2.2,5,1.8,q);flame(P,13.4,by-2.6,6.4,2,(q+1)%4);flame(P,17,by-2.2,4.6,1.7,(q+2)%4)}
  else[[9.6,by-2],[13.4,by-2.4],[17,by-2]].forEach(([x,y])=>P.push(PL([[x-1.4,y],[x,y-3],[x+1.4,y]],'char',2,{ol:1})));
  P.push(E(13,by,6.4,3.2,dead?'char':'sal',{ol:1}),E(13,by+1.9,5,1.1,dead?'charB':'salB',{flat:3}));
  const hx=20.4+lunge;
  P.push(E(hx,by-0.6,3.8,3.1,dead?'char':'sal',{ol:1}),C(hx+1.6,by+0.2,hx+4.4,by+0.8,1.8,dead?'char':'sal'));
  // 手前の脚
  P.push(C(10.5,by+1.6,10.2+lA,by+3.8,1,'sal'),C(16.4,by+1.6,16.8-lA,by+3.8,1,'sal'));
  const fr=raster(W,H,P);
  const glowPx=[];
  if(!dead){
   // 体側の光る斑点と大きな目
   [[9.6,by+0.2],[12.4,by+0.8],[15.4,by+0.4]].forEach(([x,y])=>glowPx.push([x,y,RAMP.fireI[2]],[x+1,y,RAMP.fireI[1]]));
   glowPx.push([hx+0.6,by-1.6,[255,240,150]],[hx+1.6,by-1.6,[255,240,150]],[hx+1.6,by-0.6,RAMP.char[0]]);
   if(at&&q>0){[[hx+5.4,by+0.6,2],[hx+6.4,by+0.2,1],[hx+6.6,by+1.2,1],[hx+7.6,by+0.6,0]].forEach(([x,y,c])=>glowPx.push([x,y,RAMP.fireI[c+1]]))}
  }else glowPx.push([hx+1,by-1,RAMP.char[0]],[hx+2,by-1,RAMP.char[0]]);
  return finishSal(fr,glowPx,W,H,ax,ay);
 }
 W=24;H=26;ax=12;ay=23;const back=dir==='up';
 const by=13;
 const m=(x)=>24-x;
 const tailY=back?[[12,17],[12+s,21],[12+s*1.6,24]]:[[12,9],[12+s,5],[12+s*1.6,2.4]];
 P.push(C(...tailY[0],...tailY[1],1.6,'sal'),C(...tailY[1],...tailY[2],1.1,'sal'));
 // 脚
 const legs=(y,o)=>{P.push(C(9.4,y,6.4,y+0.6+o,1.1,'sal'),C(6.4,y+0.6+o,6,y+2.6+o,0.9,'sal'),C(m(9.4),y,m(6.4),y+0.6-o,1.1,'sal'),C(m(6.4),y+0.6-o,m(6),y+2.6-o,0.9,'sal'))};
 legs(by-3,lA);legs(by+3,-lA);
 P.push(E(12,by,4.4,5.4,'sal',{ol:1}));
 const hy=back?by-6.4:by+6.4+lunge*0.6;
 P.push(E(12,hy,3.8,3.2,'sal',{ol:1}));
 // 背中の炎のひれ（背骨に沿って）
 [[by-3.6,0],[by,1],[by+3.6,2]].forEach(([y,k])=>flame(P,12,y+1.6,k===1?5.4:4.4,1.8,(q+k)%4));
 if(!back)P.push(C(12,hy+1,12,hy+3.2,2.2,'sal'));
 const fr=raster(W,H,P);
 const glowPx=[];
 [[8.4,by-2],[15.6,by-2],[8.2,by+1.6],[15.8,by+1.6]].forEach(([x,y])=>glowPx.push([x,y,RAMP.fireI[2]]));
 if(!back){glowPx.push([9.6,hy-0.4,[255,240,150]],[14.4,hy-0.4,[255,240,150]]);if(at&&q>0)[[12,hy+4.6,2],[11,hy+5.6,1],[13,hy+5.6,1],[12,hy+6.6,0]].forEach(([x,y,c])=>glowPx.push([x,y,RAMP.fireI[c+1]]))}
 // 尾の先の炎
 const tt=tailY[2];
 const P2=[];flame(P2,tt[0],tt[1]+(back?1.6:0.6),back?4:4.6,1.5,q);
 const fr2=raster(W,H,P2);
 for(let p=0;p<W*H;p++)if(fr2.px[p*4+3]&&fr2.mat[p]!=='ol'){fr.px[p*4]=fr2.px[p*4];fr.px[p*4+1]=fr2.px[p*4+1];fr.px[p*4+2]=fr2.px[p*4+2];fr.px[p*4+3]=255;fr.mat[p]=fr2.mat[p]}
 return finishSal(fr,glowPx,W,H,ax,ay);
}
function finishSal(fr,glowPx,W,H,ax,ay){
 for(let p=0;p<W*H;p++)if(fr.mat[p]==='fireO'||fr.mat[p]==='fireI')fr.mat[p]='wisp';
 // 炎の外側に輪郭を付けない（輪郭の点は炎の色にして柔らかく）
 for(let p=0;p<W*H;p++){if(fr.mat[p]!=='ol')continue;const c=[fr.px[p*4],fr.px[p*4+1],fr.px[p*4+2]].join(',');if(c===RAMP.fireO[0].join(',')||c===RAMP.fireI[0].join(',')){fr.px[p*4+3]=0;fr.mat[p]=null}}
 glowPx.forEach(([x,y,c])=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=W||y>=H)return;const p=y*W+x;fr.px[p*4]=c[0];fr.px[p*4+1]=c[1];fr.px[p*4+2]=c[2];fr.px[p*4+3]=255;fr.mat[p]=c===RAMP.char[0]?'ol':'wisp'});
 return {...fr,ax,ay};
}
// ===== 地面のもの：キノコの群落、掘りたての床（見本用。本番ではシェーダーで描く） =====
function mushrooms(n,seed){
 const W=16,H=16,P=[];
 for(let i=0;i<n;i++){const x=2+hz(i,seed,1)*12,y=5+hz(i,seed,2)*9,s=0.6+hz(i,seed,3)*0.8;P.push(LN(x,y,x,y-2*s,'stem',3,{no:1}),E(x,y-2.4*s,1.8*s,1*s,'cap',{ol:1}))}
 const fr=raster(W,H,P);
 for(let i=0;i<n;i++){const x=Math.round(2+hz(i,seed,1)*12),y=Math.round(5+hz(i,seed,2)*9-2.6*(0.6+hz(i,seed,3)*0.8)),p=y*W+x;if(y>=0&&fr.px[p*4+3]){fr.px[p*4]=230;fr.px[p*4+1]=200;fr.px[p*4+2]=255;fr.mat[p]='wisp'}}
 return {...fr,ax:8,ay:15};
}


// ===== 段階5b-1：ゴブリン、オーク、リザードマン、ミノタウロス =====
function gobHead(dir,P,x,y,dead,open,k){
 const ey=dead?RAMP.gob[0]:[230,200,60];
 if(dir==='side'){
  P.push(PL([[x-1.6,y-0.6],[x-6,y-2.6],[x-1.8,y+1.6]],'gob',2,{ol:1}));
  P.push(E(x,y+0.4,3.4,3.2,'gob',{ol:1}),C(x+2.6,y+0.8,x+4.6,y+2.2,1.2,'gob'));
  P.push(GD(x+1.6,y-0.4,ey),D(x+1.4,y-1.4,RAMP.gob[0]));
  if(open)P.push(D(x+2.2,y+2.6,COL.gum),D(x+3,y+2.6,COL.white));else P.push(D(x+2.4,y+2.4,RAMP.gob[0]));
  return;
 }
 P.push(PL([[x-2.6,y-0.4],[x-7.2,y-2.4],[x-2.8,y+1.6]],'gob',2,{ol:1}),PL([[x+2.6,y-0.4],[x+7.2,y-2.4],[x+2.8,y+1.6]],'gob',2,{ol:1}));
 P.push(E(x,y+0.4,3.6,3.3,'gob',{ol:1}));
 if(dir==='down'){P.push(GD(x-1.6,y-0.2,ey),GD(x+1.6,y-0.2,ey),D(x-1.6,y-1.2,RAMP.gob[0]),D(x+1.6,y-1.2,RAMP.gob[0]),E(x,y+1.4,0.9,1.2,'gob',{flat:4}));P.push(open?D(x,y+3,COL.gum):D(x-0.6,y+2.8,RAMP.gob[0]),open?D(x-1,y+3,COL.white):D(x+0.6,y+2.8,RAMP.gob[0]))}
}
function club(dir,P,hx,hy,sw,rest,k){
 if(dir==='up'&&rest)return;
 let tx,ty;
 if(rest){tx=hx+(dir==='side'?-3:1);ty=hy-5}else{tx=hx+(dir==='side'?1+sw*2.5:0.6);ty=hy-5.6+Math.abs(sw)*1.5}
 P.push(LN(hx,hy+1,tx,ty,'wood',2,{no:1}),E(tx+(tx-hx)*0.12,ty-0.6,1.5,1.5,'wood',{ol:1}));
}
function goblin(dir,act,f,v=0){
 // v: 0 こん棒、1 拾った剣、2 拾った松明を掲げる
 const fr=humanoid(dir,act,f,{skin:'gob',skinD:'gobD',cloth:'rag',head:gobHead,tool:v===1?sword:club,off:v===2?torchHeld:null,offFront:v===2,leg:4.4,bw:3,bh:2.8,hh:7.6});
 if(v===2)glowFlame(fr);
 return fr;
}

function orcHead(dir,P,x,y,dead,open,k){
 const ey=dead?RAMP.orc[0]:[230,70,50];
 if(dir==='side'){
  P.push(E(x-0.6,y-2.4,2.6,1.6,'leather',{flat:1}));
  P.push(E(x,y+0.6,4,3.8,'orc',{ol:1}),E(x+2.8,y+2.4,2.4,2,'orc',{ol:1}));
  P.push(D(x+4.4,y+1.4,RAMP.orc[0]),GD(x+2,y-0.6,ey),D(x+1.6,y-1.6,RAMP.orc[0]),D(x+2.6,y-1.6,RAMP.orc[0]));
  P.push(D(x+4,y+3.4,COL.white),D(x+4,y+2.6,COL.white));
  if(open)P.push(D(x+3,y+3.8,COL.gum));
  return;
 }
 P.push(PL([[x-3.4,y-0.4],[x-5.6,y-1.6],[x-3.6,y+1.8]],'orc',2,{ol:1}),PL([[x+3.4,y-0.4],[x+5.6,y-1.6],[x+3.6,y+1.8]],'orc',2,{ol:1}));
 P.push(E(x,y+0.6,4.2,4,'orc',{ol:1}));
 P.push(E(x,y-3,2.4,1.4,'leather',{flat:1}));
 if(dir==='down'){P.push(GD(x-1.8,y-0.2,ey),GD(x+1.8,y-0.2,ey),LN(x-2.6,y-1.2,x-1,y-0.8,'orc',0,{no:1}),LN(x+2.6,y-1.2,x+1,y-0.8,'orc',0,{no:1}),E(x,y+1.6,1.4,1,'orc',{flat:3}),D(x-0.5,y+1.6,RAMP.orc[0]),D(x+0.5,y+1.6,RAMP.orc[0]));
  P.push(D(x-2,y+3.2,COL.white),D(x-2,y+2.4,COL.white),D(x+2,y+3.2,COL.white),D(x+2,y+2.4,COL.white));if(open)P.push(D(x,y+3.4,COL.gum),D(x-1,y+3.4,COL.gum),D(x+1,y+3.4,COL.gum))}
}
function axe(dir,P,hx,hy,sw,rest,k){
 if(dir==='up'&&rest)return;
 let tx,ty;
 if(rest){tx=hx+(dir==='side'?-4:1.4)*k;ty=hy-7*k}else{tx=hx+(dir==='side'?(1+sw*3)*k:0.8);ty=hy-7*k+Math.abs(sw)*2}
 P.push(LN(hx,hy+1,tx,ty,'wood',2,{no:1}));
 const bx=tx+(dir==='side'?1:0.4),by=ty+1.4*k;
 P.push(PL([[bx,by-2.4*k],[bx+3*k,by-3.2*k],[bx+3.6*k,by],[bx+3*k,by+2.6*k],[bx,by+1.6*k]],'iron',3,{ol:1}),D(bx+3.2*k,by,RAMP.iron[4]));
}
function orc(dir,act,f,v=0){
 // v: 0 斧、1 拾った剣と盾
 return humanoid(dir,act,f,{s:1.3,skin:'orc',skinD:'orcD',cloth:'leather',head:orcHead,tool:v===1?sword:axe,off:v===1?shieldOff:null,leg:5,bw:4,bh:3.6,hh:9,limb:1.25});
}

function lzmHead(dir,P,x,y,dead,open,k){
 const ey=dead?RAMP.lzm[0]:[240,210,70];
 if(dir==='side'){
  P.push(PL([[x-2.4,y-2.4],[x-3.6,y-4],[x-1,y-2.8]],'lzmD',2,{ol:1}));
  P.push(E(x,y,3.2,2.8,'lzm',{ol:1}),C(x+1.8,y+0.8,x+6.2,y+1.4,1.6,'lzm'),E(x+4,y+2,2.6,0.8,'lzmB',{flat:2}));
  P.push(GD(x+0.8,y-1,ey),D(x+6.4,y+0.6,RAMP.lzm[0]));
  if(open)P.push(D(x+3,y+2.4,COL.gum),D(x+4,y+2.4,COL.gum),D(x+5,y+2,COL.white));
  return;
 }
 P.push(PL([[x-1.2,y-2.6],[x,y-5],[x+1.2,y-2.6]],'lzmD',2,{ol:1}));
 P.push(E(x,y+0.4,3.2,3,'lzm',{ol:1}));
 if(dir==='down'){P.push(C(x,y+1.6,x,y+4.4,1.7,'lzm'),E(x,y+3.4,1.4,1,'lzmB',{flat:3}),GD(x-2,y-0.6,ey),GD(x+2,y-0.6,ey),D(x-0.6,y+4.6,RAMP.lzm[0]),D(x+0.6,y+4.6,RAMP.lzm[0]));if(open)P.push(D(x,y+5.4,COL.gum))}
}
function spear(dir,P,hx,hy,sw,rest,k){
 if(dir==='up'&&rest){P.push(LN(hx,hy+2,hx+1,hy-9,'wood',2,{no:1}));return}
 let tx,ty;
 if(rest){tx=hx+(dir==='side'?1:0.5);ty=hy-10}else if(dir==='side'){tx=hx+5+sw*3;ty=hy-2+sw}else{tx=hx;ty=hy+5}
 P.push(LN(hx-(tx-hx)*0.3,hy+1-(ty-hy)*0.3,tx,ty,'wood',2,{no:1}));
 const dx=tx-hx,dy=ty-hy,L=Math.hypot(dx,dy)||1;
 P.push(LN(tx,ty,tx+dx/L*2.4,ty+dy/L*2.4,'iron',3,{no:1}),D(tx+dx/L*2.6,ty+dy/L*2.6,RAMP.iron[4]));
}
function lizardman(dir,act,f){return humanoid(dir,act,f,{s:1.1,skin:'lzm',skinD:'lzmD',cloth:'reed',head:lzmHead,tool:spear,leg:5.4,bw:3.2,bh:3.4,hh:8.6,tail:7,tailR:1.2})}

function bullHead(dir,P,x,y,dead,open,k){
 const ey=dead?RAMP.bull[0]:[240,60,40];
 if(dir==='side'){
  P.push(C(x-1,y-2.4,x-4.2,y-4.4,1.1,'horn'),C(x-4.2,y-4.4,x-2.6,y-7,0.8,'horn'));
  P.push(E(x,y+0.4,4.4,4,'bull',{ol:1}),C(x+2.4,y+1.6,x+6.6,y+3,2.4,'bull'),E(x+6,y+3.4,1.8,1.4,'bullD',{flat:3}));
  P.push(PL([[x-2.6,y+0.4],[x-5.6,y+1.4],[x-3,y+2.2]],'bullD',2,{ol:1}));
  P.push(GD(x+2,y-0.6,ey),D(x+7.2,y+2.8,COL.K));
  if(open)P.push(D(x+5,y+4.8,COL.gum),D(x+6,y+4.8,COL.gum));
  return;
 }
 const hs=dir==='down'?1:1;
 P.push(C(x-3,y-2.6,x-7.4,y-3.6,1.2,'horn'),C(x-7.4,y-3.6,x-8,y-7,0.9,'horn'),C(x+3,y-2.6,x+7.4,y-3.6,1.2,'horn'),C(x+7.4,y-3.6,x+8,y-7,0.9,'horn'));
 P.push(PL([[x-3.6,y],[x-6.6,y+1.2],[x-3.8,y+2.4]],'bullD',2,{ol:1}),PL([[x+3.6,y],[x+6.6,y+1.2],[x+3.8,y+2.4]],'bullD',2,{ol:1}));
 P.push(E(x,y+0.6,4.4,4.2*hs,'bull',{ol:1}));
 if(dir==='down'){P.push(E(x,y+3.6,3,2.2,'bullD',{ol:1}),D(x-1.2,y+3.6,COL.K),D(x+1.2,y+3.6,COL.K),GD(x-2.2,y-0.4,ey),GD(x+2.2,y-0.4,ey),D(x,y-1.6,RAMP.bull[4]));if(open)P.push(D(x,y+5.6,COL.gum))}
}
function bigaxe(dir,P,hx,hy,sw,rest,k){
 if(dir==='up'&&rest){P.push(LN(hx,hy+3,hx+2,hy-12,'wood',2,{no:1}));return}
 let tx,ty;
 if(rest){tx=hx+(dir==='side'?-5:1.6)*k;ty=hy-8*k}else{tx=hx+(dir==='side'?(1+sw*3)*k:0.8);ty=hy-8*k+Math.abs(sw)*2}
 P.push(LN(hx,hy+2,tx,ty,'wood',2,{no:1}));
 const bx=tx,by=ty+1.6*k;
 P.push(PL([[bx+0.6,by-1.6*k],[bx+3.6*k,by-3*k],[bx+4*k,by],[bx+3.6*k,by+3*k],[bx+0.6,by+1.6*k]],'iron',3,{ol:1}));
 P.push(PL([[bx-0.6,by-1.6*k],[bx-3.6*k,by-3*k],[bx-4*k,by],[bx-3.6*k,by+3*k],[bx-0.6,by+1.6*k]],'iron',2,{ol:1}));
}
function minotaur(dir,act,f){return humanoid(dir,act,f,{s:1.6,skin:'bull',skinD:'bullD',cloth:'leather',head:bullHead,tool:bigaxe,leg:5.6,bw:4.4,bh:4,hh:9.6,limb:1.35})}

// ===== 集落 =====
function goblinCamp(){
 const P=[];
 // ぼろ布の寝床（継ぎはぎのテント）と骨の山
 P.push(PL([[3,20],[12,4],[21,20]],'rag',2,{ol:1}),PL([[12,4],[16,12],[14,20],[12,20]],'rag',1),PL([[10,20],[12,13],[14,20]],'rag',0));
 [[8,12],[15,15],[17,18]].forEach(([x,y])=>P.push(D(x,y,RAMP.cloth[2]),D(x+1,y,RAMP.cloth[2]),D(x,y+1,RAMP.cloth[3])));
 P.push(LN(12,4,11,1,'wood',2,{no:1}),LN(12,4,13.4,1.4,'wood',2,{no:1}));
 P.push(E(27,19,4,2,'bone',{ol:1}),C(25,17.6,29,18.4,0.7,'bone'),E(29.4,17,1.4,1.2,'bone',{ol:1}),D(29,17,COL.K),LN(24,20,30,16,'bone',3,{no:1}));
 return {...raster(33,22,P),ax:14,ay:20};
}
// ===== 物資の置き場（冒険者の遠征の木箱と寝具。tier 2 たっぷり、1 減った、0 空の残骸） =====
// ヴァンパイアの棺（見下ろし。頭の側が広い六角形）。open：蓋がずれて、赤い内張りが見える
function coffin(open){
 const P=[];
 const body=[[7,2],[13,2],[16,7],[13,22],[7,22],[4,7]];
 P.push(PL(body,'cape',1,{ol:1}));
 P.push(PL([[8,3.5],[12,3.5],[14.4,7.4],[12,20.6],[8,20.6],[5.6,7.4]],open?'capeR':'cape',open?1:2,{ol:0}));
 if(open){
  P.push(PL([[13,4],[19,6],[17,24],[11,22]],'cape',2,{ol:1}));
  P.push(LN(15,10,15,16,'gold',3,{no:1}),LN(13,13,17,13,'gold',3,{no:1}));
 }else{
  P.push(LN(10,6,10,16,'gold',3,{no:1}),LN(7.6,9.5,12.4,9.5,'gold',3,{no:1}));
 }
 return {...raster(21,25,P),ax:10,ay:22};
}
function supplyCache(tier){
 const P=[];
 if(tier===0){
  // 空の残骸：蓋のはずれた空の木箱、散らばった板、ほどけた寝具
  P.push(PL([[8,9],[20,9],[20,19],[8,19]],'wood',1,{ol:1}),PL([[9,10],[19,10],[19,13],[9,13]],'char',1));
  P.push(LN(9,15,19,15,'wood',0,{no:1}),LN(9,17,19,17,'wood',0,{no:1}));
  P.push(PL([[21,17],[28,14],[29,16],[22,19]],'wood',2,{ol:1}),LN(22,18,28,15,'wood',1,{no:1}));
  P.push(PL([[1,18],[6,16],[7,18],[2,20]],'wood',2,{ol:1}));
  P.push(E(14,21,9,1.6,'leather',{ol:1}),LN(6,21,22,21,'leather',1,{no:1}));
  return {...raster(30,23,P),ax:14,ay:21};
 }
 // 寝具（巻いた毛布と革ひも）
 P.push(E(23,17,6,3.4,'tabard',{ol:1}),E(17.6,17,1.6,3.2,'tabard',{ol:1}),LN(21,14,21,20,'leather',1,{no:1}),LN(25,14,25,20,'leather',1,{no:1}));
 // 木箱：板の継ぎ目と、角の鉄の金具
 P.push(PL([[3,8],[16,8],[16,20],[3,20]],'wood',2,{ol:1}),PL([[3,8],[16,8],[17.6,5.6],[4.6,5.6]],'wood',3,{ol:1}));
 P.push(LN(3,12,16,12,'wood',1,{no:1}),LN(3,16,16,16,'wood',1,{no:1}),LN(9.5,8,9.5,20,'wood',1,{no:1}));
 P.push(D(4,9,RAMP.iron[3]),D(15,9,RAMP.iron[3]),D(4,19,RAMP.iron[2]),D(15,19,RAMP.iron[2]));
 // 中身：たっぷりなら蓋の上に袋と干し肉の包み、減っていれば袋だけ
 P.push(E(10,5,4.4,2.6,'rag',{ol:1}),LN(10,2.6,10,3.6,'leather',1,{no:1}));
 if(tier===2)P.push(E(6,4.6,2.6,1.8,'leather',{ol:1}),E(14.6,4.8,2.2,1.6,'rag',{ol:1}));
 return {...raster(30,23,P),ax:12,ay:20};
}
function reedHut(){
 const P=[];
 P.push(E(14,15,11,8,'reed',{ol:1}));
 for(let x=5;x<=23;x+=3)P.push(LN(x,9+Math.abs(x-14)*0.4,x+1,21,'reed',1,{no:1}));
 P.push(E(14,7.6,4,2,'reed',{flat:4}),LN(14,5,14,8,'reed',3,{no:1}));
 P.push(E(14,18,3,4,'reed',{flat:0}),PL([[11,22],[17,22],[16.4,18],[11.6,18]],'reed',0));
 return {...raster(28,24,P),ax:14,ay:22};
}


// ===== 段階5b-2：トロール、バジリスク、ガーゴイル、ヴァンパイア =====
function trollHead(dir,P,x,y,dead,open,k){
 const ey=dead?RAMP.trl[0]:[230,190,60];
 if(dir==='side'){
  P.push(E(x+0.6,y+3.6,3.8,2,'trlD',{ol:1}));
  P.push(E(x,y+0.6,4.2,3.8,'trl',{ol:1}),E(x+3.8,y+1.4,1.8,2.2,'trl',{ol:1}));
  P.push(D(x+1.4,y-0.8,ey),D(x+0.8,y-1.8,RAMP.trl[0]),D(x+2,y-1.8,RAMP.trl[0]),E(x-1.6,y-2.6,2.2,1.1,'moss2',{flat:2}));
  P.push(D(x+2.6,y+4.4,COL.white),D(x+1.2,y+4.6,COL.white));
  if(open)P.push(D(x+2,y+5,COL.gum),D(x+3,y+5,COL.gum));
  return;
 }
 P.push(PL([[x-3.6,y],[x-6,y-1],[x-3.8,y+2]],'trl',2,{ol:1}),PL([[x+3.6,y],[x+6,y-1],[x+3.8,y+2]],'trl',2,{ol:1}));
 P.push(E(x,y+0.6,4.4,4,'trl',{ol:1}),E(x,y-2.6,3.4,1.4,'moss2',{flat:2}));
 if(dir==='down'){P.push(D(x-1.6,y-0.2,ey),D(x+1.6,y-0.2,ey),C(x,y+0.6,x,y+2.6,1.3,'trl'),E(x,y+3.6,2.6,1.2,'trlD',{ol:1}),D(x-1.2,y+3.4,COL.white),D(x+1.2,y+3.4,COL.white));if(open)P.push(D(x,y+4.2,COL.gum))}
}
function troll(dir,act,f){return humanoid(dir,act,f,{s:1.7,skin:'trl',skinD:'trlD',cloth:'trlD',head:trollHead,leg:5,bw:4.6,bh:4,hh:8,limb:1.4,armL:3,hunch:1.6})}

function basilisk(dir,act,f){
 const P=[],q=mod(f,4),mv=act==='move',at=act==='attack',dead=act==='death';
 const s=mv?[-0.6,0,0.6,0][q]:0,lA=mv?[1.1,0,-1.1,0][q]:0;
 const gl=at&&q>0;
 const EYE=gl?[240,255,140]:[190,230,90];
 let fr,ax,ay,W,H;const eyes=[];
 if(dir==='side'||dead){
  W=40;H=20;ax=18;ay=18;const by=dead?14.5:12.5;
  P.push(C(9,by,5,by+0.8+s,2.2,'bas'),C(5,by+0.8+s,1.4,by+1.6+s*1.8,1.3,'bas'));
  [[12,1],[18,-1],[24,1]].forEach(([x,o])=>P.push(C(x,by+1.4,x-1-lA*o,by+4.8,1,'basD')));
  P.push(E(18,by,9.4,3.6,'bas',{ol:1}),E(18,by+2.4,7.6,1.2,'basB',{flat:2}));
  [[11,by-3],[14,by-3.4],[17,by-3.6],[20,by-3.4],[23,by-3]].forEach(([x,y])=>P.push(PL([[x-1.2,y+1],[x,y-1.6],[x+1.2,y+1]],'crest',2)));
  const hx=28.6+(at?[0,1,2,1][q]:0);
  P.push(E(hx,by-0.8,4.2,3,'bas',{ol:1}),C(hx+1,by,hx+5.2,by+0.4,1.8,'bas'));
  P.push(PL([[hx-2,by-3],[hx-1,by-6.2],[hx+0.4,by-3.6],[hx+1.4,by-6],[hx+2.2,by-3]],'crest',2,{ol:1}));
  [[13,-1],[19,1],[25,-1]].forEach(([x,o])=>P.push(C(x,by+1.8,x+1+lA*o,by+5,1.1,'bas')));
  fr=raster(W,H,P);
  if(!dead){eyes.push([hx+1.6,by-1.4]);if(gl)eyes.push([hx+2.6,by-1.4],[hx+1.6,by-2.4])}
 }else{
  W=30;H=32;ax=15;ay=28;const back=dir==='up',Y=(y)=>back?30-y:y;
  P.push(C(15,Y(8),15+s,Y(3),2,'bas'),C(15+s,Y(3),15+2*s,Y(0.4),1.2,'bas'));
  [[11,1],[16,-1],[21,1]].forEach(([y,o])=>{P.push(C(11,Y(y),6.4,Y(y-1+lA*o),1.3,'bas'),C(6.4,Y(y-1+lA*o),5.6,Y(y+1.4+lA*o),1,'bas'),C(19,Y(y),23.6,Y(y-1-lA*o),1.3,'bas'),C(23.6,Y(y-1-lA*o),24.4,Y(y+1.4-lA*o),1,'bas'))});
  P.push(E(15,Y(16),5.4,8,'bas',{ol:1}));
  for(let y=10;y<=22;y+=3)P.push(PL([[14,Y(y)],[15,Y(y-2)],[16,Y(y)]],'crest',2));
  const hy=back?Y(25):25+(at?[0,1,2,1][q]:0);
  P.push(E(15,hy,4,3.4,'bas',{ol:1}));
  if(!back){P.push(C(15,hy+1,15,hy+3.6,2.2,'bas'),PL([[12.6,hy-2],[13.4,hy-5.2],[15,hy-3],[16.6,hy-5.2],[17.4,hy-2]],'crest',2,{ol:1}));eyes.push([13,hy-0.6],[17,hy-0.6]);if(gl)eyes.push([12.4,hy-1.2],[17.6,hy-1.2])}
  else P.push(PL([[12.6,hy+2],[13.4,hy+5],[15,hy+3],[16.6,hy+5],[17.4,hy+2]],'crest',2,{ol:1}));
  fr=raster(W,H,P);
 }
 eyes.forEach(([x,y])=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=W||y>=H)return;const p=y*W+x;fr.px[p*4]=EYE[0];fr.px[p*4+1]=EYE[1];fr.px[p*4+2]=EYE[2];fr.px[p*4+3]=255;fr.mat[p]='wisp'});
 return {...fr,ax,ay};
}

function gargoyle(dir,act,f){
 const P=[],q=mod(f,4),dead=act==='death';
 // idle = 壁の上にうずくまる、move = 飛ぶ、attack = 爪で襲いかかる
 const fly=act==='move'||act==='attack';
 const W=28,H=26,cx=14;
 const eyes=[];
 if(dead){
  [[8,22,2.4],[13,23,3],[18,22,2.2],[22,23,1.6],[11,20,1.4]].forEach(([x,y,r])=>P.push(E(x+q*0.4,y,r,r*0.7,'stone',{ol:1})));
  return {...raster(W,H,P),ax:cx,ay:24};
 }
 const by=fly?14+[0,-1,0,1][q]:18;
 const wingUp=fly?[0,1,2,1][q]:0;
 const back=dir==='up';
 if(dir==='side'){
  const wp=fly?[[cx-2,by-2],[cx-9,by-9+wingUp*4],[cx-12,by-3+wingUp*2],[cx-7,by-1],[cx-10,by+2+wingUp],[cx-3,by+1]]:[[cx-2,by-3],[cx-6,by-7],[cx-7,by+1],[cx-2,by+2]];
  P.push(PL(wp,'stoneD',2,{ol:1}));
  P.push(C(cx-2,by+2,cx-6,by+5,0.9,'stone'),E(cx,by,3.4,3.6,'stone',{ol:1}));
  if(!fly)P.push(C(cx-1,by+3,cx-2,by+6,1.1,'stone'),C(cx+1.6,by+3,cx+2.6,by+6,1.1,'stone'));
  else P.push(C(cx-1,by+3,cx-2,by+7,1,'stone'),C(cx+1,by+3,cx+2.4,by+7,1,'stone'));
  const ha=act==='attack'?[0,2,3,1][q]:0;
  P.push(C(cx+2,by,cx+4+ha,by+2+(act==='attack'?2:0),0.9,'stone'));
  P.push(E(cx+2.6,by-4,2.6,2.4,'stone',{ol:1}),PL([[cx+1.4,by-6],[cx+0.6,by-9],[cx+2.6,by-6.4]],'stone',3,{ol:1}),C(cx+4,by-3.6,cx+5.6,by-3.2,0.9,'stone'));
  fr0();
 }else{
  const sp=fly?1:0.55;
  for(const sx of [-1,1]){const X=(x)=>cx+sx*x;const wp=fly?[[X(2),by-2],[X(10),by-8+wingUp*3],[X(13),by-2+wingUp],[X(8),by],[X(11),by+3],[X(3),by+1]]:[[X(2),by-3],[X(6),by-8],[X(7.4),by+1],[X(3),by+2]];P.push(PL(wp,back?'stone':'stoneD',2,{ol:1}))}
  P.push(E(cx,by,3.8,3.8,'stone',{ol:1}));
  P.push(C(cx-1.6,by+3,cx-2,by+6.4,1.1,'stone'),C(cx+1.6,by+3,cx+2,by+6.4,1.1,'stone'));
  P.push(C(cx-3,by-0.6,cx-4,by+3+(act==='attack'?-2:0),0.9,'stone'),C(cx+3,by-0.6,cx+4,by+3+(act==='attack'?-2:0),0.9,'stone'));
  P.push(E(cx,by-4.2,2.8,2.6,'stone',{ol:1}),PL([[cx-2.4,by-5.4],[cx-3.4,by-9],[cx-1,by-6.2]],'stone',3,{ol:1}),PL([[cx+2.4,by-5.4],[cx+3.4,by-9],[cx+1,by-6.2]],'stone',3,{ol:1}));
  fr0();
 }
 function fr0(){}
 const fr=raster(W,H,P);
 if(dir==='side')eyes.push([cx+3.4,by-4.4]);else if(!back)eyes.push([cx-1.2,by-4.2],[cx+1.2,by-4.2]);
 eyes.forEach(([x,y])=>{x=Math.round(x);y=Math.round(y);const p=y*W+x;fr.px[p*4]=230;fr.px[p*4+1]=60;fr.px[p*4+2]=40;fr.px[p*4+3]=255;fr.mat[p]='wisp'});
 return {...fr,ax:cx,ay:24};
}

function vampHead(dir,P,x,y,dead,open,k){
 const ey=dead?RAMP.pale[0]:[255,60,60];
 if(dir==='side'){
  P.push(E(x,y+0.4,3.2,3.4,'pale',{ol:1}),C(x+2,y+0.8,x+3.4,y+1.6,0.9,'pale'),PL([[x-3.2,y-1],[x-2.6,y-3.4],[x+2.4,y-3.4],[x+1.6,y-1.6],[x-1,y-1.6],[x-2,y+2]],'cape',2,{ol:1}));
  P.push(GD(x+1.6,y-0.2,ey));
  if(open)P.push(D(x+2.4,y+2.4,COL.white),D(x+1.6,y+2.4,COL.gum));
  return;
 }
 P.push(E(x,y+0.4,3.2,3.4,'pale',{ol:1}));
 if(dir==='down'){P.push(PL([[x-3.2,y-0.4],[x-3,y-3.2],[x+3,y-3.2],[x+3.2,y-0.4],[x+1,y-2],[x,y-0.8],[x-1,y-2]],'cape',2,{ol:1}),GD(x-1.4,y+0.2,ey),GD(x+1.4,y+0.2,ey),D(x,y+2.2,RAMP.pale[1]));if(open)P.push(D(x-0.6,y+2.8,COL.white),D(x+0.6,y+2.8,COL.white))}
 else P.push(E(x,y-0.4,3.2,3,'cape',{ol:1}));
}
function vampCape(dir,P,cx,sh,hip,feet,q,mv,k){
 const fl=mv?[0,1,2,1][q]:0;
 // 横向きでも、マントを背中側へ大きく広げて、細い線に見えないようにする（裏地の赤を少し見せる）
 if(dir==='side'){P.push(PL([[cx-1*k,sh-1.4*k],[cx-5.4*k-fl*1.4,hip],[cx-7.4*k-fl*1.6,feet-1.4*k],[cx-3*k,feet],[cx+1.4*k,feet-0.4*k],[cx+2*k,sh]],'cape',2,{ol:1}),PL([[cx-1.6*k,sh+0.4*k],[cx-5*k-fl*1.2,hip+0.6*k],[cx-6.6*k-fl*1.4,feet-1.6*k],[cx-4.6*k-fl*0.6,feet-1.2*k]],'capeR',2));return}
 if(dir==='down'){P.push(PL([[cx-4.2*k,sh-1],[cx-6*k-fl*0.4,feet],[cx-3*k,feet-1],[cx-3.2*k,sh+2]],'capeR',2,{ol:1}),PL([[cx+4.2*k,sh-1],[cx+6*k+fl*0.4,feet],[cx+3*k,feet-1],[cx+3.2*k,sh+2]],'capeR',2,{ol:1}));return}
 P.push(PL([[cx-4.4*k,sh-1],[cx+4.4*k,sh-1],[cx+6*k+fl*0.4,feet],[cx+2,feet-1+fl*0.3],[cx-2,feet-1-fl*0.3],[cx-6*k-fl*0.4,feet]],'cape',2,{ol:1}));
}
function vampire(dir,act,f){return humanoid(dir,act,f,{s:1.35,skin:'pale',skinD:'pale',cloth:'cape',head:vampHead,cape:vampCape,leg:6,bw:3,bh:3.8,hh:9.2})}

/** 石像：その姿のまま石の色に変える（見本と書き出し用。ゲームではシェーダーで同じことをする） */
function petrify(fr){
 const {W,H,px,mat}=fr,out=new Uint8ClampedArray(px);
 for(let p=0;p<W*H;p++){if(!px[p*4+3])continue;const l=(px[p*4]*0.3+px[p*4+1]*0.5+px[p*4+2]*0.2)/255;const i=Math.max(0,Math.min(4,Math.round(l*5.2)));const c=RAMP.stone[i];out[p*4]=c[0];out[p*4+1]=c[1];out[p*4+2]=c[2]}
 return {...fr,px:out,mat:mat.map(m=>m==='wisp'?'stone':m)};
}


// ===== 段階5c-1：古い宝、ゴーレム、ミミック、ワーム =====
/** 金貨と宝石の山。size 0..2。光が当たったときだけ、きらめき（'glint'）が光る */
function treasure(size,f){
 const W=[16,24,32][size],H=[10,14,18][size],cx=W/2,base=H-1;
 const P=[];const q=mod(f,4);
 const rx=[5,8,11][size],ry=[2.6,4,5.6][size];
 P.push(E(cx,base-ry*0.6,rx,ry,'gold',{ol:1}));
 if(size>0)P.push(E(cx-rx*0.25,base-ry*1.2,rx*0.6,ry*0.7,'gold',{ol:1}));
 if(size>1)P.push(E(cx+rx*0.2,base-ry*1.6,rx*0.4,ry*0.5,'gold',{ol:1}));
 const fr=raster(W,H,P);
 // 金貨の縁と宝石
 const pts=[];for(let i=0;i<6+size*8;i++){pts.push([Math.round(cx+(hz(i,size,1)-0.5)*rx*1.7),Math.round(base-hz(i,size,2)*ry*1.8)])}
 pts.forEach(([x,y],i)=>{const p=y*W+x;if(x<0||y<0||x>=W||y>=H||!fr.px[p*4+3]||fr.mat[p]==='ol')return;const c=i%5===0?RAMP.gemR[3]:i%7===0?RAMP.gemB[3]:i%9===0?RAMP.gemG[3]:RAMP.gold[i%2?4:1];fr.px[p*4]=c[0];fr.px[p*4+1]=c[1];fr.px[p*4+2]=c[2]});
 // きらめき：コマごとに違う場所
 for(let i=0;i<1+size;i++){const x=Math.round(cx+(hz(i,q,3)-0.5)*rx*1.4),y=Math.round(base-hz(i,q,4)*ry*1.6);const p=y*W+x;if(x<0||y<0||x>=W||y>=H||!fr.px[p*4+3])continue;fr.px[p*4]=255;fr.px[p*4+1]=250;fr.px[p*4+2]=220;fr.mat[p]='glint';
  [[1,0],[-1,0],[0,1],[0,-1]].forEach(([a,b])=>{const xx=x+a,yy=y+b,pp=yy*W+xx;if(xx>=0&&yy>=0&&xx<W&&yy<H&&fr.px[pp*4+3]&&q%2===0){fr.px[pp*4]=255;fr.px[pp*4+1]=236;fr.px[pp*4+2]=160;fr.mat[pp]='glint'}})}
 return {...fr,ax:Math.round(cx),ay:base};
}
// ゴーレム：積み上げた石のブロックの巨人。継ぎ目とルーンがほのかに光る
function golem(dir,act,f){
 const q=mod(f,4),mv=act==='move',at=act==='attack',dead=act==='death';
 const W=46,H=50,cx=23,feet=48;
 const P=[];const glow=[];
 const blk=(x0,y0,x1,y1,top=2)=>{ // 箱：上面は明るく、正面は中間、下と右は暗く
  P.push(PL([[x0,y0],[x1,y0],[x1,y1],[x0,y1]],'gst',2,{ol:1}));
  P.push(PL([[x0+0.5,y0],[x1-0.5,y0],[x1-0.5,y0+top],[x0+0.5,y0+top]],'gst',4));
  P.push(LN(x1-1,y0+top,x1-1,y1-1,'gst',1,{no:1}),LN(x0+1,y1-1,x1-1,y1-1,'gst',1,{no:1}));
 };
 if(dead){
  // 崩れて石の山になる
  const k=Math.min(q,3);
  [[10,44,7,4],[22,45,9,4],[34,44,7,4],[16,40,6,4],[29,40,6,4],[22,36-k,6,4]].forEach(([x,y,w,h],i)=>{if(i<3+k)blk(x-w/2,y-h,x+w/2,y,1)});
  if(k<2)glow.push([22,38]);
  const fr=raster(W,H,P);
  glow.forEach(([x,y])=>{const p=y*W+x;fr.px[p*4]=110;fr.px[p*4+1]=210;fr.px[p*4+2]=240;fr.px[p*4+3]=255;fr.mat[p]='wisp'});
  return {...fr,ax:cx,ay:feet};
 }
 const bob=mv?[0,-1,0,-1][q]:0;
 const lu=mv?[2,0,0,0][q]:0,ru=mv?[0,0,2,0][q]:0;
 if(dir==='side'){
  // 横向き：奥の脚、厚い胴、手前の脚、肩の大岩と大きな腕
  blk(20,36+bob-ru,28,feet-ru,1);blk(19,feet-4-ru,31,feet-ru,1);
  blk(12,32+bob,32,38+bob,2);
  // 胴：背中が丸く盛り上がった厚い塊
  P.push(PL([[10,16+bob],[30,13+bob],[35,18+bob],[33,34+bob],[12,34+bob],[8,24+bob]],'gst',2,{ol:1}));
  P.push(PL([[11,16+bob],[30,13+bob],[33,16+bob],[12,19+bob]],'gst',4));
  [[10,23,34,23],[11,29,33,29],[20,14,20,23],[27,23,27,29],[17,29,17,34]].forEach(([x0,y0,x1,y1])=>P.push(LN(x0,y0+bob,x1,y1+bob,'gst',0,{no:1})));
  P.push(E(14,18+bob,4,1.6,'gmoss',{flat:2}),E(11,27+bob,2,1.4,'gmoss',{flat:1}));
  blk(13,36+bob-lu,21,feet-lu,1);blk(12,feet-4-lu,24,feet-lu,1);
  // 頭：胴の前寄りに沈み、目の溝が前を向く
  blk(27,7+bob,37,16+bob,2);P.push(LN(31,11+bob,37,11+bob,'gst',0,{no:1}));glow.push([34,11+bob],[35,11+bob]);
  // 肩の大岩
  P.push(E(24,17+bob,7.4,6,'gst',{ol:1}),E(23,12.6+bob,4.4,1.8,'gmoss',{flat:2}));
  // 手前の腕（攻撃では振り上げて前へ振り下ろす）
  const ay=at?[0,-16,5,-2][q]:mv?[0,1,0,-1][q]:0;
  const ax=at?[0,0,9,4][q]:mv?[0,1,0,-1][q]:0;
  blk(20+ax*0.3,20+bob+ay*0.4,29+ax*0.3,30+bob+ay*0.6,2);
  blk(21+ax*0.8,29+bob+ay*0.8,32+ax*0.8,39+bob+ay*0.8,2);
  blk(22+ax,37+bob+ay,35+ax,44+bob+ay,2);
  glow.push([24,22+bob],[15,25+bob]);
  const fr=raster(W,H,P);
  glow.forEach(([x,y])=>{x=Math.round(x);y=Math.round(y);const p=y*W+x;if(x>=0&&y>=0&&x<W&&y<H&&fr.px[p*4+3]){fr.px[p*4]=120;fr.px[p*4+1]=225;fr.px[p*4+2]=250;fr.mat[p]='wisp'}});
  return {...fr,ax:cx,ay:feet};
 }
 const back=dir==='up';
 // 脚：短く太い柱と、幅広の足
 blk(13,36+bob-lu,21,feet-lu,1);blk(11,feet-4-lu,22,feet-lu,1);
 blk(25,36+bob-ru,33,feet-ru,1);blk(24,feet-4-ru,35,feet-ru,1);
 blk(14,32+bob,32,38+bob,2);
 // 胴：上が広い台形。ブロックの継ぎ目
 P.push(PL([[7,14+bob],[39,14+bob],[34,33+bob],[12,33+bob]],'gst',2,{ol:1}));
 P.push(PL([[8,14+bob],[38,14+bob],[37,17+bob],[9,17+bob]],'gst',4));
 [[9,21],[11,27]].forEach(([x,y],i)=>P.push(LN(x,y+bob,46-x,y+bob,'gst',0,{no:1})));
 [[18,14,18,21],[28,14,28,21],[14,21,14,27],[23,21,23,27],[32,21,32,27],[19,27,19,33],[27,27,27,33]].forEach(([a,b,c,d])=>P.push(LN(a,b+bob,c,d+bob,'gst',0,{no:1})));
 // 頭：肩に沈んだ小さな塊と、細い目の溝
 blk(18,6+bob,28,15+bob,2);
 if(!back){P.push(LN(19,10+bob,27,10+bob,'gst',0,{no:1}));glow.push([20,10+bob],[21,10+bob],[25,10+bob],[26,10+bob])}
 // 肩の大岩と苔
 P.push(E(9,17+bob,6.4,5.4,'gst',{ol:1}),E(37,17+bob,6.4,5.4,'gst',{ol:1}));
 P.push(E(8,13.6+bob,4,1.6,'gmoss',{flat:2}),E(38,13.6+bob,3.4,1.4,'gmoss',{flat:2}));
 if(back)P.push(E(23,20+bob,5,2,'gmoss',{flat:1}),E(17,29+bob,3,1.4,'gmoss',{flat:2}));
 // 腕：上腕のブロック、太い前腕、大きな拳。攻撃では両腕を振り上げて地面に叩きつける
 const lift=at?[0,-20,6,-4][q]:mv?[0,1,0,-1][q]:0;
 for(const sx of [-1,1]){
  const X=(x)=>sx<0?x:46-x;
  const xs=(a,b)=>sx<0?[a,b]:[46-b,46-a];
  const [u0,u1]=xs(2,10),[f0,f1]=xs(1,11),[h0,h1]=xs(0,12);
  const ly=lift*(at&&q===2?0.6:1);
  const inward=at&&q===2?(sx<0?6:-6):0;
  blk(u0,20+bob+ly*0.3,u1,29+bob+ly*0.5,2);
  blk(f0+inward*0.6,28+bob+ly*0.8,f1+inward*0.6,38+bob+ly*0.8,2);
  blk(h0+inward,37+bob+ly,h1+inward,44+bob+ly,2);
  void X;
 }
 // 胸のルーンと、継ぎ目から漏れる光
 if(!back){
  [[23,20],[23,21],[23,22],[23,23],[23,24],[21,22],[25,22],[22,20],[24,20],[22,24],[24,24],[20,21],[26,21],[20,23],[26,23]].forEach(([x,y])=>glow.push([x,y+bob]));
  glow.push([14,23+bob],[32,25+bob],[19,30+bob]);
 }else glow.push([18,18+bob],[29,24+bob]);
 const fr=raster(W,H,P);
 const pulse=[0,1,2,1][q];
 glow.forEach(([x,y],i)=>{x=Math.round(x);y=Math.round(y);const p=y*W+x;if(x<0||y<0||x>=W||y>=H||!fr.px[p*4+3])return;const b=i<4?255:200+pulse*20;fr.px[p*4]=Math.min(255,90+pulse*10);fr.px[p*4+1]=Math.min(255,b-30);fr.px[p*4+2]=255;fr.mat[p]='wisp'});
 return {...fr,ax:cx,ay:feet};
}
function mimic(dir,act,f){
 const P=[],q=mod(f,4),W=26,H=24,cx=13,base=21;
 const at=act==='attack',mv=act==='move',dead=act==='death';
 const hop=mv?[0,-2,-3,-1][q]:0,open=at?[1,4,6,3][q]:0;
 const by=base+hop,side=dir==='side';
 if(dead){
  P.push(PL([[cx-8,base],[cx-7,base-6],[cx+2,base-7],[cx+8,base-3],[cx+8,base]],'chest',2,{ol:1}),PL([[cx-6,base-8],[cx+1,base-12],[cx+5,base-9]],'chest',1,{ol:1}));
  const fr=raster(W,H,P);[[cx-3,base],[cx,base+1],[cx+4,base],[cx+7,base+1],[cx-6,base+1]].forEach(([x,y])=>{const p=y*W+x;if(y<H){fr.px[p*4]=232;fr.px[p*4+1]=190;fr.px[p*4+2]=70;fr.px[p*4+3]=255;fr.mat[p]='glint'}});
  return {...fr,ax:cx,ay:base};
 }
 const w=side?8:9,h=7;
 // 箱の胴
 P.push(PL([[cx-w,by],[cx-w,by-h],[cx+w,by-h],[cx+w,by]],'chest',2,{ol:1}));
 P.push(LN(cx-w,by-h+2,cx+w,by-h+2,'iron',1,{no:1}),LN(cx-w+2,by,cx-w+2,by-h,'iron',2,{no:1}),LN(cx+w-2,by,cx+w-2,by-h,'iron',2,{no:1}));
 // ふた（開くと牙と舌）
 const ly=by-h-open;
 if(open>0){
  P.push(PL([[cx-w+1,by-h],[cx+w-1,by-h],[cx+w-1,ly+1],[cx-w+1,ly+1]],'capeR',1));
  for(let x=cx-w+2;x<=cx+w-2;x+=2)P.push(D(x,by-h-1,COL.white),D(x+1,ly+2,COL.white));
  P.push(C(cx,by-h-1,cx+(side?6:0),by-h+2+open*0.6,1,'capeR'));
 }
 P.push(PL([[cx-w,ly],[cx-w+1,ly-4],[cx+w-1,ly-4],[cx+w,ly]],'chest',3,{ol:1}),LN(cx-w,ly-1,cx+w,ly-1,'iron',2,{no:1}),D(cx,ly,RAMP.gold[4]),D(cx,ly+1,RAMP.gold[3]));
 const fr=raster(W,H,P);
 if(open>0){[[cx-3,ly+2],[cx+3,ly+2]].forEach(([x,y])=>{const p=Math.round(y)*W+Math.round(x);fr.px[p*4]=255;fr.px[p*4+1]=220;fr.px[p*4+2]=60;fr.px[p*4+3]=255;fr.mat[p]='wisp'})}
 return {...fr,ax:cx,ay:base};
}
/** ワーム：巨大な環形の虫。目はなく、円い口のまわりに牙が輪になって並ぶ。胴の節と尾は wormSeg */
function wormHead(dir,act,f){
 const P=[],q=mod(f,4),at=act==='attack',mv=act==='move';
 const open=at?[0.5,0.85,1,0.7][q]:mv?[0.15,0.3,0.15,0.05][q]:0;
 const W=36,H=34,cx=18;
 const teeth=[];
 if(dir==='side'){
  const by=21;
  // 太い円筒の胴の先が丸くふくらみ、その先端に口が開く
  P.push(C(4,by,20,by,8.2,'flesh',{ol:1}));
  P.push(E(23,by,8.6+open*1.2,9+open*1.4,'flesh',{ol:1}));
  P.push(LN(15,by-8,15,by+8,'fleshD',1,{no:1}),LN(9,by-8,9,by+8,'fleshD',1,{no:1}),LN(3,by-8,3,by+8,'fleshD',1,{no:1}));
  P.push(C(4,by-4.6,18,by-4.6,1.4,'flesh',{flat:4}));
  // 口：先端の唇のひだ。開くと喉の奥と牙の輪が見える
  const mo=1.2+open*5.6;
  P.push(E(30.4,by,1.6+open*1.4,mo,'fleshD',{ol:1}));
  if(open>0.1){P.push(E(31,by,1+open*1.2,mo-1.2,'maw',{flat:0}));for(let i=0;i<5;i++){const yy=by-mo+1+i*(2*mo-2)/4;teeth.push([31.6-Math.abs(i-2)*0.4,yy])}}
  else P.push(LN(30.4,by-mo,30.4,by+mo,'maw',1,{no:1}));
  for(const x of [2,8,14,20])P.push(LN(x,by+8.2,x-1,by+10.4,'fleshD',0,{no:1}));
  const fr=raster(W,H,P);
  teeth.forEach(([x,y])=>{x=Math.round(x);y=Math.round(y);const p=y*W+x;if(x<W&&y>=0&&y<H){fr.px[p*4]=236;fr.px[p*4+1]=226;fr.px[p*4+2]=200;fr.px[p*4+3]=255}});
  return {...fr,ax:12,ay:by+8};
 }
 const back=dir==='up';
 const cy=17;
 if(back){
  // 後ろから見た頭：太い輪の節
  P.push(E(cx,cy,13,12,'flesh',{ol:1}),LN(cx-12,cy-3,cx+12,cy-3,'fleshD',1,{no:1}),LN(cx-12.6,cy+2,cx+12.6,cy+2,'fleshD',1,{no:1}),LN(cx-11,cy+7,cx+11,cy+7,'fleshD',1,{no:1}),E(cx-4,cy-6,4,1.6,'flesh',{flat:4}));
  for(let i=0;i<10;i++){const a=i/10*6.283;P.push(LN(cx+Math.cos(a)*12.4,cy+Math.sin(a)*11.4,cx+Math.cos(a)*14.4,cy+Math.sin(a)*13.2,'fleshD',0,{no:1}))}
  return {...raster(W,H,P),ax:cx,ay:31};
 }
 // 正面：円い口。閉じているとひだが中心で合わさり、開くと牙の輪と喉の奥が見える
 P.push(E(cx,cy,13,12,'flesh',{ol:1}));
 for(let i=0;i<10;i++){const a=i/10*6.283;P.push(LN(cx+Math.cos(a)*12.4,cy+Math.sin(a)*11.4,cx+Math.cos(a)*14.4,cy+Math.sin(a)*13.2,'fleshD',0,{no:1}))}
 P.push(E(cx,cy,10.4,9.6,'fleshD',{flat:2}));
 const r=1+open*8;
 if(open>0.05){
  P.push(E(cx,cy,r,r*0.92,'maw',{flat:1}),E(cx,cy+r*0.15,r*0.55,r*0.5,'maw',{flat:0}));
  const n=12;for(let i=0;i<n;i++){const a=i/n*6.283;teeth.push([cx+Math.cos(a)*(r+0.4),cy+Math.sin(a)*(r+0.4)*0.92]);if(open>0.6&&i%2===0)teeth.push([cx+Math.cos(a+0.26)*r*0.6,cy+Math.sin(a+0.26)*r*0.55])}
 }
 // ひだ（閉じているときは中心で合わさる線）
 if(open<0.5)for(let i=0;i<5;i++){const a=i/5*6.283-1.57;P.push(LN(cx+Math.cos(a)*r,cy+Math.sin(a)*r,cx+Math.cos(a)*9.6,cy+Math.sin(a)*8.8,'flesh',3,{no:1}))}
 const fr=raster(W,H,P);
 teeth.forEach(([x,y])=>{x=Math.round(x);y=Math.round(y);const p=y*W+x;fr.px[p*4]=236;fr.px[p*4+1]=226;fr.px[p*4+2]=200;fr.px[p*4+3]=255});
 return {...fr,ax:cx,ay:31};
}
/**
 * ワームの胴の一節（上から少し斜めに見た、太い環形の胴の輪切り）。r は太さ（半径、3〜12）。
 * v 0 は節の膨らみ（明るい）、v 1 は節と節の間のくびれ（暗い溝）。胴の跡に沿って交互に重ねて、ひと続きの体にする（src/creatureView.ts の drawWorm）
 */
function wormBody(r,v){
 const W=Math.ceil(r*2+5),H=Math.ceil(r*1.7+6),cx=W/2,cy=r*0.8+2.5,P=[];
 if(v===0){
  P.push(E(cx,cy,r,r*0.8,'worm',{ol:1}));
  // 背の淡い帯と、てかり
  P.push(E(cx,cy-r*0.12,r*0.78,r*0.42,'wormB',{flat:1}));
  P.push(E(cx-r*0.28,cy-r*0.34,r*0.34,r*0.16,'wormB',{flat:3}));
  // 両脇の短い剛毛
  if(r>=6)for(const sx of [-1,1])P.push(LN(cx+sx*r*0.98,cy+r*0.1,cx+sx*(r+1.6),cy+r*0.3,'wormD',1,{no:1}));
 }else{
  P.push(E(cx,cy,r*0.94,r*0.74,'wormD',{ol:1}));
  P.push(E(cx,cy-r*0.1,r*0.6,r*0.3,'worm',{flat:1}));
 }
 return {...raster(W,H,P),ax:Math.round(cx),ay:Math.round(cy+r*0.8)};
}
/**
 * ワームの頭：胴の先の太い輪と、進む向き（d 0〜7、右から時計回りに45°ずつ）の側に開く円い口。open 0〜3 で口が開き、牙の輪と喉の奥が見える。
 * 目はない。上から少し斜めに見た姿（胴の節 wormBody と同じ見方と色）
 */
function wormMouth(d,open){
 const r=12,W=34,H=32,cx=17,cy=14,P=[];
 const a=d*Math.PI/4,ux=Math.cos(a),uy=Math.sin(a)*0.8;
 const o=[0.12,0.45,0.75,1][open];
 P.push(E(cx,cy,r,r*0.82,'worm',{ol:1}));
 P.push(E(cx-ux*2,cy-uy*2-1.5,r*0.75,r*0.4,'wormB',{flat:1}));
 // 口の縁（向きの側へ寄った、肉の厚いひだの輪）
 const mx=cx+ux*r*0.48,my=cy+uy*r*0.48+(uy<0?-0.5:0.5);
 const mr=3.2+o*3.8;
 P.push(E(mx,my,mr+1.6,(mr+1.6)*0.82,'wormD',{ol:1}));
 P.push(E(mx,my,mr,mr*0.8,'maw',{flat:o>0.5?0:1}));
 if(o>0.6)P.push(E(mx+ux*0.6,my+uy*0.6,mr*0.5,mr*0.38,'maw',{flat:0}));
 const fr=raster(W,H,P);
 // 牙の輪（開くほど多く、内側にもう一列）
 const n=o<0.3?6:10;
 for(let i=0;i<n;i++){const b=i/n*6.283;setPx(fr,Math.round(mx+Math.cos(b)*(mr-0.4)),Math.round(my+Math.sin(b)*(mr-0.4)*0.8),[236,226,200],false)}
 if(o>0.6)for(let i=0;i<6;i++){const b=i/6*6.283+0.5;setPx(fr,Math.round(mx+Math.cos(b)*mr*0.5),Math.round(my+Math.sin(b)*mr*0.4),[214,204,180],false)}
 return {...fr,ax:cx,ay:Math.round(cy+r*0.82)};
}
/**
 * 岩の下を掘り進むワームが押し上げた岩：盛り上がって割れた岩と、こぼれた小石。v 0〜2 は形の違い、big は頭の上（大きく割れる）
 */
function wormMound(v,big,hard){
 const M=['rockS','rock','rockH'][hard]??'rock',RM=RAMP[M];
 const W=big?30:22,H=big?20:15,cx=W/2,cy=H-5,P=[];
 const R=big?11:7.5;
 P.push(E(cx,cy,R,R*0.55,M,{ol:1}));
 // 割れ目で分かれた岩のかけら
 const k=big?5:3;
 for(let i=0;i<k;i++){const b=(i/k)*6.283+v*1.3;const rr=R*0.5;P.push(E(cx+Math.cos(b)*rr,cy+Math.sin(b)*rr*0.5-1.2,R*0.42,R*0.28,M,{ol:1}))}
 const fr=raster(W,H,P);
 // 割れ目（暗い線）と、まわりにこぼれた小石
 for(let i=0;i<k;i++){const b=(i/k)*6.283+v*1.3+0.6;for(let s=0;s<R*0.8;s+=0.7)setPx(fr,Math.round(cx+Math.cos(b)*s),Math.round(cy-1+Math.sin(b)*s*0.5),RM[0],false)}
 for(let i=0;i<(big?7:4);i++){const b=i*2.4+v;setPx(fr,Math.round(cx+Math.cos(b)*(R+1.5)),Math.round(cy+Math.sin(b)*(R*0.55+1)),RM[2],false)}
 return {...fr,ax:Math.round(cx),ay:H-1};
}
function wormSeg(kind,f){
 const P=[],W=28,H=24,cx=14,base=20;
 const r=kind===1?6:10;
 P.push(E(cx,base-r*0.8,r,r*0.8,'flesh',{ol:1}));
 // 輪の溝
 P.push(LN(cx-r*0.95,base-r*0.8,cx+r*0.95,base-r*0.8,'fleshD',1,{no:1}));
 if(kind===0){P.push(LN(cx-r*0.8,base-r*1.3,cx+r*0.8,base-r*1.3,'fleshD',1,{no:1}),LN(cx-r*0.8,base-r*0.3,cx+r*0.8,base-r*0.3,'fleshD',1,{no:1}))}
 P.push(E(cx-r*0.3,base-r*1.2,r*0.4,r*0.18,'flesh',{flat:4}));
 // 両脇の剛毛
 for(const sx of [-1,1])for(const dy of [0.5,1.1])P.push(LN(cx+sx*r*0.95,base-r*dy,cx+sx*(r+2),base-r*dy+1,'fleshD',0,{no:1}));
 return {...raster(W,H,P),ax:cx,ay:base};
}


// ===== 段階5c-2：ワイバーン、ドラゴン、炎の吐息 =====
function putGlow(fr,pts,c){const {W,H,px,mat}=fr;pts.forEach(([x,y])=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=W||y>=H)return;const p=y*W+x;px[p*4]=c[0];px[p*4+1]=c[1];px[p*4+2]=c[2];px[p*4+3]=255;mat[p]='wisp'})}
/** 翼の膜（肩、指の先、付け根の点を結ぶ）と、指の骨 */
function wing(P,sh,tips,root,mem,bone){
 const pts=[sh];tips.forEach((t,i)=>{pts.push(t);if(i<tips.length-1){const n=tips[i+1];pts.push([(t[0]+n[0])/2+(root[0]-sh[0])*0.12,(t[1]+n[1])/2+(root[1]-sh[1])*0.2])}});pts.push(root);
 P.push(PL(pts,mem,2,{ol:1}));tips.forEach(t=>P.push(LN(sh[0],sh[1],t[0],t[1],bone,1,{no:1})));
}
function wyvern(dir,act,f){
 const P=[],q=mod(f,4),dead=act==='death',at=act==='attack';
 const W=52,H=44,cx=26;
 const flap=dead?0:[0,1,2,1][q];
 const by=22+(at?[0,2,4,2][q]:[0,-1,0,1][q]);
 if(dead){
  // 落ちて地面に伏せる
  P.push(PL([[8,38],[20,30],[26,36],[16,40]],'wyvW',1,{ol:1}),PL([[44,38],[32,30],[26,36],[36,40]],'wyvW',1,{ol:1}));
  P.push(E(26,37,7,3.4,'wyv',{ol:1}),C(20,38,8,41,1.4,'wyv'),C(32,36,40,33,1.8,'wyv'),E(42,33,3,2.2,'wyv',{ol:1}));
  return {...raster(W,H,P),ax:cx,ay:41};
 }
 if(dir==='side'){
  const up=[[-14,-14],[-6,-6],[2,6]][flap],tipY=by+up[0];
  wing(P,[24,by-3],[[14,tipY-4],[6,tipY+2],[4,by+up[1]+6]],[22,by+3],'wyvW','wyvD');
  // 尾（先に毒針）
  P.push(C(18,by+2,10,by+6,2,'wyv'),C(10,by+6,3,by+4,1.3,'wyv'),PL([[3,by+2.4],[0,by+4],[3,by+5.6]],'horn',3));
  P.push(E(24,by+1,7,4.6,'wyv',{ol:1}),E(24,by+3.4,5.6,1.6,'wyvD',{flat:2}));
  // 脚と爪（襲うときは前へ突き出す）
  const tl=at?[0,3,5,2][q]:0;
  P.push(C(22,by+4,22+tl,by+9+tl*0.4,1.3,'wyv'),C(26,by+4,27+tl,by+9+tl*0.4,1.3,'wyv'));
  P.push(D(22+tl,by+10+tl*0.4,RAMP.horn[3]),D(27+tl,by+10+tl*0.4,RAMP.horn[3]));
  // 首と頭
  P.push(C(29,by-1,35,by-6,2,'wyv'),E(38,by-7.4,4,2.6,'wyv',{ol:1}),C(40,by-6.6,45,by-5.6,1.4,'wyv'),C(36,by-9,32,by-12,0.9,'horn'));
  if(at&&q>0)P.push(LN(41,by-5,45,by-4,'maw',1,{no:1}));
  const near=[[-16,-12],[-4,-4],[6,8]][flap];
  wing(P,[26,by-3],[[34,by+near[0]-2],[42,by+near[0]+4],[44,by+near[1]+8]],[26,by+3],'wyvW','wyvD');
  const fr=raster(W,H,P);putGlow(fr,[[39,by-8]],[250,210,60]);
  return {...fr,ax:cx,ay:by+12};
 }
 const back=dir==='up';
 const span=[[-12,-8,2],[-4,-2,6],[4,4,8]][flap];
 for(const sx of [-1,1]){const X=(x)=>cx+sx*x;wing(P,[X(4),by-2],[[X(14),by+span[0]],[X(23),by+span[1]],[X(22),by+span[2]+4]],[X(3),by+4],back?'wyv':'wyvW','wyvD')}
 P.push(C(cx,by+4,cx+(back?0:0),by+(back?14:12),1.8,'wyv'),PL([[cx-1.6,by+(back?14:12)],[cx,by+(back?17:15)],[cx+1.6,by+(back?14:12)]],'horn',3));
 P.push(E(cx,by,5,6,'wyv',{ol:1}));
 if(!back){P.push(C(cx,by-4,cx,by-9,2,'wyv'),E(cx,by-11,3.4,3,'wyv',{ol:1}),C(cx,by-9,cx,by-6.6,1.6,'wyv'),C(cx-2,by-13,cx-4,by-16,0.9,'horn'),C(cx+2,by-13,cx+4,by-16,0.9,'horn'));
  const tl=at?[0,2,4,2][q]:0;P.push(C(cx-2,by+4,cx-2,by+8+tl,1.2,'wyv'),C(cx+2,by+4,cx+2,by+8+tl,1.2,'wyv'))}
 else P.push(C(cx,by-4,cx,by-8,2,'wyv'),E(cx,by-10,3,2.6,'wyv',{ol:1}),C(cx-2,by-11,cx-4,by-14,0.9,'horn'),C(cx+2,by-11,cx+4,by-14,0.9,'horn'));
 const fr=raster(W,H,P);if(!back)putGlow(fr,[[cx-1.4,by-11.4],[cx+1.4,by-11.4]],[250,210,60]);
 return {...fr,ax:cx,ay:by+12};
}

/** うろこの模様：体のピクセルに、ずらした格子状の暗い点を打つ */
function scales(fr,mats,salt){
 const {W,H,px,mat}=fr;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=y*W+x;if(!mats.includes(mat[p]))continue;
  const on=((x+(((y/2)|0)%2)*2)%4===0&&y%2===0)||hz(x,y,salt)<0.06;
  if(!on)continue;const m=RAMP[mat[p]];const c=[px[p*4],px[p*4+1],px[p*4+2]];let i=m.findIndex(r=>r[0]===c[0]&&r[1]===c[1]&&r[2]===c[2]);if(i<=0)continue;const d=m[i-1];px[p*4]=d[0];px[p*4+1]=d[1];px[p*4+2]=d[2]}
}
/** ドラゴン：四本の太い脚で地面を踏みしめる重たい体。翼は肩からたたんで脇腹に垂らす。
 * idle = 宝の山の上で体を丸めて眠る、move = 歩く、attack = 地面へ炎を吐きつける、fly = 翼を広げて飛ぶ */
function dragon(dir,act,f){
 const P=[],q=mod(f,4),W=100,H=78,G=72;
 const glow=[];const smoke=[];
 const spike=(x,y,h,m='drgD')=>P.push(PL([[x-1.6,y],[x+0.4,y-h],[x+1.6,y]],m,2,{ol:1}));
 const claws=(x,y,dirx)=>{for(let i=0;i<3;i++)P.push(LN(x+i*2*dirx,y,x+i*2*dirx+dirx,y+1,'horn',2,{no:1}))};
 const fin=(fr)=>{scales(fr,['drg','drgD'],7);putGlow(fr,glow,[255,190,70]);smoke.forEach(([x,y,c])=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=W||y>=H)return;const p=y*W+x;fr.px[p*4]=c;fr.px[p*4+1]=c;fr.px[p*4+2]=c+6;fr.px[p*4+3]=255;fr.mat[p]='smoke'});return fr};
 if(act==='death'){
  P.push(PL([[18,G],[30,56],[52,54],[70,58],[78,G]],'drgW',1,{ol:1}));
  P.push(PL([[22,G-2],[34,60],[62,60],[72,G-2]],'drg',2,{ol:1}),C(22,G-3,4,G-1,3,'drg'),C(70,G-4,86,G-2,3.4,'drg'),PL([[84,G-6],[94,G-4],[92,G],[84,G]],'drg',2,{ol:1}));
  return {...fin(raster(W,H,P)),ax:50,ay:G};
 }
 if(act==='idle'){
  // 体を丸めて眠る：尾は体の前を回って頭のそばへ、頭は前脚の上、翼はたたんで背にかぶせる
  const br=[0,0,1,0][q];
  P.push(PL([[18,54],[26,40],[44,34],[66,36],[78,46],[74,58],[50,62],[26,62]],'drg',2,{ol:1}));
  P.push(E(46,50,22,10,'drg',{ol:1}));
  // たたんだ翼（背にかぶせた膜と指の骨）。寝息でわずかに上下する
  const wy=-br;
  P.push(PL([[22,48],[30,32+wy],[46,26+wy],[64,30+wy],[74,42],[60,46],[40,48]],'drgW',2,{ol:1}));
  [[46,26+wy,28,46],[46,26+wy,40,47],[46,26+wy,54,46],[46,26+wy,68,42]].forEach(([a,b,c,d])=>P.push(LN(a,b,c,d,'drgD',1,{no:1})));
  P.push(C(46,26+wy,50,24+wy,1.2,'drgD'),PL([[50,24+wy],[53,20+wy],[52,25+wy]],'horn',3,{ol:1}));
  for(let x=26;x<=68;x+=6){const yy=x<46?38-(x-26)*0.5:28+(x-46)*0.55;spike(x,yy+wy,3)}
  // 尾：体の前を回って右へ
  P.push(C(20,56,24,64,5,'drg'),C(24,64,44,68,4.4,'drg'),C(44,68,64,67,3.4,'drg'),C(64,67,72,64,2.4,'drg'),PL([[71,61],[78,63],[72,67]],'drgD',2,{ol:1}));
  [[28,61],[38,64],[50,64],[60,63]].forEach(([x,y])=>spike(x,y,2.4));
  // 前脚と、その上にのせた頭
  P.push(C(66,56,78,62,3.4,'drg'),PL([[76,59],[84,60],[84,64],[76,64]],'drg',2,{ol:1}));claws(80,64,1);
  P.push(C(66,50,74,52,5,'drg'));
  P.push(PL([[70,48],[80,46],[90,50],[92,54],[86,57],[72,57]],'drg',2,{ol:1}),PL([[72,57],[88,57],[86,59],[74,59]],'drgD',2,{ol:1}));
  P.push(LN(78,51,82,51,'drgD',0,{no:1}),PL([[74,48],[66,41],[69,47]],'horn',3,{ol:1}),PL([[78,47],[73,39],[75,46]],'horn',3,{ol:1}));
  // 鼻から漏れる煙（寝息）
  const sm=[[94,53],[96,50],[95,47],[97,44]];for(let i=0;i<=q;i++){const [x,y]=sm[i];smoke.push([x,y,70+i*12])}
  return {...fin(raster(W,H,P)),ax:50,ay:G};
 }
 const fly=act==='fly',at=act==='attack';
 const step=act==='move'?q:0;
 const bob=act==='move'?[0,-1,0,-1][q]:0;
 if(fly){
  // 翼を大きく広げて飛ぶ（上から見たような姿）。頭が上の絵を基準に描き、向きに合わせて座標を変える：
  // up = 頭が画面の上（後頭部が見える）、down = 頭が画面の下（顔と光る目が見える）、side = 頭が右（翼は上下に広がる。左向きは描くときに反転）
  const flap=[0,1,2,1][q],up=[-8,0,8,0][q];
  const cy=34;
  const back=dir==='up',side=dir==='side';
  const FW=100,FH=side?104:78,sc=52;
  const T=side?(x,y)=>[50+(cy-y),sc+(x-50)]:dir==='down'?(x,y)=>[x,2*cy-y+8]:(x,y)=>[x,y];
  const tp=(pts)=>pts.map(([x,y])=>T(x,y));
  const tC=(x0,y0,x1,y1,r,m)=>{const [a,b]=T(x0,y0),[c,d]=T(x1,y1);return C(a,b,c,d,r,m)};
  const tL=(x0,y0,x1,y1,m,i,o)=>{const [a,b]=T(x0,y0),[c,d]=T(x1,y1);return LN(a,b,c,d,m,i,o)};
  const tE=(x,y,rx,ry,m,o)=>{const [a,b]=T(x,y);return side?E(a,b,ry,rx,m,o):E(a,b,rx,ry,m,o)};
  for(const sx of [-1,1]){const X=(x)=>50+sx*x;
   const pts=[[X(6),cy-4],[X(20),cy-16+up],[X(34),cy-24+up*1.4],[X(48),cy-18+up*1.6],[X(42),cy-6+up],[X(46),cy+4+up*0.6],[X(34),cy+2],[X(30),cy+10],[X(18),cy+6],[X(12),cy+8]];
   P.push(PL(tp(pts),'drgW',2,{ol:1}));
   [[X(34),cy-24+up*1.4],[X(48),cy-18+up*1.6],[X(46),cy+4+up*0.6],[X(30),cy+10]].forEach(([tx,ty])=>P.push(tL(X(20),cy-16+up,tx,ty,'drgD',1,{no:1})));
   P.push(tC(X(6),cy-4,X(20),cy-16+up,1.6,'drg'));}
  P.push(tC(50,cy+6,50,cy+26,4,'drg'),tC(50,cy+26,52,cy+34,2.6,'drg'),PL(tp([[48,cy+34],[52,cy+40],[56,cy+34]]),'drgD',2,{ol:1}));
  P.push(tE(50,cy,8,12,'drg',{ol:1}));
  for(let y=cy-8;y<=cy+20;y+=5)P.push(PL(tp([[48.4,y],[50.4,y-3],[51.6,y]]),'drgD',2,{ol:1}));
  if(!back){P.push(tC(50,cy-10,50,cy-22,4,'drg'),PL(tp([[45,cy-22],[55,cy-22],[54,cy-32],[46,cy-32]]),'drg',2,{ol:1}),PL(tp([[46,cy-26],[40,cy-20],[45,cy-23]]),'horn',3),PL(tp([[54,cy-26],[60,cy-20],[55,cy-23]]),'horn',3));glow.push(T(48,cy-27),T(52,cy-27))}
  else P.push(tC(50,cy-10,50,cy-20,4,'drg'),PL(tp([[46,cy-20],[54,cy-20],[53,cy-28],[47,cy-28]]),'drg',2,{ol:1}));
  // 足元の基準点（影の位置）は、体の中心から32px下
  const [,by0]=T(50,cy);
  return {...fin(raster(FW,FH,P)),ax:50,ay:Math.round(by0)+32};
 }
 if(dir==='side'){
  const lf=[2,0,-2,0][step],lh=-lf;
  const bob0=bob;{const bob=bob0+6;
  const hd=at?[0,1,1,1][q]:0,jaw=at&&q>0?4:0,fw=at?[0,3,4,3][q]:0;
  // 奥の翼（背の上に指先の山がのぞく）
  P.push(PL([[52,28+bob],[40,12+bob],[22,24+bob],[30,30+bob],[46,32+bob]],'drgD',2,{ol:1}));
  // 尾（太く、先に鋤形の飾り）
  // 尾：腰から後ろへ水平にのび、ゆるいS字を描いて先をわずかに持ち上げる。歩くと揺れる
  const sw=[0,1,0,-1][step];
  P.push(C(22,42+bob,10,47+bob,5.4,'drg'),C(10,47+bob,-4,49+bob+sw,4,'drg'),C(-4,49+bob+sw,-14,47+bob+sw*1.6,2.8,'drg'),C(-14,47+bob+sw*1.6,-18,43+bob+sw*2,2,'drg'));
  P.push(PL([[-21,43+bob+sw*2],[-19,37+bob+sw*2],[-15,41+bob+sw*2],[-18,45+bob+sw*2]],'drgD',2,{ol:1}));
  [[16,41],[6,44],[-4,45+sw],[-12,43+sw]].forEach(([x,y])=>spike(x,y+bob,2.8));
  // 奥の脚
  P.push(C(28,48+bob,24-lh,62,5,'drgD'),C(24-lh,62,26-lh,G-2,3.8,'drgD'),PL([[23-lh,G-3],[34-lh,G-3],[35-lh,G],[23-lh,G]],'drgD',2,{ol:1}));
  P.push(C(60,48+bob,62-lf,62,4.2,'drgD'),C(62-lf,62,62-lf,G-2,3.4,'drgD'),PL([[59-lf,G-3],[69-lf,G-3],[69-lf,G],[59-lf,G]],'drgD',2,{ol:1}));
  // 胴：胸が高く、腹が垂れ、腰へ細る
  P.push(PL([[18,44+bob],[24,34+bob],[42,28+bob],[58,30+bob],[68,38+bob],[68,48+bob],[58,56+bob],[34,58+bob],[22,54+bob]],'drg',2,{ol:1}));
  P.push(E(44,44+bob,22,12,'drg',{}));
  for(let x=28;x<=58;x+=5)P.push(LN(x,52+bob,x+1,57+bob,'drgB',2,{no:1}));
  P.push(PL([[26,54+bob],[60,52+bob],[58,56+bob],[34,58+bob]],'drgB',2));
  // 首と頭（炎を吐くときは頭を下げて口を開く）
  const hx=82+fw,hy=20+bob+hd;
  P.push(C(62,38+bob,72,28+bob+hd*0.4,6,'drg'),C(72,28+bob+hd*0.4,hx-6,hy+3,4.6,'drg'));
  [[60,30],[66,26],[71,23]].forEach(([x,y])=>spike(x,y+bob+hd*0.3,3.4));
  P.push(PL([[hx-8,hy-2],[hx+2,hy-4],[hx+10,hy],[hx+12,hy+3],[hx+2,hy+4],[hx-8,hy+5]],'drg',2,{ol:1}));
  P.push(PL([[hx-6,hy+4],[hx+10,hy+4+jaw*0.4],[hx+8,hy+7+jaw],[hx-4,hy+8]],'drgD',2,{ol:1}));
  if(jaw){P.push(PL([[hx-2,hy+4],[hx+10,hy+4],[hx+8,hy+6+jaw*0.8],[hx-2,hy+6]],'maw',1));for(let x=hx;x<=hx+8;x+=2)P.push(D(x,hy+4,RAMP.horn[4]),D(x+1,hy+6+jaw*0.6,RAMP.horn[4]))}
  P.push(LN(hx-6,hy-1,hx+4,hy-2,'drgD',0,{no:1}),PL([[hx-6,hy-2],[hx-16,hy-10],[hx-12,hy-3]],'horn',3,{ol:1}),PL([[hx-2,hy-3],[hx-10,hy-12],[hx-6,hy-3]],'horn',3,{ol:1}));
  glow.push([hx-1,hy]);
  if(jaw)glow.push([hx+11,hy+6]);
  // 手前の脚：太い腿、関節、鉤爪
  P.push(E(28,48+bob,9,9,'drg',{ol:1}),C(28,52+bob,22+lh,63,5,'drg'),C(22+lh,63,26+lh,G-2,3.8,'drg'),PL([[22+lh,G-3],[35+lh,G-3],[36+lh,G],[22+lh,G]],'drg',2,{ol:1}));claws(30+lh,G,1);
  P.push(E(60,46+bob,7,7,'drg',{ol:1}),C(60,50+bob,64+lf,63,4.2,'drg'),C(64+lf,63,64+lf,G-2,3.4,'drg'),PL([[60+lf,G-3],[71+lf,G-3],[72+lf,G],[60+lf,G]],'drg',2,{ol:1}));claws(66+lf,G,1);
  // 手前の翼：肩から腕の骨が上へ、手首の山から指の骨が下りて、膜が脇腹にかかる
  const wr=[40,8+bob];
  P.push(PL([[58,32+bob],wr,[20,26+bob],[22,38+bob],[30,46+bob],[46,44+bob],[56,40+bob]],'drgW',2,{ol:1}));
  P.push(C(58,32+bob,wr[0],wr[1],1.8,'drgD'),PL([[wr[0],wr[1]],[wr[0]-3,wr[1]-4],[wr[0]+1,wr[1]-1]],'horn',3,{ol:1}));
  [[20,26],[22,38],[30,46],[46,44]].forEach(([x,y])=>P.push(LN(wr[0],wr[1],x,y+bob,'drgD',1,{no:1})));
  }
  // 尾を長くのばせるよう、横向きは左に余白をとる
  const OX=24;
  for(const p of P){if(p.t==='e'||p.t==='d')p.x+=OX;else if(p.t==='c'||p.t==='l'){p.x0+=OX;p.x1+=OX}else if(p.t==='p')p.pts=p.pts.map(([x,y])=>[x+OX,y])}
  glow.forEach(g=>{g[0]+=OX});
  return {...fin(raster(W+OX,H,P)),ax:50+OX,ay:G};
 }
 const back=dir==='up';
 const lf=[2,0,-2,0][step];
 const legs=(xs,yTop,yFoot,thick,m,lift)=>{for(const [x,l] of xs){P.push(E(x,yTop,thick+2,thick+1.6,m,{ol:1}),C(x,yTop+2,x+(x<50?-1:1),yFoot-2+l,thick,m),PL([[x-thick-1,yFoot-3+l],[x+thick+1,yFoot-3+l],[x+thick+1,yFoot+l],[x-thick-1,yFoot+l]],m,2,{ol:1}));for(let i=-1;i<=1;i++)P.push(D(x+i*2,yFoot+1+l,RAMP.horn[3]))}};
 if(!back){
  // 正面（こちらへ向かう）：胸を張り、首をS字に持ち上げて、頭は肩より高い位置からこちらを見下ろす
  const hd=at?[0,2,3,2][q]:0,op=at&&q>0;
  // 尾（奥で片側へのぞく）と、奥の後ろ脚
  P.push(C(60,34+bob,74,26,3.6,'drgD'),C(74,26,82,30,2.4,'drgD'),PL([[80,26],[88,30],[82,33]],'drgD',2,{ol:1}));
  legs([[34,-lf],[66,lf]],44+bob,58,3.4,'drgD',0);
  // 背中（胸の向こうに盛り上がる）ととげ
  P.push(E(50,40+bob,17,10,'drg',{ol:1}));
  [[38,32],[44,30],[56,30],[62,32]].forEach(([x,y])=>spike(x,y+bob,3));
  // たたんだ翼：手首の山が肩の外側に高く立ち、膜が脇腹に沿って垂れる
  for(const sx of [-1,1]){const X=(x)=>50+sx*x;
   P.push(PL([[X(12),40+bob],[X(24),18+bob],[X(28),32+bob],[X(26),46+bob],[X(18),54+bob]],'drgW',2,{ol:1}));
   P.push(C(X(12),40+bob,X(24),18+bob,1.6,'drgD'),PL([[X(24),18+bob],[X(25),12+bob],[X(26),19+bob]],'horn',3,{ol:1}));
   [[X(28),32],[X(26),46],[X(18),54]].forEach(([x,y])=>P.push(LN(X(24),18+bob,x,y+bob,'drgD',1,{no:1})));}
  // 前脚：張り出した胸の下に踏みしめる
  legs([[38,lf],[62,-lf]],52+bob,G-4,4.4,'drg',0);
  // 胸：前に張り出し、腹の板が縦に並ぶ
  P.push(E(50,50+bob,13,10,'drg',{ol:1}),PL([[45,42+bob],[55,42+bob],[56,58+bob],[44,58+bob]],'drgB',2));
  for(let y=45;y<=57;y+=3)P.push(LN(45,y+bob,55,y+bob,'drgB',1,{no:1}));
  // 首：胸から持ち上がり、少しS字に。喉には腹の板が続く
  P.push(C(50,46+bob,52,36+bob+hd,5.6,'drg'),C(52,36+bob+hd,50,28+bob+hd,5,'drg'));
  P.push(PL([[47,44+bob],[53,44+bob],[53,30+bob+hd],[47,30+bob+hd]],'drgB',2));
  for(let y=32;y<=42;y+=3)P.push(LN(47,y+bob+hd*(y<38?1:0),53,y+bob+hd*(y<38?1:0),'drgB',1,{no:1}));
  // 頭：高い位置からこちらを見下ろす。広い眉の張り出しから、こちらへ向かって鼻先が細く長くのびる
  const hy=16+bob+hd;
  // 頬のひれ（後ろへ流れる）と角
  P.push(PL([[41,hy-1],[32,hy-5],[35,hy-1],[40,hy+3]],'drgD',2,{ol:1}),PL([[59,hy-1],[68,hy-5],[65,hy-1],[60,hy+3]],'drgD',2,{ol:1}));
  P.push(C(43,hy-6,38,hy-12,1.8,'horn'),C(38,hy-12,36,hy-18,1.1,'horn'),C(57,hy-6,62,hy-12,1.8,'horn'),C(62,hy-12,64,hy-18,1.1,'horn'));
  // 頭骨と眉
  P.push(PL([[41,hy-7],[59,hy-7],[61,hy-2],[57,hy+3],[43,hy+3],[39,hy-2]],'drg',2,{ol:1}));
  // 下あご（開くと牙と喉の奥）
  if(op){P.push(PL([[44,hy+8],[56,hy+8],[55,hy+16],[45,hy+16]],'drgD',2,{ol:1}),PL([[45,hy+9],[55,hy+9],[54,hy+14],[46,hy+14]],'maw',1));for(let x=45;x<=55;x+=2)P.push(D(x,hy+9,RAMP.horn[4]),D(x,hy+14,RAMP.horn[4]))}
  // 鼻先：こちらへ向かって細く長く
  P.push(PL([[43,hy+1],[57,hy+1],[55,hy+10+(op?-1:0)],[52,hy+12+(op?-1:0)],[48,hy+12+(op?-1:0)],[45,hy+10+(op?-1:0)]],'drg',2,{ol:1}));
  P.push(LN(50,hy-5,50,hy+8,'drg',4,{no:1}));
  // 眉の稜線（V字）と、口の線、鼻孔
  P.push(LN(41,hy-5,47,hy-2,'drgD',0,{no:1}),LN(59,hy-5,53,hy-2,'drgD',0,{no:1}));
  if(!op)P.push(LN(44,hy+5,46,hy+10,'drgD',0,{no:1}),LN(56,hy+5,54,hy+10,'drgD',0,{no:1}));
  P.push(D(48,hy+10,RAMP.drgD[0]),D(52,hy+10,RAMP.drgD[0]));
  glow.push([45,hy-2],[46,hy-2],[55,hy-2],[54,hy-2]);
  return {...fin(raster(W,H,P)),ax:50,ay:G};
 }
 // 後ろ姿（向こうへ進む）：画面の下ほど手前。頭（いちばん奥）→ 首 → 前脚 → 背中と翼 → 後ろ脚 → 尾（いちばん手前）
 P.push(C(50,24+bob,50,16+bob,5.4,'drg'));
 P.push(PL([[42,4+bob],[58,4+bob],[61,11+bob],[56,18+bob],[44,18+bob],[39,11+bob]],'drg',2,{ol:1}),LN(44,8+bob,56,8+bob,'drgD',0,{no:1}));
 P.push(PL([[43,7+bob],[33,1+bob],[41,9+bob]],'horn',3,{ol:1}),PL([[57,7+bob],[67,1+bob],[59,9+bob]],'horn',3,{ol:1}));
 for(let y=14;y<=22;y+=4)spike(50,y+bob,2.6);
 legs([[38,lf],[64,-lf]],24+bob,38,3.6,'drgD',0);
 P.push(PL([[38,22+bob],[62,22+bob],[68,36+bob],[66,52+bob],[34,52+bob],[32,36+bob]],'drg',2,{ol:1}));
 for(const sx of [-1,1]){const X=(x)=>50+sx*x;
  P.push(PL([[X(8),26+bob],[X(19),20+bob],[X(25),32+bob],[X(23),44+bob],[X(16),51+bob],[X(10),42+bob]],'drgW',2,{ol:1}));
  P.push(C(X(8),26+bob,X(19),20+bob,1.6,'drgD'),PL([[X(19),20+bob],[X(21),16+bob],[X(21),21+bob]],'horn',3,{ol:1}));
  [[X(25),32],[X(23),44],[X(16),51]].forEach(([x,y])=>P.push(LN(X(19),20+bob,x,y+bob,'drgD',1,{no:1})));}
 for(let y=24;y<=50;y+=5)spike(50,y+bob,3.4);
 legs([[36,-lf],[64,lf]],52+bob,G-4,4.4,'drg',0);
 // 尾：手前へ伸びて片側へ流れる
 P.push(C(50,50+bob,48+lf,60,5,'drg'),C(48+lf,60,42+lf,68,3.6,'drg'),C(42+lf,68,34+lf,72,2.4,'drg'),PL([[30+lf,69],[33+lf,76],[37+lf,71]],'drgD',2,{ol:1}));
 [[49,56],[46,63],[40,69]].forEach(([x,y])=>spike(x+lf,y,2.8));
 return {...fin(raster(W,H,P)),ax:50,ay:G};
}
/** 炎の吐息：大きく開いた口から前方斜め下へ噴き出す太い炎の柱が、地面に当たって火の海になって広がる。
 * 火の海は床の上の燃える範囲から、高さも形もばらばらな炎の舌が立ち上がり、先端は揺れてちぎれ、煙に変わる。
 * side：drop = 口の高さ（地面から）。down：口からこちらへ噴き下ろす。ax,ay は口の位置 */
function fireBreath(dir,f,drop=24,jetOnly=false){
 const q=mod(f,4),side=dir==='side';
 const C5=[[255,250,224],[255,220,110],[255,156,48],[230,86,28],[140,40,20]];
 const SMK=[[58,50,52],[40,34,38]];
 let W,H;
 if(side){W=124;H=drop+34}else{W=90;H=Math.max(10,drop)+70}
 const px=new Uint8ClampedArray(W*H*4),mat=new Array(W*H).fill(null);
 const rank=(r,g,b)=>C5.findIndex(c=>c[0]===r&&c[1]===g&&c[2]===b);
 const put=(x,y,ci,over)=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=W||y>=H)return;const p=y*W+x;ci=Math.max(0,Math.min(4,ci));if(px[p*4+3]&&!over){const old=rank(px[p*4],px[p*4+1],px[p*4+2]);if(old>=0&&old<=ci)return}const c=C5[ci];px[p*4]=c[0];px[p*4+1]=c[1];px[p*4+2]=c[2];px[p*4+3]=255;mat[p]='wisp'};
 const smoke=(x,y,i)=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=W||y>=H)return;const p=y*W+x;if(px[p*4+3])return;const c=SMK[i];px[p*4]=c[0];px[p*4+1]=c[1];px[p*4+2]=c[2];px[p*4+3]=255;mat[p]='smoke'};
 // 炎の舌一本：根元は太く明るく、上へ行くほど細く赤く、揺れながらちぎれる
 const tongue=(bx,by,h,w,ph)=>{
  for(let y=0;y<h;y++){const v=y/h,ww=w*(1-Math.pow(v,1.25))+0.4,sx=Math.sin(y*0.42+ph+q*1.3)*v*2.2;
   if(v>0.7&&hz(Math.round(bx),y,Math.round(ph*10)+q)<0.35)continue;
   for(let x=-ww;x<=ww;x+=1){const e=Math.abs(x)/ww;put(bx+x+sx,by-y,Math.floor(v*2.8+e*1.3-0.2),true)}}
  // 先端からちぎれた炎と煙
  if(hz(Math.round(bx),Math.round(by),q+7)<0.6)put(bx+Math.sin(ph+q)*2.4,by-h-1-hz(Math.round(bx),q,3)*3,3,true);
  for(let k=0;k<2;k++)if(hz(Math.round(bx)+k,Math.round(by),q+11)<0.5)smoke(bx+Math.sin(ph*2+q+k)*3,by-h-3-k*2-hz(k,q,5)*3,k);
 };
 // 床の上の火の海：中心 (cx,cy)、前方 L、奥行き方向の広がり zr(u)。screen(u,z) で画面上の点に
 const sea=(L,screen,zr,hmax,n)=>{
  // 熾火の床
  for(let i=0;i<L;i++){const u=i/L,r=zr(u);for(let z=-r;z<=r;z+=1){const nn=hz(i>>1,Math.round(z)+30,q*5+3);if(nn<u*0.7+0.15)continue;const [x,y]=screen(u,z);put(x,y,nn>0.85?2:nn>0.6?3:4)}}
  // 炎の舌：当たった所ほど高く密に、先へ行くほど低くまばらに。奥から手前へ
  const src=[];for(let k=0;k<n;k++){const u=Math.pow(hz(k,q,31),1.4),z=(hz(k,q,32)*2-1)*zr(u)*0.9;src.push([u,z])}
  src.push([0,0],[0.04,-zr(0.04)*0.5],[0.04,zr(0.04)*0.5]);
  src.sort((a,b)=>screen(a[0],a[1])[1]-screen(b[0],b[1])[1]);
  src.forEach(([u,z],k)=>{const [x,y]=screen(u,z);const h=hmax*(1-u*0.65)*(0.55+0.55*hz(k,q,33));tongue(x,y,h,1.6+(1-u)*1.8,k*1.7)});
 };
 if(side){
  const my=4,gy=my+drop,ix=Math.max(18,drop*1.3);
  // 噴き出す柱：口から前方斜め下へ、太くなりながら
  const ln=Math.hypot(ix,drop),nx=-drop/ln,ny=ix/ln;
  for(let i=0;i<=ix;i++){const u=i/ix,cx=i,cy=my+u*drop,w=2.6+u*6+Math.sin(i*0.7+q*2)*1.1;
   for(let d=-w;d<=w;d+=0.5){const n=hz(i>>1,Math.round(d)+q*9,13);if(Math.abs(d)>w*0.6&&n<0.45)continue;put(cx+d*nx,cy+d*ny,Math.floor(Math.abs(d)/w*2.6+u*0.6+(n-0.5)*1.2))}}
  for(let k=0;k<10;k++){const u=hz(k,q,21),a=hz(k,q,22)*6.28,r=6+hz(k,q,23)*7;put(u*ix+Math.cos(a)*r*0.6,my+u*drop+Math.sin(a)*r*0.6,2+Math.floor(hz(k,q,24)*2))}
  // 火の海（床は奥行きがつぶれて見える）
  const L=W-ix-6;
  if(!jetOnly)sea(L,(u,z)=>[ix-4+u*L,gy+z*0.5],(u)=>3+Math.sin(Math.min(1,u*1.3)*Math.PI*0.8)*9,16,46);
  return {W,H,px,mat,ax:0,ay:my};
 }
 // 正面：高い口から地面へ噴き下ろし、こちらへ向かって火の海が広がる（画面の下ほど手前）
 const cx=W/2,my=2,sl=Math.max(10,drop);
 for(let i=0;i<sl;i++){const u=i/sl,w=2.4+u*5+Math.sin(i*0.7+q*2)*1;for(let d=-w;d<=w;d+=0.5){const n=hz(i>>1,Math.round(d)+q*9,13);if(Math.abs(d)>w*0.6&&n<0.45)continue;put(cx+d,my+i,Math.floor(Math.abs(d)/w*2.4+u*0.6+(n-0.5)*1.2))}}
 const L=H-sl-6;
 if(!jetOnly)sea(L,(u,z)=>[cx+z,my+sl+u*L*0.85],(u)=>6+u*30,18,56);
 return {W,H,px,mat,ax:Math.round(cx),ay:my};
}


// ===== 段階6a：冒険者（戦士、魔法使い、盗賊、僧侶）と、その道具 =====
const FLAME=[[255,250,220],[255,214,100],[255,150,44],[220,80,26]];
/** 松明：手に持つ棒、巻いた布、ゆらめく炎（光る） */
function torchHeld(dir,P,x,y,k,q){
 const side=dir==='side',tx=x+(side?3*k:0),ty=y-(side?5*k:1*k);
 P.push(LN(x,y+2*k,tx,ty-5*k,'wood',2,{no:1}),C(tx,ty-5*k,tx,ty-6.4*k,0.9*k,'leather',{flat:2}));
 const fl=[[0,0],[-0.6,-1],[0.6,-2],[0,-3]][q],fy=ty-7.2*k;
 [[0,0,1],[-1,0,2],[1,0,2],[0,-1,0],[-1,-1,1],[1,-1,2],[0,1,1],[fl[0],-2,1],[-1+fl[0],-2,2],[fl[0],-3,2],[-fl[0]*2,-4+(q%2),3],[1-fl[0],-3,3]].forEach(([dx,dy,c])=>P.push(D(tx+dx,fy+dy,FLAME[c])));
}
function sword(dir,P,hx,hy,sw,rest,k){
 if(dir==='up'&&rest)return;
 let tx,ty;
 if(rest){tx=hx+(dir==='side'?2.6*k:1.4*k);ty=hy+6*k}else{tx=hx+(dir==='side'?(5+sw*3)*k:1.4*k);ty=hy-(8-Math.abs(sw)*2)*k}
 const ux=(tx-hx),uy=(ty-hy),L=Math.hypot(ux,uy)||1,nx=-uy/L,ny=ux/L;
 P.push(LN(hx,hy,tx,ty,'mail',4,{no:1}),LN(hx+nx*0.8,hy+ny*0.8,tx,ty,'mail',2,{no:1}),D(tx,ty,RAMP.mail[4]));
 P.push(LN(hx-nx*1.8*k,hy-ny*1.8*k,hx+nx*1.8*k,hy+ny*1.8*k,'goldT',2,{no:1}),D(hx-ux/L*1.6*k,hy-uy/L*1.6*k,RAMP.goldT[3]));
}
function mace(dir,P,hx,hy,sw,rest,k){
 if(dir==='up'&&rest)return;
 let tx,ty;
 if(rest){tx=hx+(dir==='side'?1.4*k:0.8*k);ty=hy+6*k}else{tx=hx+(dir==='side'?(2+sw*2.5)*k:0.8*k);ty=hy-(6.4-Math.abs(sw)*1.5)*k}
 P.push(LN(hx,hy+k,tx,ty,'wood',2,{no:1}),E(tx,ty,1.7*k,1.7*k,'mail',{ol:1}));
 [[1,0],[-1,0],[0,1],[0,-1]].forEach(([a,b])=>P.push(D(tx+a*1.9*k,ty+b*1.9*k,RAMP.mail[3])));
}
function dagger(dir,P,hx,hy,sw,rest,k){
 if(rest){P.push(LN(hx,hy,hx+(dir==='side'?1.2*k:0.6*k),hy+3.6*k,'mail',3,{no:1}),D(hx,hy-0.6*k,RAMP.leather[3]));return}
 P.push(LN(hx,hy,hx+(dir==='side'?(3.6+sw)*k:1.2*k),hy-(3.6-Math.abs(sw))*k,'mail',4,{no:1}),D(hx,hy+0.6*k,RAMP.leather[3]));
}
/** 杖：節くれだった木の杖。先の宝玉が光の呪文で青白く光り、攻撃では炎の呪文で燃える */
const ORB=[210,236,255],ORB2=[150,200,250];
function staffOf(){return(dir,P,hx,hy,sw,rest,k)=>{
 const tx=hx+(dir==='side'?(rest?0:(1+sw)*k):0.5*k),ty=hy-13*k+(rest?0:-Math.abs(sw)*k);
 P.push(LN(hx,hy+5*k,tx,ty,'wood',2,{no:1}),D((hx+tx)/2+0.6,(hy+ty)/2+2,RAMP.wood[3]),D((hx+tx)/2-0.4,(hy+ty)/2-3,RAMP.wood[1]));
 P.push(LN(tx-1.2*k,ty-0.6*k,tx-0.6*k,ty-2.6*k,'wood',2,{no:1}),LN(tx+1.2*k,ty-0.6*k,tx+0.6*k,ty-2.6*k,'wood',2,{no:1}));
 P.push(D(tx,ty-1.8*k,ORB),D(tx-1,ty-1.8*k,ORB2),D(tx+1,ty-1.8*k,ORB2),D(tx,ty-2.8*k,ORB2),D(tx,ty-0.8*k,ORB2));
}}
function shieldOff(dir,P,x,y,k,q){
 if(dir==='up'){P.push(E(x,y,3.6*k,4*k,'wood',{ol:1}),C(x-3*k,y,x+3*k,y,0.5*k,'iron',{flat:2}),E(x,y,1.2*k,1.2*k,'iron',{flat:3}));return}
 if(dir==='side'){P.push(E(x-0.6*k,y,1.8*k,4*k,'wood',{ol:1}),LN(x-0.6*k,y-3.6*k,x-0.6*k,y+3.6*k,'iron',2,{no:1}));return}
 P.push(E(x,y,3.6*k,4*k,'tabard',{ol:1}),E(x,y,2.6*k,3*k,'tabard',{flat:3}));
 P.push(LN(x,y-3*k,x,y+3*k,'goldT',3,{no:1}),LN(x-2.2*k,y-0.6*k,x+2.2*k,y-0.6*k,'goldT',3,{no:1}),E(x,y-0.6*k,0.9*k,0.9*k,'iron',{flat:4}));
}
function symbolOff(dir,P,x,y,k,q){
 if(dir==='up')return;
 P.push(LN(x,y-2.4*k,x,y+2.4*k,'goldT',3,{no:1}),LN(x-1.6*k,y-0.8*k,x+1.6*k,y-0.8*k,'goldT',3,{no:1}),D(x,y-0.8*k,RAMP.goldT[4]));
}
/** 顔：k に合わせて大きさを変える。style で兜・帽子・頭巾・髪 */
function humanHead(style){return(dir,P,x,y,dead,open,k)=>{
 const side=dir==='side',back=dir==='up',K=k;
 const ec=dead?RAMP.hskin[1]:COL.K;
 if(style==='hat'&&!back){P.push(C(x-1.4*K+(side?1.6*K:0),y+2*K,x+(side?2.4*K:0),y+7.6*K,1.6*K,'beard'),C(x+1.4*K+(side?1.6*K:0),y+2*K,x+(side?2*K:0),y+7*K,1.4*K,'beard'))}
 P.push(E(x+(side?0.5*K:0),y+0.4*K,3.2*K,3.4*K,'hskin',{ol:1}));
 if(side)P.push(E(x+3*K,y+1*K,0.9*K,0.8*K,'hskin',{flat:2}));
 if(style==='helm'){
  // 鼻当てのついた兜と、頭頂の筋
  P.push(PL([[x-3.6*K,y+0.6*K],[x-3.4*K,y-3*K],[x,y-4.8*K],[x+3.4*K,y-3*K],[x+3.6*K,y+0.6*K],[x+(side?3.8:2.6)*K,y-0.6*K],[x-2.6*K,y-0.6*K]],'mail',2,{ol:1}));
  P.push(LN(x-3.4*K,y-0.8*K,x+3.4*K,y-0.8*K,'iron',1,{no:1}),LN(x+(side?-0.4:0)*K,y-4.6*K,x+(side?-2.6:0)*K,y-2*K,'goldT',3,{no:1}));
  if(!back)P.push(LN(x+(side?2.4:0)*K,y-0.6*K,x+(side?2.4:0)*K,y+2*K,'mail',3,{no:1}));
  if(back)return;
  if(side)P.push(D(x+1.4*K,y+0.4*K,ec));else P.push(D(x-1.4*K,y+0.4*K,ec),D(x+1.4*K,y+0.4*K,ec),LN(x-1*K,y+2.6*K,x+1*K,y+2.6*K,'hskin',1,{no:1}));
  return;
 }
 if(style==='hat'){
  // 折れ曲がった尖り帽子と金の帯
  P.push(E(x,y-2*K,5.8*K,1.6*K,'robeB',{ol:1}));
  const tipX=x+(side?-4.6:2.8)*K;
  P.push(PL([[x-3.2*K,y-2.4*K],[x+2.8*K,y-2.4*K],[x+1.2*K,y-7*K],[tipX,y-11*K],[tipX-0.6*K,y-10*K],[x-1.6*K,y-7*K]],'robeB',2,{ol:1}));
  P.push(LN(x-3*K,y-3*K,x+2.6*K,y-3*K,'goldT',3,{no:1}),D(x+0.4*K,y-6*K,RAMP.goldT[4]),D(x-0.8*K,y-8*K,RAMP.goldT[3]));
  if(back)return;
  if(side)P.push(D(x+1.6*K,y+0.2*K,ec),LN(x+0.6*K,y-0.8*K,x+2.4*K,y-0.6*K,'beard',3,{no:1}));
  else P.push(D(x-1.3*K,y+0.2*K,ec),D(x+1.3*K,y+0.2*K,ec),LN(x-2.2*K,y-0.9*K,x-0.6*K,y-0.7*K,'beard',3,{no:1}),LN(x+2.2*K,y-0.9*K,x+0.6*K,y-0.7*K,'beard',3,{no:1}));
  return;
 }
 if(style==='hood'){
  // 深い頭巾：顔は影に沈み、目だけが光る。口元を布で覆う
  P.push(PL([[x-4*K,y+2.4*K],[x-3.8*K,y-2.6*K],[x-1*K,y-4.8*K],[x+2*K,y-4.6*K],[x+3.8*K,y-2.6*K],[x+4*K,y+2.4*K],[x+(side?-3.6:0)*K,y+(side?3.6:4)*K]],'hood',2,{ol:1}));
  if(back){P.push(LN(x,y-4*K,x,y+2*K,'hood',1,{no:1}));return}
  P.push(E(x+(side?1.6:0)*K,y+0.6*K,side?1.8*K:2.6*K,2.2*K,'hood',{flat:0}));
  P.push(PL([[x+(side?0:-2.4)*K,y+1.4*K],[x+(side?3.4:2.4)*K,y+1.4*K],[x+(side?3:2)*K,y+3.2*K],[x+(side?0.4:-2)*K,y+3.2*K]],'leather',2));
  const gl=dead?RAMP.hood[2]:[230,230,200];
  if(side)P.push(D(x+2*K,y,gl));else P.push(D(x-1*K,y,gl),D(x+1*K,y,gl));
  return;
 }
 // 僧侶：刈り込んだ髪
 P.push(PL([[x-3.6*K,y-0.4*K],[x-3.2*K,y-3*K],[x,y-4.2*K],[x+3.2*K,y-3*K],[x+3.6*K,y-0.4*K],[x+(side?-1:2.4)*K,y-2.4*K],[x+(side?-3:-2.4)*K,y-2.4*K]],'hair',2,{ol:1}));
 if(back){P.push(E(x,y-2.4*K,1.6*K,1.2*K,'hskin',{flat:3}));return}
 if(side)P.push(D(x+1.6*K,y+0.2*K,ec));else P.push(D(x-1.3*K,y+0.2*K,ec),D(x+1.3*K,y+0.2*K,ec),LN(x-0.8*K,y+2.2*K,x+0.8*K,y+2.2*K,'hskin',1,{no:1}));
}}
/** ローブ（裾と袖口に縁取り） */
function robeCape(color,trim){return(dir,P,cx,sh,hip,feet,q,mv,k)=>{
 const sw=mv?[-1,0,1,0][q]:0;
 const L=dir==='side'?-3.4*k:-3.9*k,Rr=dir==='side'?3*k:3.9*k;
 P.push(PL([[cx-2.8*k,sh],[cx+2.8*k,sh],[cx+Rr+sw*0.4,feet-0.5],[cx+L-sw*0.4,feet-0.5]],color,2,{ol:1}));
 P.push(LN(cx+L-sw*0.4+0.6,feet-1,cx+Rr+sw*0.4-0.6,feet-1,trim,3,{no:1}));
 // 裾のひだ
 P.push(LN(cx-1*k,hip,cx-1.6*k-sw*0.3,feet-2,color,1,{no:1}),LN(cx+1.4*k,hip,cx+2*k+sw*0.3,feet-2,color,1,{no:1}));
}}
/** 胴の飾り：職業ごとの装備 */
const DECOR={
 warrior:(v,P,cx,hip,sh,bw,bh,k)=>{
  // 陣羽織と紋章、ベルトと留め金
  if(v==='side'){P.push(PL([[cx-1.6*k,sh+0.6*k],[cx+2.4*k,sh+0.6*k],[cx+2.2*k,hip+1.6*k],[cx-1.2*k,hip+1.6*k]],'tabard',2,{ol:1}),LN(cx-2.2*k,hip-0.6*k,cx+2.6*k,hip-0.6*k,'leather',2,{no:1}),D(cx+1.8*k,hip-0.6*k,RAMP.goldT[3]));return}
  P.push(PL([[cx-2.2*k,sh+0.6*k],[cx+2.2*k,sh+0.6*k],[cx+2*k,hip+2*k],[cx,hip+2.6*k],[cx-2*k,hip+2*k]],'tabard',2,{ol:1}));
  if(v==='down')P.push(LN(cx,sh+1.6*k,cx,hip-1.4*k,'goldT',3,{no:1}),LN(cx-1*k,sh+2.6*k,cx+1*k,sh+2.6*k,'goldT',3,{no:1}));
  P.push(LN(cx-bw,hip-0.6*k,cx+bw,hip-0.6*k,'leather',2,{no:1}));
  if(v==='down')P.push(E(cx,hip-0.6*k,0.8*k,0.6*k,'goldT',{flat:3}));
 },
 wizard:(v,P,cx,hip,sh,bw,bh,k)=>{
  // 腰の帯と薬袋、胸の留め金
  P.push(LN(cx-bw*0.9,hip-1.2*k,cx+bw*0.9,hip-1.2*k,'goldT',2,{no:1}));
  if(v!=='up')P.push(E(cx+(v==='side'?-1.6:2)*k,hip,1.1*k,1.3*k,'leather',{ol:1}),D(cx,sh+0.6*k,RAMP.goldT[4]));
 },
 thief:(v,P,cx,hip,sh,bw,bh,k)=>{
  // 斜めがけの革帯、腰の小袋、短い外套
  if(v==='up'){P.push(PL([[cx-bw-0.4*k,sh],[cx+bw+0.4*k,sh],[cx+bw+0.8*k,hip],[cx-bw-0.8*k,hip]],'hood',2,{ol:1}));return}
  P.push(LN(cx-bw*0.9,sh+0.4*k,cx+bw*0.8,hip-0.8*k,'boot',2,{no:1}),D(cx+bw*0.2,sh+2*k,RAMP.goldT[2]));
  P.push(LN(cx-bw,hip-0.6*k,cx+bw,hip-0.6*k,'boot',2,{no:1}),E(cx+(v==='side'?-1.4:-1.8)*k,hip+0.4*k,1*k,1.2*k,'leather',{ol:1}),E(cx+(v==='side'?0.6:1.6)*k,hip+0.2*k,0.9*k,1*k,'leather',{ol:1}));
 },
 priest:(v,P,cx,hip,sh,bw,bh,k)=>{
  // 青い肩掛け、胸の聖印、縄帯
  if(v==='up'){P.push(PL([[cx-1.6*k,sh],[cx+1.6*k,sh],[cx+1.2*k,sh+3*k],[cx-1.2*k,sh+3*k]],'stole',2,{ol:1}));return}
  if(v==='side'){P.push(LN(cx+1.2*k,sh,cx+1.6*k,hip+3*k,'stole',3,{no:1}),LN(cx-1.6*k,hip-0.8*k,cx+2.2*k,hip-0.8*k,'goldT',1,{no:1}));return}
  P.push(LN(cx-1.6*k,sh,cx-1.8*k,hip+3.4*k,'stole',3,{no:1}),LN(cx+1.6*k,sh,cx+1.8*k,hip+3.4*k,'stole',3,{no:1}));
  P.push(LN(cx,sh+1*k,cx,sh+3.4*k,'goldT',4,{no:1}),LN(cx-0.9*k,sh+1.8*k,cx+0.9*k,sh+1.8*k,'goldT',4,{no:1}));
  P.push(LN(cx-bw,hip-0.8*k,cx+bw,hip-0.8*k,'goldT',1,{no:1}),LN(cx+0.6*k,hip-0.8*k,cx+1*k,hip+2.2*k,'goldT',1,{no:1}));
 },
};
/** 鎖かたびらの編み目と、布の織り目 */
function weave(fr,mat,step){
 const {W,H,px}=fr,m=RAMP[mat];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=y*W+x;if(fr.mat[p]!==mat)continue;if(((x+(y>>1))&1)!==0||(y&1)!==step)continue;
  const i=m.findIndex(c=>c[0]===px[p*4]&&c[1]===px[p*4+1]&&c[2]===px[p*4+2]);if(i<=0)continue;const d=m[i-1];px[p*4]=d[0];px[p*4+1]=d[1];px[p*4+2]=d[2]}
}
/** 冒険者。job: warrior|wizard|thief|priest。torch: 空いた手に松明を持つ */
function adventurer(job,dir,act,f,torch){
 const o={s:1.4,leg:5,bw:3.2,bh:3.4,hh:9.2,decor:DECOR[job]};
 if(job==='warrior')Object.assign(o,{skin:'mail',skinD:'mail',cloth:'mail',hand:'leather',boot:'boot',pad:'iron',head:humanHead('helm'),tool:sword,off:torch?torchHeld:shieldOff,offFront:torch,bw:3.6,limb:1.1});
 else if(job==='wizard')Object.assign(o,{skin:'robeB',skinD:'robeB',cloth:'robeB',hand:'hskin',head:humanHead('hat'),tool:staffOf(),cape:robeCape('robeB','goldT'),off:torch?torchHeld:null,offFront:torch});
 else if(job==='thief')Object.assign(o,{skin:'hood',skinD:'hood',cloth:'leather',hand:'boot',boot:'boot',head:humanHead('hood'),tool:dagger,leg:5,bw:2.9});
 else Object.assign(o,{skin:'robeW',skinD:'robeW',cloth:'robeW',hand:'hskin',head:humanHead('plain'),tool:mace,cape:robeCape('robeW','goldT'),off:torch?torchHeld:symbolOff,offFront:torch});
 const fr=humanoid(dir,act,f,o);
 if(job==='warrior')weave(fr,'mail',0);
 if(job==='thief')weave(fr,'leather',1);
 const {W,H,px,mat}=fr;
 for(let p=0;p<W*H;p++){
  const r=px[p*4],g=px[p*4+1],b=px[p*4+2];
  if(FLAME.some(c=>c[0]===r&&c[1]===g&&c[2]===b))mat[p]='wisp';
  // 魔法使いの杖の宝玉：光の呪文で青白く光り、攻撃では炎の呪文で橙に燃える
  const isOrb=r===ORB[0]&&g===ORB[1]&&b===ORB[2],isOrb2=r===ORB2[0]&&g===ORB2[1]&&b===ORB2[2];
  if(isOrb||isOrb2){mat[p]='wisp';if(act==='attack'&&mod(f,4)>0){const c=isOrb?FLAME[0]:FLAME[2];px[p*4]=c[0];px[p*4+1]=c[1];px[p*4+2]=c[2]}}
  // 盗賊の目の光
  if(job==='thief'&&r===230&&g===230&&b===200)mat[p]='wisp';
 }
 return fr;
}
/** 床に落ちた道具：torch（燃えている）, stub（燃えさし）, sword, shield, staff, mace, dagger, symbol */
function item(kind,f){
 const P=[],W=16,H=12,q=mod(f,4);
 if(kind==='torch'||kind==='stub'){
  P.push(LN(3,9,11,7,'wood',2,{no:1}),LN(10,6,12,8,'leather',1,{no:1}));
  const fr=raster(W,H,P);
  if(kind==='torch'){const fl=[[0,0],[1,-1],[0,-2],[-1,-1]][q];[[12,6,1],[13,6,2],[12,5,0],[13,5,1],[12+fl[0],4,1],[13,4+fl[1]*0,2],[12+fl[0],3,2],[13-fl[0],2+(q%2),3]].forEach(([x,y,c])=>{const p=y*W+x;fr.px[p*4]=FLAME[c][0];fr.px[p*4+1]=FLAME[c][1];fr.px[p*4+2]=FLAME[c][2];fr.px[p*4+3]=255;fr.mat[p]='wisp'})}
  else{[[11,6],[12,7]].forEach(([x,y])=>{const p=y*W+x;fr.px[p*4]=20;fr.px[p*4+1]=16;fr.px[p*4+2]=16;fr.px[p*4+3]=255})}
  return {...fr,ax:8,ay:10};
 }
 if(kind==='sword')P.push(LN(2,9,12,5,'mail',4,{no:1}),LN(3,7,4,10,'goldT',2,{no:1}),D(13,5,RAMP.mail[4]));
 else if(kind==='shield')P.push(E(8,7,4.4,3.4,'tabard',{ol:1}),LN(8,4,8,10,'goldT',3,{no:1}),LN(5,6.4,11,6.4,'goldT',3,{no:1}),E(8,6.4,1,0.9,'iron',{flat:4}));
 else if(kind==='staff')P.push(LN(1,10,13,4,'wood',2,{no:1}),E(13.6,3.6,1.4,1.4,'mail',{flat:4}));
 else if(kind==='mace')P.push(LN(2,9,10,6,'wood',2,{no:1}),E(11,5.6,1.6,1.6,'mail',{ol:1}));
 else if(kind==='dagger')P.push(LN(4,8,10,6,'mail',4,{no:1}),LN(4,7,5,9,'leather',2,{no:1}));
 else if(kind==='lute')P.push(LN(8,7,14,3,'wood',2,{no:1}),E(6,8,3.4,2.6,'wood',{ol:1}),E(6.4,7.6,0.9,0.8,'boot',{flat:0}));
 else if(kind==='bow')P.push(C(2,9,6,4,0.6,'wood'),C(6,4,12,3,0.6,'wood'),LN(2,9,12,3,'beard',3,{no:1}));
 else if(kind==='greatsword')P.push(LN(1,10,15,3,'plate',4,{no:1}),LN(2,8,4,11,'bardY',2,{no:1}),D(15,3,RAMP.plate[4]));
 else P.push(LN(8,4,8,10,'goldT',3,{no:1}),LN(5.6,6,10.4,6,'goldT',3,{no:1}));
 const fr=raster(W,H,P);
 // きらめき：光が当たったときだけ
 const gl={sword:[12,5],shield:[8,7],staff:[13,3],mace:[11,5],dagger:[9,6],symbol:[8,5],greatsword:[13,4]}[kind];
 if(gl&&q===0){const p=gl[1]*W+gl[0];if(fr.px[p*4+3]){fr.px[p*4]=255;fr.px[p*4+1]=250;fr.px[p*4+2]=230;fr.mat[p]='glint'}}
 return {...fr,ax:8,ay:9};
}


// ===== 段階6b：吟遊詩人、狩人、竜殺し、スケルトン、リッチ =====
function glowFlame(fr){const {W,H,px,mat}=fr;for(let p=0;p<W*H;p++){const r=px[p*4],g=px[p*4+1],b=px[p*4+2];if(FLAME.some(c=>c[0]===r&&c[1]===g&&c[2]===b))mat[p]='wisp'}}
/** リュート：胴と棹。攻撃（かき鳴らす）では指が弦の上を動く */
function lute(dir,P,hx,hy,sw,rest,k){
 if(dir==='up')return;
 const bx=hx-(dir==='side'?0.6:2.6)*k,by=hy-0.4*k;
 P.push(LN(bx+1.6*k,by-1.2*k,bx+5.6*k,by-5.6*k,'wood',2,{no:1}),D(bx+5.8*k,by-6*k,RAMP.bardY[3]));
 P.push(E(bx,by,2.6*k,2.2*k,'wood',{ol:1}),E(bx+0.3*k,by-0.2*k,0.7*k,0.7*k,'boot',{flat:0}));
 if(!rest)P.push(D(bx+0.6*k+sw*0.6,by+0.8*k,RAMP.hskin[3]));
}
/** 胸に抱えたリュート（手前に描く） */
function luteOff(dir,P,x,y,k,q){
 if(dir==='up')return;
 const side=dir==='side',bx=side?x+1.2*k:x+2.4*k,by=y-1.6*k;
 P.push(LN(bx+(side?2:2.2)*k,by-1.6*k,bx+(side?5.2:6)*k,by-6.4*k,'wood',2,{no:1}),C(bx+(side?5.2:6)*k,by-6.4*k,bx+(side?6:6.8)*k,by-7.6*k,0.6*k,'bardY'));
 P.push(E(bx,by,2.8*k,2.4*k,'wood',{ol:1}),E(bx+0.4*k,by-0.4*k,0.8*k,0.8*k,'boot',{flat:0}),LN(bx-1.6*k,by+1.2*k,bx+5.6*k,by-6.4*k,'beard',3,{no:1}));
 P.push(D(bx-0.6*k+(q%2),by+0.8*k,RAMP.hskin[3]));
}
/** 手に下げた弓（手前に描く） */
function bowOff(dir,P,x,y,k,q){
 if(dir==='up')return;
 const bx=x+(dir==='side'?2.2*k:-0.8*k);
 P.push(C(bx,y-6.4*k,bx-1.4*k,y-3*k,0.55*k,'wood'),C(bx-1.4*k,y-3*k,bx-1.4*k,y+3*k,0.55*k,'wood'),C(bx-1.4*k,y+3*k,bx,y+6.4*k,0.55*k,'wood'));
 P.push(LN(bx,y-6.4*k,bx,y+6.4*k,'beard',3,{no:1}));
}
/** 弓：両手で構える。攻撃では引き絞って矢をつがえる */
function bow(dir,P,hx,hy,sw,rest,k){
 if(dir==='up'&&rest){P.push(C(hx-1.4*k,hy-9*k,hx+1.4*k,hy-2*k,0.5*k,'wood'));return}
 const draw=rest?0:Math.max(0,1-Math.abs(sw))*1.6*k+1*k;
 if(dir==='side'){
  const x=hx+1.6*k;
  P.push(C(x,hy-5.6*k,x+1.6*k,hy-2.6*k,0.5*k,'wood'),C(x+1.6*k,hy-2.6*k,x+1.6*k,hy+2.6*k,0.5*k,'wood'),C(x+1.6*k,hy+2.6*k,x,hy+5.6*k,0.5*k,'wood'));
  P.push(LN(x,hy-5.6*k,x-draw,hy,'beard',3,{no:1}),LN(x-draw,hy,x,hy+5.6*k,'beard',3,{no:1}));
  if(!rest)P.push(LN(x-draw,hy,x+5*k,hy,'wood',3,{no:1}),D(x+5.4*k,hy,RAMP.mail[4]));
  return;
 }
 const x=hx-2.4*k;
 P.push(C(x-4*k,hy-1.6*k,x,hy-3*k,0.5*k,'wood'),C(x,hy-3*k,x+4*k,hy-1.6*k,0.5*k,'wood'),LN(x-4*k,hy-1.6*k,x+4*k,hy-1.6*k,'beard',3,{no:1}));
 if(!rest)P.push(LN(x,hy-1.6*k,x,hy+3*k,'wood',3,{no:1}));
}
/** 大剣：両手持ち。休むときは肩にかつぐ */
function greatsword(dir,P,hx,hy,sw,rest,k){
 let tx,ty;
 if(rest){tx=hx-(dir==='side'?3:2)*k;ty=hy-12*k}else{tx=hx+(dir==='side'?(7+sw*4)*k:2*k);ty=hy-(11-Math.abs(sw)*3)*k}
 if(dir==='up'&&rest){P.push(LN(hx,hy,tx+2*k,ty,'plate',4,{no:1}));return}
 const ux=tx-hx,uy=ty-hy,L=Math.hypot(ux,uy)||1,nx=-uy/L,ny=ux/L;
 P.push(LN(hx,hy,tx,ty,'plate',4,{no:1}),LN(hx+nx,hy+ny,tx+nx,ty+ny,'plate',2,{no:1}),D(tx,ty,RAMP.plate[4]));
 P.push(LN(hx-nx*2.4*k,hy-ny*2.4*k,hx+nx*2.4*k,hy+ny*2.4*k,'bardY',2,{no:1}),D(hx-ux/L*2*k,hy-uy/L*2*k,RAMP.bardY[3]));
}
function quiver(v,P,cx,hip,sh,bw,bh,k){
 // 背の矢筒（後ろ姿と横向きで見える）と、狩人の腰帯
 if(v==='up'||v==='side'){const x=cx+(v==='side'?-2.4:1.4)*k;P.push(C(x,sh-1*k,x-0.6*k,hip,1*k,'leather'));[0,1,2].forEach(i=>P.push(D(x-0.6*k+i*0.8*k,sh-2.2*k-i*0.4,RAMP.beard[3])))}
 if(v!=='up')P.push(LN(cx-bw,hip-0.6*k,cx+bw,hip-0.6*k,'boot',2,{no:1}),E(cx+1.6*k,hip+0.2*k,0.9*k,1.1*k,'leather',{ol:1}));
}
function bardDecor(v,P,cx,hip,sh,bw,bh,k){
 // 二色に分かれた胴衣と、金の飾り
 if(v==='up')return;
 if(v==='side'){P.push(LN(cx-1*k,sh+0.6*k,cx-1*k,hip,'bardY',2,{no:1}));return}
 P.push(PL([[cx,sh+0.4*k],[cx+bw,sh+0.4*k],[cx+bw*0.9,hip],[cx,hip]],'bardY',2));
 P.push(LN(cx-bw,hip-0.6*k,cx+bw,hip-0.6*k,'boot',2,{no:1}),D(cx,sh+1.2*k,RAMP.bardY[4]),D(cx,sh+2.6*k,RAMP.bardY[4]));
}
function slayerDecor(v,P,cx,hip,sh,bw,bh,k){
 // 胸当ての稜線、腰の草摺、背の赤い外套（後ろ姿）
 if(v==='up'){P.push(PL([[cx-bw-0.6*k,sh-0.4*k],[cx+bw+0.6*k,sh-0.4*k],[cx+bw+1.4*k,hip+3*k],[cx-bw-1.4*k,hip+3*k]],'tabard',2,{ol:1}));return}
 if(v==='side'){P.push(LN(cx+1.4*k,sh+0.6*k,cx+1.6*k,hip-1*k,'plate',4,{no:1}),PL([[cx-2.2*k,hip-0.8*k],[cx+2.4*k,hip-0.8*k],[cx+2.6*k,hip+1.8*k],[cx-2.4*k,hip+1.8*k]],'plate',2,{ol:1}));return}
 P.push(LN(cx,sh+0.6*k,cx,hip-1.2*k,'plate',4,{no:1}),LN(cx-bw+0.6*k,sh+1.6*k,cx-0.6*k,sh+3*k,'plate',1,{no:1}),LN(cx+bw-0.6*k,sh+1.6*k,cx+0.6*k,sh+3*k,'plate',1,{no:1}));
 P.push(PL([[cx-bw,hip-0.8*k],[cx+bw,hip-0.8*k],[cx+bw+0.6*k,hip+2*k],[cx-bw-0.6*k,hip+2*k]],'plate',2,{ol:1}),LN(cx,hip-0.8*k,cx,hip+2*k,'plate',1,{no:1}));
 P.push(D(cx,hip-0.6*k,RAMP.bardY[4]));
}
function headBard(dir,P,x,y,dead,open,k){
 humanHead('plain')(dir,P,x,y,dead,open,k);
 const side=dir==='side',K=k;
 // 羽根飾りのついたつば広の帽子
 P.push(E(x,y-2.2*K,5.2*K,1.4*K,'bardR',{ol:1}),PL([[x-3*K,y-2.4*K],[x+3*K,y-2.4*K],[x+2.4*K,y-5.4*K],[x-2.6*K,y-5.4*K]],'bardR',2,{ol:1}));
 P.push(C(x+(side?-2:2)*K,y-4.6*K,x+(side?-6:5.4)*K,y-8.4*K,0.7*K,'bardY'),D(x+(side?-6.4:5.8)*K,y-8.8*K,RAMP.bardY[4]));
}
function headHunter(dir,P,x,y,dead,open,k){
 const side=dir==='side',back=dir==='up',K=k;
 P.push(E(x+(side?0.5*K:0),y+0.4*K,3.2*K,3.4*K,'hskin',{ol:1}));
 // 緑の頭巾（後ろへ垂れる尖り）
 P.push(PL([[x-3.8*K,y+1.6*K],[x-3.6*K,y-2.6*K],[x,y-5*K],[x+3.4*K,y-2.8*K],[x+3.8*K,y+(side?-0.4:1.6)*K],[x+(side?2.2:2.8)*K,y-1.2*K],[x-2.8*K,y-1*K]],'forest',2,{ol:1}));
 if(side)P.push(PL([[x-3.6*K,y-2.4*K],[x-6.4*K,y+0.6*K],[x-3.6*K,y+1*K]],'forest',2,{ol:1}));
 if(back){P.push(C(x,y-4*K,x,y-6.6*K,0.9*K,'forest'));return}
 const ec=dead?RAMP.hskin[1]:COL.K;
 if(side)P.push(D(x+1.6*K,y+0.4*K,ec));else P.push(D(x-1.3*K,y+0.4*K,ec),D(x+1.3*K,y+0.4*K,ec));
}
function headSlayer(dir,P,x,y,dead,open,k){
 const side=dir==='side',back=dir==='up',K=k;
 // 角のついた大兜（顔は面頬の細い隙間だけ）
 P.push(E(x+(side?0.4*K:0),y,3.8*K,4.2*K,'plate',{ol:1}));
 P.push(C(x-3*K,y-2.6*K,x-6*K,y-6*K,0.9*K,'horn'),C(x-6*K,y-6*K,x-5.4*K,y-8.4*K,0.6*K,'horn'));
 if(!side)P.push(C(x+3*K,y-2.6*K,x+6*K,y-6*K,0.9*K,'horn'),C(x+6*K,y-6*K,x+5.4*K,y-8.4*K,0.6*K,'horn'));
 P.push(LN(x-3.4*K,y-1.4*K,x+3.4*K,y-1.4*K,'plate',4,{no:1}));
 if(back)return;
 if(side)P.push(LN(x+1*K,y,x+3.8*K,y,'boot',0,{no:1}));else P.push(LN(x-2.4*K,y,x+2.4*K,y,'boot',0,{no:1}),LN(x,y+0.6*K,x,y+3*K,'plate',1,{no:1}));
}
/** 冒険者（6b の3職）。job: bard|hunter|slayer */
function adventurer2(job,dir,act,f,torch){
 let o;
 if(job==='bard')o={s:1.4,leg:5,bw:3,bh:3.3,hh:9.2,skin:'bardR',skinD:'bardR',cloth:'bardR',hand:'hskin',boot:'boot',head:headBard,tool:null,off:luteOff,offFront:true,decor:bardDecor};
 else if(job==='hunter')o={s:1.4,leg:5.2,bw:3,bh:3.3,hh:9.2,skin:'forest',skinD:'forest',cloth:'leather',hand:'leather',boot:'boot',head:headHunter,tool:null,off:bowOff,offFront:true,decor:quiver};
 else o={s:1.55,leg:5,bw:3.8,bh:3.6,hh:9.4,limb:1.25,skin:'plate',skinD:'plate',cloth:'plate',hand:'plate',boot:'plate',pad:'plate',head:headSlayer,tool:greatsword,decor:slayerDecor};
 // 狩人は攻撃のときだけ弓を両手で構える
 if(job==='hunter'&&act==='attack'){o.tool=bow;o.off=null}
 const fr=humanoid(dir,act,f,o);
 if(job==='slayer')weave(fr,'plate',3);
 glowFlame(fr);
 return fr;
}
// ===== 町の名簿の冒険者（冒険者の作り直しの五歩目）：一人ひとりの姿と、位ごとの装備 =====
// 姿（look）：髪の色、肌の色、身につける色（首の布、兜の飾り、マント）、体つき、頭の形（髭・羽根飾り・長い髪など）。
// 位（rank）：0 見習い、1 熟練（盾や胸に紋章）、2 歴戦（身につける色のマント。ローブの者は肩掛け）、3 英雄（武器がほのかに光る。マントに金の縁）
const HERO_PC=[[176,40,48],[48,90,196],[44,146,74],[136,64,178],[226,136,34],[36,156,156]];
const HERO_HAIR=[[38,30,30],[92,58,34],[164,66,34],[226,194,100],[204,204,212],[134,88,50]];
const HERO_SKIN=[[246,216,192],[228,182,142],[188,132,92],[122,82,58]];
const ramp5=(c)=>[0.3,0.55,0.78,1,1.16].map(f=>c.map(v=>Math.max(0,Math.min(255,Math.round(v*f)))));
HERO_PC.forEach((c,i)=>{RAMP['pc'+i]=ramp5(c)});
RAMP.bandage=ramp5([222,214,192]);
HERO_HAIR.forEach((c,i)=>{RAMP['hair'+i]=ramp5(c)});
HERO_SKIN.forEach((c,i)=>{RAMP['skin'+i]=ramp5(c)});
// 位ごとの布と鎧の色：見習いはくすんだ古着（drab）と革、英雄は白金の鎧（regal）と深い色の衣（royal）
RAMP.drab=[[30,26,22],[58,50,42],[88,78,64],[114,102,84],[136,124,104]];
RAMP.drabG=[[24,30,22],[46,56,40],[70,82,58],[94,106,76],[116,128,96]];
RAMP.regal=[[74,56,22],[146,116,58],[210,184,116],[240,224,172],[254,248,224]];
RAMP.royal=[[28,14,46],[60,26,94],[96,46,146],[134,78,192],[174,122,224]];
/** 身につける色のマント（歴戦から）。trim は英雄の金の縁。英雄のマントは止まっていてもはためく */
function heroCape(mat,trim,flutter,len=1,wide=1){return(dir,P,cx,sh,hip,feet0,q,mv,k)=>{
 const sw=mv?[-1,0,1,0][q]:flutter?[0,0.6,1,0.6][q]:0;
 // 丈：len 0 は腰までの短いマント（熟練）、1 は足もと（歴戦）、2 は地に引きずる長さ（英雄）
 const feet=len===0?hip+1.6*k:len===2?feet0+1*k:feet0;
 if(dir==='side'){
  P.push(PL([[cx-1.4*k,sh-0.6*k],[cx+0.8*k,sh-0.6*k],[cx-1.4*k-sw*0.5,feet-1.4*k],[cx-4.6*k-sw*0.9,feet-2*k]],mat,2,{ol:1}));
  if(trim)P.push(LN(cx-4.6*k-sw*0.9,feet-2*k,cx-1.4*k-sw*0.5,feet-1.4*k,trim,3,{no:1}));
  return;
 }
 const w=4.4*k*wide,fl=1.6*k*wide*wide;
 P.push(PL([[cx-w+0.4*k,sh-0.8*k],[cx+w-0.4*k,sh-0.8*k],[cx+w+fl+sw*0.3,feet-1*k],[cx-w-fl-sw*0.3,feet-1*k]],mat,2,{ol:1}));
 if(dir==='up'){P.push(LN(cx,sh,cx+sw*0.3,feet-2*k,mat,1,{no:1}));if(trim){P.push(E(cx,sh+3.6*k,1.6*k,1.8*k,trim,{ol:1}),E(cx,sh+3.6*k,0.8*k,0.9*k,mat,{flat:3}))}}
 if(trim)P.push(LN(cx-w-fl,feet-1.2*k,cx+w+fl,feet-1.2*k,trim,3,{no:1}),LN(cx-w-fl,feet-1.2*k,cx-w+0.4*k,sh-0.8*k,trim,3,{no:1}),LN(cx+w+fl,feet-1.2*k,cx+w-0.4*k,sh-0.8*k,trim,3,{no:1}));
}}
/** 盾：見習いは小さな木の盾、熟練からは身につける色に金の十字、英雄は白金の縁 */
function heroShield(pc,rank){return(dir,P,x,y,k,q)=>{
 const s=rank===0?0.78:rank>=2?1.1:1,rim=rank>=3?'regal':'goldT';
 if(dir==='up'){P.push(E(x,y,3.6*k*s,4*k*s,'wood',{ol:1}),C(x-3*k*s,y,x+3*k*s,y,0.5*k,'iron',{flat:2}),E(x,y,1.2*k,1.2*k,'iron',{flat:3}));return}
 if(dir==='side'){P.push(E(x-0.6*k,y,1.8*k*s,4*k*s,rank?pc:'wood',{ol:1}),LN(x-0.6*k,y-3.6*k*s,x-0.6*k,y+3.6*k*s,rank?rim:'wood',2,{no:1}));return}
 if(!rank){P.push(E(x,y,3*k,3.2*k,'wood',{ol:1}),LN(x-2.2*k,y-0.6*k,x+2.2*k,y-0.6*k,'wood',1,{no:1}),LN(x-2*k,y+1.2*k,x+2*k,y+1.2*k,'wood',1,{no:1}),E(x,y,0.8*k,0.8*k,'iron',{flat:3}));return}
 P.push(E(x,y,3.6*k*s,4*k*s,rank>=3?rim:pc,{ol:1}),E(x,y,(3.6*s-1)*k,(4*s-1)*k,pc,{flat:3}));
 P.push(LN(x,y-3*k*s,x,y+3*k*s,'goldT',3,{no:1}),LN(x-2.2*k*s,y-0.6*k,x+2.2*k*s,y-0.6*k,'goldT',3,{no:1}),E(x,y-0.6*k,0.9*k,0.9*k,'goldT',{flat:4}));
}}
/** 見習いの棍棒（剣の代わり） */
function noviceClub(dir,P,hx,hy,sw,rest,k){
 let tx,ty;
 if(rest){tx=hx+(dir==='side'?1:0.6)*k;ty=hy-6*k}else{tx=hx+(dir==='side'?(1+sw*3)*k:0.6*k);ty=hy-(7-Math.abs(sw)*1.6)*k}
 P.push(LN(hx,hy+1,tx,ty,'wood',2,{no:1}),C((hx+tx*2)/3,(hy+ty*2)/3,tx,ty,1.1*k,'wood'));
}
/** 武器を大きく持つ（歴戦から） */
const bigTool=(t,m)=>t&&((dir,P,hx,hy,sw,rest,k)=>t(dir,P,hx,hy,sw,rest,k*m));
/** 冒険者の基本の組み立て（adventurer と adventurer2 と同じ。熟練の姿） */
function heroBase(job,act,torch){
 let o;
 if(job==='bard')o={s:1.4,leg:5,bw:3,bh:3.3,hh:9.2,skin:'bardR',skinD:'bardR',cloth:'bardR',hand:'hskin',boot:'boot',head:headBard,tool:null,off:luteOff,offFront:true,decor:bardDecor};
 else if(job==='hunter')o={s:1.4,leg:5.2,bw:3,bh:3.3,hh:9.2,skin:'forest',skinD:'forest',cloth:'leather',hand:'leather',boot:'boot',head:headHunter,tool:null,off:bowOff,offFront:true,decor:quiver};
 else if(job==='slayer')o={s:1.55,leg:5,bw:3.8,bh:3.6,hh:9.4,limb:1.25,skin:'plate',skinD:'plate',cloth:'plate',hand:'plate',boot:'plate',pad:'plate',head:headSlayer,tool:greatsword,decor:slayerDecor};
 else{
  o={s:1.4,leg:5,bw:3.2,bh:3.4,hh:9.2,decor:DECOR[job]};
  if(job==='warrior')Object.assign(o,{skin:'mail',skinD:'mail',cloth:'mail',hand:'leather',boot:'boot',pad:'iron',head:humanHead('helm'),tool:sword,off:torch?torchHeld:shieldOff,offFront:torch,bw:3.6,limb:1.1});
  else if(job==='wizard')Object.assign(o,{skin:'robeB',skinD:'robeB',cloth:'robeB',hand:'hskin',head:humanHead('hat'),tool:staffOf(),cape:robeCape('robeB','goldT'),off:torch?torchHeld:null,offFront:torch});
  else if(job==='thief')Object.assign(o,{skin:'hood',skinD:'hood',cloth:'leather',hand:'boot',boot:'boot',head:humanHead('hood'),tool:dagger,leg:5,bw:2.9});
  else Object.assign(o,{skin:'robeW',skinD:'robeW',cloth:'robeW',hand:'hskin',head:humanHead('plain'),tool:mace,cape:robeCape('robeW','goldT'),off:torch?torchHeld:symbolOff,offFront:torch});
 }
 if(job==='hunter'&&act==='attack'){o.tool=bow;o.off=null}
 return o;
}
/** 見習いの頭：革の帽子（戦士・竜殺し）、粗末な頭巾（魔法使い） */
function noviceHead(kind){return(dir,P,x,y,dead,open,k)=>{
 const side=dir==='side',back=dir==='up',K=k;
 if(kind==='hood'){
  P.push(E(x+(side?0.5*K:0),y+0.4*K,3.2*K,3.4*K,'hskin',{ol:1}));
  P.push(PL([[x-3.8*K,y+2*K],[x-3.6*K,y-2.4*K],[x-0.6*K,y-4.6*K],[x+2.2*K,y-4.2*K],[x+3.8*K,y-2.4*K],[x+3.8*K,y+(side?0:2)*K],[x+(side?2.4:2.6)*K,y-1.2*K],[x-2.6*K,y-1*K]],'drab',2,{ol:1}));
  if(back)return;
  const ec=dead?RAMP.hskin[1]:COL.K;
  if(side)P.push(D(x+1.6*K,y+0.4*K,ec));else P.push(D(x-1.3*K,y+0.4*K,ec),D(x+1.3*K,y+0.4*K,ec));
  return;
 }
 humanHead('plain')(dir,P,x,y,dead,open,k);
 // 革の帽子（頭の上半分を覆う丸い帽子と、縫い目）
 P.push(PL([[x-3.6*K,y-0.6*K],[x-3.4*K,y-3.2*K],[x,y-4.6*K],[x+3.4*K,y-3.2*K],[x+3.6*K,y-0.6*K]],'leather',2,{ol:1}),LN(x-3.4*K,y-1*K,x+3.4*K,y-1*K,'leather',1,{no:1}));
}}
/** 英雄の頭飾り：戦士・竜殺しは翼の冠、僧侶は高い司教冠、ほかは額の金の冠 */
function heroCrown(job,dir,P,x,y,K){
 const side=dir==='side';
 if(job==='priest'){
  P.push(PL([[x-2.8*K,y-2.6*K],[x+2.8*K,y-2.6*K],[x+2.2*K,y-7*K],[x,y-9*K],[x-2.2*K,y-7*K]],'robeW',2,{ol:1}),LN(x,y-8.4*K,x,y-3*K,'goldT',3,{no:1}),LN(x-2.4*K,y-3.2*K,x+2.4*K,y-3.2*K,'goldT',3,{no:1}),D(x,y-6*K,RAMP.gemR[3]));
  return;
 }
 if(job==='warrior'||job==='slayer'){
  const top=y-(job==='slayer'?4:4.6)*K;
  if(side)P.push(PL([[x-0.6*K,top+0.6*K],[x-4.4*K,top-2.8*K],[x-1.2*K,top-1.2*K]],'regal',2,{ol:1}));
  else P.push(PL([[x-1.2*K,top+0.6*K],[x-4.6*K,top-2.6*K],[x-2.2*K,top-0.6*K]],'regal',2,{ol:1}),PL([[x+1.2*K,top+0.6*K],[x+4.6*K,top-2.6*K],[x+2.2*K,top-0.6*K]],'regal',2,{ol:1}));
  P.push(D(x,top-0.4*K,RAMP.gemR[3]));
  return;
 }
 // 額の冠（魔法使いは帽子の帯の上）
 const cy=job==='wizard'?y-3.4*K:y-3.6*K;
 P.push(LN(x-3*K,cy,x+3*K,cy,'goldT',3,{no:1}),D(x,cy-1,RAMP.goldT[4]),D(x-2*K,cy-1,RAMP.goldT[3]),D(x+2*K,cy-1,RAMP.goldT[3]),D(x,cy,RAMP.gemR[3]));
}
/**
 * 名簿の冒険者の頭の飾り（一人ひとり形が違う。名簿の12人で重ならない）。0 羽根、1 角、2 房、3 とさか、4 星、5 三日月、6 輪、7 二枚羽根、8 炎、9 一本角、10 四つ葉、11 扇、12 菱（引退する英雄の連れる見習いで名簿が13人になっても重ならない）。
 * (x, y) は飾りの付け根（頭のてっぺん）、K は絵の倍率、s は位の大きさ、side は横向き（向きの符号 fx：横向きは前が +x）。
 */
const CREST_NAMES=['羽根','角','房','とさか','星','三日月','輪','二枚羽根','炎','一本角','四つ葉','扇','菱'];
function crestPrims(id,side,P,x,y,K,s,m){
 const u=K*s,fx=side?-1:1;
 switch(id){
  case 0:P.push(C(x,y,x+1.4*u*fx,y-3.4*u,0.9*u,m),C(x+1.4*u*fx,y-3.4*u,x+3.4*u*fx,y-4.4*u,0.7*u,m),C(x+3.4*u*fx,y-4.4*u,x+4.4*u*fx,y-3.4*u,0.5*u,m));break;
  case 1:for(const sx of side?[1]:[-1,1]){const X=side?x+0.6*u:x;P.push(C(X+0.8*u*sx,y+0.4*u,X+2.8*u*sx,y-1.6*u,0.8*u,m),C(X+2.8*u*sx,y-1.6*u,X+2.6*u*sx,y-3.8*u,0.55*u,m))}break;
  case 2:P.push(C(x-0.6*u,y-2.6*u,x-2.4*u,y+0.4*u,0.55*u,m),C(x+0.6*u,y-2.6*u,x+2.4*u,y+0.4*u,0.55*u,m),LN(x,y,x,y-1.4*u,m,2,{no:1}),E(x,y-3.2*u,2*u,1.9*u,m));break;
  case 3:if(side)P.push(E(x-2*u,y-1.2*u,1.2*u,1.4*u,m),E(x,y-2*u,1.3*u,1.6*u,m),E(x+2*u,y-1.2*u,1.2*u,1.4*u,m),E(x,y-0.4*u,3*u,0.9*u,m));
   else P.push(E(x,y-2.4*u,1*u,2.2*u,m),E(x-1.2*u,y-1.2*u,0.8*u,1.4*u,m),E(x+1.2*u,y-1.2*u,0.8*u,1.4*u,m));break;
  case 4:{const cy=y-3.4*u,pts=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=(i&1?1.3:3)*u;pts.push([x+Math.cos(a)*r,cy+Math.sin(a)*r])}P.push(LN(x,y,x,cy+1*u,m,2,{no:1}),PL(pts,m,3,{ol:1}));break}
  case 5:P.push(C(x-2.6*u,y-3.6*u,x-1.6*u,y-1*u,0.7*u,m),C(x-1.6*u,y-1*u,x+1.6*u,y-1*u,0.75*u,m),C(x+1.6*u,y-1*u,x+2.6*u,y-3.6*u,0.7*u,m));break;
  case 6:P.push(LN(x,y,x,y-1.2*u,m,2,{no:1}),C(x-1.6*u,y-3.2*u,x-1.6*u,y-3.2*u,0.6*u,m),C(x-1.6*u,y-3.2*u,x,y-4.8*u,0.6*u,m),C(x,y-4.8*u,x+1.6*u,y-3.2*u,0.6*u,m),C(x+1.6*u,y-3.2*u,x,y-1.6*u,0.6*u,m),C(x,y-1.6*u,x-1.6*u,y-3.2*u,0.6*u,m));break;
  case 7:P.push(C(x-0.4*u,y,x-2.6*u,y-4.8*u,0.75*u,m),C(x+0.4*u,y,x+2.6*u,y-4.8*u,0.75*u,m));break;
  case 8:P.push(PL([[x-2*u,y-1.2*u],[x-1.9*u,y-4.6*u],[x-0.9*u,y-2.8*u],[x+0.3*u,y-6.2*u],[x+1*u,y-3*u],[x+2.1*u,y-4.2*u],[x+2*u,y-1.2*u],[x+1.2*u,y],[x-1.2*u,y]],m,3,{ol:1}));break;
  case 9:P.push(PL([[x-1.1*u,y],[x+1.1*u,y],[x+0.25*u*fx,y-5.6*u]],m,3,{ol:1}),LN(x-0.6*u,y-1.6*u,x+0.6*u,y-2.2*u,m,1,{no:1}));break;
  case 10:P.push(LN(x,y,x,y-1.2*u,m,2,{no:1}),E(x,y-4.2*u,1.2*u,1.2*u,m),E(x-1.4*u,y-2.8*u,1.2*u,1.2*u,m),E(x+1.4*u,y-2.8*u,1.2*u,1.2*u,m),E(x,y-1.6*u,1*u,1*u,m));break;
  case 12:P.push(LN(x,y,x,y-1*u,m,2,{no:1}),PL([[x,y-0.8*u],[x+1.9*u,y-3*u],[x,y-5.4*u],[x-1.9*u,y-3*u]],m,3,{ol:1}),E(x,y-3*u,0.6*u,0.7*u,m,{flat:4}));break;
  default:{const pts=[[x,y]];for(let i=0;i<=6;i++){const a=Math.PI+i*Math.PI/6;pts.push([x+Math.cos(a)*3.2*u,y+Math.sin(a)*3.6*u])}P.push(PL(pts,m,3,{ol:1}));for(const a of [-2.4,-1.57,-0.75])P.push(LN(x,y,x+Math.cos(a)*2.8*u,y+Math.sin(a)*3.2*u,m,1,{no:1}));}
 }
}
/** 飾りの付け根（頭のてっぺん）：職業と位ごと。[x のずれ（正面）, x のずれ（横）, y のずれ]（K 単位） */
function crestBase(job,rank,dir){
 const side=dir==='side';
 if(job==='wizard')return rank===0?[0,0,-4.4]:[side?-4.6:2.8,side?-4.6:2.8,-10.6];
 if(job==='priest')return rank>=3?[0,0,-8.8]:[0,0,-3.4];
 if(job==='warrior')return rank===0?[0,0,-4.4]:rank>=3?[0,0,-5.2]:[0,0,-4.6];
 if(job==='slayer')return rank===0?[0,0,-4.4]:[0,0,-4];
 if(job==='bard')return [0,0,-5.2];
 if(job==='hunter')return [side?-1:0,side?-1:0,-4.8];
 return [side?-0.4:0.4,side?-0.4:0.4,-4.6];
}
/** 見習いの背負い袋：丸めた毛布を背に（正面からも肩の上に両端が見える） */
function noviceRoll(dir,P,cx,sh,hip,feet,q,mv,k){
 const bob=mv?[0,0.4,0,0.4][q]*k:0;
 if(dir==='side'){P.push(PL([[cx-1.6*k,sh-0.2*k],[cx-5*k,sh+0.2*k],[cx-5*k,hip-0.4*k],[cx-1.6*k,hip]],'leather',2,{ol:1}),E(cx-3.4*k,sh-1.2*k+bob,2.6*k,1.5*k,'drab',{ol:1}),LN(cx-5.4*k,sh-1.2*k+bob,cx-1.6*k,sh-1.2*k+bob,'drab',1,{no:1}));return}
 if(dir==='up'){P.push(PL([[cx-3*k,sh],[cx+3*k,sh],[cx+3.2*k,hip+0.4*k],[cx-3.2*k,hip+0.4*k]],'leather',2,{ol:1}),LN(cx-3*k,sh+2*k,cx+3*k,sh+2*k,'boot',2,{no:1}));}
 P.push(C(cx-4.6*k,sh-1.4*k+bob,cx+4.6*k,sh-1.4*k+bob,1.5*k,'drab'),LN(cx-2.6*k,sh-2.6*k+bob,cx-2.6*k,sh-0.2*k+bob,'leather',1,{no:1}),LN(cx+2.6*k,sh-2.6*k+bob,cx+2.6*k,sh-0.2*k+bob,'leather',1,{no:1}));
}
/** 傷の痕：1 眼帯（片目）、2 頭の包帯。scar はビットの組み合わせ */
function scarPrims(scar,dir,P,x,y,K){
 const side=dir==='side',back=dir==='up';
 if(scar&2){
  P.push(C(x-3.3*K,y-1.6*K,x+3.3*K,y-1.2*K,0.85*K,'bandage'));
  if(back)P.push(C(x+0.6*K,y-1.2*K,x+1.6*K,y+1.6*K,0.5*K,'bandage'),C(x-0.4*K,y-1.2*K,x-1.4*K,y+1.8*K,0.5*K,'bandage'));
  else P.push(D(x+(side?-1.6:1.8)*K,y-1.6*K,[176,44,40]));
 }
 if(scar&1){
  if(back)P.push(LN(x-3.2*K,y-1.4*K,x+3.2*K,y-0.6*K,'boot',0,{no:1}));
  else if(side)P.push(LN(x-2.8*K,y-1.6*K,x+2.6*K,y-0.2*K,'boot',0,{no:1}),E(x+1.6*K,y+0.4*K,1*K,0.9*K,'boot',{flat:0}));
  else P.push(LN(x-3.2*K,y-1.8*K,x+3.2*K,y-0.6*K,'boot',0,{no:1}),E(x+1.3*K,y+0.3*K,1.1*K,1*K,'boot',{flat:0}));
 }
}
/**
 * 名簿の冒険者の絵。job: warrior|wizard|thief|priest|bard|hunter|slayer、look は src/eco/roster.ts の packLook、rank 0〜3。
 * 輪郭と色の面で位が読めるように：
 *  見習い：鎧を着ない古着（くすんだ布、継ぎ当て）、革の帽子と棍棒（戦士）、粗末な頭巾（魔法使い）、金の飾りなし、少し猫背。
 *  熟練：職業らしい姿（鎖かたびら、星の帽子、白い法衣など）に紋章。
 *  歴戦：身につける色の肩当てと幅広のマント（ローブの者は肩掛け）、ひと回り大きな武器。
 *  英雄：白金の鎧と深い色の衣、翼の冠・司教冠・金の冠、金縁のマント（止まっていてもはためく）、光る武器、体のまわりのほのかな金の光。
 */
function heroSprite(job,dir,act,f,torch,look,rank){
 const L={hair:look&7,skin:(look>>3)&3,color:(look>>5)&7,build:(look>>8)&3,head:(look>>10)&1,crest:((look>>11)&15)-1,scar:(look>>15)&3};
 const pc='pc'+Math.min(5,L.color),hairM='hair'+Math.min(5,L.hair);
 const o=heroBase(job,act,torch);
 // 頭の飾りのための上の余白（帽子の先も切れない）
 o.top=CREST_PAD;
 let hd=null;
 const bk=[0.88,1,1.14][Math.min(2,L.build)];
 o.bw=(o.bw||3.3)*bk;o.bh=(o.bh||3.6)*(0.96+0.04*Math.min(2,L.build));
 // ---- 見習い：鎧と飾りを外して古着に ----
 if(rank===0){
  o.hunch=0.5;
  if(job==='warrior'){Object.assign(o,{skin:'leather',skinD:'leather',cloth:'leather',pad:null,head:noviceHead('cap'),tool:noviceClub,limb:1});o.decor=(v,P,cx,hip,sh,bw,bh,k)=>{if(v!=='up')P.push(LN(cx-bw,hip-0.6*k,cx+bw,hip-0.6*k,'boot',2,{no:1}),LN(cx-bw*0.8,sh+0.6*k,cx+bw*0.6,hip-0.8*k,'drab',1,{no:1}))}}
  else if(job==='wizard'){Object.assign(o,{skin:'drab',skinD:'drab',cloth:'drab',head:noviceHead('hood'),cape:robeCape('drab','drab')});o.decor=(v,P,cx,hip,sh,bw,bh,k)=>{P.push(LN(cx-bw*0.9,hip-1.2*k,cx+bw*0.9,hip-1.2*k,'wood',2,{no:1}))}}
  else if(job==='priest'){Object.assign(o,{skin:'drab',skinD:'drab',cloth:'drab',cape:robeCape('drab','drab')});o.decor=(v,P,cx,hip,sh,bw,bh,k)=>{P.push(LN(cx-bw,hip-0.8*k,cx+bw,hip-0.8*k,'wood',1,{no:1}),LN(cx+0.6*k,hip-0.8*k,cx+1*k,hip+2.2*k,'wood',1,{no:1}))}}
  else if(job==='slayer'){Object.assign(o,{skin:'leather',skinD:'leather',cloth:'leather',hand:'leather',boot:'boot',head:noviceHead('cap'),s:1.48,bw:o.bw*0.92});o.decor=(v,P,cx,hip,sh,bw,bh,k)=>{if(v!=='up')P.push(LN(cx-bw,hip-0.6*k,cx+bw,hip-0.6*k,'boot',2,{no:1}))}}
  // 形の印：背に丸めた毛布の背負い袋（ローブの者も法衣の上に背負う）
  o.cape=noviceRoll;
 }
 // ---- 熟練：腰までの短いマント（ローブの者は法衣のまま） ----
 if(rank===1&&job!=='wizard'&&job!=='priest')o.cape=heroCape(pc,null,false,0);
 if(job==='warrior'&&!torch)o.off=heroShield(pc,rank);
 // ---- 歴戦から：ひと回り大きな武器、身につける色のマント ----
 if(rank>=2){o.tool=bigTool(o.tool,1.15);if((job==='bard'||job==='hunter')&&o.off){const off0=o.off;o.off=(d,P,x,y,k,q)=>off0(d,P,x,y,k*1.1,q)}}
 if(rank>=2&&job!=='wizard'&&job!=='priest')o.cape=rank>=3?heroCape(pc,'goldT',true,2,1.2):heroCape(pc,null,false,1);
 // ---- 英雄：深い色の衣 ----
 if(rank>=3&&job==='wizard'){Object.assign(o,{skin:'royal',skinD:'royal',cloth:'royal',cape:robeCape('royal','goldT')})}
 // 頭：髭・羽根飾り・長い髪・帽子の帯・肩当て・冠
 const head0=o.head;
 o.head=(d,P,x,y,dead,open,k)=>{
  const side=d==='side',back=d==='up',K=k;
  if(!dead)hd={d,x,y,k};
  if(job==='priest'&&L.head===1&&!dead){
   if(side)P.push(C(x-2.4*K,y-1*K,x-2.8*K,y+4.4*K,1.6*K,hairM));
   else P.push(C(x-3*K,y-1*K,x-3.4*K,y+4.2*K,1.3*K,hairM),C(x+3*K,y-1*K,x+3.4*K,y+4.2*K,1.3*K,hairM));
  }
  if(rank>=2&&(job==='wizard'||job==='priest')&&!dead){
   const sh=y+o.hh*K-o.bh*K*1.15,bw=o.bw*K;
   if(side)P.push(PL([[x-2.8*K,sh-0.8*K],[x+2.4*K,sh-0.8*K],[x+2.8*K,sh+3.2*K],[x-3.2*K,sh+3.6*K]],pc,2,{ol:1}));
   else P.push(PL([[x-bw-1.2*K,sh-0.6*K],[x+bw+1.2*K,sh-0.6*K],[x+bw+1*K,sh+3.4*K],[x,sh+4.4*K],[x-bw-1*K,sh+3.4*K]],pc,2,{ol:1}));
   if(rank>=3&&!side)P.push(LN(x-bw-1*K,sh+3.4*K,x,sh+4.4*K,'goldT',3,{no:1}),LN(x,sh+4.4*K,x+bw+1*K,sh+3.4*K,'goldT',3,{no:1}));
   if(rank>=3&&side)P.push(LN(x-3.2*K,sh+3.6*K,x+2.8*K,sh+3.2*K,'goldT',3,{no:1}));
  }
  if(rank>=1&&!dead&&(rank>=3||(job!=='wizard'&&job!=='priest'))){
   // 肩当て：熟練は小さく、歴戦はふつう、英雄は大きく張り出す
   const sh=y+o.hh*K-o.bh*K*1.15,bw=o.bw*K,m=rank>=3?'regal':rank===1?'leather':pc,r=[0,0.62,1,1.45][rank];
   if(side)P.push(E(x-0.2*K,sh+0.6*K,2.2*K*r,1.8*K*r,m,{ol:1}));
   else P.push(E(x-bw-0.2*K,sh+0.4*K,2*K*r,1.7*K*r,m,{ol:1}),E(x+bw+0.2*K,sh+0.4*K,2*K*r,1.7*K*r,m,{ol:1}));
  }
  head0(d,P,x,y,dead,open,k);
  if(dead)return;
  if(L.head===1&&!back&&(job==='warrior'||job==='bard'||job==='hunter')){
   if(side)P.push(E(x+1.8*K,y+2.6*K,1.5*K,1.3*K,hairM,{ol:1}));
   else P.push(E(x,y+2.8*K,2.4*K,1.4*K,hairM,{ol:1}));
  }
  if(job==='wizard'&&L.head===1&&rank>=1)P.push(LN(x-3*K,y-3*K,x+2.6*K,y-3*K,pc,3,{no:1}),LN(x-3*K,y-3.6*K,x+2.6*K,y-3.6*K,pc,2,{no:1}));
  if(rank>=3)heroCrown(job,d,P,x,y,K);
  if(L.scar)scarPrims(L.scar,d,P,x,y,K);
 };
 // 胴：首の布（身につける色）、熟練の紋章
 const decor0=o.decor;
 o.decor=(v,P,cx,hip,sh,bw,bh,k,q,mv)=>{
  if(decor0)decor0(v,P,cx,hip,sh,bw,bh,k,q,mv);
  if(v==='side')P.push(E(cx+0.6*k,sh+0.2*k,1.7*k,0.9*k,pc,{ol:1}));
  else P.push(E(cx,sh+0.1*k,bw*0.72,0.95*k,pc,{ol:1}));
  if(rank>=1&&job!=='warrior'&&v!=='up'){
   const bx=v==='side'?cx+0.8*k:cx-bw*0.45,by=sh+(v==='side'?0.6:1.8)*k;
   P.push(E(bx,by,1.6*k,1.6*k,'goldT',{ol:1}),E(bx,by,0.8*k,0.8*k,pc,{flat:3}));
  }
 };
 const fr=humanoid(dir,act,f,o);
 if(job==='warrior'&&rank>=1)weave(fr,'mail',0);
 if(job==='thief')weave(fr,'leather',1);
 if(job==='slayer'&&rank>=1)weave(fr,'plate',3);
 // 英雄の武器：武器を持たずに描いた絵と比べて、違うピクセル（武器）を光らせる
 if(rank>=3&&act!=='death'){
  const o2={...o};
  if(job==='bard')o2.off=null;
  else if(job==='hunter'){o2.tool=null;o2.off=null}
  else o2.tool=null;
  const bare=humanoid(dir,act,f,o2);
  if(bare.W===fr.W&&bare.H===fr.H){
   for(let p=0;p<fr.W*fr.H;p++){
    if(!fr.px[p*4+3])continue;
    if(bare.px[p*4+3]&&bare.px[p*4]===fr.px[p*4]&&bare.px[p*4+1]===fr.px[p*4+1]&&bare.px[p*4+2]===fr.px[p*4+2])continue;
    if(fr.mat[p]==='ol')continue;
    for(let c=0;c<3;c++)fr.px[p*4+c]=Math.round(fr.px[p*4+c]*0.55+[255,236,170][c]*0.45);
    fr.mat[p]='wisp';
   }
  }
 }
 const {W,H,px,mat}=fr;
 const remap=(from,to,shift=0)=>{const A=RAMP[from],B=RAMP[to];for(let p=0;p<W*H;p++){if(mat[p]!==from)continue;const i=A.findIndex(c=>c[0]===px[p*4]&&c[1]===px[p*4+1]&&c[2]===px[p*4+2]);if(i<0)continue;const b=B[Math.max(0,Math.min(4,i+shift))];px[p*4]=b[0];px[p*4+1]=b[1];px[p*4+2]=b[2];mat[p]=to}};
 // 髪と肌（魔法使いの髭も髪の色に）
 remap('hskin','skin'+Math.min(3,L.skin));
 remap('hair',hairM);
 if(job==='wizard')remap('beard',hairM);
 // 盗賊の頭の形 1 は、頭巾と外套が身につける色に染まる（暗めに）
 if(job==='thief'&&L.head===1&&rank>=1)remap('hood',pc,-1);
 if(rank===0){
  // 見習い：金は木に、色の布はくすんだ古着に。布に継ぎ当て（少し暗い四角）
  remap('goldT','wood',-1);
  remap('bardY','drab');
  for(const m of ['hood','bardR','tabard','stole','forest','robeW','robeB'])remap(m,m==='forest'?'drabG':'drab');
  remap('plate','iron',-1);
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const p=y*W+x;if((mat[p]==='drab'||mat[p]==='leather'||mat[p]==='drabG')&&hz(x>>1,y>>1,77)<0.11&&hz(x,y,78)<0.67){for(let c=0;c<3;c++)px[p*4+c]=Math.round(px[p*4+c]*0.72)}}
 }
 if(rank>=3){
  // 英雄：鎧は白金、衣は深い色に金、金の飾りは光を受けてきらめく
  for(const m of ['mail','plate','iron'])remap(m,'regal');
  if(job==='thief')remap('hood','royal',-1);
  if(job==='bard')remap('bardR','royal');
  if(job==='priest')remap('stole',pc);
  for(let p=0;p<W*H;p++)if(mat[p]==='goldT'||mat[p]==='regal')mat[p]=mat[p]==='goldT'?'glw':'regal';
 }
 // 炎と宝玉の光、盗賊の目の光（adventurer と同じ）
 for(let p=0;p<W*H;p++){
  const r=px[p*4],g=px[p*4+1],b=px[p*4+2];
  if(FLAME.some(c=>c[0]===r&&c[1]===g&&c[2]===b))mat[p]='wisp';
  const isOrb=r===ORB[0]&&g===ORB[1]&&b===ORB[2],isOrb2=r===ORB2[0]&&g===ORB2[1]&&b===ORB2[2];
  if(isOrb||isOrb2){mat[p]='wisp';if(act==='attack'&&mod(f,4)>0){const c=isOrb?FLAME[0]:FLAME[2];px[p*4]=c[0];px[p*4+1]=c[1];px[p*4+2]=c[2]}}
  if(job==='thief'&&r===230&&g===230&&b===200)mat[p]='wisp';
 }
 // 英雄：体のまわりのほのかな金の光（1ピクセルおきの縁。暗がりでも光る）
 if(rank>=3&&act!=='death'){
  const on=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&px[(y*W+x)*4+3]&&mat[y*W+x]!=='aura';
  const add=[];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(px[(y*W+x)*4+3])continue;if(((x+y+mod(f,4))&1)===0)continue;if(on(x+1,y)||on(x-1,y)||on(x,y+1)||on(x,y-1))add.push(y*W+x)}
  for(const p of add){px[p*4]=170;px[p*4+1]=134;px[p*4+2]=56;px[p*4+3]=255;mat[p]='wisp'}
 }
 return withCrest(fr,job,rank,L.crest,pc,hd);
}
/** 頭の飾りを、上に余白を足したコマに重ねる。飾りの中はほのかに自ら光る（輪郭は光らない）。灯りの色に寄らず形と色が読める */
const CREST_PAD=10;
function withCrest(fr,job,rank,crest,pc,hd){
 if(crest<0||!hd)return fr;
 const {W,H,px,mat}=fr,[bx,bxs,by]=crestBase(job,rank,hd.d),side=hd.d==='side',K=hd.k;
 const P=[];
 crestPrims(crest,side,P,hd.x+(side?bxs:bx)*K,hd.y+by*K,K*0.88,[0.8,0.95,1.05,1.15][rank],pc);
 const cr=raster(W,H,P);
 for(let p=0;p<W*H;p++){
  if(!cr.px[p*4+3])continue;
  const ol=cr.mat[p]==='ol';
  // 輪郭は体の上には描かない（頭に食い込まない）
  if(ol&&px[p*4+3])continue;
  for(let c=0;c<3;c++)px[p*4+c]=ol?cr.px[p*4+c]:Math.round(cr.px[p*4+c]*0.62+34);
  px[p*4+3]=255;mat[p]=ol?'ol':'wisp';
 }
 return fr;
}
/** 名簿の冒険者の寝具：身につける色の毛布（見習いはくすんだ古い毛布、英雄は金の縁）、髪と肌の色 */
function heroBed(job,look,rank,f){
 const L={hair:look&7,skin:(look>>3)&3,color:(look>>5)&7};
 const q=mod(f,4),W=26,H=14,P=[],pc=rank===0?'drab':'pc'+Math.min(5,L.color),hairM='hair'+Math.min(5,L.hair);
 const br=q===1||q===2?0.5:0;
 P.push(E(14,8,10+br,4.4+br*0.5,pc,{ol:1}),LN(6,6,22,6,pc,1,{no:1}),LN(8,10,21,10,pc,1,{no:1}));
 if(rank===0)P.push(E(17,7,2,1.6,'leather',{flat:2}));
 if(rank>=3)P.push(LN(5,11.6,23,11.6,'goldT',3,{no:1}),LN(4.6,5.2,22,5.2,'goldT',3,{no:1}));
 P.push(E(4,7,3.2,3.2,'skin'+Math.min(3,L.skin),{ol:1}));
 if(job==='warrior'&&rank>=1)P.push(E(4,5.6,3.2,2,rank>=3?'regal':'mail',{ol:1}));
 else if(job==='wizard'&&rank>=1)P.push(PL([[1,6],[7,6],[3,1]],rank>=3?'royal':'robeB',2,{ol:1}));
 else if(job==='thief')P.push(E(4,6,3.4,3.2,rank===0?'drab':'hood',{ol:1}));
 else P.push(E(4,5.4,3,1.8,hairM,{ol:1}));
 const fr=raster(W,H,P);
 setPx(fr,3,7,[60,40,36],false);setPx(fr,5,7,[60,40,36],false);
 return {...fr,ax:13,ay:11};
}
/** 祈りの光：墓標の上に立ちのぼる、光る小さな聖印（f 0〜3 で薄れる） */
function prayLight(f){
 const q=mod(f,4),fr=blank(7,9),a=[1,0.85,0.65,0.45][q];
 const c=[Math.round(255*a),Math.round(236*a),Math.round(160*a)],o=[Math.round(120*a),Math.round(90*a),Math.round(40*a)];
 const on=(x,y)=>(x===3&&y>=1&&y<=7)||(y===3&&x>=1&&x<=5);
 for(let y=0;y<9;y++)for(let x=0;x<7;x++){
  if(on(x,y))setPx(fr,x,y,c,true);
  else if([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>on(x+dx,y+dy)))setPx(fr,x,y,o,true);
 }
 return {...fr,ax:3,ay:8};
}
/** 墓標：熟練は木の十字に身につける色の布、歴戦は石の墓標、英雄は石の墓標に剣を立てる。土の盛り上がりつき */
function graveMarker(rank,color){
 const P=[],W=16,H=18,pc='pc'+Math.min(5,color);
 P.push(E(8,15.4,6,2.2,'soil',{ol:1}),E(8,15,4,1.2,'soil',{flat:3}));
 if(rank<=1){
  P.push(LN(8,4,8,15,'wood',2,{no:1}),C(8,4,8,15,0.9,'wood'),C(4.6,7.4,11.4,7.4,0.8,'wood'));
  P.push(C(7,8.6,9,8.6,0.8,pc),C(9,8.6,10.4,11.6,0.6,pc));
 }else{
  P.push(PL([[4.4,15],[4.4,6.4],[5.6,4.4],[8,3.4],[10.4,4.4],[11.6,6.4],[11.6,15]],'stone',2,{ol:1}));
  P.push(LN(8,6,8,11,'stone',1,{no:1}),LN(6.4,7.6,9.6,7.6,'stone',1,{no:1}),C(5,13.6,11,13.6,0.7,pc));
  if(rank>=3)P.push(LN(13.4,2,13.4,15,'mail',4,{no:1}),LN(12,5,14.8,5,'goldT',3,{no:1}),D(13.4,1.6,RAMP.goldT[4]));
 }
 const fr=raster(W,H,P);
 return {...fr,ax:8,ay:15};
}
/** スケルトン：骨の体に、拾った生前の装備。gear: none|warrior|thief|priest|hunter|bard|slayer */
function skelHead(helm){return(dir,P,x,y,dead,open,k)=>{
 const side=dir==='side',back=dir==='up',K=k;
 P.push(E(x+(side?0.4*K:0),y,3.1*K,3.2*K,'bone',{ol:1}));
 if(!back){
  const ex=side?[x+1.4*K]:[x-1.3*K,x+1.3*K];
  ex.forEach(e=>P.push(E(e,y+0.2*K,0.8*K,0.9*K,'boot',{flat:0})));
  P.push(PL([[x+(side?1.2:-1.6)*K,y+2.2*K],[x+(side?3.4:1.6)*K,y+2.2*K],[x+(side?3:1.4)*K,y+3.6*K+(open?1:0)],[x+(side?1.2:-1.4)*K,y+3.6*K+(open?1:0)]],'bone',3,{ol:1}));
  for(let i=0;i<3;i++)P.push(D(x+(side?1.8:-0.8)*K+i*0.9*K,y+2.6*K,RAMP.boot[1]));
 }
 if(helm==='helm')P.push(PL([[x-3.4*K,y],[x-3.2*K,y-3.2*K],[x,y-4.4*K],[x+3.2*K,y-3.2*K],[x+3.4*K,y]],'mail',2,{ol:1}));
 if(helm==='slayer'){P.push(PL([[x-3.6*K,y-0.2*K],[x-3.4*K,y-3.4*K],[x,y-4.6*K],[x+3.4*K,y-3.4*K],[x+3.6*K,y-0.2*K]],'plate',2,{ol:1}),C(x-3*K,y-2.6*K,x-6*K,y-6*K,0.9*K,'horn'));if(!side)P.push(C(x+3*K,y-2.6*K,x+6*K,y-6*K,0.9*K,'horn'))}
 if(helm==='hood')P.push(PL([[x-3.8*K,y+1.6*K],[x-3.6*K,y-2.6*K],[x,y-4.6*K],[x+3.6*K,y-2.6*K],[x+3.8*K,y+1.6*K],[x+2.6*K,y-1.2*K],[x-2.6*K,y-1.2*K]],'hood',2,{ol:1}));
 if(helm==='crown'){P.push(PL([[x-3*K,y-2*K],[x-3*K,y-4.6*K],[x-1.6*K,y-3.4*K],[x,y-5.2*K],[x+1.6*K,y-3.4*K],[x+3*K,y-4.6*K],[x+3*K,y-2*K]],'bardY',2,{ol:1}),D(x,y-3*K,RAMP.gemR[3]))}
}}
const SKEYE=[200,120,255];
function ribs(v,P,cx,hip,sh,bw,bh,k){
 if(v==='up'){P.push(LN(cx,sh,cx,hip,'bone',1,{no:1}));return}
 for(let i=0;i<3;i++)P.push(LN(cx-bw*0.8,sh+(1+i*1.4)*k,cx+bw*0.8,sh+(1+i*1.4)*k,'boot',1,{no:1}));
 P.push(LN(cx,sh+0.6*k,cx,hip,'bone',4,{no:1}));
}
function skeleton(gear,dir,act,f){
 const g={none:{},warrior:{tool:sword,off:shieldOff,helm:'helm'},thief:{tool:dagger,helm:'hood'},priest:{tool:mace},hunter:{tool:bow},bard:{tool:lute},slayer:{tool:greatsword,helm:'slayer',pad:'plate'}}[gear];
 const fr=humanoid(dir,act,f,{s:1.35,leg:5.2,bw:2.6,bh:3.2,hh:9.2,limb:0.75,skin:'bone',skinD:'bone',cloth:'bone',head:skelHead(g.helm),tool:g.tool||null,off:g.off||null,pad:g.pad||null,decor:ribs});
 // 眼窩の奥の小さな光
 return fr;
}
function lichCape(dir,P,cx,sh,hip,feet,q,mv,k){
 const sw=mv?[-1,0,1,0][q]:0,L=dir==='side'?-3.8*k:-4.4*k,Rr=dir==='side'?3.4*k:4.4*k;
 // 裾がぼろぼろに裂けたローブ
 const pts=[[cx-3*k,sh],[cx+3*k,sh],[cx+Rr+sw*0.4,feet-1]];
 for(let i=1;i<6;i++){const t=i/6,x=cx+Rr+sw*0.4+(L-Rr-sw*0.8)*t;pts.push([x,feet-1-(i%2?2.4*k:0)])}
 pts.push([cx+L-sw*0.4,feet-1]);
 P.push(PL(pts,'lichR',2,{ol:1}),LN(cx-2.6*k,sh+0.6*k,cx-3*k,feet-3*k,'lichR',1,{no:1}),LN(cx+2.4*k,sh+0.6*k,cx+2.8*k,feet-3*k,'lichR',1,{no:1}));
}
function lichStaff(dir,P,hx,hy,sw,rest,k){
 const tx=hx+(dir==='side'?(rest?0:(1+sw)*k):0.5*k),ty=hy-14*k+(rest?0:-Math.abs(sw)*k);
 P.push(LN(hx,hy+5*k,tx,ty,'bone',2,{no:1}),E(tx,ty-1.6*k,1.6*k,1.6*k,'bone',{ol:1}));
 P.push(D(tx-0.6*k,ty-1.8*k,SKEYE),D(tx+0.6*k,ty-1.8*k,SKEYE));
}
function lich(dir,act,f){
 const fr=humanoid(dir,act,f,{s:1.5,leg:5,bw:3,bh:3.4,hh:9.4,limb:0.8,skin:'lichR',skinD:'lichR',cloth:'lichR',hand:'bone',head:skelHead('crown'),tool:lichStaff,cape:lichCape});
 const {W,H,px,mat}=fr;
 // 目と杖の髑髏の目が紫に光る
 for(let p=0;p<W*H;p++){if(px[p*4]===SKEYE[0]&&px[p*4+1]===SKEYE[1]&&px[p*4+2]===SKEYE[2])mat[p]='wisp'}
 if(act!=='death'&&dir!=='up'){const k=1.5,cx=Math.round(W/2),feet=H-2,hip=feet-5*k,hh=9.4*k,y=Math.round(hip-hh);const xs=dir==='side'?[cx+Math.round(1.4*k+0.6*k)]:[cx-2,cx+2];xs.forEach(x=>{const p=y*W+x;px[p*4]=SKEYE[0];px[p*4+1]=SKEYE[1];px[p*4+2]=SKEYE[2];px[p*4+3]=255;mat[p]='wisp'})}
 return fr;
}


// ===== 段階7b：崩落の土ぼこり =====
function dust(f){
 const q=mod(f,4),W=14,H=12,P=[];
 const r=[3,4.4,5.4,5.8][q];
 P.push(E(7,7,r,r*0.75,'rag',{flat:[3,3,2,1][q]}));
 const fr=raster(W,H,P);
 // 薄れていく：外側から間引く
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=y*W+x;if(!fr.px[p*4+3])continue;const d=Math.hypot(x-7,(y-7)/0.75)/r;if(hz(x,y,q+40)<q*0.22+d*0.35)fr.px[p*4+3]=0}
 return {...fr,ax:7,ay:10};
}


// ===== ドラゴンの炎の粒（扇の形に吹き出す炎の、ひとかたまり） =====
/** f は口元から炎の先へ進んだ段（0〜3）。口元に近いほど小さく白っぽい黄色、先へ行くほど大きく橙から赤になり、縁が裂けて薄れる。光る */
function flamePuff(f){
 const q=mod(f,4),W=13,H=13,fr=blank(W,H);
 const r=[3,4,4.8,5.4][q];
 const cols=[[255,250,215],[255,224,120],[255,160,60],[230,90,40],[160,44,30]];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const d=Math.hypot(x-6,(y-6)*1.2)/r;if(d>1)continue;
  if(hz(x,y,q+90)<d*0.4+q*0.06-0.05)continue;
  setPx(fr,x,y,cols[Math.min(4,Math.floor(d*2+q*0.75))],true);
 }
 return {...fr,ax:6,ay:8};
}

// ===== ヴァンパイアの黒い霧（コウモリにばらける瞬間と、姿を戻す瞬間） =====
/** f は広がって薄れていく段（0〜3）。暗い紫の、裂けた縁の霧に、裏地と同じ赤の粒が少し混じる */
function vampMist(f){
 const q=mod(f,4),W=22,H=16,P=[];
 const r=[4.5,6.5,8.2,9.4][q];
 P.push(E(11,9,r,r*0.7,'cape',{flat:[4,4,3,2][q]}));
 const fr=raster(W,H,P);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=y*W+x;if(!fr.px[p*4+3])continue;const d=Math.hypot(x-11,(y-9)/0.7)/r;if(hz(x,y,q+70)<q*0.2+d*0.4)fr.px[p*4+3]=0}
 // 赤い粒（裏地の色）
 const red=RAMP.capeR[3-q>0?3-q:0];
 for(let i=0;i<4-q;i++){const x=Math.round(11+Math.cos(i*2.3+q)*r*0.6),y=Math.round(9+Math.sin(i*2.3+q)*r*0.4);setPx(fr,x,y,red,q<2)}
 return {...fr,ax:11,ay:13};
}

// ===== 段階7c：ドワーフと、その住みか =====
const LAMP=[[255,246,200],[255,222,140],[240,180,90]];
const BEARDS={miner:'dbeard',smith:'dbeardK',warrior:'dbeardW'};
function dwarfHead(role){return(dir,P,x,y,dead,open,k)=>{
 const side=dir==='side',back=dir==='up',K=k,bd=BEARDS[role];
 // 大きな頭
 P.push(E(x+(side?0.4*K:0),y+0.2*K,3.9*K,3.7*K,'hskin',{ol:1}));
 if(back){
  // 後ろ姿：兜の下からはみ出す髪と、肩に広がるひげの端
  P.push(E(x,y+1.6*K,3.8*K,2.6*K,bd,{ol:1}),E(x-3.2*K,y+3.4*K,1.2*K,1.6*K,bd,{ol:1}),E(x+3.2*K,y+3.4*K,1.2*K,1.6*K,bd,{ol:1}));
 } else if(side){
  // 横向き：前へ張り出したひげの房と、編んだ先の金の輪
  P.push(PL([[x-0.6*K,y+0.6*K],[x+4.2*K,y+1.4*K],[x+4.6*K,y+5*K],[x+3.4*K,y+9.6*K],[x+1.2*K,y+10.4*K],[x-0.8*K,y+6.4*K]],bd,2,{ol:1}));
  P.push(LN(x+1.4*K,y+3*K,x+2.4*K,y+9.4*K,bd,1,{no:1}),LN(x+3*K,y+3*K,x+3.4*K,y+8.4*K,bd,1,{no:1}));
  P.push(E(x+2.4*K,y+8.4*K,0.8*K,0.5*K,'goldT',{flat:4}));
  P.push(E(x+3.6*K,y+0.8*K,1.5*K,1.3*K,'hskin',{ol:1}),D(x+4.2*K,y+0.4*K,RAMP.hskin[4]));
  P.push(LN(x+1.4*K,y-1.2*K,x+3.6*K,y-0.8*K,bd,1,{no:1}),D(x+2.4*K,y-0.2*K,dead?RAMP.hskin[1]:COL.K));
 } else {
  // 正面：腰まで届く大きなひげ、左右に編んだ房と金の輪、口ひげ、丸い鼻、目を隠す太い眉
  P.push(PL([[x-3.9*K,y+0.4*K],[x+3.9*K,y+0.4*K],[x+4.4*K,y+4.6*K],[x+3*K,y+9.4*K],[x,y+11*K],[x-3*K,y+9.4*K],[x-4.4*K,y+4.6*K]],bd,2,{ol:1}));
  P.push(LN(x-1.6*K,y+4*K,x-1.2*K,y+9.6*K,bd,1,{no:1}),LN(x+1.6*K,y+4*K,x+1.2*K,y+9.6*K,bd,1,{no:1}),LN(x,y+5*K,x,y+10.4*K,bd,1,{no:1}));
  P.push(C(x-3.4*K,y+6*K,x-3.6*K,y+10.2*K,0.8*K,bd),C(x+3.4*K,y+6*K,x+3.6*K,y+10.2*K,0.8*K,bd));
  P.push(E(x-3.6*K,y+9.2*K,0.9*K,0.5*K,'goldT',{flat:4}),E(x+3.6*K,y+9.2*K,0.9*K,0.5*K,'goldT',{flat:4}));
  P.push(PL([[x-3.2*K,y+3.2*K],[x-0.4*K,y+2.2*K],[x,y+2.8*K],[x+0.4*K,y+2.2*K],[x+3.2*K,y+3.2*K],[x+1.6*K,y+4.2*K],[x-1.6*K,y+4.2*K]],bd,3,{ol:1}));
  P.push(E(x,y+1.4*K,1.3*K,1.2*K,'hskin',{ol:1}),D(x-0.4*K,y+1*K,RAMP.hskin[4]));
  P.push(LN(x-3*K,y-0.8*K,x-0.8*K,y-0.4*K,bd,2,{no:1}),LN(x+3*K,y-0.8*K,x+0.8*K,y-0.4*K,bd,2,{no:1}));
  const ec=dead?RAMP.hskin[1]:COL.K;
  P.push(D(x-1.6*K,y+0.2*K,ec),D(x+1.6*K,y+0.2*K,ec));
 }
 // 兜：坑夫はろうそくの灯る坑夫帽、鍛冶屋は革の帽子、戦士は小さな角のある兜
 const mat=role==='smith'?'leather':'iron';
 P.push(PL([[x-4.2*K,y-0.8*K],[x-3.8*K,y-3.6*K],[x,y-5.2*K],[x+3.8*K,y-3.6*K],[x+4.2*K,y-0.8*K]],mat,2,{ol:1}));
 P.push(LN(x-4.2*K,y-1*K,x+4.2*K,y-1*K,mat,3,{no:1}));
 if(role!=='smith')[-3,-1,1,3].forEach(dx=>P.push(D(x+dx*K,y-1*K,RAMP.goldT[3])));
 if(role==='miner'){
  const cx2=x+(side?0.6:0)*K;
  P.push(C(cx2,y-5.2*K,cx2,y-7*K,0.8*K,'beard'),D(cx2,y-7.8*K,LAMP[0]),D(cx2,y-8.6*K,LAMP[1]),D(cx2,y-9.2*K,LAMP[2]));
 }
 if(role==='warrior'){
  P.push(C(x-3.6*K,y-3*K,x-5.6*K,y-5.4*K,0.8*K,'horn'),C(x-5.6*K,y-5.4*K,x-5.2*K,y-6.6*K,0.5*K,'horn'));
  if(!side)P.push(C(x+3.6*K,y-3*K,x+5.6*K,y-5.4*K,0.8*K,'horn'),C(x+5.6*K,y-5.4*K,x+5.2*K,y-6.6*K,0.5*K,'horn'));
  if(!back)P.push(LN(x+(side?2.6:0)*K,y-1*K,x+(side?2.6:0)*K,y+1.4*K,'iron',3,{no:1}));
 }
}}
function dPick(dir,P,hx,hy,sw,rest,k){
 if(dir==='up'&&rest)return;
 let tx,ty;
 if(rest){tx=hx+(dir==='side'?-2.4:1.6)*k;ty=hy-6*k}else{tx=hx+(dir==='side'?(1.4+sw*3)*k:0.8*k);ty=hy-(7-Math.abs(sw)*2)*k}
 P.push(LN(hx,hy+k,tx,ty,'wood',2,{no:1}));
 const ux=tx-hx,uy=ty-hy,L=Math.hypot(ux,uy)||1,nx=-uy/L,ny=ux/L;
 P.push(LN(tx-nx*3.4*k-ux/L*k,ty-ny*3.4*k-uy/L*k,tx+nx*3.4*k-ux/L*k,ty+ny*3.4*k-uy/L*k,'iron',3,{no:1}),D(tx+nx*3.4*k-ux/L*k,ty+ny*3.4*k-uy/L*k,RAMP.iron[4]));
}
function hammer(dir,P,hx,hy,sw,rest,k){
 if(dir==='up'&&rest)return;
 let tx,ty;
 if(rest){tx=hx+(dir==='side'?1:0.6)*k;ty=hy+5*k}else{tx=hx+(dir==='side'?(1+sw*2.6)*k:0.6*k);ty=hy-(5.6-Math.abs(sw)*1.5)*k}
 P.push(LN(hx,hy,tx,ty,'wood',2,{no:1}),C(tx-1.6*k,ty,tx+1.6*k,ty,1.2*k,'iron',{ol:1}));
}
function dAxe(dir,P,hx,hy,sw,rest,k){
 if(dir==='up'&&rest)return;
 let tx,ty;
 if(rest){tx=hx+(dir==='side'?-3:1.4)*k;ty=hy-6*k}else{tx=hx+(dir==='side'?(1+sw*3)*k:0.8*k);ty=hy-(6.6-Math.abs(sw)*2)*k}
 P.push(LN(hx,hy+1,tx,ty,'wood',2,{no:1}));
 const bx=tx+(dir==='side'?0.6:0.3)*k,by=ty+1.2*k;
 P.push(PL([[bx,by-2.2*k],[bx+2.8*k,by-3*k],[bx+3.4*k,by],[bx+2.8*k,by+2.4*k],[bx,by+1.4*k]],'iron',3,{ol:1}),D(bx+3*k,by,RAMP.iron[4]));
 P.push(PL([[bx,by-1.6*k],[bx-2*k,by-2.2*k],[bx-2.2*k,by+1.6*k],[bx,by+1.2*k]],'iron',2,{ol:1}));
}
function lanternOff(dir,P,x,y,k,q){
 // 手に提げたランタン（灯る）
 const lx=x+(dir==='side'?1.2*k:0),ly=y+2.6*k;
 P.push(LN(x,y,lx,ly-2*k,'iron',1,{no:1}),E(lx,ly,1.5*k,1.9*k,'iron',{ol:1}));
 P.push(D(lx,ly,LAMP[0]),D(lx,ly-1,LAMP[1]),D(lx-1,ly,LAMP[2]),D(lx+1,ly,LAMP[1]),D(lx,ly+1,LAMP[2]));
}
function dShield(dir,P,x,y,k,q){
 if(dir==='side'){P.push(E(x-0.6*k,y,1.6*k,3.4*k,'iron',{ol:1}));return}
 P.push(E(x,y,3.2*k,3.2*k,'iron',{ol:1}),E(x,y,2.4*k,2.4*k,'wood',{flat:3}),E(x,y,0.9*k,0.9*k,'goldT',{flat:4}));
 if(dir==='down')P.push(LN(x-1.4*k,y-1.4*k,x+1.4*k,y+1.4*k,'goldT',2,{no:1}),LN(x-1.4*k,y+1.4*k,x+1.4*k,y-1.4*k,'goldT',2,{no:1}));
}
function dwarfDecor(role){return(v,P,cx,hip,sh,bw,bh,k)=>{
 // 太い革帯と金の留め金。鍛冶屋は革の前掛け
 if(role==='smith'&&v!=='up')P.push(PL([[cx-bw*0.8,sh+1.4*k],[cx+bw*0.8,sh+1.4*k],[cx+bw*0.9,hip+2.4*k],[cx-bw*0.9,hip+2.4*k]],'apron',2,{ol:1}));
 P.push(LN(cx-bw,hip-0.8*k,cx+bw,hip-0.8*k,'leather',3,{no:1}),LN(cx-bw,hip-0.4*k,cx+bw,hip-0.4*k,'leather',2,{no:1}));
 if(v!=='up')P.push(E(cx,hip-0.6*k,1*k,0.8*k,'goldT',{flat:3}));
}}
/** ドワーフ：role = miner（つるはしとランタン）| smith（金槌と前掛け）| warrior（斧と盾） */
function dwarf(role,dir,act,f){
 // ずんぐりした体：大きな頭、ごく短い足、広い肩、重い長靴
 const o={s:1.35,leg:2.6,bw:4.6,bh:3.3,hh:7.4,limb:1.3,skin:'dtunic',skinD:'dtunic',cloth:'dtunic',hand:'hskin',boot:'boot',head:dwarfHead(role),decor:dwarfDecor(role)};
 if(role==='miner')Object.assign(o,{tool:dPick,off:lanternOff,offFront:true});
 else if(role==='smith')Object.assign(o,{tool:hammer,cloth:'apron'});
 else Object.assign(o,{tool:dAxe,off:dShield,pad:'iron'});
 const fr=humanoid(dir,act,f,o);
 const {W,H,px,mat}=fr;
 for(let p=0;p<W*H;p++){const r=px[p*4],g=px[p*4+1],b=px[p*4+2];if(LAMP.some(c=>c[0]===r&&c[1]===g&&c[2]===b))mat[p]='wisp'}
 return fr;
}
/** 鍛冶場：石の炉と燃える火、そばの金床 */
function forge(f){
 const q=mod(f,4),W=34,H=26,P=[];
 P.push(PL([[3,22],[3,9],[7,5],[19,5],[23,9],[23,22]],'dstone',2,{ol:1}));
 for(let y=8;y<22;y+=4)P.push(LN(4,y,22,y,'dstone',1,{no:1}));
 for(let y=8;y<22;y+=4)for(let x=(y%8?6:9);x<22;x+=6)P.push(LN(x,y,x,y+4,'dstone',1,{no:1}));
 P.push(E(13,15,6,4.6,'boot',{flat:0}));
 P.push(E(27,19,4.4,1.6,'iron',{ol:1}),LN(25,20,25,23,'iron',2,{no:1}),LN(29,20,29,23,'iron',2,{no:1}),LN(23,18,31,18,'iron',4,{no:1}));
 const fr=raster(W,H,P);
 const fl=[[0,0],[1,-1],[0,-2],[-1,-1]][q];
 const pts=[[13,17,1],[12,17,2],[14,17,2],[11,16,2],[15,16,2],[13,16,0],[12,15,1],[14,15,1],[13,14,1],[13+fl[0],13,2],[12+fl[0],12,3],[14-fl[0],12,2],[13,11+(q%2),3],[10,17,3],[16,17,3]];
 for(const [x,y,c] of pts){const p=y*W+x;fr.px[p*4]=FLAME[c][0];fr.px[p*4+1]=FLAME[c][1];fr.px[p*4+2]=FLAME[c][2];fr.px[p*4+3]=255;fr.mat[p]='wisp'}
 return {...fr,ax:13,ay:23};
}
/** 坑道の壁掛けランプ */
function wallLamp(f){
 const q=mod(f,4),W=10,H=14,P=[];
 P.push(LN(5,1,5,4,'iron',2,{no:1}),LN(2,4,8,4,'iron',3,{no:1}),E(5,8,2.6,3.4,'iron',{ol:1}));
 const fr=raster(W,H,P);
 const c=q===2?LAMP[1]:LAMP[0];
 for(const [x,y,cc] of [[5,8,c],[5,7,LAMP[1]],[4,8,LAMP[2]],[6,8,LAMP[1]],[5,9,LAMP[2]],[4,7,LAMP[2]],[6,9,LAMP[2]]]){const p=y*W+x;fr.px[p*4]=cc[0];fr.px[p*4+1]=cc[1];fr.px[p*4+2]=cc[2];fr.px[p*4+3]=255;fr.mat[p]='wisp'}
 return {...fr,ax:5,ay:12};
}


// ===== 段階8a：血の跡 =====
const BLOODC=[[[150,20,24],[110,12,18],[190,40,40]],[[110,24,20],[80,16,14],[140,40,30]],[[130,150,40],[90,110,24],[170,190,70]],[[120,116,112],[86,82,80],[150,146,140]]];
function blood(col,v){
 const W=8,H=5,px=new Uint8ClampedArray(W*H*4),mat=new Array(W*H).fill(null);
 // 小さな血だまりと、飛び散ったしずく
 const shapes=[[[3,2],[4,2],[3,1],[2,2],[4,3],[3,3],[6,1]],[[2,2],[3,2],[4,2],[5,3],[4,3],[1,1],[6,4]],[[3,1],[3,2],[4,2],[4,3],[2,3],[6,2],[1,1]],[[2,2],[3,2],[3,3],[4,2],[5,2],[4,1],[6,3],[1,4]]];
 shapes[v].forEach(([x,y],i)=>{const c=BLOODC[col][i%3];const p=y*W+x;px[p*4]=c[0];px[p*4+1]=c[1];px[p*4+2]=c[2];px[p*4+3]=255});
 return {W,H,px,mat,ax:4,ay:3};
}


// ===== 段階8b：冒険者の焚き火 =====
function campfire(f){
 const q=mod(f,4),W=20,H=16,P=[];
 // 石の輪
 for(let i=0;i<8;i++){const a=i/8*6.283;P.push(E(10+Math.cos(a)*7,11+Math.sin(a)*3.4,1.6,1.2,'iron',{ol:1}))}
 // 組んだ薪
 P.push(LN(5,13,15,9,'wood',2,{no:1}),LN(5,9,15,13,'wood',2,{no:1}),LN(10,8,10,14,'wood',1,{no:1}));
 const fr=raster(W,H,P);
 const fl=[[0,0],[1,-1],[0,-2],[-1,-1]][q];
 const pts=[[10,11,1],[9,11,2],[11,11,2],[8,10,2],[12,10,2],[10,10,0],[9,9,1],[11,9,1],[10,8,1],[10+fl[0],7,2],[9+fl[0],6,3],[11-fl[0],6,2],[10,5+(q%2),3],[8,11,3],[12,11,3],[10-fl[0],4,3]];
 for(const [x,y,c] of pts){const p=y*W+x;fr.px[p*4]=FLAME[c][0];fr.px[p*4+1]=FLAME[c][1];fr.px[p*4+2]=FLAME[c][2];fr.px[p*4+3]=255;fr.mat[p]='wisp'}
 return {...fr,ax:10,ay:13};
}


// ===== 外とつながる口、卵、子 =====
function setPx(fr,x,y,c,emis){if(x<0||y<0||x>=fr.W||y>=fr.H)return;const p=y*fr.W+x;fr.px[p*4]=c[0];fr.px[p*4+1]=c[1];fr.px[p*4+2]=c[2];fr.px[p*4+3]=255;if(emis)fr.mat[p]='wisp'}
function blank(W,H){return {W,H,px:new Uint8ClampedArray(W*H*4),mat:new Array(W*H).fill(null)}}
/**
 * 地表の横穴の外：洞窟の口の向こうの、日の当たる草地。口の縁は不揃いで、草と小さな花が洞窟の床へはみ出し、
 * 縁の岩から蔦が垂れる。night なら月明かりの青。左の端の口の形（右の端は左右を反転して使う）
 */
function outside(night,f){
 const W=30,H=56,fr=blank(W,H),q=mod(f,4);
 const top=8,bot=H-8;
 const edge=y=>16+Math.round(Math.sin(y*0.45)*1.5+hz(0,y>>1,21)*4);
 const dark=t=>night?[t[0]*0.22+8,t[1]*0.26+12,t[2]*0.42+36]:t;
 for(let y=top;y<bot;y++){
  const ex=edge(y);
  for(let x=0;x<W;x++){
   if(x>ex)break;
   const v=hz(x>>1,y>>1,11),w=hz(x,y,12);
   let c=v<0.3?[86,138,62]:v<0.7?[104,156,70]:[120,172,82];
   if(w<0.07)c=[166,210,112];
   if(hz(x>>2,y>>2,13)<0.1)c=[156,150,134];
   if(w>0.985)c=[250,246,210];
   if(w>0.975&&w<=0.985)c=[250,214,90];
   const l=0.8+0.4*(1-x/ex);
   c=c.map(t=>Math.min(255,t*l));
   // 縁ほど、洞窟の床へ溶け込む
   const fade=Math.max(0,(x-(ex-4))/4);
   setPx(fr,x,y,dark(c.map(t=>t*(1-fade*0.45))),x<ex-1);
  }
  // 洞窟の床へはみ出す草の房
  if(hz(1,y,22)<0.35){const L=2+Math.floor(hz(2,y,22)*4);for(let k=0;k<L;k++)setPx(fr,ex+1+k,y-(k>>1),dark(k===L-1?[150,200,96]:[72,120,52]),false)}
 }
 // 口の縁の岩（上と下）
 for(const [y0,dir] of [[top-1,-1],[bot,1]]){for(let k=0;k<8;k++)for(let x=0;x<W-4;x++){const y=y0+dir*k;if(k>2+hz(x,k,23)*4)continue;const hl=k===0;setPx(fr,x,y,night?[22,22,30]:hl?[112,104,120]:[54,50,62],false)}}
 // 蔦
 for(let i=0;i<7;i++){const x=3+i*3+(i&1),len=5+Math.floor(hz(i,1,14)*9);for(let k=0;k<len;k++){const sw=Math.round(Math.sin(q*1.57+i+k*0.5)*k*0.1);const c=k===len-1?[150,200,90]:k%3===0?[96,150,64]:[64,110,48];setPx(fr,x+sw,top+k,dark(c),false)}}
 return {...fr,ax:8,ay:H/2+8};
}
/** 上の端の横穴の外：左の端の横穴の外の絵を、縦と横を入れ替えたもの（草地が上、縁から蔦が下へ垂れる） */
function outsideTop(night,f){
 const a=outside(night,f),W=a.H,H=a.W,fr=blank(W,H);
 for(let y=0;y<a.H;y++)for(let x=0;x<a.W;x++){const p=(y*a.W+x)*4;if(!a.px[p+3])continue;const q=(x*W+y)*4;fr.px[q]=a.px[p];fr.px[q+1]=a.px[p+1];fr.px[q+2]=a.px[p+2];fr.px[q+3]=255;fr.mat[x*W+y]=a.mat[y*a.W+x]}
 return {...fr,ax:a.ay,ay:a.ax};
}
/**
 * ダンジョンの正面の入口：外から下りてくる石の階段、両側の石の柱とアーチ、柱の脇で昼も夜も燃えるかがり火、
 * 階段の上に見える外の地面と空（昼は明るく、夜は月明かりの青）。入口の2マスと両脇の1マスずつ、上の端から3マス分
 */
function gate(night,f){
 const q=mod(f,4),W=64,H=54,fr=blank(W,H);
 const sky=night?[[18,24,52],[28,36,70]]:[[150,196,236],[188,220,246]];
 // 外：空と地面（光る）
 for(let y=0;y<10;y++)for(let x=16;x<48;x++){const t=y/10;let c=sky[0].map((v,i)=>v+(sky[1][i]-v)*t);if(y>=6){const g=night?[24,40,30]:[96,140,70];c=hz(x,y,31)<0.3?g.map(v=>v*1.2):g}setPx(fr,x,y,c,true)}
 // 階段：外から下りてくる。上ほど明るい（昼は日が差し、夜は暗い）
 for(let st=0;st<9;st++){const y0=10+st*4;const lit=night?0.5:1-st*0.06;for(let y=y0;y<y0+4;y++)for(let x=17+Math.min(st,3);x<47-Math.min(st,3);x++){const edge=y===y0;let c=edge?[168,160,150]:(hz(x>>2,st,32)<0.5?[120,114,110]:[108,102,100]);if(x%8===0&&!edge)c=c.map(v=>v*0.82);setPx(fr,x,y,c.map(v=>Math.min(255,v*lit+(night?6:0))),false)}}
 // 柱（左右）とアーチ
 for(const px of [8,48]){for(let y=6;y<50;y++)for(let x=px;x<px+8;x++){const e=x===px||x===px+7;let c=e?[70,64,76]:(((y>>2)+(x>>2))%2?[150,142,140]:[134,126,126]);if((y&3)===0)c=[84,78,86];setPx(fr,x,y,c,false)}
  for(let x=px-1;x<px+9;x++){setPx(fr,x,5,[176,168,160],false);setPx(fr,x,6,[110,104,108],false);setPx(fr,x,49,[110,104,108],false)}}
 for(let x=10;x<54;x++){const dx=(x-32)/22;const top=Math.round(1+5*(dx*dx));for(let y=top;y<top+4;y++){const c=y===top?[184,176,168]:(((x>>2)+y)%2?[140,132,130]:[124,118,118]);setPx(fr,x,y,c,false)}}
 // かがり火（柱の脇の鉄の籠と炎。光る）
 for(const bx of [3,60]){for(let y=40;y<52;y++){setPx(fr,bx,y,[60,56,58],false)}for(let x=bx-3;x<=bx+3;x++){setPx(fr,x,38,[80,74,76],false);setPx(fr,x,40,[60,56,58],false)}
  const fl=[[0,0],[1,-1],[0,-2],[-1,-1]][q];
  const pts=[[0,37,1],[-1,37,2],[1,37,2],[-2,36,2],[2,36,2],[0,36,0],[-1,35,1],[1,35,1],[0,34,1],[fl[0],33,2],[fl[0]-1,32,3],[-fl[0],32,2],[0,31+(q%2),3]];
  for(const [dx,y,c] of pts)setPx(fr,bx+dx,y,FLAME[c],true)}
 return {...fr,ax:32,ay:0};
}
/** 地底の裂け目：床を縦に裂く割れ目。縁の岩の段差、奥の紫の光（光る）、縁に育つ紫水晶 */
function fissure(f){
 const W=30,H=46,fr=blank(W,H),q=mod(f,4),pulse=[0.85,1,0.9,0.75][q];
 const cx=y=>15+Math.sin(y*0.28)*3+Math.sin(y*0.09+1)*2;
 const wd=y=>Math.max(0,4.6-Math.abs(y-23)*0.19);
 for(let y=0;y<H;y++){const c0=cx(y),w=wd(y);if(w<=0.4)continue;
  for(let x=Math.floor(c0-w-2);x<=c0+w+2;x++){const d=x-c0,ad=Math.abs(d);
   if(ad>w&&ad<=w+1.4){setPx(fr,x,y,d<0?[150,140,168]:[96,88,112],false);continue}
   if(ad>w)continue;
   const depth=1-ad/w;
   if(depth>0.72){const g=pulse*(0.75+0.25*Math.sin(y*0.5+q));setPx(fr,x,y,[Math.round(150+80*g),Math.round(70+60*g),Math.round(210+45*g)],true)}
   else{const band=Math.min(2,Math.floor(depth*3.2));const pal=[[66,46,90],[44,26,68],[26,12,46]];let c=pal[band];if(d<0&&band===0)c=c.map(v=>v*1.3);setPx(fr,x,y,c,false)}
  }}
 // 床に走るひび
 for(const [y0,dir] of [[10,1],[17,-1],[29,1],[36,-1]]){let x=cx(y0)+dir*(wd(y0)+1),y=y0;for(let k=0;k<7;k++){x+=dir*(1+hz(k,y0,15)*0.6);y+=hz(k,y0,16)-0.5;setPx(fr,Math.round(x),Math.round(y),[30,26,38],false)}}
 // 紫水晶
 for(const [yc,dir] of [[12,-1],[19,1],[28,-1],[34,1]]){const x0=cx(yc)+dir*(wd(yc)+2.2);const h=3+Math.floor(hz(yc,1,17)*3);for(let k=0;k<h;k++){const ww=Math.max(0,Math.round((h-k)/2.4));for(let xx=-ww;xx<=ww;xx++){const c=xx<0?RAMP.crystal[3]:xx===0?RAMP.crystal[2]:RAMP.crystal[1];setPx(fr,Math.round(x0+xx),Math.round(yc-k),k===h-1?RAMP.crystal[4]:c,k>=h-2)}}}
 return {...fr,ax:15,ay:30};
}
/** 裂け目から立ちのぼる光の粒（光る） */
function mote(f){const fr=blank(3,3),q=mod(f,4);const c=[[220,180,255],[190,130,255],[160,100,230],[120,70,190]][q];setPx(fr,1,1,c,true);if(q<2){setPx(fr,0,1,c.map(v=>v*0.7),true);setPx(fr,2,1,c.map(v=>v*0.7),true);setPx(fr,1,0,c.map(v=>v*0.7),true)}return {...fr,ax:1,ay:1}}
/** 地下の川の口：壁にうがたれた石組みのアーチから、水が白く泡立ちながら落ち、下の水たまりに波紋が広がる */
function inlet(f){
 const W=26,H=34,fr=blank(W,H),q=mod(f,4);
 const ax=13,aw=9;
 // 石組みのアーチ（壁の正面）。内側は奥へ向かって暗くなる
 for(let y=0;y<15;y++)for(let x=ax-aw;x<=ax+aw;x++){
  const dx=(x-ax)/aw,top=Math.round(6*(1-Math.sqrt(Math.max(0,1-dx*dx))));
  if(y<top)continue;
  const rim=y<=top+1||Math.abs(x-ax)>=aw-1;
  if(rim){const blk=((x+(y>>1))%4===0)||((y>>1)%3===0);setPx(fr,x,y,blk?[70,64,82]:y<=top?[150,142,164]:[118,110,132],false);continue}
  const d=(y-top)/14;setPx(fr,x,y,[Math.round(8+d*14),Math.round(12+d*24),Math.round(22+d*40)],false);
 }
 // 落ちる水：中ほどは青く、縁と筋は白く泡立つ（明るい筋は光って見える）
 for(let y=8;y<26;y++)for(let x=ax-5;x<=ax+5;x++){
  const ph=(y*2-q*3.2+Math.abs(x-ax)*0.7)%8;
  let c=[58,110,176],e=false;
  if(ph<1.4){c=[226,242,255];e=true}else if(ph<3)c=[132,184,232];
  if(Math.abs(x-ax)>=4)c=c.map(v=>Math.min(255,v*0.85+30));
  setPx(fr,x,y,c,e);
 }
 // 水たまりの泡と波紋
 for(let y=25;y<33;y++)for(let x=2;x<W-2;x++){
  const dx=(x-ax)/11,dy=(y-28.5)/4;const d=Math.sqrt(dx*dx+dy*dy);if(d>1)continue;
  const ring=Math.abs(((d*3-q*0.25)%1)-0.5)<0.12;
  let c=d<0.35?[214,236,252]:ring?[150,196,236]:[50,98,160];
  setPx(fr,x,y,c,d<0.3);
 }
 for(let i=0;i<10;i++){const x=ax-6+Math.round(hz(i,q,18)*12),y=22+Math.round(hz(i,q+4,18)*6);setPx(fr,x,y,[240,250,255],true)}
 return {...fr,ax:13,ay:28};
}
/** クモの卵嚢：床と壁の角に張った糸に、白い繭の玉がいくつか。糸が巻きつき、孵る間際に揺れる */
function eggSac(f){
 const q=mod(f,2),W=22,H=16,P=[];
 for(let i=0;i<9;i++){const a=i/9*6.283+0.3;P.push(LN(11,9,11+Math.cos(a)*11,9+Math.sin(a)*7,'silk',0,{no:1}))}
 [[7,8,3.4,3.8],[12,6,3.8,4.2],[10,11,3.2,3],[15,10,2.8,3]].forEach(([x,y,rx,ry],i)=>P.push(E(x+(q&&i===1?0.7:0),y,rx,ry,'silk',{ol:1})));
 const fr=raster(W,H,P);
 // 巻きついた糸の筋と、つやの点
 for(const [x,y] of [[6,6],[8,10],[11,4],[13,8],[9,12],[15,11]])setPx(fr,x,y,RAMP.silk[1],false);
 for(const [x,y] of [[6,6],[11,4],[9,10]])setPx(fr,x,y-1,[255,255,255],false);
 return {...fr,ax:11,ay:11};
}
/** トカゲの卵：掘り返した土のくぼみに、斑点のある楕円の卵が五つ。ときどき一つが揺れる */
function clutch(f){
 const q=mod(f,4),W=26,H=16,P=[];
 P.push(E(13,9,12,6,'boot',{flat:1}),E(13,9,10,4.6,'leather',{flat:0}));
 const eggs=[[7,7],[13,6],[19,7],[10,11],[16,11]];
 eggs.forEach(([x,y],i)=>P.push(E(x+(i===3&&q===1?1:i===3&&q===3?-1:0),y,2.8,2.2,'eggL',{ol:1})));
 const fr=raster(W,H,P);
 eggs.forEach(([x,y],i)=>{const w=i===3&&q===1?1:i===3&&q===3?-1:0;setPx(fr,x+w-1,y-1,[255,252,240],false);setPx(fr,x+w+1,y,[140,112,74],false);setPx(fr,x+w-1,y+1,[150,120,82],false)});
 // くぼみの縁の土と小石
 for(let i=0;i<14;i++){const a=i/14*6.283;setPx(fr,Math.round(13+Math.cos(a)*12),Math.round(9+Math.sin(a)*6),hz(i,1,24)<0.5?[110,92,70]:[86,72,56],false)}
 return {...fr,ax:13,ay:11};
}
/** 大ネズミの子：小さく、毛の生えそろわない桃色の体。耳と閉じた目、細い尾 */
function ratPup(dir,act,f){
 const q=mod(f,4),mv=act==='move',P=[];
 const bob=mv?[0,-1,0,-1][q]:0,leg=mv?[1,0,-1,0][q]:0;
 if(dir==='side'){
  P.push(C(1,9+bob,5,8+bob,0.5,'pup'),C(7+leg,10,7+leg,11,0.6,'pup'),C(11-leg,10,11-leg,11,0.6,'pup'));
  P.push(E(9,8+bob,3.8,2.8,'pup',{ol:1}),E(13,7+bob,2.4,2,'pup',{ol:1}),E(12,4.8+bob,1.2,1.2,'pup',{ol:1}));
  const fr=raster(18,13,P);setPx(fr,14,6+bob,[120,60,70],false);setPx(fr,16,7+bob,[236,150,160],false);setPx(fr,8,7+bob,RAMP.pup[4],false);
  return {...fr,ax:9,ay:11};
 }
 const up=dir==='up';
 P.push(C(9,up?3:11,9+(q&1),up?0:14,0.5,'pup'),E(9,8+bob,3.2,3.6,'pup',{ol:1}),E(9,up?10+bob:4.6+bob,2.2,2,'pup',{ol:1}));
 if(!up)P.push(E(7,3+bob,1,1,'pup',{ol:1}),E(11,3+bob,1,1,'pup',{ol:1}));
 const fr=raster(18,15,P);
 if(!up){setPx(fr,8,4+bob,[120,60,70],false);setPx(fr,10,4+bob,[120,60,70],false);setPx(fr,9,6+bob,[236,150,160],false)}
 setPx(fr,8,7+bob,RAMP.pup[4],false);
 return {...fr,ax:9,ay:12};
}


// ===== 眠り：Z の部品と、眠り専用の姿 =====
/** 眠りの Z。big なら大きな Z（深い眠り）、そうでなければ小さな z。縁取りつきで暗がりでも読める（光る） */
function zMark(big,f){
 const q=mod(f,4);
 // 小さな z も 4×4 px（前は3×3で、暗い所では見分けにくかった）。縁取りは斜めにも回して、明るい床の上でも読める
 const pat=big?['#####','...#.','..#..','.#...','#####']:['####','..#.','.#..','####'];
 const W=pat[0].length+2,H=pat.length+2,fr=blank(W,H);
 const a=[1,0.9,0.75,0.55][q];
 const fill=[Math.round(220*a+20),Math.round(230*a+20),Math.round(255*a)],ol=[14,16,36];
 for(let y=0;y<pat.length;y++)for(let x=0;x<pat[0].length;x++)if(pat[y][x]==='#'){
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+1+dx,Y=y+1+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const p=Y*W+X;if(!fr.px[p*4+3])setPx(fr,X,Y,ol,false)}
 }
 for(let y=0;y<pat.length;y++)for(let x=0;x<pat[0].length;x++)if(pat[y][x]==='#')setPx(fr,x+1,y+1,fill,true);
 return {...fr,ax:Math.floor(W/2),ay:H-1};
}
/** 半分だけ眠る種の、開いたままの片目（光る点） */
function halfEye(f){const fr=blank(3,3),q=mod(f,4);const c=q===3?[180,170,90]:[255,240,140];setPx(fr,1,1,c,true);return {...fr,ax:1,ay:1}}
/** 眠るドラゴン：宝の山の上で丸くなり、翼をたたみ、尾を体に巻きつけ、頭を前脚にのせて目を閉じる。呼吸で胸がふくらむ */
function dragonSleep(f){
 const q=mod(f,4),W=86,H=56,P=[];
 const br=[0,0.6,1,0.6][q];
 // 巻きつけた尾
 P.push(C(70,44,78,36,4,'drg'),C(78,36,76,26,3.4,'drg'),C(76,26,66,22,2.8,'drg'),C(66,22,56,24,2.2,'drgD'));
 P.push(PL([[56,24],[52,21],[53,27]],'drgD',2,{ol:1}));
 // 丸くなった胴（呼吸でふくらむ）
 P.push(E(48,38,24+br,13+br*0.6,'drg',{ol:1}),E(44,45,12,3.4,'drgB',{flat:2}));
 // たたんだ翼
 P.push(PL([[30,30],[42,18],[58,16],[66,26],[56,34],[38,36]],'drgW',2,{ol:1}));
 for(const t of [[44,19,40,32],[52,17,50,33],[60,20,60,31]])P.push(LN(t[0],t[1],t[2],t[3],'drgD',1,{no:1}));
 // 背の棘
 for(let i=0;i<5;i++){const x=34+i*7,y=26-Math.abs(i-2)*1.2;P.push(PL([[x-1.6,y],[x+0.4,y-3.6],[x+1.6,y]],'drgD',2,{ol:1}))}
 // 前脚と、その上の頭（目を閉じる）
 P.push(E(24,46,7,3.2,'drg',{ol:1}),C(30,40,22,40,4.2,'drg'),E(17,40,8,5.2,'drg',{ol:1}),E(11,42,4.2,3,'drg',{ol:1}));
 P.push(PL([[19,36],[23,30],[24,36]],'horn',2,{ol:1}),PL([[14,36],[16,31],[18,36]],'horn',2,{ol:1}));
 const fr=raster(W,H,P);
 scales(fr,['drg','drgD'],9);
 // 閉じた目の線と、鼻先から漏れるかすかな熾火の息
 for(const [x,y] of [[16,39],[17,39],[18,40]])setPx(fr,x,y,[30,10,10],false);
 if(q===2){setPx(fr,7,41,[255,170,70],true);setPx(fr,6,40,[200,120,60],true)}
 return {...fr,ax:44,ay:48};
}
/** 焚き火を囲んで眠る冒険者：毛布にくるまって横になり、頭だけ出す。毛布の色は職業ごと */
function bedroll(job,f){
 const q=mod(f,4),W=26,H=14,P=[];
 const cols={warrior:'tabard',wizard:'robeB',thief:'hood',priest:'robeW',bard:'bardR',hunter:'forest',slayer:'plate'};
 const m=cols[job]||'leather';
 const br=q===1||q===2?0.5:0;
 P.push(E(14,8,10+br,4.4+br*0.5,m,{ol:1}),LN(6,6,22,6,m,1,{no:1}),LN(8,10,21,10,m,1,{no:1}));
 P.push(E(4,7,3.2,3.2,'hskin',{ol:1}));
 if(job==='warrior')P.push(E(4,5.6,3.2,2,'mail',{ol:1}));
 else if(job==='wizard')P.push(PL([[1,6],[7,6],[3,1]],'robeB',2,{ol:1}));
 else if(job==='thief')P.push(E(4,6,3.4,3.2,'hood',{ol:1}));
 else P.push(E(4,5.4,3,1.8,'hair',{ol:1}));
 const fr=raster(W,H,P);
 setPx(fr,3,7,[60,40,36],false);setPx(fr,5,7,[60,40,36],false);
 return {...fr,ax:13,ay:11};
}
/** ねぐらで眠るコウモリ：逆さにぶら下がり、翼で体を包む */
function batSleep(f){
 const q=mod(f,4),W=14,H=19,P=[];
 P.push(LN(5,0,5,3,'bat',2,{no:1}),LN(9,0,9,3,'bat',2,{no:1}));
 P.push(E(7,8+(q===2?0.5:0),5,6,'bat',{ol:1}),PL([[2,5],[7,3],[12,5],[11,12],[3,12]],'bat',3,{ol:1}));
 P.push(LN(7,4,7,12,'bat',1,{no:1}),LN(4,6,5,11,'bat',1,{no:1}),LN(10,6,9,11,'bat',1,{no:1}));
 P.push(E(7,15,3.2,2.6,'bat',{ol:1}),PL([[4.6,16],[4,19],[6,17]],'bat',2),PL([[9.4,16],[10,19],[8,17]],'bat',2));
 const fr=raster(W,H,P);
 return {...fr,ax:7,ay:1};
}
/** 目覚める前のワーム：とぐろを巻いて眠る。巻きの間に隙間を残し、節の帯で一巻きずつ読めるように。頭は外側で、口の歯の輪を閉じている */
function wormCoil(f){
 const q=mod(f,4),W=48,H=34,P=[];
 const br=[0,0.3,0.6,0.3][q];
 const pts=[];
 for(let i=0;i<=48;i++){const t=i/48,a=t*Math.PI*2*2.1,r=4+t*13;pts.push([24+Math.cos(a)*r*1.25,17+Math.sin(a)*r*0.72])}
 // 内側から外側へ（外側の巻きが手前）
 for(let i=0;i<pts.length-1;i++){const [x0,y0]=pts[i],[x1,y1]=pts[i+1];const th=2.0+i*0.035+br*0.15;P.push(C(x0,y0,x1,y1,th,'worm'))}
 const fr0=raster(W,H,P);
 const fr=fr0;
 // 巻きの境目を暗く、節の帯を明るく
 for(let i=1;i<pts.length;i+=2){const [x,y]=pts[i];const [px,py]=pts[i-1];const nx=-(y-py),ny=(x-px);const L=Math.hypot(nx,ny)||1;const th=2.0+i*0.035;for(let s=-th;s<=th;s+=0.5)setPx(fr,Math.round(x+nx/L*s),Math.round(y+ny/L*s),i%4===1?RAMP.wormB[2]:RAMP.wormD[2],false)}
 // 頭：外側の端に、少し持ち上がった丸い頭と、閉じた歯の輪
 const [hx,hy]=pts[pts.length-1];
 const P2=[E(hx+1,hy-1,4.2,3.6,'worm',{ol:1}),E(hx+2,hy-1.5,2.2,1.8,'wormD',{flat:0})];
 const hf=raster(W,H,P2);
 for(let i=0;i<W*H;i++)if(hf.px[i*4+3]){fr.px[i*4]=hf.px[i*4];fr.px[i*4+1]=hf.px[i*4+1];fr.px[i*4+2]=hf.px[i*4+2];fr.px[i*4+3]=255}
 for(let k=0;k<6;k++){const a=k/6*6.283;setPx(fr,Math.round(hx+2+Math.cos(a)*1.6),Math.round(hy-1.5+Math.sin(a)*1.3),[230,220,190],false)}
 return {...fr,ax:24,ay:28};
}


// ===== 見た目の粒：塵、火の粉、胞子、しずく =====
/** kind：0 光の筋に舞う塵（白っぽい）、1 火の粉（橙）、2 胞子（淡い緑）、3 しずく（青白い）。f は消えていく段（0〜3）。どれも光る */
function speck(kind,f){
 const q=mod(f,4);
 const cols=[[[250,244,220],[220,214,196],[180,176,164],[130,128,124]],[[255,236,150],[255,180,70],[230,110,40],[160,60,30]],[[214,255,206],[170,230,170],[120,190,130],[80,140,96]],[[220,240,255],[170,210,245],[120,170,225],[80,120,180]]][kind];
 const fr=blank(3,3);const c=cols[q];
 setPx(fr,1,1,c,true);
 if(q<2&&kind!==0){const d=c.map(v=>Math.round(v*0.55));setPx(fr,1,0,d,true);if(kind===3)setPx(fr,1,2,d,true)}
 return {...fr,ax:1,ay:1};
}


// ===== 生き物のまわりの、見た目だけの淡い暈 =====
/** size：0 小、1 中、2 大。まばらな点で淡い光の輪を描く（光る。暗がりでだけ目に入る明るさ） */
function halo(size){
 const R=[7,11,18][size],W=R*2+1,H=Math.round(R*1.3)+1,fr=blank(W,H);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const dx=(x-R)/R,dy=(y-H/2)/(H/2);const d=Math.sqrt(dx*dx+dy*dy);if(d>1)continue;
  const a=(1-d)*(1-d);
  if(BAYER4[(y&3)*4+(x&3)]/16<a*0.4)setPx(fr,x,y,[Math.round(46+40*a),Math.round(52+44*a),Math.round(78+60*a)],true);
 }
 return {...fr,ax:R,ay:Math.round(H*0.62)};
}
const BAYER4=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];


// ===== 宝：溜まった量で五段階、持ち主で飾りを変える =====
/**
 * tier：0 散らばった数枚、1 小さな山、2 山と小箱、3 大きな山と宝箱と杯と宝石、4 宝の山（宝箱、王冠、突き立った剣）。
 * owner：'' 持ち主なし、vault 宝物庫（古い石の箱と壺）、goblin ゴブリン（粗末な袋）、dwarf ドワーフ（金の延べ棒）、dragon ドラゴン（特大の山）。
 * 金貨は一枚ずつ、丸い縁と光る面を持つ硬貨として描く
 */
function hoardArt(tier,owner,f){
 const q=mod(f,2);
 const big=owner==='dragon'&&tier>=3;
 const W=[18,24,32,44,big?64:56][tier],H=[10,16,22,32,big?50:42][tier];
 const fr=blank(W,H);
 const G=RAMP.gold;
 const coin=(x,y,face)=>{ // 3×2 の硬貨。face：0 横向き、1 正面（丸い）
  x=Math.round(x);y=Math.round(y);
  if(face){setPx(fr,x,y,G[3],false);setPx(fr,x+1,y,G[4],false);setPx(fr,x,y+1,G[2],false);setPx(fr,x+1,y+1,G[3],false);setPx(fr,x-1,y,G[1],false);setPx(fr,x+2,y+1,G[1],false);setPx(fr,x,y-1,G[1],false);setPx(fr,x+1,y+2,G[1],false)}
  else{setPx(fr,x-1,y,G[1],false);setPx(fr,x,y,G[3],false);setPx(fr,x+1,y,G[4],false);setPx(fr,x+2,y,G[2],false);setPx(fr,x,y+1,G[1],false);setPx(fr,x+1,y+1,G[1],false)}
 };
 // 山：下から硬貨を積む（山の形の中に、少しずつずらして並べる）
 const mound=(cx,base,rx,ry,seed)=>{
  for(let y=Math.floor(base-ry);y<=base;y++){
   const t=(base-y)/ry;const half=rx*Math.sqrt(Math.max(0,1-t*t));
   for(let x=Math.floor(cx-half);x<=cx+half;x++){setPx(fr,x,y,y<base-ry*0.55?G[2]:G[1],false)}
  }
  for(let i=0;i<rx*ry*0.9;i++){const a=hz(i,seed,40),b=hz(i,seed,41);const y=base-b*ry*0.95;const t=(base-y)/ry;const half=rx*Math.sqrt(Math.max(0,1-t*t));coin(cx+(a-0.5)*2*half*0.9,y-1,hz(i,seed,42)<0.35?1:0)}
 };
 const chest=(x,y,stone,open)=>{ // 宝箱（木と鉄）か、古い石の箱
  const c1=stone?[118,112,120]:[110,70,36],c2=stone?[84,80,88]:[70,44,22],band=stone?[150,144,150]:[150,154,166];
  for(let yy=0;yy<6;yy++)for(let xx=0;xx<9;xx++){let c=yy===0?c1:xx===0||xx===8||yy===5?c2:c1;if(!stone&&(xx===2||xx===6))c=band;setPx(fr,x+xx,y+yy,c,false)}
  if(open){for(let xx=0;xx<9;xx++){setPx(fr,x+xx,y-3,c2,false);setPx(fr,x+xx,y-2,c1,false)}for(let xx=1;xx<8;xx++)setPx(fr,x+xx,y,xx%2?G[4]:G[3],false);setPx(fr,x+3,y-1,G[3],false);setPx(fr,x+5,y-1,G[4],false)}
  else setPx(fr,x+4,y+2,stone?[60,58,64]:G[3],false);
 };
 const goblet=(x,y)=>{for(let yy=0;yy<3;yy++){setPx(fr,x-1,y+yy,G[3],false);setPx(fr,x,y+yy,G[4],false);setPx(fr,x+1,y+yy,G[2],false)}setPx(fr,x,y+3,G[2],false);setPx(fr,x,y+4,G[2],false);setPx(fr,x-1,y+5,G[2],false);setPx(fr,x,y+5,G[3],false);setPx(fr,x+1,y+5,G[2],false);setPx(fr,x,y+1,RAMP.gemR[3],false)};
 const gem=(x,y,r)=>{setPx(fr,x,y,r[3],false);setPx(fr,x+1,y,r[4],false);setPx(fr,x,y+1,r[2],false);setPx(fr,x+1,y+1,r[2],false)};
 const crown=(x,y)=>{for(let xx=0;xx<7;xx++){setPx(fr,x+xx,y+2,G[3],false);setPx(fr,x+xx,y+3,G[2],false)}for(const xx of [0,3,6]){setPx(fr,x+xx,y+1,G[4],false);setPx(fr,x+xx,y,G[3],false)}setPx(fr,x+3,y+2,RAMP.gemB[3],false)};
 const sword=(x,y,len)=>{for(let i=0;i<len;i++){setPx(fr,x,y+i,i<2?[90,60,30]:[200,206,218],false);if(i>1)setPx(fr,x+1,y+i,[140,146,160],false)}for(let xx=-2;xx<=3;xx++)setPx(fr,x+xx,y+2,G[2],false)};
 const urn=(x,y)=>{for(let yy=0;yy<8;yy++){const w=yy<2?1:yy<6?3:2;for(let xx=-w;xx<=w;xx++)setPx(fr,x+xx,y+yy,xx<0?[146,140,148]:xx===w?[86,82,92]:[118,112,122],false)}for(let xx=-2;xx<=2;xx++)setPx(fr,x+xx,y,[90,86,96],false)};
 const sack=(x,y)=>{for(let yy=0;yy<8;yy++){const w=yy<2?1:yy<7?3:2;for(let xx=-w;xx<=w;xx++)setPx(fr,x+xx,y+yy,xx<0?[150,120,80]:xx===w?[90,66,40]:[124,96,60],false)}setPx(fr,x,y-1,[90,66,40],false);coin(x+3,y+7,0);coin(x+5,y+8,1)};
 const ingots=(x,y,n)=>{for(let i=0;i<n;i++){const ox=x+(i%3)*5+(Math.floor(i/3)%2)*2,oy=y-Math.floor(i/3)*2;for(let xx=0;xx<5;xx++){setPx(fr,ox+xx,oy,G[4],false);setPx(fr,ox+xx,oy+1,G[2],false)}setPx(fr,ox,oy,G[3],false)}};
 const cx=W/2,base=H-2;
 if(tier===0){for(let i=0;i<5;i++)coin(3+hz(i,1,43)*(W-7),base-1-hz(i,2,43)*4,i%2)}
 else if(tier===1){mound(cx,base,6,5,1);coin(cx-8,base,0);coin(cx+6,base-1,1)}
 else if(tier===2){mound(cx-2,base,9,8,2);chest(cx+3,base-5,owner==='vault',false);coin(cx-12,base,1)}
 else if(tier===3){mound(cx-3,base,15,13,3);chest(cx+5,base-6,owner==='vault',true);goblet(cx-10,base-15);gem(cx-3,base-8,RAMP.gemR);gem(cx+1,base-11,RAMP.gemB);gem(cx-8,base-5,RAMP.gemG)}
 else{const rx=big?28:22,ry=big?26:20;mound(cx,base,rx,ry,4);chest(cx-rx+2,base-7,owner==='vault',true);chest(cx+rx-12,base-6,owner==='vault',false);crown(cx-3,base-ry-4);sword(cx+8,base-ry-3,10);sword(cx-12,base-ry+1,8);gem(cx-6,base-ry*0.6,RAMP.gemR);gem(cx+4,base-ry*0.5,RAMP.gemB);gem(cx-14,base-5,RAMP.gemG);gem(cx+12,base-8,RAMP.gemR);goblet(cx+16,base-10)}
 // 持ち主の飾り
 if(owner==='vault'&&tier>=1)urn(tier>=3?6:3,base-8);
 if(owner==='goblin'&&tier>=1)sack(W-5,base-8);
 if(owner==='dwarf'&&tier>=1)ingots(1,base-1,Math.min(9,tier*3));
 // きらめき（光る）
 for(let i=0;i<1+tier;i++){const x=Math.round(3+hz(i,q+tier*3,44)*(W-6)),y=Math.round(base-hz(i,q+7,45)*(H-4));const p=y*W+x;if(x<1||y<1||x>=W-1||y>=H-1||!fr.px[p*4+3])continue;setPx(fr,x,y,[255,250,220],true);if(q===0){setPx(fr,x-1,y,[255,236,170],true);setPx(fr,x+1,y,[255,236,170],true);setPx(fr,x,y-1,[255,236,170],true);setPx(fr,x,y+1,[255,236,170],true)}}
 return {...fr,ax:Math.round(cx),ay:base};
}


// ===== 気づいた印と、当たった印 =====
/**
 * 「！」か「？」の吹き出し：暗い縁取りの吹き出しに、光る太い字（明るい所では暗い吹き出しが、暗い所では光る字が目に入る）。
 * 9×12 px（吹き出し 9×10 と下の尾）。字は 5×8 px で、線の太さは2〜3 px
 */
function mark(kind){
 const pat=kind==='!'
  ?['.###.','.###.','.###.','.###.','..#..','.....','.###.','.###.']
  :['.###.','##.##','...##','..##.','..#..','.....','..#..','..#..'];
 const W=9,BH=10,H=12,fr=blank(W,H);
 const fill=kind==='!'?[255,214,90]:[170,220,255],shade=kind==='!'?[224,150,40]:[110,170,230],ol=[14,10,16],bg=[46,38,48];
 for(let y=0;y<BH;y++)for(let x=0;x<W;x++){
  const corner=(x===0||x===W-1)&&(y===0||y===BH-1);
  if(corner)continue;
  const edge=y===0||y===BH-1||x===0||x===W-1||((x===1||x===W-2)&&(y===1||y===BH-2));
  setPx(fr,x,y,edge?ol:bg,false);
 }
 // 下の尾
 setPx(fr,4,BH-1,bg,false);setPx(fr,3,BH,ol,false);setPx(fr,4,BH,bg,false);setPx(fr,5,BH,ol,false);setPx(fr,4,BH+1,ol,false);
 for(let y=0;y<8;y++)for(let x=0;x<5;x++)if(pat[y][x]==='#'){
  // 字の下の端と右の端は少し濃く（浮き上がって見える）
  const low=y+1>=8||pat[y+1][x]!=='#';
  setPx(fr,x+2,y+1,low?shade:fill,true);
 }
 return {...fr,ax:4,ay:H-1};
}
/** 当たった印：短い光の弧（f は 0〜2 で広がって消える） */
function slash(f){
 const W=13,H=13,fr=blank(W,H),q=Math.min(2,Math.max(0,f));
 const r=3+q*1.6;
 for(let a=-1.1;a<=1.1;a+=0.12){const x=Math.round(6+Math.cos(a-0.5)*r),y=Math.round(6+Math.sin(a-0.5)*r);const c=q===0?[255,255,240]:q===1?[255,226,150]:[220,160,110];setPx(fr,x,y,c,true);if(q<2)setPx(fr,Math.round(6+Math.cos(a-0.5)*(r-1)),Math.round(6+Math.sin(a-0.5)*(r-1)),c.map(v=>v*0.7),true)}
 return {...fr,ax:6,ay:6};
}


// ===== 攻撃の演出の部品 =====
/** 演出の色（光る）：0 白、1 金、2 炎、3 毒（緑）、4 魔（紫）、5 血（赤）、6 石（灰）、7 霜（青白） */
const FXC=[[255,255,240],[255,220,120],[255,150,50],[150,240,90],[200,120,255],[230,60,60],[200,196,186],[190,230,255]];
const fxc=(c,a)=>FXC[c].map(v=>Math.round(v*a));
/** 振りの軌跡：size 0 小 1 中 2 大、f 0〜2（振り抜いて消える）。右向きの弧 */
function fxArc(size,col,f){
 const R=[7,11,16][size],W=R*2+3,H=R*2+3,fr=blank(W,H),q=Math.min(2,f);
 const a0=-1.25+q*0.35,a1=a0+1.6+q*0.3;
 for(let a=a0;a<=a1;a+=0.04){
  const t=(a-a0)/(a1-a0);
  for(let w=0;w<=(size>0?2:1);w++){const r=R-w-(q*0.5);const x=Math.round(R+1+Math.cos(a)*r),y=Math.round(R+1+Math.sin(a)*r);
   const br=(1-q*0.35)*(0.35+0.65*t);setPx(fr,x,y,fxc(col,w?br*0.6:br),true)}
 }
 return {...fr,ax:R+1,ay:R+1};
}
/** ぎざぎざの軌跡（オークの鉈、獣の荒い振り） */
function fxJag(col,f){
 const W=19,H=19,fr=blank(W,H),q=Math.min(2,f);
 for(let i=0;i<14;i++){const a=-1.1+i*0.12,r=7+(i%2?1.5:-0.5)-q*0.5;const x=Math.round(9+Math.cos(a)*r),y=Math.round(9+Math.sin(a)*r);setPx(fr,x,y,fxc(col,(1-q*0.35)*(0.4+i/20)),true);setPx(fr,x-1,y,fxc(col,0.4*(1-q*0.35)),true)}
 return {...fr,ax:9,ay:9};
}
/** 矢：dir 0〜7（右から時計回りに45°ずつ） */
function fxArrow(dir){
 const W=11,H=11,fr=blank(W,H),a=dir*Math.PI/4,dx=Math.cos(a),dy=Math.sin(a);
 for(let i=-4;i<=4;i++){const x=Math.round(5+dx*i),y=Math.round(5+dy*i);setPx(fr,x,y,i>2?[230,230,240]:i<-2?[240,240,240]:[150,110,70],false)}
 const tx=Math.round(5+dx*4),ty=Math.round(5+dy*4);setPx(fr,tx,ty,[255,255,255],true);
 for(const s of [-1,1]){const x=Math.round(5-dx*4+(-dy)*s),y=Math.round(5-dy*4+dx*s);setPx(fr,x,y,[220,220,230],false)}
 return {...fr,ax:5,ay:5};
}
/** 魔法の弾：揺らめく光の玉 */
function fxOrb(col,f){
 const W=13,H=13,fr=blank(W,H),q=mod(f,2);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const d=Math.hypot(x-6,y-6);if(d>5+q*0.6)continue;const a=d<2?1:d<3.5?0.8:0.45;setPx(fr,x,y,d<1.6?[255,255,255]:fxc(col,a),true)}
 return {...fr,ax:6,ay:6};
}
/** 噛み跡：上下二列の牙の点。size 0 小 1 大 */
function fxBite(size,col,f){
 const R=size?9:6,W=R*2+3,H=R*2+3,fr=blank(W,H),q=Math.min(2,f),cl=(R*0.5)*(q/2);
 for(let i=0;i<=(size?7:5);i++){const t=i/(size?7:5),x=Math.round(1+t*R*2);
  const yu=Math.round(R+1-R*0.6+cl+Math.sin(t*Math.PI)*-1.5),yd=Math.round(R+1+R*0.6-cl+Math.sin(t*Math.PI)*1.5);
  for(const dy of [0,1]){setPx(fr,x,yu-dy,fxc(col,1-q*0.3),true);setPx(fr,x,yd+dy,fxc(col,1-q*0.3),true)}}
 return {...fr,ax:R+1,ay:R+1};
}
/** 爪痕：三本の斜めの線 */
function fxClaw(col,f){
 const W=19,H=19,fr=blank(W,H),q=Math.min(2,f);
 for(let k=0;k<3;k++)for(let i=0;i<14-q*3;i++){const x=2+k*4+Math.round(i*0.55),y=2+i;const c=fxc(col,(1-q*0.3)*(0.5+i/24));setPx(fr,x,y,c,true);setPx(fr,x+1,y,c,true)}
 return {...fr,ax:9,ay:9};
}
/** 弾ける光：放射状の短い光。f 0〜2 で広がって消える */
function fxBurst(col,f){
 const W=25,H=25,fr=blank(W,H),q=Math.min(2,f);
 for(let k=0;k<8;k++){const a=k*Math.PI/4+0.2;for(let i=3+q*3;i<7+q*3.5;i++){const x=Math.round(12+Math.cos(a)*i),y=Math.round(12+Math.sin(a)*i);setPx(fr,x,y,fxc(col,1-q*0.35),true);if(q<2)setPx(fr,x+(k%2),y+((k+1)%2),fxc(col,0.6-q*0.2),true)}}
 if(q===0)for(let y=8;y<=16;y++)for(let x=8;x<=16;x++){const d=Math.hypot(x-12,y-12);if(d<3.4)setPx(fr,x,y,d<2?[255,255,255]:fxc(col,1),true)}
 return {...fr,ax:12,ay:12};
}
/** しぶき：小さな滴が外へ飛ぶ */
function fxSplash(col,f){
 const W=21,H=15,fr=blank(W,H),q=Math.min(2,f);
 for(let k=0;k<9;k++){const a=-Math.PI+k*Math.PI/8,r=3+q*3;const x=Math.round(10+Math.cos(a)*r*1.3),y=Math.round(10+Math.sin(a)*r*0.8-q*0.5);const c=fxc(col,1-q*0.3);setPx(fr,x,y,c,true);setPx(fr,x+1,y,c,true);if(q<2)setPx(fr,x,y+1,fxc(col,0.5),true)}
 return {...fr,ax:10,ay:10};
}
/** 地面のひび（床に残る跡。光らない） */
function fxCrack(v){
 const W=25,H=13,fr=blank(W,H);
 for(let k=0;k<5;k++){let x=12,y=6;const a=(k/5)*Math.PI*2+v;for(let i=0;i<6+(k%2)*3;i++){x+=Math.cos(a+Math.sin(i*1.3+v)*0.6)*1.2;y+=Math.sin(a+Math.cos(i+v)*0.6)*0.6;setPx(fr,Math.round(x),Math.round(y),[24,20,24],false)}}
 return {...fr,ax:12,ay:6};
}
/** 床に残る跡：溶け跡（緑）、焦げ（黒）、霜（青白）。光らない */
function fxStain(kind,v){
 const W=15,H=9,fr=blank(W,H);
 const cols=[[[90,140,60],[70,110,50]],[[30,24,22],[44,36,32]],[[170,200,220],[210,230,240]]][kind];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const d=((x-7)/7)**2+((y-4)/4)**2;if(d>1||hz(x+v*13,y,46)<d*0.7)continue;setPx(fr,x,y,cols[hz(x,y+v,47)<0.5?0:1],false)}
 return {...fr,ax:7,ay:4};
}


// ===== 攻撃の演出の部品（作り込み版）：魔物の絵と同じく、何段階かの色と縁取りで描く =====
/** 演出の色の段（明→暗）。0 鋼、1 金、2 炎、3 毒、4 魔、5 血、6 石、7 霜 */
const FXR=[
 [[250,252,255],[206,214,226],[150,158,174],[96,102,118],[44,46,58]],
 [[255,246,200],[250,212,110],[204,150,52],[136,90,26],[66,42,14]],
 [[255,250,220],[255,214,100],[255,150,44],[210,80,26],[110,36,18]],
 [[232,255,200],[160,232,96],[92,176,64],[46,110,44],[22,56,26]],
 [[255,240,255],[222,172,255],[168,104,236],[98,54,170],[46,24,88]],
 [[255,190,180],[230,74,70],[160,32,40],[96,16,26],[48,8,14]],
 [[236,230,218],[190,182,170],[140,132,124],[92,86,82],[44,40,40]],
 [[255,255,255],[214,242,255],[152,204,242],[90,144,204],[38,70,120]],
];
const FX_ENERGY=c=>c===2||c===3||c===4||c===7;
/** 消えていくときの点描（f 段目でどれだけ残すか） */
const fxKeep=(x,y,keep)=>BAYER4[(y&3)*4+(x&3)]/16<keep;
/**
 * 刃の軌跡：f 0〜5（振り始め、振り抜き、満ちる、余韻、薄れる、消えかけ）。右向きの弧。
 * 外の縁が光沢（いちばん明るい）、内へ向かって暗く、外側に細い縁取り。炎・魔法など力の色のときだけ芯が光る
 */
function fxSlash2(size,col,f){
 const R=[8,12,17][size],T=[2,3,4][size],W=R*2+5,H=R*2+5,fr=blank(W,H),C=FXR[col],en=FX_ENERGY(col);
 const sweep=[0.35,0.8,1,1,1,1][f],keep=[1,1,1,0.75,0.45,0.2][f];
 const a0=-1.3,a1=a0+1.9*sweep;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const dx=x-(R+2),dy=y-(R+2),r=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
  if(a<a0||a>a1)continue;
  const t=(a-a0)/(a1-a0||1);                 // 0 尾 → 1 先端
  const th=T*(0.35+0.65*t);                  // 先端ほど太い
  const d=R-r;                                // 外の縁からの深さ
  if(d<-1||d>th)continue;
  if(!fxKeep(x,y,keep*(0.35+0.65*t)))continue;
  let c;
  if(d<0)c=C[4];                              // 縁取り
  else if(d<0.9)c=C[0];                       // 光沢
  else if(d<th*0.55)c=C[1];
  else c=C[2];
  setPx(fr,x,y,c,en&&d>=0&&d<th*0.55&&f<4);
 }
 return {...fr,ax:R+2,ay:R+2};
}
/** 爪痕：三本の裂け目。f 0〜2で伸び、3〜5で薄れる。裂け目の芯は暗く、片側の縁が明るい */
function fxClaw2(col,f){
 const W=21,H=21,fr=blank(W,H),C=FXR[col],grow=[0.4,0.75,1,1,1,1][f],keep=[1,1,1,0.7,0.4,0.18][f];
 for(let k=0;k<3;k++){const L=Math.round(14*grow)-(k===1?0:2);for(let i=0;i<L;i++){const x=3+k*5+Math.round(i*0.5),y=3+i+(k===1?0:1);
  if(!fxKeep(x,y,keep))continue;
  setPx(fr,x-1,y,C[4],false);setPx(fr,x,y,C[3],false);setPx(fr,x+1,y,i<L-2?C[1]:C[2],false);if(i===0||i===L-1)setPx(fr,x,y,C[2],false)}}
 return {...fr,ax:10,ay:10};
}
/** 噛みつき：上下の顎の牙。f 0 開く、1 閉じかけ、2 閉じる、3〜5 薄れる。牙は骨の色、歯茎は暗い赤、縁取り */
function fxBite2(size,f){
 const R=size?10:6,W=R*2+5,H=R*2+5,fr=blank(W,H),B=RAMP.bone,G=FXR[5];
 const open=[R*0.75,R*0.45,R*0.18,R*0.18,R*0.2,R*0.2][f],keep=[1,1,1,0.7,0.45,0.2][f],n=size?6:4;
 for(const s of [-1,1]){
  const gy=R+2+s*open;
  for(let i=0;i<=n*2;i++){const x=2+Math.round(i*R*2/(n*2));const y=Math.round(gy+s*Math.sin(i/(n*2)*Math.PI)*-1.5);if(fxKeep(x,y,keep)){setPx(fr,x,y,G[3],false);setPx(fr,x,y+s,G[4],false)}}
  for(let i=0;i<n;i++){const cx=2+Math.round((i+0.5)*R*2/n);const len=size?3:2;for(let j=0;j<len;j++){const y=Math.round(gy-s*(j+1));const w=len-1-j;for(let dx=-w;dx<=w;dx++){const x=cx+dx;if(!fxKeep(x,y,keep))continue;setPx(fr,x,y,j===len-1?B[4]:(dx<0?B[3]:B[2]),false)}}
   const ty=Math.round(gy-s*(len+1));if(fxKeep(cx,ty,keep))setPx(fr,cx,ty,B[1],false)}
 }
 return {...fr,ax:R+2,ay:R+2};
}
/** 衝撃の輪：f 0〜5で広がって薄れる。石なら土色の輪と影、力の色なら芯が光る輪 */
function fxRing(size,col,f){
 const R=[7,10,14][size],W=R*2+7,H=Math.round(R*1.2)+7,fr=blank(W,H),C=FXR[col],en=FX_ENERGY(col);
 const r=R*(0.3+0.14*f),keep=[1,1,0.9,0.65,0.4,0.18][f],cx=R+3,cy=Math.round(H/2);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const dx=(x-cx),dy=(y-cy)/0.6,d=Math.hypot(dx,dy)-r;
  if(d<-2.2||d>1.2||!fxKeep(x,y,keep))continue;
  const c=d>0.4?C[4]:d>-0.6?(dy<0?C[0]:C[1]):d>-1.5?C[2]:C[3];
  setPx(fr,x,y,c,en&&d>-1.5&&d<=0.4);
 }
 return {...fr,ax:cx,ay:cy};
}
/** 力の弾ける光：芯は白く、外へ向かって技の色、外側は暗い炎や影。f 0〜5 */
function fxBlast(size,col,f){
 const R=[6,9,12][size],W=R*2+5,H=R*2+5,fr=blank(W,H),C=FXR[col];
 const rr=R*[0.45,0.8,1,1,0.95,0.85][f],keep=[1,1,1,0.7,0.42,0.18][f],core=[0.5,0.45,0.3,0.15,0,0][f];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const dx=x-(R+2),dy=y-(R+2),d=Math.hypot(dx,dy);
  const wob=Math.sin(Math.atan2(dy,dx)*5+f)*1.2;
  if(d>rr+wob||!fxKeep(x,y,keep))continue;
  const t=d/(rr+0.01);
  const c=t<core?C[0]:t<0.55?C[1]:t<0.8?C[2]:t<0.95?C[3]:C[4];
  setPx(fr,x,y,c,t<0.8);
 }
 return {...fr,ax:R+2,ay:R+2};
}
/** 魔法や炎の弾：芯が白く、技の色の段で外へ、縁取り。f 0〜3（揺らめき） */
function fxOrb2(col,f){
 const W=13,H=13,fr=blank(W,H),C=FXR[col];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const dx=x-6,dy=y-6,d=Math.hypot(dx,dy)+Math.sin(Math.atan2(dy,dx)*4+f*1.6)*0.5;
  if(d>5)continue;const c=d<1.3?C[0]:d<2.6?C[1]:d<3.7?C[2]:d<4.4?C[3]:C[4];setPx(fr,x,y,c,d<3.7)}
 return {...fr,ax:6,ay:6};
}
/** 矢：木の矢柄、鋼の鏃（光沢）、赤い矢羽根、縁取り。dir 0〜7 */
function fxArrow2(dir){
 const W=15,H=15,fr=blank(W,H),a=dir*Math.PI/4,ux=Math.cos(a),uy=Math.sin(a),px=-uy,py=ux,Wd=RAMP.wood,Ir=RAMP.iron,F=FXR[5];
 const put=(t,o,c)=>setPx(fr,Math.round(7+ux*t+px*o),Math.round(7+uy*t+py*o),c,false);
 for(let t=-5;t<=3;t++){put(t,0,t%3===0?Wd[2]:Wd[3])}
 put(4,0,Ir[4]);put(5,0,Ir[3]);put(4,-1,Ir[2]);put(4,1,Ir[1]);put(6,0,Ir[2]);
 for(const o of [-1,1]){put(-5,o,F[1]);put(-6,o,F[2]);put(-4,o,F[2])}
 return {...fr,ax:7,ay:7};
}
/** 粒：kind 0 石のかけら、1 土ぼこりの塊（大きさ f 0〜3）、2 しずく（col）、3 氷のかけら、4 火花（光る） */
function fxBit(kind,col,f){
 const W=7,H=7,fr=blank(W,H);
 if(kind===0){const S=RAMP.stone;setPx(fr,3,3,S[3],false);setPx(fr,4,3,S[2],false);setPx(fr,3,4,S[1],false);setPx(fr,4,4,S[1],false);setPx(fr,3,2,S[4],false)}
 else if(kind===1){const D=[[170,150,124],[134,116,96],[96,82,70]];const r=[1.2,2,2.6,3][f];for(let y=0;y<H;y++)for(let x=0;x<W;x++){const d=Math.hypot(x-3,y-3);if(d>r||!fxKeep(x,y,[1,0.9,0.6,0.35][f]))continue;setPx(fr,x,y,D[y<3?0:d>r-0.8?2:1],false)}}
 else if(kind===2){const C=FXR[col];setPx(fr,3,2,C[1],false);setPx(fr,3,3,C[2],false);setPx(fr,2,3,C[3],false);setPx(fr,3,4,C[3],false);setPx(fr,4,2,C[0],false)}
 else if(kind===3){const C=FXR[7];setPx(fr,3,1,C[0],true);setPx(fr,3,2,C[1],false);setPx(fr,3,3,C[2],false);setPx(fr,2,3,C[3],false);setPx(fr,4,2,C[1],false)}
 else{const C=[[255,250,220],[255,214,100],[255,150,44],[200,70,30]][Math.min(3,f)];setPx(fr,3,3,C,true);if(f<2)setPx(fr,2,3,C.map(v=>v*0.6),true)}
 return {...fr,ax:3,ay:3};
}


// ===== 幼竜と若い竜（描き起こし）：横向き。dir は side 以外も横向きで描く =====
/**
 * stage 0 幼竜：頭と目が大きく、首と尾が短く、翼は小さく丸い（飛べない）。角はなく、鱗は明るく柔らかい色。
 * stage 1 若い竜：首と尾が伸び、短い角、翼は大きく広がる（滑空できる）。鱗は少し暗く硬い色。
 * act：idle（呼吸）、move（よちよち歩き／歩く）、attack（噛む／煙を吐く）、fly（若い竜の滑空）、death
 */
function dragonling(stage,act,f){
 const q=mod(f,4),P=[],y1=stage===1;
 const W=y1?64:40,H=y1?50:32,G=y1?44:28;
 const S=y1?'drgY':'drgS',B=y1?'drgB':'drgSB',WG=y1?'drgYW':'drgSW';
 const k=y1?1.55:1;
 const mv=act==='move',at=act==='attack',fl=act==='fly';
 const bob=mv?[0,-1,0,-1][q]:act==='idle'?[0,0,-0.5,0][q]:0;
 const step=mv?[-1.5,0,1.5,0][q]:0;
 const ox=y1?6:3,oy=0;
 const X=v=>ox+v*k, Y=v=>G-(28-v)*k+bob*0.8;
 if(act==='death'){
  P.push(E(X(18),Y(25),9*k,3.5*k,S,{ol:1}),E(X(29),Y(25),5*k,3*k,S,{ol:1}),C(X(10),Y(26),X(2),Y(27),1.6*k,S),E(X(16),Y(22),5*k,2*k,WG,{ol:1}));
  return {...raster(W,H,P),ax:Math.round(X(18)),ay:G};
 }
 // 尾
 const tw=[0,0.8,0,-0.8][q];
 P.push(C(X(11),Y(21),X(y1?1:5),Y(y1?24+tw:23+tw),(y1?2.2:2.4)*k*0.6,S));
 if(y1)P.push(C(X(1),Y(24+tw),X(-3),Y(21+tw),1.0*k*0.6,S));
 // 後ろ脚と前脚（よちよち）
 const lr=y1?1.25:1;
 P.push(C(X(13+step),Y(23),X(13+step),Y(28),1.5*k*0.7*lr,S),C(X(23-step),Y(23),X(23-step),Y(28),1.4*k*0.7*lr,S));
 // 体と腹
 P.push(E(X(18),Y(20),(y1?9.5:8)*k*0.85,(y1?6:6.2)*k*0.85,S,{ol:1}));
 P.push(E(X(19),Y(23),(y1?6:5)*k*0.85,2.4*k*0.8,B));
 // 翼
 if(fl&&y1){P.push(PL([[X(15),Y(15)],[X(4),Y(4+q)],[X(10),Y(13)],[X(2),Y(11+q*0.5)],[X(14),Y(17)]],WG,2,{ol:1}),PL([[X(20),Y(15)],[X(30),Y(3+q)],[X(27),Y(12)],[X(34),Y(10)],[X(22),Y(17)]],WG,2,{ol:1}))}
 else if(y1){P.push(PL([[X(13),Y(16)],[X(18),Y(5)],[X(21),Y(9)],[X(25),Y(7)],[X(24),Y(16)]],WG,2,{ol:1}))}
 else{P.push(E(X(16),Y(13.5),4.2,3.2,WG,{ol:1}),E(X(15),Y(14),2.4,1.6,WG))}
 // 首と頭
 const lunge=at?[0,1.5,3,1.5][q]:0;
 const hx=X(y1?29:28)+lunge,hy=Y(y1?11:11);
 P.push(C(X(22),Y(17),hx-(y1?3:2),hy+2,(y1?3.3:2.8)*k*0.7,S));
 P.push(E(hx,hy,(y1?5.4:6)*k*0.75,(y1?4:5)*k*0.75,S,{ol:1}));
 P.push(E(hx+(y1?5:4.2)*k*0.75,hy+(y1?1:1.5),(y1?3:2.6)*k*0.7,(y1?1.8:2)*k*0.7,S,{ol:1}));
 if(y1){P.push(PL([[hx-2,hy-3],[hx-6,hy-8],[hx-1,hy-4]],'horn',2,{ol:1}),PL([[hx+1,hy-3.5],[hx-1,hy-8.5],[hx+2.5,hy-4]],'horn',2,{ol:1}))}
 const fr=raster(W,H,P);
 // 目：幼竜は大きく丸く、若い竜は細く鋭い（光る）
 const ex=Math.round(hx+(y1?1:0.5)),ey=Math.round(hy-(y1?1:1.5));
 if(y1){setPx(fr,ex,ey,[255,200,70],true);setPx(fr,ex+1,ey,[255,160,40],true)}
 else{for(const [dx,dy,c] of [[0,0,[250,250,240]],[1,0,[250,250,240]],[0,1,[250,250,240]],[1,1,[30,20,24]],[0,-1,[40,24,28]],[1,-1,[40,24,28]]])setPx(fr,ex+dx,ey+dy,c,false);setPx(fr,ex,ey,[255,255,255],true)}
 // 口：噛むときは開く。幼竜は煙のかたまりを吐く練習（攻撃の2コマ目）
 const mx=Math.round(hx+(y1?7:6)*0.75*k),my=Math.round(hy+(y1?2:2.5));
 if(at&&(q===1||q===2)){setPx(fr,mx,my,[40,10,12],false);setPx(fr,mx-1,my,[40,10,12],false);if(!y1&&q===2)for(const [dx,dy] of [[2,-1],[3,-1],[3,0],[4,-2],[2,0]])setPx(fr,mx+dx,my+dy,[150,144,150],false);if(y1&&q===2)for(const [dx,dy] of [[2,0],[3,0],[3,-1],[4,0]])setPx(fr,mx+dx,my+dy,[255,180,60],true)}
 // 背の小さなとげ（若い竜だけ）
 if(y1)for(let i=0;i<4;i++){const x=Math.round(X(12+i*3)),yy=Math.round(Y(14.5-(i===3?1:0)))-1;setPx(fr,x,yy,[60,20,22],false);setPx(fr,x,yy-1,[100,32,30],false)}
 return {...fr,ax:Math.round(X(18)),ay:G};
}
/** 幼竜と若い竜の眠る姿：丸まって尾を体に巻きつける */
function dragonlingSleep(stage,f){
 const q=mod(f,4),y1=stage===1,k=y1?1.55:1,W=y1?52:34,H=y1?32:22,G=y1?28:19;
 const S=y1?'drgY':'drgS',WG=y1?'drgYW':'drgSW',P=[];
 const br=[0,0.3,0.6,0.3][q];
 const cx=W/2,cy=G-5*k;
 P.push(C(cx-8*k,cy+3*k,cx+6*k,cy+4*k,2*k*0.7,S));
 P.push(E(cx,cy,8*k*0.95,(5+br)*k*0.95,S,{ol:1}));
 P.push(E(cx-1*k,cy-2.5*k,5*k*0.8,(2.6+br*0.5)*k*0.8,WG,{ol:1}));
 P.push(E(cx+6*k,cy+1.5*k,(y1?3.6:4.4)*k*0.8,(y1?2.8:3.6)*k*0.8,S,{ol:1}));
 if(y1)P.push(PL([[cx+5*k,cy-0.5*k],[cx+2*k,cy-4*k],[cx+6*k,cy-1*k]],'horn',2,{ol:1}));
 const fr=raster(W,H,P);
 const ex=Math.round(cx+6.5*k),ey=Math.round(cy+0.8*k);
 setPx(fr,ex,ey,[40,20,24],false);setPx(fr,ex+1,ey,[40,20,24],false);
 return {...fr,ax:Math.round(cx),ay:G};
}
/** 卵の殻のかけら（幼竜が生まれた場所に残る） */
function eggShell(v){
 const W=18,H=8,fr=blank(W,H),C1=[236,226,200],C2=[196,184,156],C3=[140,128,108];
 const bits=[[3,5,4],[8,6,5],[13,5,3]];
 bits.forEach(([x,y,w],i)=>{for(let dx=0;dx<w;dx++){setPx(fr,x+dx,y,dx===0?C3:C2,false);if(dx>0&&dx<w-1)setPx(fr,x+dx,y-1,C1,false)}if(i===1){setPx(fr,x+1,y-2,C1,false);setPx(fr,x+2,y-2,C2,false)}});
 return {...fr,ax:9,ay:6};
}


// ===== マナから生まれる者の出現（描画専用） =====
/** マナの粒：紫に光る点（size 0 小 〜 3 大） */
function manaMote(size){
 const C=[[180,130,255],[200,160,255],[222,196,255],[246,236,255]][size];
 const W=size>=2?5:3,fr=blank(W,W),c=Math.floor(W/2);
 setPx(fr,c,c,C,true);
 const d=C.map(v=>Math.round(v*0.62));
 if(size>=1){setPx(fr,c-1,c,d,true);setPx(fr,c+1,c,d,true);setPx(fr,c,c-1,d,true);setPx(fr,c,c+1,d,true)}
 if(size>=3){const e=C.map(v=>Math.round(v*0.4));setPx(fr,c-2,c,e,true);setPx(fr,c+2,c,e,true);setPx(fr,c,c-2,e,true);setPx(fr,c,c+2,e,true)}
 return {...fr,ax:c,ay:c};
}
/** 竜の卵：0 まだ静か、1 マナを吸って筋が紫に光る、2 ひびが走る、3 ひびが広がり上が欠ける */
function dragonEgg(v){
 const W=14,H=18,fr=blank(W,H);
 const S=[[46,40,52],[64,54,70],[88,76,96],[30,24,34]];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const dx=(x-6.5)/6.2,dy=(y-10.5)/(y<10.5?9.6:7.2);const d=dx*dx+dy*dy;if(d>1)continue;
  if(v===3&&y<4)continue;
  const lit=(-dx*0.6-dy*0.7);
  let c=d>0.8?S[3]:lit>0.35?S[2]:lit>-0.1?S[1]:S[0];
  if(((x*7+y*3)%9===0)&&d<0.75)c=S[0];
  setPx(fr,x,y,c,false);
 }
 const vein=[[6,4],[7,5],[7,6],[6,7],[6,8],[7,9],[8,10],[8,11],[7,12],[4,8],[5,9],[4,10],[9,7],[10,8]];
 if(v>=1)vein.forEach(([x,y],i)=>{if(v===3&&y<4)return;const c=i%3===0?[246,230,255]:[196,150,255];setPx(fr,x,y,c,true);if(v>=2)setPx(fr,x+1,y,c,true)});
 if(v>=2){const crack=[[3,6],[4,6],[5,5],[6,5],[8,5],[9,6],[10,6],[11,7]];crack.forEach(([x,y])=>setPx(fr,x,y,[30,22,26],false));if(v===3){setPx(fr,6,3,[246,230,255],true);setPx(fr,7,3,[246,230,255],true)}}
 return {...fr,ax:7,ay:16};
}

// ===== 特別な個体の姿 =====
/** 火の精：炎の体。芯は白く、外へ橙、赤、縁は暗い赤。腕の炎が揺らめく。act attack は両腕を前へ */
function fireSpirit(act,f){
 const q=mod(f,4),W=24,H=32,fr=blank(W,H),at=act==='attack';
 const R=[[255,252,226],[255,226,120],[255,170,60],[230,100,36],[150,46,24]];
 const shape=(x,y)=>{ // 縦長の雫。上ほど細く揺れる
  const cy=y/H;const wob=Math.sin(y*0.55+q*1.7)*1.4*(1-cy);
  const half=(cy<0.18?cy*18:cy<0.75?3.4+cy*5:7.2-(cy-0.75)*14)+0.5;
  return Math.abs(x-12-wob)/Math.max(0.5,half);
 };
 for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
  const d=shape(x,y);if(d>1)continue;
  const t=d*0.75+(1-y/H)*0.35;
  const c=t<0.32?R[0]:t<0.5?R[1]:t<0.7?R[2]:t<0.88?R[3]:R[4];
  setPx(fr,x,y,c,true);
 }
 // 腕の炎
 const ax=at?[3,4,5,4][q]:[1,2,1,0][q];
 for(const sgn of [-1,1]){for(let i=0;i<5;i++){const x=Math.round(12+sgn*(5+i*0.9+(at?ax*0.4:0))),y=Math.round(17-i*0.8-(i===4?ax*0.4:0));setPx(fr,x,y,i>3?R[1]:R[2],true);setPx(fr,x,y+1,R[3],true)}}
 // 目と口（暗い）
 setPx(fr,10,12,[60,16,10],false);setPx(fr,14,12,[60,16,10],false);if(at){setPx(fr,11,15,[60,16,10],false);setPx(fr,12,15,[60,16,10],false);setPx(fr,13,15,[60,16,10],false)}
 return {...fr,ax:12,ay:H-2};
}
/**
 * リビングアーマー：人の形をしていない。胸当てと冑だけが宙に浮く芯で、手足は無い。継ぎ目と胸当ての下の空洞から青白いマナの光が漏れる
 * （光を帯びたときに光る模様の点。描画が強さを渡して、マナが減るとちらつく。src/creatureView.ts）。
 * 体になった武具と、取り込んだ武器・盾は、描画のときに床の道具の絵を芯のまわりに重ねる（下にぶら下がる・周りを巡る。src/creatureView.ts）
 */
const ARMOR_EYE=[52,70,92],ARMOR_RUST=[[110,62,36],[140,84,48]];
function armorHelm(eyes){return(dir,P,x,y,dead,open,k)=>{
 const side=dir==='side',back=dir==='up',K=k,o=side?0.4*K:0;
 // 天辺の平らな大兜：裾がわずかに広がり、目の高さに横長の覗き穴、その下に通気の穴
 P.push(PL([[x+o-3*K,y+2.6*K],[x+o-2.8*K,y-2.4*K],[x+o-2*K,y-3.2*K],[x+o+2*K,y-3.2*K],[x+o+2.8*K,y-2.4*K],[x+o+3*K,y+2.6*K]],'plate',2,{ol:1}));
 P.push(LN(x+o-2.6*K,y-2.6*K,x+o+2.6*K,y-2.6*K,'plate',4,{no:1}),LN(x+o-2.8*K,y+2.2*K,x+o+2.8*K,y+2.2*K,'iron',1,{no:1}));
 P.push(D(x+o+(side?-1.6:1.9)*K,y-2*K,ARMOR_RUST[0]));
 if(back){P.push(LN(x,y-2.4*K,x,y+2*K,'iron',2,{no:1}));return}
 if(side){
  P.push(LN(x+o+0.8*K,y-0.6*K,x+o+3*K,y-0.6*K,'boot',0,{no:1}),D(x+o+2.2*K,y+1.2*K,RAMP.boot[0]));
  eyes.push([x+o+2*K,y-0.6*K]);
 }else{
  P.push(LN(x-2.4*K,y-0.6*K,x+2.4*K,y-0.6*K,'boot',0,{no:1}),LN(x-2.4*K,y-0.6*K+1,x+2.4*K,y-0.6*K+1,'boot',0,{no:1}),LN(x,y-0.6*K+1,x,y+2*K,'plate',4,{no:1}));
  [[-1.2,1.4],[1.2,1.4]].forEach(([a,b])=>P.push(D(x+a*K,y+b*K,RAMP.boot[0])));
  eyes.push([x-1.2*K,y-0.6*K],[x+1.2*K,y-0.6*K]);
 }
}}
function livingArmor(dir,act,f){
 const W=24,H=28,cx=12,base=26,q=mod(f,4),mv=act==='move',at=act==='attack';
 const P=[],glows=[],eyes=[];
 const band=(x0,x1,y)=>{for(let x=Math.round(x0);x<=Math.round(x1);x++)glows.push([x,y])};
 const finish=()=>{const fr=raster(W,H,P);for(const [gx,gy] of [...glows,...eyes]){const x=Math.round(gx),y=Math.round(gy);if(x<0||y<0||x>=W||y>=H)continue;const p=y*W+x;fr.px[p*4]=ARMOR_EYE[0];fr.px[p*4+1]=ARMOR_EYE[1];fr.px[p*4+2]=ARMOR_EYE[2];fr.px[p*4+3]=255;fr.mat[p]='glw'}return {...fr,ax:cx,ay:base}};
 if(act==='death'){
  // 床に落ちた胸当てと、転がった冑（光は消えている）
  const sl=q===0?0:1;
  P.push(E(cx-1,base-2.4-(1-sl)*2,5,2.6-sl*0.4,'plate',{ol:1}),PL([[cx-5.6,base-3],[cx-1,base-5],[cx-1,base-0.6],[cx-5,base-0.8]],'iron',2));
  armorHelm([])('side',P,cx+4+sl*2,base-3.6-(1-sl)*4,true,false,1.1);
  return finish();
 }
 const side=dir==='side',back=dir==='up';
 // 宙に浮いて上下する。冑は胸当てより遅れて動く。攻めるときは前へ傾いて突き出る
 const bob=mv?[0,-1,-1.5,-1][q]:[0,-0.6,-1,-0.6][q];
 const hb=mv?[-1,0,-1,-1.5][q]:[-0.4,0,-0.6,-1][q];
 const lean=at?[0,-1,2,1][q]:0;
 const ty=base-9+bob,helmY=ty-9+hb;
 const tx=cx+(side?lean:0),tyy=ty+(side?0:lean*0.5);
 // 胸当ての下から垂れる草摺の板（ばらばらに浮く）と、空洞から漏れる光
 const tassets=side?[[-1.6,0],[1.4,0.6]]:[[-3.2,0],[0,0.6],[3.2,0]];
 for(const [dx,dy] of tassets){const sw=mv?[0.4,0,-0.4,0][(q+Math.round(dx))&3]:0;P.push(PL([[tx+dx-1.4+sw,tyy+5.6+dy],[tx+dx+1.4+sw,tyy+5.6+dy],[tx+dx+1.1+sw*1.5,tyy+8.4+dy],[tx+dx-1.1+sw*1.5,tyy+8.4+dy]],'iron',2,{ol:1}))}
 // 肩当て：胸当ての脇に、離れて浮く
 const pd=[[-6.4,-3.2],[6.4,-3.2]];
 if(!side)for(const [dx,dy] of pd)P.push(E(tx+dx,tyy+dy+(mv?[0,0.5,0,-0.5][q]*(dx<0?1:-1):0),2.2,1.6,'plate',{ol:1}));
 else P.push(E(tx-0.6,tyy-3.4,2.4,1.6,'plate',{ol:1}));
 // 胸当て：色と錆の違う板金の継ぎはぎ
 if(side){P.push(E(tx,tyy,3.4,4.4,'plate',{ol:1}),PL([[tx-3.2,tyy-1.6],[tx-0.6,tyy-3.8],[tx-0.6,tyy+4.2],[tx-2.8,tyy+3]],'iron',2),LN(tx+2.2,tyy-2.6,tx+2.6,tyy+2.4,'plate',4,{no:1}),D(tx-1.6,tyy+1,ARMOR_RUST[1]))}
 else{P.push(E(tx,tyy,4.6,4.4,'plate',{ol:1}));if(!back)P.push(PL([[tx-4.4,tyy-1.6],[tx-0.4,tyy-3.8],[tx-0.4,tyy+4.2],[tx-3.6,tyy+3]],'iron',2),LN(tx,tyy-3.4,tx,tyy+3,'plate',4,{no:1}),D(tx+2.2,tyy+1.6,ARMOR_RUST[0]),D(tx-2,tyy-2,ARMOR_RUST[1]),D(tx+1.4,tyy-2.6,ARMOR_RUST[0]));else P.push(LN(tx,tyy-3.4,tx,tyy+3,'iron',1,{no:1}),D(tx-1.6,tyy+1,ARMOR_RUST[0]))}
 // 光：首の隙間、胸当ての下の空洞、肩の付け根
 if(side){band(tx-0.6,tx+1.8,tyy-6);band(tx-2,tx+2,tyy+5.2)}else{band(tx-1.6,tx+1.6,tyy-6);band(tx-3,tx+3,tyy+5);band(tx-1,tx+1,tyy+4.2);band(tx-4.6,tx-4.2,tyy-3.4);band(tx+4.2,tx+4.6,tyy-3.4)}
 armorHelm(eyes)(back?'up':side?'side':'down',P,tx+(side?0.4+lean*0.5:0),helmY+(side?0:lean*0.4),false,false,1.3);
 return finish();
}
/** 亡霊の騎士：青白く透ける鎧の騎士。兜の覗き穴が光り、裾は点描で透けて消える。剣を持つ。act attack は剣を振り上げる */
function phantomKnight(act,f){
 const q=mod(f,4),W=26,H=34,fr=blank(W,H),at=act==='attack';
 const A=[[214,230,246],[170,192,220],[124,146,182],[82,100,140],[40,50,80]];
 const bob=[0,-1,-1,0][q];
 const put=(x,y,c,keep=1)=>{if(BAYER4[(y&3)*4+(x&3)]/16<keep)setPx(fr,x,y,c,false)};
 // 体（胸当て）と腰、裾
 for(let y=12;y<30;y++){const keep=y<22?0.9:Math.max(0.15,0.9-(y-22)*0.1);const half=y<20?5:y<24?5.5:6+((y+q)%3===0?1:0);for(let x=Math.round(13-half);x<=Math.round(13+half);x++){const e=x===Math.round(13-half)||x===Math.round(13+half);put(x,y+bob,e?A[4]:(x<13?A[1]:A[2]),keep)}}
 for(let x=9;x<=17;x++)put(x,19+bob,A[3]);
 // 兜
 for(let y=3;y<12;y++)for(let x=9;x<=17;x++){const d=Math.hypot((x-13)/4.4,(y-7.5)/4.6);if(d>1)continue;put(x,y+bob,d>0.85?A[4]:x<13?A[0]:A[1])}
 for(let x=10;x<=16;x++)setPx(fr,x,8+bob,A[4],false);
 setPx(fr,11,8+bob,[150,220,255],true);setPx(fr,15,8+bob,[150,220,255],true);
 // 兜の飾り
 for(let y=0;y<4;y++)put(13,y+bob,A[2]);
 // 盾（左腕）
 for(let y=14;y<22;y++)for(let x=5;x<=8;x++)put(x,y+bob,x===5||y===14||y===21?A[4]:A[1]);
 // 剣（右腕）
 const sx=at?[19,20,21,20][q]:20,sy=at?[6,4,2,4][q]:14;
 for(let i=0;i<11;i++){const x=sx+(at?Math.round(i*0.2):0),y=sy+i;setPx(fr,x,y+bob,i<8?[200,220,240]:[110,90,60],i<8)}
 for(let dx=-1;dx<=1;dx++)setPx(fr,sx+dx,sy+8+bob,A[3],false);
 return {...fr,ax:13,ay:H-3};
}
/** 冠（大ネズミの王の頭の上に重ねる） */
function crownS(){
 const fr=blank(9,6),G=RAMP.gold;
 for(let x=1;x<8;x++){setPx(fr,x,4,G[2],false);setPx(fr,x,3,G[3],false);setPx(fr,x,5,G[1],false)}
 for(const x of [1,4,7]){setPx(fr,x,2,G[3],false);setPx(fr,x,1,G[4],false)}
 setPx(fr,4,3,[230,60,70],true);setPx(fr,0,4,G[1],false);setPx(fr,8,4,G[1],false);
 return {...fr,ax:4,ay:5};
}
/** 角兜（ゴブリンの頭の上に重ねる） */
/** 貢ぎ物の袋：オークが肩に担いで縄張りへ持ち帰る、口を縛った麻袋 */
function tributeSack(){
 const fr=blank(9,9),L=[150,120,80],M=[124,96,60],K=[86,62,38],T=[60,44,28];
 for(let y=2;y<9;y++){const w=y<3?2:y<8?4:3;for(let x=4-w;x<=4+w;x++)setPx(fr,x,y,x===4+w||y===8?K:x<=4-w+1?L:M,false)}
 setPx(fr,3,1,T,false);setPx(fr,4,1,T,false);setPx(fr,5,1,T,false);setPx(fr,4,0,K,false);setPx(fr,2,5,T,false);setPx(fr,6,4,T,false);
 return {...fr,ax:4,ay:8};
}

/** 描いた形のまわりに濃い縁取りをつける（小さな持ち物を背景から浮かせる） */
/** 縁取りのために、まわりに1px の余白をつけて縁取る */
function pad1(fr){const W=fr.W+2,H=fr.H+2,o=blank(W,H);for(let y=0;y<fr.H;y++)for(let x=0;x<fr.W;x++){const p=y*fr.W+x,q=(y+1)*W+x+1;for(let i=0;i<4;i++)o.px[q*4+i]=fr.px[p*4+i];o.mat[q]=fr.mat[p]}return outline(o)}
/** ピクセルを2倍に（戦利品は大きく描いて、遠くからでも見分けられるように） */
function x2(fr){const W=fr.W*2,H=fr.H*2,o=blank(W,H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=(y>>1)*fr.W+(x>>1),q=y*W+x;for(let i=0;i<4;i++)o.px[q*4+i]=fr.px[p*4+i];o.mat[q]=fr.mat[p]}return o}
function outline(fr){
 const {W,H,px}=fr,add=[];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=y*W+x;if(px[p*4+3])continue;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=W||yy>=H)continue;if(px[(yy*W+xx)*4+3]&&fr.mat[yy*W+xx]!=='ol'){add.push(p);break}}}
 for(const p of add){px[p*4]=22;px[p*4+1]=14;px[p*4+2]=12;px[p*4+3]=255;fr.mat[p]='ol'}
 return fr;
}

/** 金貨の袋：冒険者が背に担ぐ、口から金貨ののぞく革袋（size 0 小、1 中、2 大） */
function goldSack(size){
 const R=[3,4,5][size],W=R*2+3,H=R*2+3,fr=blank(W,H),L=RAMP.leather,G=RAMP.gold,cx=R+1,cy=R+2;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const dx=(x-cx)/R,dy=(y-cy)/(R*0.92);const d=dx*dx+dy*dy;if(d>1||y<2)continue;setPx(fr,x,y,d>0.72?L[1]:dx<-0.2||dy<-0.3?L[4]:L[3],false)}
 // 縛った口と、のぞく金貨
 for(let x=cx-1;x<=cx+1;x++)setPx(fr,x,2,L[0],false);
 setPx(fr,cx-1,1,G[3],false);setPx(fr,cx,1,G[4],false);setPx(fr,cx+1,1,G[2],false);setPx(fr,cx,0,G[3],false);
 if(size>=1){setPx(fr,cx-2,1,G[2],false);setPx(fr,cx+2,1,G[3],false)}
 if(size>=2){setPx(fr,cx-1,0,G[4],false);setPx(fr,cx+1,0,G[2],false)}
 const gp=1*W+cx;fr.mat[gp]='glint';
 return {...pad1(fr),ax:cx+1,ay:H};
}

/** 戦利品の絵（担ぐ姿と、床に残ったもの）：fang 牙、club 棍棒、horn 角、eye 眼、staff 杖、skull 骨の冠、helm 角兜、axe 斧、spear 槍、hide 皮 */
function trophyArt(type){
 if(type==='helm')return {...pad1(x2(chiefHelm())),ax:14,ay:14};
 const W=15,H=11,fr=blank(W,H),B=RAMP.bone,Wd=RAMP.wood,I=RAMP.iron,Hn=RAMP.horn;
 const put=(x,y,c,e)=>setPx(fr,x,y,c,e);
 if(type==='fang'){
  // 大きく反った牙（根元は太く黄ばみ、先は細く白い）
  const pts=[[1,7],[2,7],[3,7],[4,6],[5,6],[6,5],[7,5],[8,4],[9,3],[10,2],[11,2],[12,1],[13,0]];
  pts.forEach(([x,y],i)=>{const w=i<4?3:i<8?2:1;for(let k=0;k<=w;k++)put(x,y+k,k===0?(i<8?B[4]:B[3]):k===w?B[1]:i<5?B[2]:B[3])});
  put(0,8,RAMP.leather[2]);put(0,9,RAMP.leather[1]);put(1,10,RAMP.leather[1]);
 }else if(type==='club'){
  for(let i=0;i<10;i++){const x=2+i,y=8-Math.floor(i*0.6);const r=i<4?0:i<7?1:2;for(let k=-r;k<=r;k++)put(x,y+k,k===-r?Wd[3]:k===r?Wd[1]:Wd[2])}
  for(const [x,y] of [[9,3],[11,6],[12,4]])put(x,y,Wd[0]);
  for(const [x,y] of [[10,2],[12,3],[11,7]])put(x,y,B[3]);
 }else if(type==='horn'){
  const pts=[[2,9],[3,8],[4,8],[5,7],[6,7],[7,6],[8,6],[9,5],[10,4],[11,3],[11,2],[12,1]];
  pts.forEach(([x,y],i)=>{put(x,y,i<4?Hn[1]:i<8?Hn[2]:Hn[4]);if(i<7){put(x,y+1,Hn[0]);put(x,y-1,Hn[3])}});
 }else if(type==='eye'){
  const C=[[255,240,120],[230,200,60],[150,110,20],[60,40,10]];
  for(let y=1;y<10;y++)for(let x=3;x<12;x++){const d=((x-7)**2+(y-5)**2);if(d>17)continue;put(x,y,d>12?C[3]:d>6?C[2]:d>2?C[1]:C[0],d<=6)}
  put(7,4,[20,10,10]);put(7,5,[20,10,10]);put(7,6,[20,10,10]);
 }else if(type==='staff'){
  for(let i=0;i<11;i++)put(1+i,10-Math.floor(i*0.8),Wd[i%3===0?1:2]);
  for(const [x,y,c] of [[12,2,[220,160,255]],[13,2,[180,110,240]],[12,1,[250,220,255]],[13,1,[200,140,255]],[12,3,[120,70,190]],[13,3,[150,90,210]]])put(x,y,c,true);
 }else if(type==='skull'){
  for(let y=3;y<9;y++)for(let x=4;x<11;x++){const d=((x-7)/3.4)**2+((y-5.5)/3)**2;if(d>1)continue;put(x,y,d>0.7?B[1]:B[3])}
  put(6,5,B[0]);put(5,5,B[0]);put(8,5,B[0]);put(9,5,B[0]);put(7,7,B[0]);put(6,8,B[2]);put(8,8,B[2]);
  for(const x of [4,7,10]){put(x,2,RAMP.gold[3]);put(x,1,RAMP.gold[4])}for(let x=4;x<11;x++)put(x,3,RAMP.gold[2]);
 }else if(type==='axe'){
  for(let i=0;i<11;i++)put(1+i,10-Math.floor(i*0.8),Wd[2]);
  for(let y=0;y<6;y++)for(let x=9;x<14;x++){if(Math.abs(x-11)+Math.abs(y-2.5)>3.2)continue;put(x,y,x>=12?I[4]:I[2])}
 }else if(type==='spear'){
  for(let i=0;i<12;i++)put(1+i,10-Math.floor(i*0.75),Wd[2]);
  put(13,1,I[4]);put(14,0,I[4]);put(12,2,I[3]);put(13,2,I[2]);put(12,1,I[3]);
 }else{
  // 皮：巻いた鱗の皮
  const L=RAMP.liz;for(let y=3;y<9;y++)for(let x=2;x<13;x++){const e=(y===3||y===8);put(x,y,e?L[1]:(x+y)%3===0?L[4]:L[2])}
  for(let y=4;y<8;y++){put(2,y,L[0]);put(12,y,L[3])}
 }
 return {...pad1(x2(fr)),ax:15,ay:20};
}

/** 倒れた冒険者の荷：背負い袋と巻いた寝具 */
function packArt(){
 const W=14,H=11,fr=blank(W,H),L=RAMP.leather,C=RAMP.cloth;
 for(let y=3;y<10;y++)for(let x=2;x<9;x++)setPx(fr,x,y,x===2||y===9?L[1]:x===8?L[2]:L[3],false);
 for(let x=3;x<8;x++)setPx(fr,x,2,L[2],false);setPx(fr,5,5,L[0],false);setPx(fr,5,6,RAMP.iron[3],false);
 for(let y=6;y<10;y++)for(let x=8;x<13;x++){const d=((x-10.5)/2.4)**2+((y-8)/2)**2;if(d<=1)setPx(fr,x,y,d>0.6?C[1]:C[3],false)}
 setPx(fr,10,8,C[0],false);
 return {...fr,ax:7,ay:9};
}

function chiefHelm(){
 const fr=blank(13,7),I=RAMP.iron,B=RAMP.bone;
 for(let x=3;x<10;x++){setPx(fr,x,5,I[1],false);setPx(fr,x,4,I[2],false);setPx(fr,x,3,x<6?I[3]:I[2],false)}
 for(let x=4;x<9;x++)setPx(fr,x,2,I[3],false);
 for(const [x,y] of [[2,4],[1,3],[0,2],[0,1],[10,4],[11,3],[12,2],[12,1]])setPx(fr,x,y,y<2?B[4]:B[3],false);
 return {...fr,ax:6,ay:6};
}


/** 水の精：水の体の乙女の姿。上は透き通る青白、裾は水たまりへ溶ける。f で水面が揺れる */
function waterSpirit(act,f){
 const q=mod(f,4),W=22,H=30,fr=blank(W,H),at=act==='attack';
 const A=[[236,250,255],[180,226,250],[120,186,236],[70,130,200],[34,70,130]];
 for(let y=2;y<H-1;y++)for(let x=1;x<W-1;x++){
  const cy=y/H;const wob=Math.sin(y*0.5+q*1.5)*0.9;
  const half=cy<0.3?2.2+cy*8:cy<0.55?3.6:cy<0.85?3.6+(cy-0.55)*14:8-(cy-0.85)*10;
  const d=Math.abs(x-11-wob)/Math.max(0.6,half);if(d>1)continue;
  const keep=cy>0.8?0.55:0.92;if(BAYER4[(y&3)*4+(x&3)]/16>=keep)continue;
  const c=d>0.85?A[4]:d<0.3&&cy<0.5?A[0]:x<11?A[1]:A[2];
  setPx(fr,x,y,c,cy<0.6);
 }
 // 頭と腕
 for(let y=2;y<8;y++)for(let x=8;x<=14;x++){const d=Math.hypot((x-11)/3,(y-5)/3);if(d<=1)setPx(fr,x,y,d>0.8?A[3]:A[0],true)}
 const ax=at?[2,3,4,3][q]:0;
 for(let i=0;i<5;i++){setPx(fr,7-i-ax*0.3|0,11+i,A[2],true);setPx(fr,15+i+ax*0.3|0,11+i-(at?ax*0.5|0:0),A[2],true)}
 setPx(fr,10,5,[30,60,110],false);setPx(fr,12,5,[30,60,110],false);
 return {...fr,ax:11,ay:H-2};
}
/** 光の精：まばゆい光の玉と、まわりを回る光の筋 */
function lightSpirit(f){
 const q=mod(f,4),W=21,H=21,fr=blank(W,H),C=[[255,255,250],[255,246,210],[255,226,150],[230,190,100]];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const d=Math.hypot(x-10,y-10);if(d<=4.6)setPx(fr,x,y,d<2?C[0]:d<3.4?C[1]:C[2],true)}
 for(let k=0;k<6;k++){const a=k/6*6.283+q*0.26;for(let r=6;r<9+(k%2);r++){const x=Math.round(10+Math.cos(a)*r),y=Math.round(10+Math.sin(a)*r);setPx(fr,x,y,r<8?C[2]:C[3],true)}}
 return {...fr,ax:10,ay:18};
}
/** キノコの主：大きな笠の、苔むした茸の巨人。笠には光る斑点。act attack は笠を振り下ろし胞子を撒く */
function mushroomLord(act,f){
 const q=mod(f,4),W=34,H=38,P=[],at=act==='attack',mv=act==='move';
 const bob=mv?[0,-1,0,-1][q]:0,tilt=at?[0,2,4,2][q]:0;
 const step=mv?[-1.5,0,1.5,0][q]:0;
 P.push(C(13+step,30,13+step,36,2.6,'stem'),C(21-step,30,21-step,36,2.6,'stem'));
 P.push(E(17,25+bob,7,8,'stem',{ol:1}));
 P.push(C(10,22+bob,5,28+bob,2,'stem'),C(24,22+bob,30,27+bob-tilt*0.5,2,'stem'));
 P.push(E(17+tilt*0.5,13+bob+tilt*0.4,15,8,'cap',{ol:1}));
 P.push(E(17+tilt*0.5,17+bob+tilt*0.4,12,3,'stem'));
 const fr=raster(W,H,P);
 for(const [x,y] of [[10,10],[15,8],[21,9],[25,12],[13,13],[19,13],[8,14],[27,15]])setPx(fr,x+Math.round(tilt*0.5),y+bob+Math.round(tilt*0.4),[200,255,170],true);
 setPx(fr,15,24+bob,[220,255,180],true);setPx(fr,19,24+bob,[220,255,180],true);
 return {...fr,ax:17,ay:36};
}

export { flamePuff, vampMist, livingArmor, heroSprite, heroBed, CREST_NAMES, graveMarker, prayLight, raster, rat, lizard, spider, bat, wisp, zrat, zlizard, slime, ghost, corpse, bones, humanoid, kobold, goblin, orc, lizardman, minotaur, goblinCamp, reedHut, supplyCache, coffin, troll, basilisk, gargoyle, vampire, petrify, treasure, golem, mimic, wormHead, wormSeg, wormBody, wormMouth, wormMound, wyvern, dragon, fireBreath, adventurer, item, adventurer2, skeleton, lich, dust, dwarf, forge, wallLamp, blood, campfire, outside, outsideTop, gate, fissure, mote, inlet, eggSac, clutch, ratPup, zMark, halfEye, dragonSleep, bedroll, batSleep, wormCoil, speck, halo, hoardArt, mark, slash, fxArc, fxJag, fxArrow, fxOrb, fxBite, fxClaw, fxBurst, fxSplash, fxCrack, fxStain, fxSlash2, fxClaw2, fxBite2, fxRing, fxBlast, fxOrb2, fxArrow2, fxBit, dragonling, dragonlingSleep, eggShell, manaMote, dragonEgg, fireSpirit, phantomKnight, crownS, chiefHelm, tributeSack, goldSack, trophyArt, packArt, waterSpirit, lightSpirit, mushroomLord, ant, anthill, myconid, salamander, mushrooms, RAMP, COL, E, C, PL, LN, D, GD };
