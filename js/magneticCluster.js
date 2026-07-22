"use strict";

/* ========================================================================
   SECTION 22 — MAGNETIC GHOST CLUSTERS
   ------------------------------------------------------------------------
   Two loose pieces "connect" when they sit exactly one grid-step apart in
   screen space, matching their real (r,c) adjacency — i.e. the player has
   arranged them exactly as they'd sit on the finished board, just not on
   the board itself yet. A cluster is a plain { members: Set<piece> }
   object shared by every piece in it (piece.cluster === null for solo
   pieces). Dragging any member moves every member by the same delta, and
   the whole cluster locks onto the board together the moment its dragged
   member reaches its own home position — which, by construction, means
   every other member is simultaneously at its own home too.

   Scope: clustering only considers pieces at rotation 0. Two pieces
   rotated together by the same non-zero amount are still positioned
   correctly relative to each other, but their tab/blank edges would no
   longer face each other after rotation, so allowing that would need
   rotation-aware geometry this feature doesn't need for its main purpose
   (helping assemble a correctly-oriented block before it reaches the
   board). Pieces still needing rotation just don't cluster until fixed.
   ======================================================================== */

const NEIGHBOR_DIRECTIONS = [[0,1],[0,-1],[1,0],[-1,0]]; // hoisted — reused every check instead of allocated per call

// Returns every piece that must move together with `piece` (itself alone
// if it isn't clustered).
function getClusterMembers(piece){
  return piece.cluster ? [...piece.cluster.members] : [piece];
}

function applyClusterVisual(cluster){
  cluster.members.forEach(p => p.el.classList.add("magnet-clustered"));
}

function mergeIntoCluster(a, b){
  if (a.cluster && b.cluster){
    if (a.cluster === b.cluster) return;
    const target = a.cluster, source = b.cluster;
    source.members.forEach(p => { target.members.add(p); p.cluster = target; });
  } else if (a.cluster){
    a.cluster.members.add(b); b.cluster = a.cluster;
  } else if (b.cluster){
    b.cluster.members.add(a); a.cluster = b.cluster;
  } else {
    const cluster = { members: new Set([a, b]) };
    a.cluster = cluster; b.cluster = cluster;
  }
  applyClusterVisual(a.cluster);
}

// Checks whether `piece` and its grid-neighbor at (piece.r+dr, piece.c+dc)
// are currently positioned correctly adjacent on screen; if so, snaps out
// any tiny drift and merges them (and their existing clusters) together.
// Returns true if a *new* connection was made.
//
// Performance note: this never scans "every piece against every other
// piece". state.pieceGrid[r][c] (built once in buildPuzzle) is already an
// O(1) spatial index keyed by exact grid position — since we only ever
// need to know "is the piece that's supposed to sit at exactly (r±1, c)
// or (r, c±1) actually there", a direct lookup into that grid IS the
// spatial-grid optimization; layering a second, coarser spatial hash on
// top would only add bookkeeping for a lookup that's already constant-time.
function tryMagneticConnect(piece, dr, dc){
  const nr = piece.r + dr, nc = piece.c + dc;
  if (nr < 0 || nr >= state.rows || nc < 0 || nc >= state.cols) return false;
  const neighbor = state.pieceGrid[nr] && state.pieceGrid[nr][nc];
  if (!neighbor || neighbor === piece) return false;
  if (neighbor.locked || neighbor.inOrganizer || piece.locked || piece.inOrganizer) return false;
  if (piece.rotation !== 0 || neighbor.rotation !== 0) return false; // see scope note above
  if (piece.cluster && piece.cluster === neighbor.cluster) return false; // already connected

  const expectedDX = dc * state.pieceSize, expectedDY = dr * state.pieceSize;
  const actualDX = neighbor.x - piece.x, actualDY = neighbor.y - piece.y;
  const tol = state.pieceSize * MAGNETIC_SNAP_RATIO;
  if (Math.abs(actualDX - expectedDX) > tol || Math.abs(actualDY - expectedDY) > tol) return false;

  // Snap out any small drift so the pair sits at *exactly* one piece-size
  // apart, then carry the rest of piece's current cluster (if any) along
  // by the same correction so the whole group stays internally rigid.
  const correctedX = neighbor.x - expectedDX, correctedY = neighbor.y - expectedDY;
  const shiftX = correctedX - piece.x, shiftY = correctedY - piece.y;
  getClusterMembers(piece).forEach(m => {
    setPiecePosition(m, m.x + shiftX, m.y + shiftY);
  });

  mergeIntoCluster(piece, neighbor);
  return true;
}

// Checks all 4 directions around every member of piece's current cluster —
// called after a drag ends, since moving a multi-piece cluster can bring
// more than one member into alignment with a new neighbor at once.
function checkMagneticConnections(piece){
  let anyNew = false;
  getClusterMembers(piece).forEach(m => {
    NEIGHBOR_DIRECTIONS.forEach(([dr,dc]) => {
      if (tryMagneticConnect(m, dr, dc)) anyNew = true;
    });
  });
  if (anyNew) playConnectSound();
}

// One full-board pass used right after a puzzle is (re)built, so clusters
// implied by restored positions (or, harmlessly, a freshly-scattered new
// game) are reconstructed without needing to save cluster membership
// explicitly — it's fully derivable from piece position + rotation.
function detectAllMagneticClusters(){
  for (let r = 0; r < state.rows; r++){
    for (let c = 0; c < state.cols; c++){
      const piece = state.pieceGrid[r][c];
      if (!piece || piece.locked || piece.inOrganizer) continue;
      tryMagneticConnect(piece, 0, 1);
      tryMagneticConnect(piece, 1, 0);
    }
  }
}
