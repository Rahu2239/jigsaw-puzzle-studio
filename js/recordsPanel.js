"use strict";

/* ========================================================================
   SECTION 6 — RECORDS / STATS UI
   ======================================================================== */

function fmtMs(ms){ return (ms === null || ms === undefined) ? "—" : formatTime(ms); }
function fmtHMS(ms){
  const totalSec = Math.floor(ms / 1000);
  return `${String(Math.floor(totalSec/3600)).padStart(2,"0")}:${String(Math.floor((totalSec%3600)/60)).padStart(2,"0")}:${String(totalSec%60).padStart(2,"0")}`;
}
const DIFF_LABELS = { easy: "Easy (3×3)", medium: "Medium (6×6)", hard: "Hard (10×10)" };

function renderRecordRow(label, rec, clearKey, onClear){
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="diff-name">${label}</td>
    <td>${fmtMs(rec.bestTimeMs)}</td>
    <td>${rec.bestMoves === null || rec.bestMoves === undefined ? "—" : rec.bestMoves}</td>
    <td><button class="clear-row-btn" data-key="${clearKey}">Clear</button></td>`;
  tr.querySelector(".clear-row-btn").addEventListener("click", onClear);
  return tr;
}

function renderRecords(){
  // --- Preset difficulties (unchanged behavior) ---
  dom.recordsTableBody.innerHTML = "";
  ["easy", "medium", "hard"].forEach(key => {
    const row = renderRecordRow(DIFF_LABELS[key], records[key], key, () => {
      if (!confirm(`Clear your ${DIFF_LABELS[key]} records?`)) return;
      records[key] = { bestTimeMs: null, bestMoves: null };
      saveRecords(); renderRecords();
    });
    dom.recordsTableBody.appendChild(row);
  });

  // --- Custom grids played (new) — sorted largest-first by piece count,
  // since that's usually what a player scans for first ("did I beat my
  // last huge grid?"). Only ever shows grids that have actually been
  // completed at least once; nothing is pre-populated. ---
  const customKeys = Object.keys(records.custom).sort((a, b) => {
    const ra = records.custom[a], rb = records.custom[b];
    return (rb.rows * rb.cols) - (ra.rows * ra.cols);
  });

  dom.customRecordsTableBody.innerHTML = "";
  customKeys.forEach(key => {
    const rec = records.custom[key];
    const label = `Custom (${rec.rows}×${rec.cols})`;
    const row = renderRecordRow(label, rec, key, () => {
      if (!confirm(`Clear your ${label} records?`)) return;
      delete records.custom[key];
      saveRecords(); renderRecords();
    });
    dom.customRecordsTableBody.appendChild(row);
  });

  const hasCustom = customKeys.length > 0;
  dom.customRecordsEmpty.style.display = hasCustom ? "none" : "block";
  dom.customRecordsTable.style.display = hasCustom ? "table" : "none";
  dom.clearAllCustomRecordsBtn.style.display = hasCustom ? "inline-flex" : "none";

  dom.totalSolvedValue.textContent = records.totalSolved;
  dom.totalTimeValue.textContent = fmtHMS(records.totalTimeMs);
}

dom.recordsBtn.addEventListener("click", () => { renderRecords(); dom.recordsModal.classList.add("visible"); });

dom.clearAllCustomRecordsBtn.addEventListener("click", () => {
  if (!confirm("Clear records for every custom grid you've played? This won't affect Easy/Medium/Hard.")) return;
  records.custom = {};
  saveRecords(); renderRecords();
});
