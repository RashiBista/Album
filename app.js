// ─── Firebase Imports ─────────────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, getDoc, getDocs,
  setDoc, updateDoc, onSnapshot, query, orderBy,
  arrayUnion, serverTimestamp, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─── Firebase Init ────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBqFzVUDfdVO0q7nx2FtewWPgDBEpjC5ZU",
  authDomain:        "photo-book-ec2df.firebaseapp.com",
  projectId:         "photo-book-ec2df",
  storageBucket:     "photo-book-ec2df.firebasestorage.app",
  messagingSenderId: "869046941856",
  appId:             "1:869046941856:web:751810af59d8591ea6f1c5"
};
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─── Constants ────────────────────────────────────────────────────────────────
const FILTERS = [
  { name: "Original", cls: "f-none"    },
  { name: "Warm",     cls: "f-warm"    },
  { name: "Cool",     cls: "f-cool"    },
  { name: "Sakura",   cls: "f-sakura"  },
  { name: "Mono",     cls: "f-mono"    },
  { name: "Vintage",  cls: "f-vintage" },
  { name: "Dreamy",   cls: "f-dreamy"  },
  { name: "Golden",   cls: "f-golden"  },
  { name: "Mist",     cls: "f-mist"    },
];

const FILTER_CSS = {
  "f-none":    "none",
  "f-warm":    "sepia(30%) saturate(130%) brightness(105%)",
  "f-cool":    "hue-rotate(15deg) saturate(90%) brightness(105%)",
  "f-sakura":  "sepia(20%) hue-rotate(310deg) saturate(140%) brightness(108%)",
  "f-mono":    "grayscale(100%) contrast(110%)",
  "f-vintage": "sepia(60%) contrast(110%) brightness(95%)",
  "f-dreamy":  "saturate(140%) brightness(108%)",
  "f-golden":  "sepia(40%) saturate(160%) hue-rotate(-10deg) brightness(110%)",
  "f-mist":    "saturate(70%) brightness(112%) contrast(90%)",
};

const STICKERS = [
  "🌸","🌺","🌻","🦋","⭐","🌙","🎋","🏮","🍡","🫧",
  "🌿","🎐","🌷","🦚","✨","🎴","🪷","🎑","🌼","🍃"
];

// ─── State ────────────────────────────────────────────────────────────────────
let currentUser         = null;
let photos              = [];
let selected            = [];
let activeFilter        = "f-none";
let folders             = [];
let selectedFolderEmoji = "🌸";
let activeGroupId       = null;
let groupPhotoBase64    = null;
let groupUnsub          = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}

function friendlyError(code) {
  const map = {
    "auth/email-already-in-use": "That email is already registered",
    "auth/invalid-email":        "Please enter a valid email",
    "auth/weak-password":        "Password must be at least 6 characters",
    "auth/user-not-found":       "No account found with that email",
    "auth/wrong-password":       "Incorrect password",
    "auth/invalid-credential":   "Incorrect email or password",
    "auth/too-many-requests":    "Too many attempts — please try again later",
  };
  return map[code] || "Something went wrong, please try again";
}

function showError(el, msg) {
  el.textContent = msg;
  el.style.display = "block";
}

// ─── Image Compression ────────────────────────────────────────────────────────
function compressImage(file, maxKB = 380) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width: w, height: h } = img;
        const max = 800;
        if (w > max || h > max) {
          if (w > h) { h = Math.round(h * max / w); w = max; }
          else       { w = Math.round(w * max / h); h = max; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        let quality = 0.85;
        let result  = canvas.toDataURL("image/jpeg", quality);
        while (result.length > maxKB * 1024 * 1.37 && quality > 0.3) {
          quality -= 0.1;
          result = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(result);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
window.showAuthTab = function(tab) {
  document.getElementById("form-login").style.display   = tab === "login"  ? "block" : "none";
  document.getElementById("form-signup").style.display  = tab === "signup" ? "block" : "none";
  document.getElementById("tab-login").classList.toggle("active",  tab === "login");
  document.getElementById("tab-signup").classList.toggle("active", tab === "signup");
  document.getElementById("auth-error").style.display   = "none";
  document.getElementById("signup-error").style.display = "none";
};

window.handleSignup = async function() {
  const name  = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const pass  = document.getElementById("signup-password").value;
  const errEl = document.getElementById("signup-error");
  if (!name || !email || !pass) { showError(errEl, "Please fill in all fields"); return; }
  if (pass.length < 6)          { showError(errEl, "Password must be at least 6 characters"); return; }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, "users", cred.user.uid), {
      name, email, createdAt: serverTimestamp(), folders: []
    });
    showToast("Welcome to Sakura Album! 🌸");
  } catch (e) { showError(errEl, friendlyError(e.code)); }
};

