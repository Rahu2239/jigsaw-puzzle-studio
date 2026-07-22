"use strict";

/* ========================================================================
   SECTION 23 — PIECE RENDERING (transform-based, compositor-only)
   ------------------------------------------------------------------------
   Every piece's on-screen position used to be written as separate
   `style.left` / `style.top` (layout-triggering properties — changing
   either forces the browser to recompute page layout) plus a separate
   `style.transform` for rotation. That's fine for one piece, but for a
   dragged Magnetic Ghost cluster of dozens of pieces, moving all of them
   every pointer event meant dozens of forced reflows per event.

   Now position AND rotation are expressed as a single combined transform:
     translate3d(x, y, 0) rotate(deg)
   transform changes never invalidate layout — the compositor handles them
   entirely on the GPU — so moving a whole cluster is now just a paint/
   composite operation, not a layout one, regardless of cluster size.

   The one exception is a piece parked in the Organizer Tray: it's a
   normal (position:relative) flex-flow item there, so only rotation is
   meaningful for it — applying a translate would yank it out of the
   tray's layout. applyPieceTransform() below handles that automatically.
   ======================================================================== */

function applyPieceTransform(piece){
  piece.el.style.transform = piece.inOrganizer
    ? `rotate(${piece.rotation}deg)`
    : `translate3d(${piece.x}px, ${piece.y}px, 0) rotate(${piece.rotation}deg)`;
}

// Convenience for the common "move it and render it" pattern — keeps the
// JS position (the source of truth, e.g. for save/restore) and the visual
// transform from ever being set in two separate, easy-to-forget steps.
function setPiecePosition(piece, x, y){
  piece.x = x; piece.y = y;
  applyPieceTransform(piece);
}
