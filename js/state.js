"use strict";

/* ========================================================================
   SECTION 3 — APPLICATION STATE
   ======================================================================== */

const state = {
  selectedImageUrl: DEFAULT_IMAGES[0].url,
  customImages: [],          // { id, url (object URL), label, width, height } — persisted ones have an id
  selectedImageDims: null,
  recommendedGrid: null,
  rows: 3, cols: 3,
  pieceSize: 0, margin: 0, footprint: 0,
  boardX: 0, boardY: 0, boardWidth: 0, boardHeight: 0,
  pieces: [], lockedCount: 0, totalPieces: 0, moveCount: 0,
  pieceGrid: null,                   // [r][c] -> piece, rebuilt every buildPuzzle() for O(1) neighbor lookups
  timerId: null, startTime: 0, elapsedMs: 0,
  topZ: 10, imageElement: null,
  rotationEnabled: false,
  hEdges: null, vEdges: null,        // the exact tab/blank geometry for the active puzzle (needed to resume with identical piece shapes)
  currentImageSource: null,          // { type:"default", url } or { type:"custom", imageId, label } — how to reload the active puzzle's image
  activeFilters: { edgesOnly: false, colorBucket: null }, // piece organizer filters — reset on every new/resumed puzzle
  eyedropperActive: false
};

const imageDimsCache = new Map(); // url -> {width,height}, avoids re-loading the same image twice

