"use strict";

/* ========================================================================
   SECTION 24 — ONLINE SYNC (email login + global world records)
   ------------------------------------------------------------------------
   This module is the seam between the game and a future Backend-as-a-
   Service (Firebase or Supabase are both a good fit — email/password
   auth + a simple leaderboard table is all either needs). Nothing here
   makes a real network call yet: every exported function is a stub with
   the exact signature the rest of the app will call, documented with
   what the real implementation should do. Flipping ONLINE_SYNC_CONFIG
   .enabled to true and filling in the three TODOs below is the entire
   integration surface — no other file needs to change.

   Design principles that matter for a later hookup:
   - Every function here is `async` and NEVER throws out of itself. A
     flaky network or a logged-out user must never break gameplay — the
     worst case is "the cloud check quietly did nothing," never a crash.
   - Nothing here is awaited on the critical path of showing the win
     modal (see gameUI.js). The player sees their result and local
     records INSTANTLY; the world-record check happens in the background
     and only ever ADDS a banner if it resolves favorably later.
   - Grid identity reuses the exact same key format records already use
     (getRecordBucket's "easy" / "medium" / "hard" / "20x40") — so a
     future leaderboard table is naturally partitioned to match what
     the local Records panel already shows, with zero new key-mapping
     logic needed anywhere.
   ======================================================================== */

const ONLINE_SYNC_CONFIG = {
  enabled: false,        // flip to true once a real backend is wired in below
  provider: null,        // e.g. "firebase" | "supabase" — informational only, for logging
};

// The signed-in user, once loginUser() succeeds against a real backend.
// { uid, email, displayName } — null while signed out or not configured.
let currentUser = null;

/* ------------------------------------------------------------------------
   1. EMAIL LOGIN
   ------------------------------------------------------------------------
   TODO (Firebase):  import { getAuth, signInWithEmailAndPassword } from
     "firebase/auth"; then `const cred = await signInWithEmailAndPassword(
     getAuth(), email, password); currentUser = { uid: cred.user.uid,
     email: cred.user.email, displayName: cred.user.displayName };`
   TODO (Supabase):  `const { data, error } = await supabase.auth
     .signInWithPassword({ email, password }); if (error) throw error;
     currentUser = { uid: data.user.id, email: data.user.email,
     displayName: data.user.user_metadata?.display_name };`
   ------------------------------------------------------------------------ */
async function loginUser(email, password){
  if (!ONLINE_SYNC_CONFIG.enabled){
    return { success: false, reason: "not-configured", user: null };
  }
  try{
    // --- TODO: replace with a real backend call (see above) ---
    console.warn("loginUser() called but no backend is wired in yet.");
    return { success: false, reason: "not-implemented", user: null };
  }catch(e){
    console.warn("loginUser failed:", e);
    return { success: false, reason: "network-error", user: null };
  }
}

/* ------------------------------------------------------------------------
   2. SUBMIT A COMPLETED PUZZLE'S SCORE TO THE GLOBAL LEADERBOARD
   ------------------------------------------------------------------------
   gridSize: the same bucket key records already use, e.g. "easy" or
             "20x40" — see getRecordBucket() in storage.js.
   timeMs / moveCount: the completed run's stats.

   TODO (Firebase): write to Firestore, e.g. `await setDoc(doc(db,
     "worldRecords", gridSize, "entries", currentUser.uid), { timeMs,
     moveCount, displayName: currentUser.displayName,
     submittedAt: serverTimestamp() }, { merge: true });` — merge:true so
     a player's own doc just updates in place rather than accumulating
     duplicate entries per run.
   TODO (Supabase): `await supabase.from("world_records").upsert({
     grid_size: gridSize, user_id: currentUser.uid, time_ms: timeMs,
     move_count: moveCount }, { onConflict: "grid_size,user_id" });`
     — a unique (grid_size, user_id) constraint gives the same
     one-entry-per-player-per-grid behavior.

   Either backend should also enforce server-side that a submitted
   timeMs/moveCount only ever improves a player's existing entry (never
   regresses it), and ideally validate plausibility (e.g. timeMs can't
   be less than a few seconds for an 800-piece grid) — a client is never
   a trustworthy source of truth for a *global* leaderboard the way it's
   fine to be for the player's own local device.
   ------------------------------------------------------------------------ */
