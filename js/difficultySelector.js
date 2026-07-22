"use strict";

/* ========================================================================
   SECTION 9 — SETUP SCREEN: DIFFICULTY SELECTION
   ======================================================================== */

function setPreset(rows, cols, btn){
  state.rows = rows; state.cols = cols;
  dom.rowsInput.value = rows; dom.colsInput.value = cols;
  dom.piecesTotal.textContent = rows * cols;
  document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("selected"));
  if (btn) btn.classList.add("selected");
  dom.customGrid.style.display = (btn === dom.customPresetBtn) ? "flex" : "none";
  updatePerfWarning();
}
dom.presetRow.querySelectorAll(".preset-btn[data-rows]").forEach(btn => {
  btn.addEventListener("click", () => setPreset(parseInt(btn.dataset.rows, 10), parseInt(btn.dataset.cols, 10), btn));
});
dom.customPresetBtn.addEventListener("click", () => setPreset(parseInt(dom.rowsInput.value, 10), parseInt(dom.colsInput.value, 10), dom.customPresetBtn));

function clampGridInput(input){
  let v = parseInt(input.value, 10);
  if (isNaN(v)) v = GRID_MIN;
  v = Math.max(GRID_MIN, Math.min(GRID_MAX, v));
  input.value = v;
  return v;
}
[dom.rowsInput, dom.colsInput].forEach(input => {
  input.addEventListener("input", () => {
    const rows = clampGridInput(dom.rowsInput), cols = clampGridInput(dom.colsInput);
    state.rows = rows; state.cols = cols;
    dom.piecesTotal.textContent = rows * cols;
    document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("selected"));
    dom.customPresetBtn.classList.add("selected");
    dom.customGrid.style.display = "flex";
    updatePerfWarning();
  });
});
setPreset(3, 3, dom.presetRow.querySelector('[data-rows="3"]'));

