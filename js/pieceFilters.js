"use strict";

/* ========================================================================
   SECTION 20 — PIECE ORGANIZER FILTERS (edges-only, isolate by color)
   ------------------------------------------------------------------------
   Filters only ever hide/show LOOSE pieces still in the main arena —
   locked (already-placed) pieces and pieces parked in the Organizer Tray
   are always left alone, since hiding a piece the player already solved,
   or one they deliberately tucked away, would be confusing rather than
   helpful. Filters reset every time a puzzle is (re)built or resumed.
   ======================================================================== */

const COLOR_BUCKET_ORDER = ["red","orange","yellow","green","cyan","blue","purple","pink","white","gray","black"];
const COLOR_BUCKET_SWATCH = {
  red:"#e05252", orange:"#e08a3c", yellow:"#e0c93c", green:"#4caf6e", cyan:"#3cc9c9",
  blue:"#4a7fe0", purple:"#8a5ce0", pink:"#e05ca8", white:"#f2f2f2", gray:"#8c8c8c", black:"#2a2a2a"
};
const COLOR_BUCKET_LABEL = {
  red:"Red", orange:"Orange", yellow:"Yellow", green:"Green", cyan:"Cyan",
  blue:"Blue", purple:"Purple", pink:"Pink", white:"White", gray:"Gray", black:"Black"
};

// Buckets an RGB triple into one of the named colors above using simple HSL
// thresholds — good enough to group "roughly the same color" pieces without
// needing an exact color-matching UI.
function rgbToColorBucket(r, g, b){
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  const l = (max+min) / 2 / 255;
  const delta = max - min;
  const s = delta === 0 ? 0 : delta / (255 - Math.abs(max+min-255));
  if (s < 0.12){
    if (l > 0.85) return "white";
    if (l < 0.15) return "black";
    return "gray";
  }
  let h;
  if (delta === 0) h = 0;
  else if (max === r) h = 60 * (((g-b)/delta) % 6);
  else if (max === g) h = 60 * (((b-r)/delta) + 2);
  else h = 60 * (((r-g)/delta) + 4);
  if (h < 0) h += 360;
  if (h < 15 || h >= 345) return "red";
  if (h < 45) return "orange";
  if (h < 70) return "yellow";
  if (h < 160) return "green";
  if (h < 200) return "cyan";
  if (h < 255) return "blue";
  if (h < 290) return "purple";
  return "pink";
}

function isEdgePiece(r, c, rows, cols){
  return r === 0 || r === rows-1 || c === 0 || c === cols-1;
}

// Applies the current filter set to every loose piece's visibility.
function applyPieceFilters(){
  state.pieces.forEach(p => {
    if (p.locked || p.inOrganizer){ p.el.classList.remove("piece-filtered-out"); return; }
    let visible = true;
    if (state.activeFilters.edgesOnly && !p.isEdge) visible = false;
    if (state.activeFilters.colorBucket && p.colorBucket !== state.activeFilters.colorBucket) visible = false;
    p.el.classList.toggle("piece-filtered-out", !visible);
  });
}

function updateClearFiltersVisibility(){
  const anyActive = state.activeFilters.edgesOnly || state.activeFilters.colorBucket;
  dom.clearFiltersBtn.style.display = anyActive ? "inline-flex" : "none";
}

// Rebuilds the color swatch popover to only show colors actually present
// in the current puzzle, and highlights whichever one is active.
function renderColorSwatches(){
  const present = COLOR_BUCKET_ORDER.filter(bucket => state.pieces.some(p => p.colorBucket === bucket));
  dom.colorSwatchPopover.innerHTML = "";
  present.forEach(bucket => {
    const btn = document.createElement("button");
    btn.className = "color-swatch" + (state.activeFilters.colorBucket === bucket ? " selected" : "");
    btn.style.background = COLOR_BUCKET_SWATCH[bucket];
    btn.title = COLOR_BUCKET_LABEL[bucket];
    btn.addEventListener("click", () => {
      state.activeFilters.colorBucket = (state.activeFilters.colorBucket === bucket) ? null : bucket;
      renderColorSwatches();
      applyPieceFilters();
      updateClearFiltersVisibility();
    });
    dom.colorSwatchPopover.appendChild(btn);
  });
}

// Called once per new/resumed puzzle build to clear any filters left over
// from a previous game and regenerate the swatch palette for this image.
function resetPieceFilters(){
  state.activeFilters = { edgesOnly: false, colorBucket: null };
  state.eyedropperActive = false;
  dom.edgesOnlyBtn.classList.remove("active");
  dom.colorFilterBtn.classList.remove("active");
  dom.eyedropperBtn.classList.remove("active");
  dom.arenaWrap.classList.remove("eyedropper-active");
  dom.colorSwatchPopover.style.display = "none";
  renderColorSwatches();
  updateClearFiltersVisibility();
  applyFiltersEnabledSetting();
}

// Shows/hides the whole filter toolbar per the "Enable Piece Filters"
// setting. Turning filters off also clears any currently-active filter so
// no pieces are left invisibly hidden with no control left to un-hide them.
function applyFiltersEnabledSetting(){
  if (!settings.filtersEnabled){
    state.activeFilters = { edgesOnly: false, colorBucket: null };
    state.eyedropperActive = false;
    dom.edgesOnlyBtn.classList.remove("active");
    dom.colorFilterBtn.classList.remove("active");
    dom.eyedropperBtn.classList.remove("active");
    dom.arenaWrap.classList.remove("eyedropper-active");
    dom.colorSwatchPopover.style.display = "none";
    applyPieceFilters();
    updateClearFiltersVisibility();
  }
  dom.filterControls.style.display = settings.filtersEnabled ? "flex" : "none";
}

dom.edgesOnlyBtn.addEventListener("click", () => {
  state.activeFilters.edgesOnly = !state.activeFilters.edgesOnly;
  dom.edgesOnlyBtn.classList.toggle("active", state.activeFilters.edgesOnly);
  applyPieceFilters();
  updateClearFiltersVisibility();
});

dom.colorFilterBtn.addEventListener("click", () => {
  const showing = dom.colorSwatchPopover.style.display !== "none";
  dom.colorSwatchPopover.style.display = showing ? "none" : "flex";
});

dom.eyedropperBtn.addEventListener("click", () => {
  state.eyedropperActive = !state.eyedropperActive;
  dom.eyedropperBtn.classList.toggle("active", state.eyedropperActive);
  dom.arenaWrap.classList.toggle("eyedropper-active", state.eyedropperActive);
});

dom.clearFiltersBtn.addEventListener("click", () => {
  state.activeFilters.edgesOnly = false;
  state.activeFilters.colorBucket = null;
  dom.edgesOnlyBtn.classList.remove("active");
  renderColorSwatches();
  applyPieceFilters();
  updateClearFiltersVisibility();
});
