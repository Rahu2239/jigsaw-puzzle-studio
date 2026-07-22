"use strict";

/* ========================================================================
   SECTION 10 — JIGSAW EDGE / PATH GEOMETRY (unchanged core geometry)
   ======================================================================== */

function randomEdgeParams(){
  return { a: 0.34 + (Math.random()*0.06-0.03), b: 0.5+(Math.random()*0.04-0.02), c: 0.66+(Math.random()*0.06-0.03), amp: 0.20+Math.random()*0.07, sign: Math.random()<0.5?-1:1 };
}
function generateEdgeGrids(rows, cols){
  const hEdges = [];
  for (let r=0;r<rows-1;r++){ hEdges.push([]); for (let c=0;c<cols;c++) hEdges[r].push(randomEdgeParams()); }
  const vEdges = [];
  for (let r=0;r<rows;r++){ vEdges.push([]); for (let c=0;c<cols-1;c++) vEdges[r].push(randomEdgeParams()); }
  return { hEdges, vEdges };
}
function mirrorParams(p){ return { a:1-p.c, b:1-p.b, c:1-p.a, amp:p.amp, sign:-p.sign }; }
function resolvePieceEdges(r, c, rows, cols, hEdges, vEdges){
  const top    = (r===0)        ? {sign:0} : mirrorParams(hEdges[r-1][c]);
  const bottom = (r===rows-1)   ? {sign:0} : hEdges[r][c];
  const left   = (c===0)        ? {sign:0} : mirrorParams(vEdges[r][c-1]);
  const right  = (c===cols-1)   ? {sign:0} : vEdges[r][c];
  return { top, right, bottom, left };
}
function addEdgeToPath(path, p0, dir, inward, L, edge){
  const pt = (x,y) => ({ x:p0.x+dir.x*x+inward.x*y, y:p0.y+dir.y*x+inward.y*y });
  if (edge.sign === 0){ const end = pt(L,0); path.lineTo(end.x,end.y); return; }
  const { a,b,c,amp,sign } = edge;
  const h = amp*L*sign;
  let p = pt(a*L,0); path.lineTo(p.x,p.y);
  let c1=pt(a*L,h*0.6), c2=pt(a*L-0.06*L,h*1.05), e1=pt(b*L-0.12*L,h*1.05);
  path.bezierCurveTo(c1.x,c1.y,c2.x,c2.y,e1.x,e1.y);
  let c3=pt(b*L-0.03*L,h*1.18), c4=pt(b*L+0.03*L,h*1.18), e2=pt(b*L+0.12*L,h*1.05);
  path.bezierCurveTo(c3.x,c3.y,c4.x,c4.y,e2.x,e2.y);
  let c5=pt(c*L+0.06*L,h*1.05), c6=pt(c*L,h*0.6), e3=pt(c*L,0);
  path.bezierCurveTo(c5.x,c5.y,c6.x,c6.y,e3.x,e3.y);
  p = pt(L,0); path.lineTo(p.x,p.y);
}
function buildPiecePath(edges, L, margin){
  const path = new Path2D();
  path.moveTo(margin, margin);
  addEdgeToPath(path, {x:margin,y:margin}, {x:1,y:0}, {x:0,y:1}, L, edges.top);
  addEdgeToPath(path, {x:margin+L,y:margin}, {x:0,y:1}, {x:-1,y:0}, L, edges.right);
  addEdgeToPath(path, {x:margin+L,y:margin+L}, {x:-1,y:0}, {x:0,y:-1}, L, edges.bottom);
  addEdgeToPath(path, {x:margin,y:margin+L}, {x:0,y:-1}, {x:1,y:0}, L, edges.left);
  path.closePath();
  return path;
}

/* ========================================================================
   SECTION 11 — IMAGE SLICING
   ======================================================================== */

function sliceImageToBoard(img, boardWidth, boardHeight){
  const canvas = document.createElement("canvas");
  canvas.width = boardWidth; canvas.height = boardHeight;
  const ctx = canvas.getContext("2d");
  const srcRatio = img.width / img.height, dstRatio = boardWidth / boardHeight;
  let sx, sy, sw, sh;
  if (srcRatio > dstRatio){ sh = img.height; sw = sh*dstRatio; sx = (img.width-sw)/2; sy = 0; }
  else { sw = img.width; sh = sw/dstRatio; sx = 0; sy = (img.height-sh)/2; }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, boardWidth, boardHeight);
  return canvas;
}

