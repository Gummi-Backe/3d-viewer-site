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
  apiKey: "DEINE_API_KEY",
  authDomain: "dreid-viewer-site.firebaseapp.com",
  projectId: "dreid-viewer-site",
  storageBucket: "dreid-viewer-site.firebasestorage.app",
  appId: "DEINE_APP_ID"
};

const viewer = document.getElementById("viewer");
const gallery = document.getElementById("gallery");
const statusEl = document.getElementById("status");
const uploadForm = document.getElementById("uploadForm");
const imageInput = document.getElementById("imageInput");
const glbInput = document.getElementById("glbInput");

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.dataset.error = isError ? "1" : "0";
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

async function loadModelByBase(baseName) {
  const modelRef = ref(storage, `models/${baseName}.glb`);
  const modelUrl = await getDownloadURL(modelRef);
  viewer.src = modelUrl;
}

async function loadGallery() {
  gallery.innerHTML = "";

  const picturesRef = ref(storage, "pictures");
  const result = await listAll(picturesRef);
  const items = result.items.sort((a, b) => a.name.localeCompare(b.name));

  if (!items.length) {
    gallery.innerHTML = "<p class=\"empty\">Keine Bilder gefunden.</p>";
    return;
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
        await loadModelByBase(baseName);
        setStatus(`Modell geladen: ${baseName}`);
      } catch {
        setStatus(`Konnte models/${baseName}.glb nicht laden.`, true);
      }
    });
    gallery.appendChild(button);
  }

  const firstBase = fileBaseName(items[0].name);
  await loadModelByBase(firstBase);
  setStatus(`Modell geladen: ${firstBase}`);
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const imageFile = imageInput.files?.[0];
  const glbFile = glbInput.files?.[0];

  if (!imageFile || !glbFile) {
    setStatus("Bitte Bild und GLB auswählen.", true);
    return;
  }

  const imageBase = fileBaseName(imageFile.name);
  const glbBase = fileBaseName(glbFile.name);

  if (imageBase !== glbBase) {
    setStatus("Dateinamen müssen gleich sein (ohne Endung).", true);
    return;
  }

  if (!glbFile.name.toLowerCase().endsWith(".glb")) {
    setStatus("Die 3D-Datei muss .glb sein.", true);
    return;
  }

  try {
    setStatus("Upload läuft...");
    const imageRef = ref(storage, `pictures/${imageFile.name}`);
    const modelRef = ref(storage, `models/${imageBase}.glb`);
    await uploadBytes(imageRef, imageFile);
    await uploadBytes(modelRef, glbFile);
    uploadForm.reset();
    await loadGallery();
    setStatus(`Upload erfolgreich: ${imageBase}`);
  } catch {
    setStatus("Upload fehlgeschlagen. Prüfe Rules/Auth.", true);
  }
});

async function bootstrap() {
  if (
    firebaseConfig.apiKey === "DEINE_API_KEY" ||
    firebaseConfig.appId === "DEINE_APP_ID"
  ) {
    setStatus("Bitte in app.js zuerst Firebase apiKey und appId eintragen.", true);
    return;
  }

  try {
    await signInAnonymously(auth);
    await loadGallery();
  } catch {
    setStatus("Anmeldung/Laden fehlgeschlagen. Prüfe Firebase Auth und Rules.", true);
  }
}

bootstrap();
