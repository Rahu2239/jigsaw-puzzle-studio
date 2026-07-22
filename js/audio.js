"use strict";

/* ========================================================================
   SECTION 4 — AUDIO
   ======================================================================== */

let audioCtx = null;
function ensureAudioCtx(){
  if (!audioCtx){ const Ctx = window.AudioContext || window.webkitAudioContext; if (Ctx) audioCtx = new Ctx(); }
  return audioCtx;
}
function playTone(freq, duration, type, volMul){
  if (!settings.sfxOn) return;
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  try{
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type || "sine"; osc.frequency.value = freq;
    const vol = Math.max(0.0001, settings.volume * (volMul || 1) * 0.35);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(now); osc.stop(now + duration);
  }catch(e){}
}
const playSnapSound    = () => playTone(660, 0.12, "triangle", 1);
const playRotateSound  = () => playTone(420, 0.07, "square", 0.55);
const playConnectSound = () => playTone(520, 0.09, "sine", 0.6);
function playWinSound(){
  if (!settings.sfxOn) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => playTone(f, 0.28, "sine", 1), i * 120));
}

