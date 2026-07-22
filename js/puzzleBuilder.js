"use strict";

/* ========================================================================
   SECTION 13 — PUZZLE GENERATION (async + batched so huge grids don't
   freeze the tab; progress is reported to whichever UI is visible)
   ======================================================================== */

function yieldFrame(){ return new Promise(resolve => requestAnimationFrame(() => resolve())); }

function reportBuildProgress(current, total){
  const text = total > BATCH_SIZE ? `Building puzzle… ${current}/${total} pieces` : "Building puzzle…";
  if (dom.startBtn.disabled) dom.startBtn.textContent = text;
  dom.buildProgressText.textContent = text;
  dom.buildProgressOverlay.style.display = "flex";
}
function hideBuildProgress(){ dom.buildProgressOverlay.style.display = "none"; }

// Piece size floor gets smaller as grids get huge, so a 100x100 board
// doesn't become physically enormous — otherwise a piece count in the
// thousands keeps things at least dimly workable on screen.
function computeMinPieceSize(totalPieces){
  if (totalPieces > 6000) return 14;
  if (totalPieces > 2500) return 18;
  if (totalPieces > 900) return 24;
  return 34;
}

async function startPuzzle(){
  dom.startBtn.disabled = true;
  dom.startBtn.textContent = "Loading image…";
  try{
    const img = await loadImage(state.selectedImageUrl);
    state.imageElement = img;
    // Remember how to reload this exact image later (default URL, or a
    // persisted custom upload's IndexedDB id) so a save can be restored
    // even after the page — and any blob: object URLs — are gone.
    const customMatch = state.customImages.find(ci => ci.url === state.selectedImageUrl);
    state.currentImageSource = (customMatch && customMatch.id)
      ? { type: "custom", imageId: customMatch.id, label: customMatch.label }
      : { type: "default", url: state.selectedImageUrl };

    await buildPuzzle();
    dom.setupScreen.style.display = "none";
    dom.gameScreen.style.display = "block";
    startTimer();
    saveGameSnapshot(); // capture an immediate snapshot so a brand-new puzzle overwrites any stale abandoned save right away
  }catch(err){
    alert("Could not load that image (it may not allow cross-origin use). Please try another image or upload your own.");
    console.error(err);
  }finally{
    dom.startBtn.disabled = false;
    dom.startBtn.textContent = "Start Puzzle →";
  }
}