window.handleLogin = async function() {
  const email = document.getElementById("login-email").value.trim();
  const pass  = document.getElementById("login-password").value;
  const errEl = document.getElementById("auth-error");
  if (!email || !pass) { showError(errEl, "Please enter email and password"); return; }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    showToast("Welcome back! 🌸");
  } catch (e) { showError(errEl, friendlyError(e.code)); }
};

window.handleLogout = async function() {
  await signOut(auth);
  photos = []; selected = []; folders = [];
  renderGallery();
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("main-app").style.display    = "block";
    const name    = user.displayName || user.email;
    const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    document.getElementById("user-avatar").textContent        = initials;
    document.getElementById("user-name-display").textContent  = name.split(" ")[0];
    await loadUserFolders();
    renderGallery();
    renderStickerGrid();
    initDropzone();
    spawnPetals();
  } else {
    currentUser = null;
    document.getElementById("auth-screen").style.display = "flex";
    document.getElementById("main-app").style.display    = "none";
    if (groupUnsub) { groupUnsub(); groupUnsub = null; }
  }
});

// ─── Tab Switching ────────────────────────────────────────────────────────────
window.switchTab = function(name) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
  document.getElementById("panel-" + name)?.classList.add("active");
  const order = ["gallery", "groups", "editor", "folders"];
  const tabs  = document.querySelectorAll(".nav-tab");
  const idx   = order.indexOf(name);
  if (tabs[idx]) tabs[idx].classList.add("active");
  if (name === "folders") renderFolders();
  if (name === "groups")  loadMyGroups();
  if (name === "editor")  { renderFilterGrid(); renderStickerGrid(); renderFolderSelectList(); }
};

// ─── Gallery ──────────────────────────────────────────────────────────────────
window.handleFiles = async function(files) {
  for (const file of [...files]) {
    if (!file.type.startsWith("image/")) continue;
    const compressed = await compressImage(file);
    photos.push({ id: Date.now() + Math.random(), src: compressed, filter: "f-none", name: file.name });
    renderGallery();
  }
};

function renderGallery() {
  const grid  = document.getElementById("photo-grid");
  const sec   = document.getElementById("gallery-section");
  const empty = document.getElementById("empty-state");
  const badge = document.getElementById("photo-count");
  if (!grid) return;
  if (photos.length === 0) {
    if (sec)   sec.style.display   = "none";
    if (empty) empty.style.display = "block";
    return;
  }
  if (sec)   sec.style.display   = "block";
  if (empty) empty.style.display = "none";
  if (badge) badge.textContent   = photos.length;
  grid.innerHTML = photos.map((p, i) => `
    <div class="photo-thumb ${selected.includes(p.id) ? "selected" : ""}" onclick="toggleSelect(${i})">
      <img src="${p.src}" alt="" class="${p.filter}">
      <div class="check">✓</div>
      <div class="photo-del" onclick="event.stopPropagation(); deletePhoto(${i})">×</div>
    </div>`).join("");
}

window.toggleSelect = function(i) {
  const id = photos[i].id;
  selected = selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id];
  renderGallery();
};
window.selectAll = function() { selected = photos.map(p => p.id); renderGallery(); };
window.deletePhoto = function(i) {
  const id = photos[i].id;
  photos.splice(i, 1);
  selected = selected.filter(s => s !== id);
  renderGallery();
};
window.openEditor = function() {
  switchTab("editor");
  const p = selected.length ? photos.find(ph => ph.id === selected[0]) : photos[0];
  if (p) loadPhotoInEditor(p);
};

// ─── Editor ───────────────────────────────────────────────────────────────────
function loadPhotoInEditor(p) {
  const img = document.getElementById("editor-img");
  const ph  = document.getElementById("canvas-placeholder");
  if (!img) return;
  img.src = p.src; img.style.display = "block";
  if (ph) ph.style.display = "none";
  FILTERS.forEach(f => img.classList.remove(f.cls));
  img.classList.add(p.filter);
  activeFilter = p.filter;
  clearStickers(); renderFilterGrid(); renderFolderSelectList();
}

