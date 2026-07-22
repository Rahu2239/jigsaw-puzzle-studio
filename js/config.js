"use strict";

/* ========================================================================
   SECTION 1 — CONFIG & DOM REFERENCES
   ======================================================================== */

const DEFAULT_IMAGES = [
  { url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80", label: "Mountain Lake" },
  { url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80", label: "Sunrise Peaks" },
  { url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80", label: "Forest Road" },
  { url: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80", label: "Ocean Waves" },
  { url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80", label: "Starry Night" }
];

const TARGET_BOARD_WIDTH = 720;
const MAX_PIECE_SIZE = 130;
const CLICK_MOVE_THRESHOLD = 6;
const GRID_MIN = 2, GRID_MAX = 100; // upgraded from 15 -> 100 (up to 10,000 pieces)
const SNAP_RATIOS = { generous: 0.42, default: 0.30, strict: 0.18 };
const BATCH_SIZE = 150; // pieces built per animation frame while generating a puzzle

const LS_SETTINGS_KEY = "jigsawSettings_v1";
const LS_RECORDS_KEY  = "jigsawRecords_v1";
const IDB_NAME = "jigsawPuzzleDB", IDB_VERSION = 2;
const IDB_STORE_IMAGES = "customImages";
const IDB_STORE_SAVE = "gameSave";
const SAVE_ID = "current";           // singleton save slot — one resumable puzzle at a time
const AUTO_SAVE_INTERVAL_MS = 30000; // "every 30 seconds" background save

const MAGNETIC_SNAP_RATIO = 0.25; // fraction of pieceSize within which two loose pieces magnetically connect
const COLOR_SAMPLE_SIZE = 6; // px — tiny downscaled sample used to bucket each piece's dominant color

const $ = (sel) => document.querySelector(sel);

const dom = {
  gallery: $("#gallery"), fileInput: $("#fileInput"), imageHint: $("#imageHint"),
  aspectBanner: $("#aspectBanner"), aspectDimsText: $("#aspectDimsText"), aspectRatioText: $("#aspectRatioText"),
  aspectRecText: $("#aspectRecText"), applyRecommendedGridBtn: $("#applyRecommendedGridBtn"),
  presetRow: $("#presetRow"), customPresetBtn: $("#customPresetBtn"), customGrid: $("#customGrid"),
  rowsInput: $("#rowsInput"), colsInput: $("#colsInput"), piecesTotal: $("#piecesTotal"), perfWarning: $("#perfWarning"),
  startBtn: $("#startBtn"), setupScreen: $("#setupScreen"), gameScreen: $("#gameScreen"),
  timerDisplay: $("#timerDisplay"), movesDisplay: $("#movesDisplay"),
  progressDisplay: $("#progressDisplay"), progressFill: $("#progressFill"),
  previewBtn: $("#previewBtn"), shuffleBtn: $("#shuffleBtn"), saveGameBtn: $("#saveGameBtn"), newPuzzleBtn: $("#newPuzzleBtn"),
  arenaWrap: $("#arenaWrap"), arena: $("#arena"), boardFrame: $("#boardFrame"), previewImg: $("#previewImg"),
  buildProgressOverlay: $("#buildProgressOverlay"), buildProgressText: $("#buildProgressText"),
  organizerToolbar: $("#organizerToolbar"), filterControls: $("#filterControls"),
  edgesOnlyBtn: $("#edgesOnlyBtn"), colorFilterBtn: $("#colorFilterBtn"), eyedropperBtn: $("#eyedropperBtn"),
  colorSwatchPopover: $("#colorSwatchPopover"), clearFiltersBtn: $("#clearFiltersBtn"),
  organizerTrayToggleBtn: $("#organizerTrayToggleBtn"), organizerDrawer: $("#organizerDrawer"),
  organizerDrawerContent: $("#organizerDrawerContent"), closeOrganizerBtn: $("#closeOrganizerBtn"),
  winModal: $("#winModal"), winTime: $("#winTime"), winMoves: $("#winMoves"), winPieces: $("#winPieces"),
  winBadges: $("#winBadges"), worldRecordBanner: $("#worldRecordBanner"),
  playAgainBtn: $("#playAgainBtn"), newFromWinBtn: $("#newFromWinBtn"),
  resumeModal: $("#resumeModal"), resumeSummary: $("#resumeSummary"),
  resumeGameBtn: $("#resumeGameBtn"), discardSaveBtn: $("#discardSaveBtn"),
  recordsBtn: $("#recordsBtn"), recordsModal: $("#recordsModal"), recordsTableBody: $("#recordsTableBody"),
  customRecordsTable: $("#customRecordsTable"), customRecordsTableBody: $("#customRecordsTableBody"),
  customRecordsEmpty: $("#customRecordsEmpty"), clearAllCustomRecordsBtn: $("#clearAllCustomRecordsBtn"),
  totalSolvedValue: $("#totalSolvedValue"), totalTimeValue: $("#totalTimeValue"),
  resetAllRecordsBtn: $("#resetAllRecordsBtn"), resetAllRecordsBtn2: $("#resetAllRecordsBtn2"),
  settingsBtn: $("#settingsBtn"), settingsModal: $("#settingsModal"),
  sfxToggle: $("#sfxToggle"), volumeSlider: $("#volumeSlider"), volumeValue: $("#volumeValue"),
  themeSelect: $("#themeSelect"), ghostOpacitySlider: $("#ghostOpacitySlider"), ghostOpacityValue: $("#ghostOpacityValue"),
  snapSelect: $("#snapSelect"), rotationToggle: $("#rotationToggle"), filtersEnabledToggle: $("#filtersEnabledToggle")
};

