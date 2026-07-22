"use strict";

/* ========================================================================
   SECTION 2 — LOCAL STORAGE (SETTINGS + RECORDS) & INDEXEDDB (IMAGE FILES)
   ------------------------------------------------------------------------
   Settings and records are small JSON blobs, so localStorage is perfect
   for them. Uploaded PHOTOS are a different story — a single photo as a
   base64 data URL can easily be several megabytes, and localStorage's
   quota is usually only ~5-10MB *total* for the whole origin. To make
   uploads reliably survive a refresh regardless of photo size, we store
   the raw image Blob in IndexedDB instead (no base64 bloat, much higher
   quota) and only keep small pointers/metadata around in memory.
   ======================================================================== */

function loadJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if (!raw) return structuredCloneSafe(fallback);
    return Object.assign(structuredCloneSafe(fallback), JSON.parse(raw));
  }catch(e){ return structuredCloneSafe(fallback); }
}
function saveJSON(key, obj){ try{ localStorage.setItem(key, JSON.stringify(obj)); }catch(e){ console.warn("Could not save", key, e); } }
function structuredCloneSafe(o){ return JSON.parse(JSON.stringify(o)); }

const DEFAULT_SETTINGS = { sfxOn: true, volume: 0.7, theme: "dark", ghostOpacity: 0.32, snapSensitivity: "default", rotationEnabled: false, filtersEnabled: true };
const DEFAULT_RECORDS = {
  easy: { bestTimeMs: null, bestMoves: null }, medium: { bestTimeMs: null, bestMoves: null }, hard: { bestTimeMs: null, bestMoves: null },
  custom: {}, // keyed by "rowsxcols" (e.g. "20x40") — { rows, cols, bestTimeMs, bestMoves }, populated as custom grids are played
  totalSolved: 0, totalTimeMs: 0
};

let settings = loadJSON(LS_SETTINGS_KEY, DEFAULT_SETTINGS);
let records  = loadJSON(LS_RECORDS_KEY, DEFAULT_RECORDS);
function saveSettings(){ saveJSON(LS_SETTINGS_KEY, settings); }
function saveRecords(){ saveJSON(LS_RECORDS_KEY, records); }
function getDifficultyKey(rows, cols){
  if (rows === 3 && cols === 3) return "easy";
  if (rows === 6 && cols === 6) return "medium";
  if (rows === 10 && cols === 10) return "hard";
  return null;
}
function getCustomGridKey(rows, cols){ return `${rows}x${cols}`; }

// Resolves any rows/cols combo to wherever its records live — one of the
// three named presets, or its own slot under records.custom. Creates the
// custom slot on first visit (lazily, only when actually needed) so
// records.custom only ever contains grids the player has actually played.
function getRecordBucket(rows, cols){
  const presetKey = getDifficultyKey(rows, cols);
  if (presetKey) return { type: "preset", key: presetKey, rec: records[presetKey] };
  const customKey = getCustomGridKey(rows, cols);
  if (!records.custom[customKey]) records.custom[customKey] = { rows, cols, bestTimeMs: null, bestMoves: null };
  return { type: "custom", key: customKey, rec: records.custom[customKey] };
}

// --- IndexedDB helpers (all promise-based, all fail soft) ---
// One shared database, two object stores: "customImages" (uploaded photo
// blobs) and "gameSave" (the resumable in-progress puzzle, if any).
function openAppDB(){
  return new Promise((resolve, reject) => {
    if (!window.indexedDB){ reject(new Error("IndexedDB unavailable")); return; }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE_IMAGES)) db.createObjectStore(IDB_STORE_IMAGES, { keyPath: "id" });
      if (!db.objectStoreNames.contains(IDB_STORE_SAVE)) db.createObjectStore(IDB_STORE_SAVE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPutImage(record){
  const db = await openAppDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_IMAGES, "readwrite");
    tx.objectStore(IDB_STORE_IMAGES).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGetAllImages(){
  const db = await openAppDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_IMAGES, "readonly");
    const req = tx.objectStore(IDB_STORE_IMAGES).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function idbGetImageById(id){
  const db = await openAppDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_IMAGES, "readonly");
    const req = tx.objectStore(IDB_STORE_IMAGES).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function idbDeleteImage(id){
  const db = await openAppDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_IMAGES, "readwrite");
    tx.objectStore(IDB_STORE_IMAGES).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Save-game helpers (single resumable slot, keyed by SAVE_ID) ---
async function idbPutSave(record){
  const db = await openAppDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_SAVE, "readwrite");
    tx.objectStore(IDB_STORE_SAVE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGetSave(){
  const db = await openAppDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_SAVE, "readonly");
    const req = tx.objectStore(IDB_STORE_SAVE).get(SAVE_ID);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function idbDeleteSave(){
  const db = await openAppDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_SAVE, "readwrite");
    tx.objectStore(IDB_STORE_SAVE).delete(SAVE_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

