"use strict";

/* ========================================================================
   SECTION 14 — DRAG & DROP + SNAPPING + ROTATION + MAGNETIC CLUSTERS
   ------------------------------------------------------------------------
   Performance notes:
   - pointermove can fire far more often than the screen actually repaints
     (especially on high-polling-rate mice/trackpads). We only ever want
     to touch the DOM once per paintable frame, so every pointermove just
     caches the latest event and schedules a single requestAnimationFrame
     callback to do the real work — if several pointermove events arrive
     before the next frame, only the most recent one is ever processed.
   - dom.arena.getBoundingClientRect() forces the browser to flush layout.
     Calling it on every pointermove (as before) is a classic "layout
     thrashing" pattern. It's now read once per drag gesture and cached,
     invalidated only by a real arena scroll/resize or the start of the
     next drag — see getArenaRect() below.
   - Positions are applied via applyPieceTransform() (pieceRender.js),
     which writes a single compositor-only `transform`, never `top`/`left`.
   ======================================================================== */

let cachedArenaRect = null;
function getArenaRect(){
  if (!cachedArenaRect) cachedArenaRect = dom.arena.getBoundingClientRect();
  return cachedArenaRect;
}
function invalidateArenaRect(){ cachedArenaRect = null; }
dom.arenaWrap.addEventListener("scroll", invalidateArenaRect, { passive: true });
window.addEventListener("resize", invalidateArenaRect, { passive: true });