function renderFilterGrid() {
  const grid = document.getElementById("filter-grid");
  if (!grid) return;
  const img = document.getElementById("editor-img");
  const src = (img && img.style.display !== "none") ? img.src : "";
  grid.innerHTML = FILTERS.map(f => `
    <div class="filter-btn ${activeFilter === f.cls ? "active" : ""}" onclick="applyFilter('${f.cls}')">
      <div class="filter-preview">${src ? `<img src="${src}" style="filter:${FILTER_CSS[f.cls]}" alt="">` : ""}</div>
      ${f.name}
    </div>`).join("");
}

window.applyFilter = function(cls) {
  activeFilter = cls;
  const img = document.getElementById("editor-img");
  if (!img) return;
  FILTERS.forEach(f => img.classList.remove(f.cls));
  img.classList.add(cls);
  renderFilterGrid();
};
window.resetFilter  = function() { window.applyFilter("f-none"); };
window.clearStickers = function() {
  const layer = document.getElementById("sticker-layer");
  if (layer) { layer.innerHTML = ""; layer.style.pointerEvents = "none"; }
};

function renderStickerGrid() {
  const grid = document.getElementById("sticker-grid");
  if (!grid) return;
  grid.innerHTML = STICKERS.map(s =>
    `<span class="sticker-pick" onclick="addSticker('${s}')">${s}</span>`
  ).join("");
}

window.addSticker = function(emoji) {
  const layer = document.getElementById("sticker-layer");
  if (!layer) return;
  layer.style.pointerEvents = "auto";
  const el = document.createElement("div");
  el.className   = "sticker-on-canvas";
  el.textContent = emoji;
  el.style.left  = (25 + Math.random() * 45) + "%";
  el.style.top   = (20 + Math.random() * 50) + "%";
  let ox = 0, oy = 0, dragging = false;
  el.addEventListener("mousedown", e => {
    dragging = true;
    ox = e.clientX - el.getBoundingClientRect().left;
    oy = e.clientY - el.getBoundingClientRect().top;
    e.preventDefault();
  });
  document.addEventListener("mousemove", e => {
    if (!dragging) return;
    const p = el.parentElement.getBoundingClientRect();
    el.style.left = ((e.clientX - p.left - ox) / p.width  * 100) + "%";
    el.style.top  = ((e.clientY - p.top  - oy) / p.height * 100) + "%";
  });
  document.addEventListener("mouseup", () => { dragging = false; });
  layer.appendChild(el);
  showToast("Sticker added! Drag to reposition 🌸");
};

window.savePhoto = function() {
  const img = document.getElementById("editor-img");
  if (!img || !img.src || img.style.display === "none") { showToast("No photo loaded!"); return; }
  const canvas = document.createElement("canvas");
  const image  = new Image();
  image.onload = () => {
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.filter = FILTER_CSS[activeFilter] || "none";
    ctx.drawImage(image, 0, 0);
    const link     = document.createElement("a");
    link.download  = "sakura-photo.png";
    link.href      = canvas.toDataURL("image/png");
    link.click();
    showToast("📸 Photo saved!");
  };
  image.src = img.src;
};

// ─── Folders ──────────────────────────────────────────────────────────────────
async function loadUserFolders() {
  if (!currentUser) return;
  try {
    const snap = await getDoc(doc(db, "users", currentUser.uid));
    folders = snap.exists() && snap.data().folders ? snap.data().folders : [];
  } catch (e) { folders = []; }
  renderFolders(); renderFolderSelectList();
}

async function saveFoldersToFirestore() {
  if (!currentUser) return;
  try { await updateDoc(doc(db, "users", currentUser.uid), { folders }); }
  catch (e) { console.error(e); }
}

function renderFolderSelectList() {
  const el = document.getElementById("folder-select-list");
  if (!el) return;
  el.innerHTML = folders.length
    ? folders.map(f =>
        `<button class="folder-save-btn" onclick="saveToFolder('${f.id}')">${f.emoji} Save to ${f.name}</button>`
      ).join("")
    : `<div style="font-size:13px;color:var(--text-muted)">Create folders in the Folders tab first</div>`;
}

window.saveToFolder = function(folderId) {
  const f   = folders.find(fl => fl.id === folderId);
  const img = document.getElementById("editor-img");
  if (!f || !img || !img.src) return;
  if (!f.photos.find(p => p.src === img.src)) {
    f.photos.push({ id: Date.now(), src: img.src, filter: activeFilter });
  }
  saveFoldersToFirestore();
  showToast(`Saved to ${f.emoji} ${f.name}!`);
};

