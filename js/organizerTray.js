"use strict";

/* ========================================================================
   SECTION 21 — ORGANIZER TRAY (slide-out drawer for parking loose pieces)
   ------------------------------------------------------------------------
   Dragging a loose piece onto this drawer moves its <canvas> element out
   of .arena and into the drawer's own flex-wrap grid (see dragDrop.js's
   endDrag), where it lays out as a normal flow item instead of an
   absolutely-positioned world-coordinate one. Dragging it back out is
   handled in dragDrop.js's pointerdown/pointermove — the moment movement
   is confirmed, the piece is reparented back into .arena at the cursor's
   current world position and behaves exactly like any other loose piece.
   ======================================================================== */

function isOrganizerOpen(){
  return dom.organizerDrawer.classList.contains("open");
}

function isPointerOverOrganizer(clientX, clientY){
  if (!isOrganizerOpen()) return false;
  const rect = dom.organizerDrawer.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function movePieceToOrganizer(piece){
  piece.inOrganizer = true;
  piece.el.classList.add("in-organizer");
  piece.el.classList.remove("piece-filtered-out");
  // Clear the stale inline z-index from its arena life — a leftover high
  // value would otherwise fight with (and sometimes lose to) the drawer's
  // own stacking context, which is what made parked pieces render
  // underneath the tray's background. Position no longer needs clearing:
  // applyPieceTransform() below switches it to the rotation-only form the
  // moment inOrganizer is true, so there's no stray translate left behind.
  piece.el.style.zIndex = "";
  dom.organizerDrawerContent.appendChild(piece.el);
  applyPieceTransform(piece);
}

dom.organizerTrayToggleBtn.addEventListener("click", () => {
  dom.organizerDrawer.classList.toggle("open");
});
dom.closeOrganizerBtn.addEventListener("click", () => {
  dom.organizerDrawer.classList.remove("open");
});