// restoreData, when provided, is a save-game record (see saveLoad.js): it
// supplies rows/cols, elapsed time, moves, the exact edge geometry, and
// each piece's locked/rotation/position so the board can be recreated
// exactly as the player left it. When omitted, this builds a brand-new
// puzzle exactly as before.
async function buildPuzzle(restoreData){
  stopTimer();
  dom.winModal.classList.remove("visible");
  dom.previewBtn.classList.remove("active");
  dom.previewImg.classList.remove("visible");
  dom.previewBtn.textContent = "👁 Show Preview";
  document.querySelectorAll(".piece").forEach(el => el.remove());

  const rows = restoreData ? restoreData.rows : state.rows;
  const cols = restoreData ? restoreData.cols : state.cols;
  state.rows = rows; state.cols = cols;
  state.totalPieces = rows * cols;
  state.lockedCount = restoreData ? restoreData.pieces.filter(p => p.locked).length : 0;
  state.elapsedMs = restoreData ? restoreData.elapsedMs : 0;
  state.moveCount = restoreData ? restoreData.moveCount : 0;
  state.topZ = 10;
  state.rotationEnabled = restoreData ? restoreData.rotationEnabled : settings.rotationEnabled;
  updateHud();

  reportBuildProgress(0, state.totalPieces);
  await yieldFrame(); // let the "building..." message actually paint before heavy work starts

  const wrapWidth = dom.arenaWrap.clientWidth || 900;
  const targetBoardWidth = Math.min(TARGET_BOARD_WIDTH, wrapWidth - 40);
  const minPieceSize = computeMinPieceSize(state.totalPieces);
  let pieceSize = targetBoardWidth / cols;
  pieceSize = Math.max(minPieceSize, Math.min(MAX_PIECE_SIZE, pieceSize));

  const boardWidth = pieceSize * cols;
  const boardHeight = pieceSize * rows;
  const margin = pieceSize * 0.42;
  const footprint = pieceSize * 1.15;
  const canvasSize = pieceSize + margin * 2;

  state.pieceSize = pieceSize; state.margin = margin; state.footprint = footprint;
  state.boardWidth = boardWidth; state.boardHeight = boardHeight;

  const slicedCanvas = sliceImageToBoard(state.imageElement, boardWidth, boardHeight);

  // One shared tiny canvas reused to sample each piece's dominant color
  // (from the pre-sliced board image, not the clipped piece canvas, so
  // transparent tab/blank padding never skews the average).
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = COLOR_SAMPLE_SIZE; sampleCanvas.height = COLOR_SAMPLE_SIZE;
  const sampleCtx = sampleCanvas.getContext("2d");

  // Edge geometry: reuse the saved tab/blank pattern when resuming (so the
  // picture looks exactly like it did before), otherwise randomize fresh.
  let hEdges, vEdges;
  if (restoreData){ hEdges = restoreData.hEdges; vEdges = restoreData.vEdges; }
  else { ({ hEdges, vEdges } = generateEdgeGrids(rows, cols)); }
  state.hEdges = hEdges; state.vEdges = vEdges;

  // Every piece's "provisional" position, in board-relative coordinates
  // (as if the board sat at (0,0)) — either a fresh scattered ring layout,
  // or each piece's saved offset from the board. Locked pieces don't need
  // a provisional scatter spot; their home position is used directly below.
  let provisional;
  if (restoreData){
    provisional = restoreData.pieces.map(p => (
      p.locked ? { x: 0, y: 0, rotation: 0, locked: true, inOrganizer: false }
      : p.inOrganizer ? { x: 0, y: 0, rotation: p.rotation, locked: false, inOrganizer: true }
      : { x: p.x, y: p.y, rotation: p.rotation, locked: false, inOrganizer: false }
    ));
  } else {
    const framePositions = generateFramePositions(boardWidth, boardHeight, footprint, state.totalPieces);
    const chosenIdx = shuffleArray([...Array(framePositions.length).keys()]).slice(0, state.totalPieces);
    provisional = chosenIdx.map(i => {
      const p = framePositions[i];
      const jitterX = (Math.random()-0.5) * footprint * 0.25;
      const jitterY = (Math.random()-0.5) * footprint * 0.25;
      const rotation = state.rotationEnabled ? [0,90,180,270][Math.floor(Math.random()*4)] : 0;
      return { x: p.x + jitterX, y: p.y + jitterY, rotation, locked: false, inOrganizer: false };
    });
  }

  // Bounding box over the board rect ∪ every piece's provisional spot, so
  // the arena is sized to comfortably fit everything (ring-scattered
  // pieces for a new game, or wherever pieces were left for a resume).
  let minX=0, minY=0, maxX=boardWidth, maxY=boardHeight;
  provisional.forEach(p => {
    if (p.locked || p.inOrganizer) return; // these never occupy arena space
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x+footprint); maxY = Math.max(maxY, p.y+footprint);
  });
  const pad = margin + 30;
  const offsetX = -minX + pad, offsetY = -minY + pad;
  const arenaWidth = (maxX-minX) + pad*2, arenaHeight = (maxY-minY) + pad*2;
  dom.arena.style.width = arenaWidth + "px";
  dom.arena.style.height = arenaHeight + "px";

  const boardX = offsetX, boardY = offsetY;
  state.boardX = boardX; state.boardY = boardY;

  dom.boardFrame.style.left = boardX + "px"; dom.boardFrame.style.top = boardY + "px";
  dom.boardFrame.style.width = boardWidth + "px"; dom.boardFrame.style.height = boardHeight + "px";
  dom.previewImg.src = slicedCanvas.toDataURL();

  state.pieces = [];
  state.pieceGrid = Array.from({ length: rows }, () => new Array(cols).fill(null));
  // Cap device-pixel-ratio scaling for huge grids — thousands of
  // high-DPI canvases would otherwise burn a lot of memory for a level
  // of sharpness nobody can see at 14px on screen anyway.
  const dpr = state.totalPieces > 2000 ? 1 : Math.min(window.devicePixelRatio || 1, 2);

  const fragment = document.createDocumentFragment();
  let idx = 0;
  for (let r = 0; r < rows; r++){
    for (let c = 0; c < cols; c++){
      const edges = resolvePieceEdges(r, c, rows, cols, hEdges, vEdges);
      const path = buildPiecePath(edges, pieceSize, margin);

      const canvas = document.createElement("canvas");
      canvas.className = "piece";
      canvas.width = canvasSize * dpr; canvas.height = canvasSize * dpr;
      canvas.style.width = canvasSize + "px"; canvas.style.height = canvasSize + "px";

      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.save(); ctx.clip(path);
      ctx.drawImage(slicedCanvas, -(c*pieceSize-margin), -(r*pieceSize-margin));
      ctx.restore();
      ctx.save(); ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.stroke(path); ctx.restore();

      sampleCtx.clearRect(0, 0, COLOR_SAMPLE_SIZE, COLOR_SAMPLE_SIZE);
      sampleCtx.drawImage(slicedCanvas, c*pieceSize, r*pieceSize, pieceSize, pieceSize, 0, 0, COLOR_SAMPLE_SIZE, COLOR_SAMPLE_SIZE);
      const sample = sampleCtx.getImageData(0, 0, COLOR_SAMPLE_SIZE, COLOR_SAMPLE_SIZE).data;
      let sr=0, sg=0, sb=0, sn=0;
      for (let i=0; i<sample.length; i+=4){ sr+=sample[i]; sg+=sample[i+1]; sb+=sample[i+2]; sn++; }
      const colorBucket = rgbToColorBucket(sr/sn, sg/sn, sb/sn);
      const isEdge = isEdgePiece(r, c, rows, cols);

      const prov = provisional[idx];
      const homeX = boardX + c*pieceSize - margin, homeY = boardY + r*pieceSize - margin;
      const finalX = prov.locked ? homeX : (offsetX + prov.x);
      const finalY = prov.locked ? homeY : (offsetY + prov.y);

      const piece = {
        r, c, el: canvas, homeX, homeY, x: finalX, y: finalY, rotation: prov.rotation,
        locked: prov.locked, inOrganizer: false, colorBucket, isEdge, cluster: null
      };
      applyPieceTransform(piece);
      canvas.style.zIndex = prov.locked ? 5 : (10 + idx);
      if (prov.locked) canvas.classList.add("locked");

      attachDragHandlers(canvas, piece);
      state.pieceGrid[r][c] = piece;

      if (prov.inOrganizer){
        movePieceToOrganizer(piece);
      } else {
        fragment.appendChild(canvas);
      }
      state.pieces.push(piece);
      idx++;

      if (idx % BATCH_SIZE === 0){
        dom.arena.appendChild(fragment); // flush what we have so it's visible / memory stays bounded
        reportBuildProgress(idx, state.totalPieces);
        await yieldFrame();
      }
    }
  }
  dom.arena.appendChild(fragment); // flush any remainder
  resetPieceFilters();
  // Only reconstruct magnetic clusters when resuming a save — a brand-new
  // game's pieces are freshly (randomly) scattered with no prior connected
  // state to derive, and checking anyway risks spurious matches purely by
  // coincidence of scatter spacing landing within the magnetic tolerance.
  if (restoreData) detectAllMagneticClusters();
  hideBuildProgress();
}

function shuffleArray(arr){
  for (let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  return arr;
}