function renderFolders() {
  const sec  = document.getElementById("folder-photos-section");
  const grid = document.getElementById("folder-grid");
  if (!grid) return;
  if (sec) sec.style.display = "none";
  grid.style.display = "grid";
  grid.innerHTML = folders.map(f => `
    <div class="folder-card" onclick="openFolder('${f.id}')">
      <div class="folder-icon">${f.emoji}</div>
      <div class="folder-name">${f.name}</div>
      <div class="folder-count">${f.photos.length} photo${f.photos.length !== 1 ? "s" : ""}</div>
    </div>`).join(`
    <div class="folder-card new-folder" onclick="document.getElementById('folder-name-input').focus()">
      <div class="folder-icon">＋</div>
      <div class="folder-name" style="color:var(--text-muted)">New Folder</div>
    </div>`);
}

window.openFolder = function(id) {
  const f = folders.find(fl => fl.id === id);
  if (!f) return;
  document.getElementById("folder-grid").style.display          = "none";
  document.getElementById("folder-photos-section").style.display = "block";
  document.getElementById("folder-photos-title").textContent    = `${f.emoji} ${f.name}`;
  const g = document.getElementById("folder-photos-grid");
  if (!g) return;
  g.innerHTML = f.photos.length
    ? f.photos.map(p => `<div class="photo-thumb"><img src="${p.src}" class="${p.filter}" alt=""></div>`).join("")
    : `<div class="empty-state" style="grid-column:1/-1">
         <div class="empty-icon">🌸</div>
         <div class="empty-title">Empty folder</div>
         <div>Save photos from the editor</div>
       </div>`;
};
window.closeFolderView = function() {
  document.getElementById("folder-grid").style.display           = "grid";
  document.getElementById("folder-photos-section").style.display = "none";
};
window.selectFolderEmoji = function(el) {
  document.querySelectorAll("#folder-emoji-pick .sticker-pick").forEach(s => s.classList.remove("active-emoji"));
  el.classList.add("active-emoji");
  selectedFolderEmoji = el.textContent;
};
window.createFolder = function() {
  const inp = document.getElementById("folder-name-input");
  if (!inp?.value.trim()) { showToast("Enter a folder name! 🌸"); return; }
  folders.push({ id: "f" + Date.now(), name: inp.value.trim(), emoji: selectedFolderEmoji, photos: [] });
  inp.value = "";
  renderFolders(); renderFolderSelectList(); saveFoldersToFirestore();
  showToast(`${selectedFolderEmoji} Folder created!`);
};

// ─── Groups ───────────────────────────────────────────────────────────────────
function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

window.createGroup = async function() {
  if (!currentUser) return;
  const nameEl = document.getElementById("new-group-name");
  const name   = nameEl.value.trim();
  if (!name) { showToast("Enter a group name 🌸"); return; }
  const code = generateCode();
  try {
    await addDoc(collection(db, "groups"), {
      name, code,
      createdBy:     currentUser.uid,
      createdByName: currentUser.displayName || "User",
      members:       [currentUser.uid],
      memberNames:   { [currentUser.uid]: currentUser.displayName || "User" },
      createdAt:     serverTimestamp(),
    });
    nameEl.value = "";
    showToast(`Group created! Code: ${code} 🌸`);
    loadMyGroups();
  } catch (e) { showToast("Error creating group"); console.error(e); }
};

window.joinGroup = async function() {
  if (!currentUser) return;
  const code = document.getElementById("join-code").value.trim().toUpperCase();
  if (code.length !== 6) { showToast("Enter a 6-digit code 🌸"); return; }
  try {
    const q    = query(collection(db, "groups"), where("code", "==", code));
    const snap = await getDocs(q);
    if (snap.empty) { showToast("Group not found — check the code"); return; }
    const groupDoc = snap.docs[0];
    const data     = groupDoc.data();
    if (data.members.includes(currentUser.uid)) { showToast("You're already in this group!"); return; }
    await updateDoc(doc(db, "groups", groupDoc.id), {
      members: arrayUnion(currentUser.uid),
      [`memberNames.${currentUser.uid}`]: currentUser.displayName || "User",
    });
    document.getElementById("join-code").value = "";
    showToast(`Joined ${data.name}! 🌸`);
    loadMyGroups();
  } catch (e) { showToast("Error joining group"); console.error(e); }
};

