"use strict";

/* ========================================================================
   SECTION 12 — ORGANIZED SCATTER LAYOUT (perimeter rings around the board)
   ======================================================================== */

function generateFramePositions(boardWidth, boardHeight, footprint, count){
  const positions = [];
  let ring = 1;
  const maxRings = 60;
  while (positions.length < count && ring <= maxRings){
    const left = -ring*footprint, top = -ring*footprint;
    const width = boardWidth + 2*ring*footprint, height = boardHeight + 2*ring*footprint;
    const cols = Math.max(1, Math.round(width/footprint));
    const rows = Math.max(1, Math.round(height/footprint));
    const cellW = width/cols, cellH = height/rows;
    for (let j=0;j<cols;j++){
      positions.push({x:left+j*cellW, y:top});
      if (rows>1) positions.push({x:left+j*cellW, y:top+(rows-1)*cellH});
    }
    for (let i=1;i<rows-1;i++){
      positions.push({x:left, y:top+i*cellH});
      if (cols>1) positions.push({x:left+(cols-1)*cellW, y:top+i*cellH});
    }
    ring++;
  }
  // Safety net for extreme grids: keep tiling further out rather than crash.
  if (positions.length < count){
    const cols = Math.max(1, Math.floor((boardWidth + 2*maxRings*footprint) / footprint));
    const farTop = -(maxRings+2)*footprint, farLeft = -(maxRings+2)*footprint;
    let i = 0;
    while (positions.length < count){
      positions.push({ x: farLeft + (i % cols)*footprint, y: farTop - Math.floor(i/cols)*footprint });
      i++;
    }
  }
  return positions;
}

