"use strict";

/* ========================================================================
   SECTION 8 — SETUP SCREEN: IMAGE GALLERY + PERSISTENT UPLOADS
   ======================================================================== */

function buildGallery(){
  dom.gallery.innerHTML = "";

  DEFAULT_IMAGES.forEach((img) => {
    const div = document.createElement("div");
    div.className = "gallery-item" + (img.url === state.selectedImageUrl ? " selected" : "");
    div.style.backgroundImage = `url("${img.url}")`;
    div.title = img.label;
    div.innerHTML = `<span class="check">✓</span>`;
    div.addEventListener("click", () => selectGalleryImage(img.url));
    dom.gallery.appendChild(div);
  });

  // Custom uploads — persisted in IndexedDB, so they're still here after a refresh.
  state.customImages.forEach((img) => {
    const div = document.createElement("div");
    div.className = "gallery-item" + (img.url === state.selectedImageUrl ? " selected" : "");
    div.style.backgroundImage = `url("${img.url}")`;
    div.title = img.label;
    div.innerHTML = `
      <span class="check">✓</span>
      <span class="custom-badge">Custom Upload</span>
      <button class="gallery-delete-btn" type="button" title="Remove this image">✕</button>`;
    div.addEventListener("click", () => selectGalleryImage(img.url));
    div.querySelector(".gallery-delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      removeCustomImage(img);
    });
    dom.gallery.appendChild(div);
  });

  const uploadTile = document.createElement("div");
  uploadTile.className = "upload-zone";
  uploadTile.innerHTML = `<span class="plus">+</span><span>Upload photo</span>`;
  uploadTile.addEventListener("click", () => dom.fileInput.click());
  dom.gallery.appendChild(uploadTile);
}

function selectGalleryImage(url){
  state.selectedImageUrl = url;
  document.querySelectorAll(".gallery-item").forEach(el => el.classList.remove("selected"));
  buildGallery();
  dom.imageHint.textContent = "Ready to play with the selected image.";
  updateAspectRecommendation();
}

async function removeCustomImage(img){
  if (!confirm(`Remove "${img.label}" from your saved images?`)) return;
  try{ if (img.id) await idbDeleteImage(img.id); }catch(e){ console.warn(e); }
  state.customImages = state.customImages.filter(x => x !== img);
  if (state.selectedImageUrl === img.url) state.selectedImageUrl = DEFAULT_IMAGES[0].url;
  try{ URL.revokeObjectURL(img.url); }catch(e){}
  buildGallery();
  updateAspectRecommendation();
}

dom.fileInput.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  dom.imageHint.textContent = "Saving your photo…";
  try{
    const objectUrl = URL.createObjectURL(file);
    const img = await loadImage(objectUrl);
    const width = img.naturalWidth || img.width, height = img.naturalHeight || img.height;
    const id = "custom_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

    // Persist the actual image bytes in IndexedDB so it survives a refresh.
    await idbPutImage({ id, blob: file, label: file.name, width, height, addedAt: Date.now() });

    const entry = { id, url: objectUrl, label: file.name, width, height };
    state.customImages.push(entry);
    state.selectedImageUrl = entry.url;
    imageDimsCache.set(entry.url, { width, height });

    buildGallery();
    dom.imageHint.textContent = `Using your uploaded photo: "${file.name}" — saved on this device for next time.`;
    updateAspectRecommendation();
  }catch(err){
    console.error("Could not persist upload:", err);
    // Still let them play with it this session even if saving failed.
    const objectUrl = URL.createObjectURL(file);
    state.customImages.push({ id: null, url: objectUrl, label: file.name });
    state.selectedImageUrl = objectUrl;
    buildGallery();
    dom.imageHint.textContent = `Using "${file.name}" for this session (couldn't save it for next time on this browser).`;
    updateAspectRecommendation();
  }
  dom.fileInput.value = "";
});

// On load, pull back any images the user uploaded in a previous session.
(async function restorePersistedImages(){
  try{
    const saved = await idbGetAllImages();
    saved.sort((a, b) => a.addedAt - b.addedAt);
    saved.forEach(rec => {
      const url = URL.createObjectURL(rec.blob);
      state.customImages.push({ id: rec.id, url, label: rec.label, width: rec.width, height: rec.height });
      imageDimsCache.set(url, { width: rec.width, height: rec.height });
    });
    if (saved.length){ buildGallery(); }
  }catch(e){
    console.warn("No IndexedDB support or no saved images to restore:", e);
  }
})();

