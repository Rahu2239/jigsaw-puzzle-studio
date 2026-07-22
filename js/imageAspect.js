"use strict";

/* ========================================================================
   SECTION 7 — IMAGE DIMENSIONS & ASPECT-RATIO GRID RECOMMENDATION
   ======================================================================== */

function loadImage(url){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function getImageDimensions(url){
  if (imageDimsCache.has(url)) return imageDimsCache.get(url);
  const img = await loadImage(url);
  const dims = { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
  imageDimsCache.set(url, dims);
  return dims;
}

function gcd(a, b){ a = Math.round(a); b = Math.round(b); return b === 0 ? a : gcd(b, a % b); }
function ratioLabel(w, h){
  const g = gcd(w, h) || 1;
  return `${Math.round(w / g)}:${Math.round(h / g)}`;
}

// Choose rows/cols whose ratio matches the image's aspect ratio as closely
// as possible, while keeping the total piece count close to `targetTotal`
// (so switching images doesn't wildly change how long a puzzle takes).
function computeRecommendedGrid(width, height, targetTotal){
  const ar = width / height;
  let rows = Math.round(Math.sqrt(targetTotal / ar));
  let cols = Math.round(Math.sqrt(targetTotal * ar));
  rows = Math.max(GRID_MIN, Math.min(GRID_MAX, rows));
  cols = Math.max(GRID_MIN, Math.min(GRID_MAX, cols));
  return { rows, cols };
}

async function updateAspectRecommendation(){
  const url = state.selectedImageUrl;
  try{
    const dims = await getImageDimensions(url);
    if (state.selectedImageUrl !== url) return; // selection changed while we were loading
    state.selectedImageDims = dims;
    const targetTotal = Math.max(4, state.rows * state.cols);
    const rec = computeRecommendedGrid(dims.width, dims.height, targetTotal);
    state.recommendedGrid = rec;

    dom.aspectDimsText.textContent = `${dims.width}×${dims.height}`;
    dom.aspectRatioText.textContent = ratioLabel(dims.width, dims.height);
    dom.aspectRecText.textContent = `${rec.rows} rows × ${rec.cols} cols (${rec.rows * rec.cols} pieces)`;
    dom.aspectBanner.style.display = "flex";
  }catch(e){
    dom.aspectBanner.style.display = "none";
    state.selectedImageDims = null;
    state.recommendedGrid = null;
  }
}

dom.applyRecommendedGridBtn.addEventListener("click", () => {
  if (!state.recommendedGrid) return;
  applyCustomGrid(state.recommendedGrid.rows, state.recommendedGrid.cols);
});

function applyCustomGrid(rows, cols){
  rows = Math.max(GRID_MIN, Math.min(GRID_MAX, rows));
  cols = Math.max(GRID_MIN, Math.min(GRID_MAX, cols));
  state.rows = rows; state.cols = cols;
  dom.rowsInput.value = rows; dom.colsInput.value = cols;
  dom.piecesTotal.textContent = rows * cols;
  document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("selected"));
  dom.customPresetBtn.classList.add("selected");
  dom.customGrid.style.display = "flex";
  updatePerfWarning();
}

function updatePerfWarning(){
  const total = state.rows * state.cols;
  if (total > 3000){
    dom.perfWarning.style.display = "block";
    dom.perfWarning.textContent = `⚠️ ${total.toLocaleString()} pieces is a lot! Building may take several seconds and could run slowly on some devices.`;
  } else if (total > 1200){
    dom.perfWarning.style.display = "block";
    dom.perfWarning.textContent = `ℹ️ ${total.toLocaleString()} pieces — this may take a few seconds to build.`;
  } else {
    dom.perfWarning.style.display = "none";
  }
}