async function loadMyGroups() {
  if (!currentUser) return;
  const list = document.getElementById("groups-list");
  if (!list) return;
  list.innerHTML = `<div style="text-align:center;padding:24px"><div class="spinner"></div></div>`;
  try {
    const q    = query(collection(db, "groups"), where("members", "array-contains", currentUser.uid));
    const snap = await getDocs(q);
    if (snap.empty) {
      list.innerHTML = `<div class="empty-state" style="padding:32px">
        <div class="empty-icon">🎋</div>
        <div class="empty-title">No groups yet</div>
        <div>Create one or join with a code</div>
      </div>`;
      return;
    }
    list.innerHTML = snap.docs.map(d => {
      const g = d.data();
      return `
        <div class="group-card" onclick="openGroupDetail('${d.id}','${g.name}','${g.code}')">
          <div class="group-card-left">
            <div class="group-avatar">🌸</div>
            <div>
              <div class="group-name">${g.name}</div>
              <div class="group-meta">${(g.members || []).length} member${g.members.length !== 1 ? "s" : ""} · Code: ${g.code}</div>
            </div>
          </div>
          <div style="font-size:20px;color:var(--text-muted)">›</div>
        </div>`;
    }).join("");
  } catch (e) {
    list.innerHTML = `<div class="empty-state"><div>Error loading groups</div></div>`;
    console.error(e);
  }
}

window.openGroupDetail = function(groupId, groupName, groupCode) {
  activeGroupId = groupId;
  document.getElementById("group-detail-name").textContent = groupName;
  document.getElementById("group-detail-code").textContent = groupCode;
  document.getElementById("groups-list").style.display     = "none";
  document.getElementById("group-detail").style.display    = "block";
  document.getElementById("groups-actions").style.display  = "none";
  document.getElementById("my-groups-label").style.display = "none";
  listenGroupPhotos(groupId);
};

window.closeGroupDetail = function() {
  if (groupUnsub) { groupUnsub(); groupUnsub = null; }
  activeGroupId = null; groupPhotoBase64 = null;
  document.getElementById("groups-list").style.display     = "block";
  document.getElementById("group-detail").style.display    = "none";
  document.getElementById("groups-actions").style.display  = "flex";
  document.getElementById("my-groups-label").style.display = "flex";
  document.getElementById("group-photos-feed").innerHTML   = "";
  const prev = document.getElementById("group-photo-preview");
  prev.innerHTML = `<span class="plus-icon">+</span><div class="plus-label">Select photo</div>`;
};

window.copyGroupCode = function() {
  const code = document.getElementById("group-detail-code").textContent;
  navigator.clipboard.writeText(code).then(() => showToast("Code copied! 🌸"));
};

window.previewGroupPhoto = async function(input) {
  const file = input.files[0];
  if (!file) return;
  const compressed = await compressImage(file, 350);
  groupPhotoBase64 = compressed;
  document.getElementById("group-photo-preview").innerHTML = `<img src="${compressed}" alt="preview">`;
};

window.uploadToGroup = async function() {
  if (!currentUser || !activeGroupId) return;
  if (!groupPhotoBase64) { showToast("Select a photo first! 🌸"); return; }
  const caption = document.getElementById("group-photo-caption").value.trim();
  try {
    await addDoc(collection(db, "groups", activeGroupId, "photos"), {
      src:            groupPhotoBase64,
      caption,
      uploadedBy:     currentUser.uid,
      uploadedByName: currentUser.displayName || "User",
      createdAt:      serverTimestamp(),
      reactions:      {},
      comments:       [],
    });
    groupPhotoBase64 = null;
    document.getElementById("group-photo-caption").value = "";
    document.getElementById("group-photo-input").value   = "";
    document.getElementById("group-photo-preview").innerHTML = `<span class="plus-icon">+</span><div class="plus-label">Select photo</div>`;
    showToast("Photo shared! 🌸");
  } catch (e) { showToast("Error: " + e.message); console.error(e); }
};

function listenGroupPhotos(groupId) {
  const feed = document.getElementById("group-photos-feed");
  if (!feed) return;
  feed.innerHTML = `<div style="text-align:center;padding:32px"><div class="spinner"></div></div>`;
  const q = query(collection(db, "groups", groupId, "photos"), orderBy("createdAt", "desc"));
  groupUnsub = onSnapshot(q, (snap) => {
    if (snap.empty) {
      feed.innerHTML = `<div class="empty-state">
        <div class="empty-icon">🌸</div>
        <div class="empty-title">No photos yet</div>
        <div>Be the first to share!</div>
      </div>`;
      return;
    }
    feed.innerHTML = snap.docs.map(d => renderFeedCard(d.id, d.data())).join("");
  }, e => console.error(e));
}

