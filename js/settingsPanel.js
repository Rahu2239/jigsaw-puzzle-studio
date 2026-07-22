"use strict";

/* ========================================================================
   SECTION 5 — SETTINGS UI
   ======================================================================== */

function applyTheme(theme){
  document.body.classList.remove("theme-dark", "theme-light", "theme-cyber", "theme-felt");
  document.body.classList.add("theme-" + theme);
}
function refreshSettingsUI(){
  dom.sfxToggle.checked = settings.sfxOn;
  dom.volumeSlider.value = Math.round(settings.volume * 100);
  dom.volumeValue.textContent = Math.round(settings.volume * 100) + "%";
  dom.themeSelect.value = settings.theme;
  dom.ghostOpacitySlider.value = Math.round(settings.ghostOpacity * 100);
  dom.ghostOpacityValue.textContent = Math.round(settings.ghostOpacity * 100) + "%";
  dom.snapSelect.value = settings.snapSensitivity;
  dom.rotationToggle.checked = settings.rotationEnabled;
  dom.filtersEnabledToggle.checked = settings.filtersEnabled;
}
dom.settingsBtn.addEventListener("click", () => { refreshSettingsUI(); dom.settingsModal.classList.add("visible"); });
document.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", () => $("#" + btn.dataset.close).classList.remove("visible")));
[dom.settingsModal, dom.recordsModal].forEach(modal => modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("visible"); }));

dom.sfxToggle.addEventListener("change", () => { settings.sfxOn = dom.sfxToggle.checked; saveSettings(); });
dom.volumeSlider.addEventListener("input", () => {
  settings.volume = parseInt(dom.volumeSlider.value, 10) / 100;
  dom.volumeValue.textContent = dom.volumeSlider.value + "%";
  saveSettings();
});
dom.themeSelect.addEventListener("change", () => { settings.theme = dom.themeSelect.value; applyTheme(settings.theme); saveSettings(); });
dom.ghostOpacitySlider.addEventListener("input", () => {
  settings.ghostOpacity = parseInt(dom.ghostOpacitySlider.value, 10) / 100;
  dom.ghostOpacityValue.textContent = dom.ghostOpacitySlider.value + "%";
  if (dom.previewImg.classList.contains("visible")) dom.previewImg.style.opacity = settings.ghostOpacity;
  saveSettings();
});
dom.snapSelect.addEventListener("change", () => { settings.snapSensitivity = dom.snapSelect.value; saveSettings(); });
dom.rotationToggle.addEventListener("change", () => { settings.rotationEnabled = dom.rotationToggle.checked; saveSettings(); });
dom.filtersEnabledToggle.addEventListener("change", () => {
  settings.filtersEnabled = dom.filtersEnabledToggle.checked;
  saveSettings();
  applyFiltersEnabledSetting();
});

function confirmAndResetAllRecords(){
  if (!confirm("Reset ALL records and stats? This cannot be undone.")) return;
  records = structuredCloneSafe(DEFAULT_RECORDS);
  saveRecords();
  renderRecords();
}
dom.resetAllRecordsBtn.addEventListener("click", confirmAndResetAllRecords);
dom.resetAllRecordsBtn2.addEventListener("click", confirmAndResetAllRecords);
applyTheme(settings.theme);

