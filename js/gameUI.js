"use strict";

/* ========================================================================
   SECTION 16 — HUD, PREVIEW TOGGLE, WIN HANDLING
   ======================================================================== */

function updateHud(){
  dom.progressDisplay.textContent = `${state.lockedCount} / ${state.totalPieces}`;
  const pct = state.totalPieces ? (state.lockedCount/state.totalPieces)*100 : 0;
  dom.progressFill.style.width = pct + "%";
}
dom.previewBtn.addEventListener("click", () => {
  const show = dom.previewImg.classList.toggle("visible");
  dom.previewImg.style.opacity = show ? settings.ghostOpacity : 0;
  dom.previewBtn.classList.toggle("active", show);
  dom.previewBtn.textContent = show ? "🙈 Hide Preview" : "👁 Show Preview";
});
dom.shuffleBtn.addEventListener("click", shuffleTray);
dom.newPuzzleBtn.addEventListener("click", () => {
  stopTimer();
  dom.gameScreen.style.display = "none";
  dom.setupScreen.style.display = "block";
});

// Guards against a slow/late-resolving world-record check painting its
// banner on top of a LATER puzzle completion (e.g. the player finishes
// another quick puzzle before a prior check's network round-trip
// returns). Each call to onPuzzleComplete() claims the next id; a
// check's result is only ever applied if its id still matches the most
// recent completion by the time it resolves.
let completionSequence = 0;

function onPuzzleComplete(){
  stopTimer();
  playWinSound();
  idbDeleteSave().catch(() => {}); // finished puzzles aren't resumable — clear the save slot

  const bucket = getRecordBucket(state.rows, state.cols);
  let newTimeRecord = false, newMovesRecord = false;
  records.totalSolved += 1;
  records.totalTimeMs += state.elapsedMs;
  const rec = bucket.rec;
  if (rec.bestTimeMs === null || state.elapsedMs < rec.bestTimeMs){ rec.bestTimeMs = state.elapsedMs; newTimeRecord = true; }
  if (rec.bestMoves === null || state.moveCount < rec.bestMoves){ rec.bestMoves = state.moveCount; newMovesRecord = true; }
  saveRecords();

  dom.winTime.textContent = formatTime(state.elapsedMs);
  dom.winMoves.textContent = state.moveCount;
  dom.winPieces.textContent = state.totalPieces;
  dom.winBadges.innerHTML = "";
  if (newTimeRecord) dom.winBadges.innerHTML += `<span class="new-record-badge">🏅 New Best Time</span> `;
  if (newMovesRecord) dom.winBadges.innerHTML += `<span class="new-record-badge">🏅 New Fewest Moves</span>`;
  if (bucket.type === "custom") dom.winBadges.innerHTML += ` <span class="new-record-badge">🧩 ${state.rows}×${state.cols} Custom Grid</span>`;
  dom.worldRecordBanner.style.display = "none"; // reset from any previous completion before this one's own check resolves

  dom.winModal.classList.add("visible");
  launchConfetti();

  // Fire-and-forget: the modal above is already fully shown with the
  // player's local results, so this cloud check (today, a same-tick
  // no-op — see onlineSync.js) never delays anything the player sees.
  completionSequence += 1;
  const myCompletionId = completionSequence;
  checkAndSubmitWorldRecord({ gridSize: bucket.key, timeMs: state.elapsedMs, moveCount: state.moveCount })
    .then(result => {
      if (myCompletionId !== completionSequence) return; // a newer completion has since happened — this result is stale
      if (result.isWorldRecord && dom.winModal.classList.contains("visible")){
        dom.worldRecordBanner.style.display = "block";
      }
    });
}

dom.playAgainBtn.addEventListener("click", async () => {
  dom.winModal.classList.remove("visible");
  dom.playAgainBtn.disabled = true;
  await buildPuzzle();
  dom.playAgainBtn.disabled = false;
  startTimer();
  saveGameSnapshot();
});
dom.newFromWinBtn.addEventListener("click", () => {
  dom.winModal.classList.remove("visible");
  dom.gameScreen.style.display = "none";
  dom.setupScreen.style.display = "block";
});

function launchConfetti(){
  const colors = ["#6fd6c4","#f6b352","#ef6f6f","#8ea6ff","#ffffff"];
  for (let i=0;i<90;i++){
    const el = document.createElement("div");
    el.className = "confetti-piece";
    el.style.left = Math.random()*100 + "vw";
    el.style.background = colors[Math.floor(Math.random()*colors.length)];
    el.style.animationDuration = (2.2+Math.random()*1.6) + "s";
    el.style.animationDelay = (Math.random()*0.4) + "s";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  }
}

// Small, self-dismissing confirmation toast (e.g. "Game saved!").
function showToast(message){
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("visible"));
  setTimeout(() => {
    el.classList.remove("visible");
    setTimeout(() => el.remove(), 300);
  }, 2000);
}

