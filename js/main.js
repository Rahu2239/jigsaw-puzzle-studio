"use strict";

/* ========================================================================
   SECTION 17 — INIT
   ======================================================================== */

dom.startBtn.addEventListener("click", startPuzzle);
buildGallery();
updateAspectRecommendation();
checkForResumableSave();
applyFiltersEnabledSetting();

