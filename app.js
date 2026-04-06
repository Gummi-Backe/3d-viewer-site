import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getStorage,
  ref,
  listAll,
  getDownloadURL,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyD_gpVALWNYB2vhH8PVXQj2-rwi4wMHn88",
  authDomain: "dreid-viewer-site.firebaseapp.com",
  projectId: "dreid-viewer-site",
  storageBucket: "dreid-viewer-site.firebasestorage.app",
  messagingSenderId: "698564758132",
  measurementId: "G-Z3WEY1MH4R",
  appId: "1:698564758132:web:ced1ec2a325e22d468df21"
};

const viewer = document.getElementById("viewer");
const statusEl = document.getElementById("status");
const uploadForm = document.getElementById("uploadForm");
const imageInput = document.getElementById("imageInput");
const glbInput = document.getElementById("glbInput");
const imagePreview = document.getElementById("imagePreview");
const overlays = document.querySelectorAll(".overlay");
const openButtons = document.querySelectorAll("[data-open]");
const closeButtons = document.querySelectorAll("[data-close]");

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);
const galleryStatic = document.getElementById("galleryStatic");
const galleryAnimated = document.getElementById("galleryAnimated");
const uploadAnimatedForm = document.getElementById("uploadAnimatedForm");
const imageAnimatedInput = document.getElementById("imageAnimatedInput");
const glbAnimatedInput = document.getElementById("glbAnimatedInput");
const imageAnimatedPreview = document.getElementById("imageAnimatedPreview");
const statusAnimatedEl = document.getElementById("statusAnimated");

function setStatus(message, isError = false) {
  setStatusFor(statusEl, message, isError);
}

function setStatusFor(target, message, isError = false) {
  target.textContent = message;
  target.dataset.error = isError ? "1" : "0";
}

function describeError(error) {
  const code = error?.code ? String(error.code) : "unknown";
  const message = error?.message ? String(error.message) : "Unbekannter Fehler";
  return `${code}: ${message}`;
}

function fileBaseName(name) {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(0, idx) : name;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function stabilizeLoadedMaterials() {
  const model = viewer?.model;
  const materials = model?.materials;
  if (!materials?.length) return;

  for (const material of materials) {
    try {
      if (typeof material.ensureLoaded === "function") {
        await material.ensureLoaded();
      }
      if (typeof material.setDoubleSided === "function") {
        material.setDoubleSided(true);
      }
      if (typeof material.getAlphaMode === "function" && typeof material.setAlphaMode === "function") {
        const alphaMode = String(material.getAlphaMode() || "").toUpperCase();
        if (alphaMode === "BLEND") {
          material.setAlphaMode("MASK");
          if (typeof material.setAlphaCutoff === "function") {
            material.setAlphaCutoff(0.35);
          }
        }
      }
    } catch {
      // Ignore per-material failures to keep model loading resilient.
    }
  }
}

function ensureAnimationPlayback() {
  try {
    if (typeof viewer.play === "function") {
      viewer.play();
    }
  } catch {
    // Non-animated models can safely ignore play errors.
  }
}

viewer.addEventListener("load", async () => {
  await stabilizeLoadedMaterials();
  ensureAnimationPlayback();
});

async function loadModelByBase(baseName) {
  return loadModelFromPath(`models/${baseName}.glb`);
}

async function loadModelFromPath(path) {
  const modelRef = ref(storage, path);
  const modelUrl = await getDownloadURL(modelRef);
  viewer.src = modelUrl;
}

async function renderGallerySection(container, picturesPath, modelsPath) {
  container.innerHTML = "";

  const picturesRef = ref(storage, picturesPath);
  const result = await listAll(picturesRef);
  const items = result.items.sort((a, b) => a.name.localeCompare(b.name));

  if (!items.length) {
    container.innerHTML = "<p class=\"empty\">Keine Bilder gefunden.</p>";
    return items;
  }

  for (const item of items) {
    const imageUrl = await getDownloadURL(item);
    const baseName = fileBaseName(item.name);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card";
    button.innerHTML =
      `<img src="${imageUrl}" alt="${escapeHtml(baseName)}">` +
      `<span>${escapeHtml(baseName)}</span>`;
    button.addEventListener("click", async () => {
      try {
        setStatus(`Lade Modell: ${baseName}...`);
        await loadModelFromPath(`${modelsPath}/${baseName}.glb`);
        setStatus(`Modell geladen: ${baseName}`);
        closeAllOverlays();
      } catch {
        setStatus(`Konnte ${modelsPath}/${baseName}.glb nicht laden.`, true);
      }
    });
    container.appendChild(button);
  }

  return items;
}

async function loadGallery() {
  const staticItems = await renderGallerySection(galleryStatic, "pictures", "models");
  const animatedItems = await renderGallerySection(
    galleryAnimated,
    "animate_models/picture",
    "animate_models/models"
  );

  if (staticItems.length) {
    const jodaItem = staticItems.find((entry) => fileBaseName(entry.name).toLowerCase() === "joda");
    const firstBase = jodaItem ? fileBaseName(jodaItem.name) : fileBaseName(staticItems[0].name);
    await loadModelByBase(firstBase);
    setStatus(`Modell geladen: ${firstBase}`);
    return;
  }

  if (animatedItems.length) {
    const firstBase = fileBaseName(animatedItems[0].name);
    await loadModelFromPath(`animate_models/models/${firstBase}.glb`);
    setStatus(`Modell geladen: ${firstBase}`);
    return;
  }

  setStatus("Keine Modelle gefunden.", true);
}

function openOverlay(id) {
  for (const overlay of overlays) {
    overlay.hidden = overlay.id !== id;
  }
}

function closeAllOverlays() {
  for (const overlay of overlays) {
    overlay.hidden = true;
  }
}

for (const button of openButtons) {
  button.addEventListener("click", () => {
    const targetId = button.getAttribute("data-open");
    if (targetId) {
      openOverlay(targetId);
    }
  });
}

for (const button of closeButtons) {
  button.addEventListener("click", () => {
    closeAllOverlays();
  });
}

for (const overlay of overlays) {
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeAllOverlays();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAllOverlays();
  }
});