function attachDragHandlers(canvas, piece){
  let dragOffsetX=0, dragOffsetY=0, dragging=false, startX=0, startY=0;
  let trayDragPending=false; // true while a drag on a tray piece hasn't yet moved past the click threshold
  let rafId=null, pendingEvent=null;

  // The actual per-frame work — called at most once per animation frame
  // regardless of how many pointermove events arrived in between.
  function processMove(){
    rafId = null;
    if (!dragging || !pendingEvent) return;
    const e = pendingEvent;

    if (trayDragPending){
      const moved = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (moved < CLICK_MOVE_THRESHOLD) return; // still just a tap so far — leave it parked until confirmed as a drag
      trayDragPending = false;
      piece.inOrganizer = false;
      canvas.classList.remove("in-organizer");
      const canvasSize = state.pieceSize + state.margin * 2;
      const rect0 = getArenaRect();
      piece.x = (startX - rect0.left) - canvasSize/2;
      piece.y = (startY - rect0.top) - canvasSize/2;
      startX = piece.x; startY = piece.y;
      dom.arena.appendChild(canvas);
      applyPieceTransform(piece);
      const rect1 = getArenaRect();
      dragOffsetX = (e.clientX - rect1.left) - piece.x;
      dragOffsetY = (e.clientY - rect1.top) - piece.y;
    }

    const rect = getArenaRect();
    const newX = (e.clientX - rect.left) - dragOffsetX;
    const newY = (e.clientY - rect.top) - dragOffsetY;
    const deltaX = newX - piece.x, deltaY = newY - piece.y;
    piece.x = newX; piece.y = newY;
    applyPieceTransform(piece);

    // Carry the rest of the magnetic cluster along by the same delta so
    // relative positions stay perfectly rigid while dragging. Iterating
    // the Set directly (no getClusterMembers() spread) avoids allocating
    // a new array on every single frame of the drag.
    if (piece.cluster){
      piece.cluster.members.forEach(m => {
        if (m === piece) return;
        m.x += deltaX; m.y += deltaY;
        applyPieceTransform(m);
      });
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (piece.locked || (e.button !== undefined && e.button !== 0)) return;

    if (state.eyedropperActive){
      state.activeFilters.colorBucket = piece.colorBucket;
      state.eyedropperActive = false;
      dom.eyedropperBtn.classList.remove("active");
      dom.arenaWrap.classList.remove("eyedropper-active");
      renderColorSwatches();
      applyPieceFilters();
      updateClearFiltersVisibility();
      return;
    }

    dragging = true;
    invalidateArenaRect(); // guarantee a fresh read at the start of every drag gesture
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("dragging");

    // Bump the grabbed piece — and every piece riding along with it in a
    // magnetic cluster — to the front, so the whole group renders above
    // everything else in the workspace while it's being moved.
    state.topZ += 1;
    canvas.style.zIndex = state.topZ;
    if (piece.cluster){
      piece.cluster.members.forEach(m => {
        if (m === piece) return;
        state.topZ += 1;
        m.el.style.zIndex = state.topZ;
      });
    }

    trayDragPending = piece.inOrganizer;
    if (trayDragPending){
      startX = e.clientX; startY = e.clientY; // compared against raw client coords until pulled out of the tray
    } else {
      startX = piece.x; startY = piece.y;
      const rect = getArenaRect();
      dragOffsetX = (e.clientX - rect.left) - piece.x;
      dragOffsetY = (e.clientY - rect.top) - piece.y;
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    pendingEvent = e; // only ever keep the latest — older queued events are simply superseded
    if (rafId === null) rafId = requestAnimationFrame(processMove);
  });

  function endDrag(e){
    if (!dragging) return;

    // Flush whatever move hasn't been applied yet (the scheduled rAF may
    // not have fired), plus this release event's own position, so every
    // downstream check below (click distance, snap distance, organizer
    // hover) uses the piece's true final position rather than a
    // potentially one-frame-stale one.
    if (rafId !== null){ cancelAnimationFrame(rafId); rafId = null; }
    pendingEvent = e;
    processMove();
    pendingEvent = null;

    dragging = false;
    canvas.classList.remove("dragging");
    try{ canvas.releasePointerCapture(e.pointerId); }catch(err){}

    if (trayDragPending){
      // Never actually left the tray — this was just a tap (rotate if enabled).
      trayDragPending = false;
      if (state.rotationEnabled){
        piece.rotation = (piece.rotation + 90) % 360;
        applyPieceTransform(piece);
        playRotateSound();
      }
      return;
    }

    const movedDist = Math.hypot(piece.x-startX, piece.y-startY);
    if (movedDist < CLICK_MOVE_THRESHOLD){
      if (state.rotationEnabled){
        piece.rotation = (piece.rotation + 90) % 360;
        applyPieceTransform(piece);
        playRotateSound();
      }
      return;
    }

    state.moveCount += 1;
    dom.movesDisplay.textContent = state.moveCount;

    // Only a solo (unclustered) piece can be parked in the Organizer Tray —
    // a rigid multi-piece cluster doesn't fit the tray's simple flex-wrap
    // storage model, so a clustered piece dropped over the tray is just
    // left wherever it was released in the workspace instead.
    if (!piece.cluster && isPointerOverOrganizer(e.clientX, e.clientY)){
      movePieceToOrganizer(piece);
      scheduleSave();
      return;
    }

    const dx = piece.x-piece.homeX, dy = piece.y-piece.homeY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const threshold = state.pieceSize * (SNAP_RATIOS[settings.snapSensitivity] || SNAP_RATIOS.default);
    const rotationOk = !state.rotationEnabled || piece.rotation % 360 === 0;

    if (dist <= threshold && rotationOk){
      // The dragged piece is home — by construction, every other member of
      // its magnetic cluster is simultaneously at its own home too, so the
      // whole group locks onto the board together in one satisfying snap.
      const members = getClusterMembers(piece);
      members.forEach(m => {
        m.rotation = 0;
        setPiecePosition(m, m.homeX, m.homeY);
        m.locked = true;
        m.cluster = null;
        m.el.classList.add("locked", "just-snapped");
        m.el.classList.remove("magnet-clustered");
        m.el.style.zIndex = 5;
        setTimeout(() => m.el.classList.remove("just-snapped"), 250);
      });
      playSnapSound();
      state.lockedCount += members.length;
      updateHud();
      saveGameSnapshot(); // a board lock is a high-value moment — save immediately, not debounced
      if (state.lockedCount === state.totalPieces) onPuzzleComplete();
      return;
    }

    // Didn't snap to the board — see if this drag brought it (or its
    // cluster) into correct alignment with any new neighboring piece.
    checkMagneticConnections(piece);
    scheduleSave();
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
}

function shuffleTray(){
  const unplaced = state.pieces.filter(p => !p.locked && !p.inOrganizer);
  if (unplaced.length === 0) return;
  const positions = generateFramePositions(state.boardWidth, state.boardHeight, state.footprint, unplaced.length);
  const order = shuffleArray([...Array(positions.length).keys()]).slice(0, unplaced.length);
  unplaced.forEach((piece, i) => {
    const p = positions[order[i]];
    const jitterX = (Math.random()-0.5) * state.footprint * 0.25;
    const jitterY = (Math.random()-0.5) * state.footprint * 0.25;
    setPiecePosition(piece, state.boardX + p.x + jitterX, state.boardY + p.y + jitterY);
  });
}