function renderFeedCard(photoId, data) {
  const initials   = (data.uploadedByName || "U").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const time       = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : "Just now";
  const heartCount = Object.keys(data.reactions || {}).length;
  const hasReacted = currentUser && (data.reactions || {})[currentUser.uid];
  const comments   = data.comments || [];
  return `
    <div class="feed-card">
      <div class="feed-header">
        <div class="feed-avatar">${initials}</div>
        <div>
          <div class="feed-user">${data.uploadedByName || "User"}</div>
          <div class="feed-time">${time}</div>
        </div>
      </div>
      <img src="${data.src}" class="feed-img" alt="${data.caption || ""}">
      ${data.caption ? `<div class="feed-caption">${data.caption}</div>` : ""}
      <div class="feed-actions">
        <button class="react-btn ${hasReacted ? "reacted" : ""}" onclick="toggleReaction('${photoId}')">
          🌸 ${heartCount > 0 ? heartCount : ""}
        </button>
        <span style="font-size:13px;color:var(--text-muted)">${comments.length} comment${comments.length !== 1 ? "s" : ""}</span>
      </div>
      <div class="comments-section">
        ${comments.map(c => `
          <div class="comment-item">
            <div class="comment-avatar">${(c.author || "U")[0].toUpperCase()}</div>
            <div class="comment-bubble">
              <div class="comment-author">${c.author || "User"}</div>
              <div class="comment-text">${c.text}</div>
            </div>
          </div>`).join("")}
        <div class="comment-input-row">
          <input class="comment-input" id="comment-${photoId}" placeholder="Add a comment..."
                 onkeydown="if(event.key==='Enter') addComment('${photoId}')">
          <button class="btn btn-primary btn-sm" onclick="addComment('${photoId}')">Post</button>
        </div>
      </div>
    </div>`;
}

window.toggleReaction = async function(photoId) {
  if (!currentUser || !activeGroupId) return;
  const ref  = doc(db, "groups", activeGroupId, "photos", photoId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const reactions = snap.data().reactions || {};
  if (reactions[currentUser.uid]) delete reactions[currentUser.uid];
  else reactions[currentUser.uid] = true;
  await updateDoc(ref, { reactions });
};

window.addComment = async function(photoId) {
  if (!currentUser || !activeGroupId) return;
  const input    = document.getElementById("comment-" + photoId);
  const text     = input.value.trim();
  if (!text) return;
  const ref  = doc(db, "groups", activeGroupId, "photos", photoId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const comments = snap.data().comments || [];
  comments.push({ author: currentUser.displayName || "User", text, uid: currentUser.uid, time: Date.now() });
  await updateDoc(ref, { comments });
  input.value = "";
};

// ─── Petals ───────────────────────────────────────────────────────────────────
function spawnPetals() {
  const container = document.getElementById("petals");
  if (!container || container.childElementCount > 0) return;
  for (let i = 0; i < 16; i++) {
    const p = document.createElement("div");
    p.className = "petal";
    p.style.left              = Math.random() * 100 + "%";
    p.style.animationDuration = (7 + Math.random() * 10) + "s";
    p.style.animationDelay    = (Math.random() * 14) + "s";
    const size = 10 + Math.random() * 8;
    const pink = Math.random() > 0.5 ? "#F7C5D5" : "#E8789A";
    p.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 20 20">
      <ellipse cx="10" cy="10" rx="5" ry="10" fill="${pink}" opacity=".75"
               transform="rotate(${Math.random() * 360} 10 10)"/>
    </svg>`;
    container.appendChild(p);
  }
}

// ─── Dropzone ─────────────────────────────────────────────────────────────────
function initDropzone() {
  const zone = document.getElementById("dropzone");
  if (!zone) return;
  zone.addEventListener("dragover", e => {
    e.preventDefault();
    zone.style.borderColor = "var(--blossom)";
    zone.style.background  = "var(--sakura-50)";
  });
  zone.addEventListener("dragleave", () => {
    zone.style.borderColor = "";
    zone.style.background  = "";
  });
  zone.addEventListener("drop", e => {
    e.preventDefault();
    zone.style.borderColor = "";
    zone.style.background  = "";
    window.handleFiles(e.dataTransfer.files);
  });
}