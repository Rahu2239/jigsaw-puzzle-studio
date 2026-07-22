"use strict";

/* ========================================================================
   SECTION 15 — TIMER
   ======================================================================== */

function startTimer(){
  state.startTime = Date.now() - state.elapsedMs;
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    state.elapsedMs = Date.now() - state.startTime;
    dom.timerDisplay.textContent = formatTime(state.elapsedMs);
  }, 250);
  startAutoSaveInterval();
}
function stopTimer(){
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
  stopAutoSaveInterval();
}
function formatTime(ms){
  const totalSec = Math.floor(ms/1000);
  return `${String(Math.floor(totalSec/60)).padStart(2,"0")}:${String(totalSec%60).padStart(2,"0")}`;
}

