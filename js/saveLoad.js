"use strict";

/* ========================================================================
   SECTION 18 — SAVE / LOAD (auto-save, manual save, resume-session UI)
   ------------------------------------------------------------------------
   A single resumable "save slot" (SAVE_ID) is kept in IndexedDB — the same
   database already used for uploaded photos, since a save for an 800+
   piece puzzle is comfortably larger than what localStorage is meant for.

   What's saved: the image source (a default URL, or the IndexedDB id of a
   persisted upload — never the image bytes themselves, to avoid storing
   a multi-megabyte photo twice), the grid size, elapsed time, moves, the
   exact tab/blank edge geometry (so a resumed picture looks identical to
   how it was left), and every piece's r/c, lock state, rotation, and — for
   still-loose pieces — position as an offset from the board's top-left
   corner (so a resume still looks right even if the window was resized,
   which would otherwise shift the board's on-screen position).
   ======================================================================== */

let autoSaveIntervalId = null;
let pendingResumeSave = null; // the save record shown in the resume modal, until the player decides
let saveDebounceId = null;

function startAutoSaveInterval(){
  stopAutoSaveInterval();
  autoSaveIntervalId = setInterval(() => { saveGameSnapshot(); }, AUTO_SAVE_INTERVAL_MS);
}
function stopAutoSaveInterval(){
  if (autoSaveIntervalId) clearInterval(autoSaveIntervalId);
  autoSaveIntervalId = null;
  if (saveDebounceId){ clearTimeout(saveDebounceId); saveDebounceId = null; }
}

// serializePiecesForSave() walks every piece — cheap for a small puzzle,
// but a genuinely measurable cost at thousands of pieces if it ran on
// every single drag release. High-value moments (a board lock, a manual
// save, completing the puzzle) still call saveGameSnapshot() directly and
// immediately; everything else (a piece was just moved but didn't snap or
// connect to anything) goes through this debounced wrapper instead, which
// coalesces a burst of rapid drags into one save shortly after things
// settle. The 30s interval and snap-triggered saves already provide a
// safety net, so this trades a small, low-risk window for a real
// reduction in serialization frequency during active play.
function scheduleSave(){
  if (saveDebounceId) clearTimeout(saveDebounceId);
  saveDebounceId = setTimeout(() => {
    saveDebounceId = null;
    saveGameSnapshot();
  }, 1200);
}

// Board-relative offsets for loose pieces, homeless (r,c only) for locked
// ones — locked pieces are always exactly at their home position, so
// there's nothing extra worth saving for them beyond the flag itself.
function serializePiecesForSave(){
  return state.pieces.map(p => (
    p.locked
      ? { r: p.r, c: p.c, locked: true, rotation: 0, x: 0, y: 0, inOrganizer: false }
      : { r: p.r, c: p.c, locked: false, rotation: p.rotation, inOrganizer: !!p.inOrganizer,
          x: p.x - state.boardX, y: p.y - state.boardY }
  ));
}

async function saveGameSnapshot(){
  if (!state.pieces.length || !state.currentImageSource) return;      // nothing active to save
  if (state.totalPieces > 0 && state.lockedCount >= state.totalPieces) return; // finished puzzles aren't resumable
  try{
    const record = {
      id: SAVE_ID,
      imageSource: state.currentImageSource,
      rows: state.rows, cols: state.cols,
      elapsedMs: state.elapsedMs, moveCount: state.moveCount,
      lockedCount: state.lockedCount, totalPieces: state.totalPieces,
      rotationEnabled: state.rotationEnabled,
      hEdges: state.hEdges, vEdges: state.vEdges,
      pieces: serializePiecesForSave(),
      savedAt: Date.now()
    };
    await idbPutSave(record);
  }catch(e){
    console.warn("Auto-save failed (gameplay is unaffected):", e);
  }
}

dom.saveGameBtn.addEventListener("click", async () => {
  await saveGameSnapshot();
  showToast("💾 Game saved!");
});

/* ---- Resume-session modal ---- */

function showResumeModal(save){
  pendingResumeSave = save;
  dom.resumeSummary.textContent =
    `${save.rows} × ${save.cols} puzzle — ${save.lockedCount}/${save.totalPieces} pieces placed, ${formatTime(save.elapsedMs)} elapsed.`;
  dom.resumeModal.classList.add("visible");
}

dom.resumeGameBtn.addEventListener("click", async () => {
  if (!pendingResumeSave) return;
  const save = pendingResumeSave;
  pendingResumeSave = null;
  dom.resumeModal.classList.remove("visible");
  await resumeSavedGame(save);
});

dom.discardSaveBtn.addEventListener("click", async () => {
  pendingResumeSave = null;
  dom.resumeModal.classList.remove("visible");
  try{ await idbDeleteSave(); }catch(e){ console.warn(e); }
});

async function resumeSavedGame(save){
  dom.resumeGameBtn.disabled = true;
  dom.discardSaveBtn.disabled = true;
  const originalLabel = dom.resumeGameBtn.textContent;
  dom.resumeGameBtn.textContent = "Loading…";
  try{
    let img, resolvedUrl;
    if (save.imageSource.type === "custom"){
      const rec = await idbGetImageById(save.imageSource.imageId);
      if (!rec) throw new Error("The saved puzzle's image could not be found — it may have been removed.");
      resolvedUrl = URL.createObjectURL(rec.blob);
      img = await loadImage(resolvedUrl);
    } else {
      resolvedUrl = save.imageSource.url;
      img = await loadImage(resolvedUrl);
    }
    state.imageElement = img;
    state.selectedImageUrl = resolvedUrl;
    state.currentImageSource = save.imageSource;

    await buildPuzzle(save);

    dom.setupScreen.style.display = "none";
    dom.gameScreen.style.display = "block";
    startTimer();
    saveGameSnapshot(); // normalize the record now that layout/board size are finalized for this device
  }catch(err){
    console.error("Could not resume saved puzzle:", err);
    alert("Sorry, we couldn't restore that saved puzzle (its image may be missing). Starting fresh instead.");
    try{ await idbDeleteSave(); }catch(e){}
  }finally{
    dom.resumeGameBtn.disabled = false;
    dom.discardSaveBtn.disabled = false;
    dom.resumeGameBtn.textContent = originalLabel;
  }
}

async function checkForResumableSave(){
  try{
    const save = await idbGetSave();
    if (!save || !save.pieces || !save.pieces.length) return;
    if (save.lockedCount >= save.totalPieces){ await idbDeleteSave(); return; } // stale/completed — clean up quietly
    showResumeModal(save);
  }catch(e){
    console.warn("Could not check for a resumable save:", e);
  }
}