async function uploadScoreToWorldRecords(gridSize, timeMs, moveCount){
  if (!ONLINE_SYNC_CONFIG.enabled){
    return { success: false, reason: "not-configured" };
  }
  if (!currentUser){
    return { success: false, reason: "not-logged-in" };
  }
  try{
    // --- TODO: replace with a real backend call (see above) ---
    console.warn("uploadScoreToWorldRecords() called but no backend is wired in yet.", { gridSize, timeMs, moveCount });
    return { success: false, reason: "not-implemented" };
  }catch(e){
    console.warn("uploadScoreToWorldRecords failed:", e);
    return { success: false, reason: "network-error" };
  }
}

/* ------------------------------------------------------------------------
   3. FETCH THE CURRENT GLOBAL BEST FOR A GRID SIZE
   ------------------------------------------------------------------------
   Returns { bestTimeMs, bestMoves, holderName } for the current #1 entry,
   or null if either the backend isn't configured yet or nobody has ever
   completed that grid size online yet (the two cases are deliberately
   indistinguishable to callers — see checkAndSubmitWorldRecord below,
   where "null" always safely means "nothing to beat yet").

   TODO (Firebase): query the top entry, e.g. `const q = query(
     collection(db, "worldRecords", gridSize, "entries"),
     orderBy("timeMs", "asc"), limit(1)); const snap = await getDocs(q);
     if (snap.empty) return null; const top = snap.docs[0].data();
     return { bestTimeMs: top.timeMs, bestMoves: top.moveCount,
     holderName: top.displayName };`
   TODO (Supabase): `const { data } = await supabase.from("world_records")
     .select("time_ms, move_count, display_name").eq("grid_size", gridSize)
     .order("time_ms", { ascending: true }).limit(1).maybeSingle();
     return data ? { bestTimeMs: data.time_ms, bestMoves: data.move_count,
     holderName: data.display_name } : null;`
   ------------------------------------------------------------------------ */
async function fetchGlobalWorldRecords(gridSize){
  if (!ONLINE_SYNC_CONFIG.enabled){
    return null;
  }
  try{
    // --- TODO: replace with a real backend call (see above) ---
    console.warn("fetchGlobalWorldRecords() called but no backend is wired in yet.", { gridSize });
    return null;
  }catch(e){
    console.warn("fetchGlobalWorldRecords failed:", e);
    return null;
  }
}

/* ------------------------------------------------------------------------
   ORCHESTRATION — the one function the rest of the app actually calls.
   ------------------------------------------------------------------------
   This is the "safe cloud check" the win modal hooks into: it fetches
   the current global best, compares the just-completed run against it,
   and — only if the run is actually better — submits it. It NEVER
   throws (every failure path resolves to isWorldRecord:false rather than
   rejecting), and it deliberately does nothing at all right now since
   ONLINE_SYNC_CONFIG.enabled is false — today this always resolves to
   { checked:false, isWorldRecord:false } near-instantly, with zero
   network activity, which is exactly the correct behavior for a fully
   offline build.
   ------------------------------------------------------------------------ */
async function checkAndSubmitWorldRecord({ gridSize, timeMs, moveCount }){
  if (!ONLINE_SYNC_CONFIG.enabled){
    return { checked: false, isWorldRecord: false, globalBest: null, error: null };
  }
  try{
    const globalBest = await fetchGlobalWorldRecords(gridSize);
    const isWorldRecord = !globalBest || timeMs < globalBest.bestTimeMs;
    if (isWorldRecord){
      const result = await uploadScoreToWorldRecords(gridSize, timeMs, moveCount);
      return { checked: true, isWorldRecord: !!result.success, globalBest, error: result.success ? null : result.reason };
    }
    return { checked: true, isWorldRecord: false, globalBest, error: null };
  }catch(e){
    console.warn("checkAndSubmitWorldRecord failed (gameplay is unaffected):", e);
    return { checked: true, isWorldRecord: false, globalBest: null, error: e.message || "unknown-error" };
  }
}