async function handleUpload({
  event,
  form,
  imageField,
  glbField,
  previewField,
  statusField,
  picturesPath,
  modelsPath
}) {
  event.preventDefault();
  const imageFile = imageField.files?.[0];
  const glbFile = glbField.files?.[0];

  if (!imageFile || !glbFile) {
    setStatusFor(statusField, "Bitte Bild und GLB auswählen.", true);
    return;
  }

  const imageBase = fileBaseName(imageFile.name);
  if (!glbFile.name.toLowerCase().endsWith(".glb")) {
    setStatusFor(statusField, "Die 3D-Datei muss .glb sein.", true);
    return;
  }

  try {
    setStatusFor(statusField, "Upload läuft...");
    const imageRef = ref(storage, `${picturesPath}/${imageFile.name}`);
    const modelRef = ref(storage, `${modelsPath}/${imageBase}.glb`);
    await uploadBytes(imageRef, imageFile);
    await uploadBytes(modelRef, glbFile, { contentType: "model/gltf-binary" });
    form.reset();
    previewField.removeAttribute("src");
    previewField.classList.remove("visible");
    await loadGallery();
    setStatusFor(statusField, `Upload erfolgreich: ${imageBase}`);
  } catch (error) {
    setStatusFor(statusField, `Upload fehlgeschlagen. ${describeError(error)}`, true);
  }
}

function bindPreview(inputField, previewField) {
  inputField.addEventListener("change", () => {
    const imageFile = inputField.files?.[0];
    if (!imageFile) {
      previewField.removeAttribute("src");
      previewField.classList.remove("visible");
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    previewField.src = objectUrl;
    previewField.classList.add("visible");
  });
}

uploadForm.addEventListener("submit", (event) =>
  handleUpload({
    event,
    form: uploadForm,
    imageField: imageInput,
    glbField: glbInput,
    previewField: imagePreview,
    statusField: statusEl,
    picturesPath: "pictures",
    modelsPath: "models"
  })
);

uploadAnimatedForm.addEventListener("submit", (event) =>
  handleUpload({
    event,
    form: uploadAnimatedForm,
    imageField: imageAnimatedInput,
    glbField: glbAnimatedInput,
    previewField: imageAnimatedPreview,
    statusField: statusAnimatedEl,
    picturesPath: "animate_models/picture",
    modelsPath: "animate_models/models"
  })
);

bindPreview(imageInput, imagePreview);
bindPreview(imageAnimatedInput, imageAnimatedPreview);

async function bootstrap() {
  try {
    await signInAnonymously(auth);
    await loadGallery();
  } catch (error) {
    setStatus(`Anmeldung/Laden fehlgeschlagen. ${describeError(error)}`, true);
  }
}

bootstrap();
