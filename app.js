// ─── State ───────────────────────────────────────────────────────────────────
const FILTERS = [
  { name: 'Original', cls: 'f-none'    },
  { name: 'Warm',     cls: 'f-warm'    },
  { name: 'Cool',     cls: 'f-cool'    },
  { name: 'Sakura',   cls: 'f-sakura'  },
  { name: 'Mono',     cls: 'f-mono'    },
  { name: 'Vintage',  cls: 'f-vintage' },
  { name: 'Dreamy',   cls: 'f-dreamy'  },
  { name: 'Golden',   cls: 'f-golden'  },
  { name: 'Mist',     cls: 'f-mist'    },
];

const FILTER_CSS = {
  'f-none':    'none',
  'f-warm':    'sepia(30%) saturate(130%) brightness(105%)',
  'f-cool':    'hue-rotate(15deg) saturate(90%) brightness(105%)',
  'f-sakura':  'sepia(20%) hue-rotate(310deg) saturate(140%) brightness(108%)',
  'f-mono':    'grayscale(100%) contrast(110%)',
  'f-vintage': 'sepia(60%) contrast(110%) brightness(95%)',
  'f-dreamy':  'saturate(140%) brightness(108%)',
  'f-golden':  'sepia(40%) saturate(160%) hue-rotate(-10deg) brightness(110%)',
  'f-mist':    'saturate(70%) brightness(112%) contrast(90%)',
};

const STICKERS = ['🌸','🌺','🌻','🦋','⭐','🌙','🎋','🏮','🍡','🫧',
                  '🌿','🎐','🌷','🦚','✨','🎴','🪷','🎑','🌼','🍃'];

let photos              = [];
let selected            = [];
let activeFilter        = 'f-none';
let collageCells        = [];
let collageCount        = 2;
let selectedFolderEmoji = '🌸';
let activeFolderView    = null;

let folders = [
  { id: 1, name: 'Sakura Season', emoji: '🌸', photos: [] },
  { id: 2, name: 'Adventures',    emoji: '🎋', photos: [] },
];

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

function switchTab(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');
  const order = ['gallery', 'editor', 'collage', 'folders'];
  const idx   = order.indexOf(name);
  const tabs  = document.querySelectorAll('.nav-tab');
  if (tabs[idx]) tabs[idx].classList.add('active');
  if (name === 'folders') renderFolders();
  if (name === 'collage') renderCollage();
  if (name === 'editor')  { renderFilterGrid(); renderStickerGrid(); renderFolderSelectList(); }
}

function handleFiles(files) {
  [...files].forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      photos.push({ id: Date.now() + Math.random(), src: e.target.result, filter: 'f-none', name: file.name });
      renderGallery();
    };
    reader.readAsDataURL(file);
  });
}

function renderGallery() {
  const grid       = document.getElementById('photo-grid');
  const sec        = document.getElementById('gallery-section');
  const empty      = document.getElementById('empty-state');
  const countBadge = document.getElementById('photo-count');
  if (!grid) return;
  if (photos.length === 0) {
    if (sec)   sec.style.display   = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (sec)        sec.style.display        = 'block';
  if (empty)      empty.style.display      = 'none';
  if (countBadge) countBadge.textContent   = photos.length;
  grid.innerHTML = photos.map((p, i) => `
    <div class="photo-thumb ${selected.includes(p.id) ? 'selected' : ''}" onclick="toggleSelect(${i})">
      <img src="${p.src}" alt="" class="${p.filter}">
      <div class="check">✓</div>
      <div class="photo-del" onclick="event.stopPropagation(); deletePhoto(${i})">×</div>
    </div>`).join('');
}

function toggleSelect(i) {
  const id = photos[i].id;
  selected = selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id];
  renderGallery();
}
function selectAll() { selected = photos.map(p => p.id); renderGallery(); }
function deletePhoto(i) {
  const id = photos[i].id;
  photos.splice(i, 1);
  selected = selected.filter(s => s !== id);
  renderGallery();
}
function openEditor() {
  switchTab('editor');
  const p = selected.length ? photos.find(ph => ph.id === selected[0]) : photos[0];
  if (p) loadPhotoInEditor(p);
}

function loadPhotoInEditor(p) {
  const img = document.getElementById('editor-img');
  const ph  = document.getElementById('canvas-placeholder');
  if (!img) return;
  img.src = p.src; img.style.display = 'block';
  if (ph) ph.style.display = 'none';
  FILTERS.forEach(f => img.classList.remove(f.cls));
  img.classList.add(p.filter);
  activeFilter = p.filter;
  clearStickers(); renderFilterGrid(); renderFolderSelectList();
}

function renderFilterGrid() {
  const grid = document.getElementById('filter-grid');
  if (!grid) return;
  const img = document.getElementById('editor-img');
  const src = (img && img.style.display !== 'none') ? img.src : '';
  grid.innerHTML = FILTERS.map(f => `
    <div class="filter-btn ${activeFilter === f.cls ? 'active' : ''}" onclick="applyFilter('${f.cls}')">
      <div class="filter-preview">${src ? `<img src="${src}" style="filter:${FILTER_CSS[f.cls]}" alt="">` : ''}</div>
      ${f.name}
    </div>`).join('');
}

function applyFilter(cls) {
  activeFilter = cls;
  const img = document.getElementById('editor-img');
  if (!img) return;
  FILTERS.forEach(f => img.classList.remove(f.cls));
  img.classList.add(cls);
  renderFilterGrid();
}
function resetFilter() { applyFilter('f-none'); }

function clearStickers() {
  const layer = document.getElementById('sticker-layer');
  if (layer) { layer.innerHTML = ''; layer.style.pointerEvents = 'none'; }
}

function renderStickerGrid() {
  const grid = document.getElementById('sticker-grid');
  if (!grid) return;
  grid.innerHTML = STICKERS.map(s => `<span class="sticker-pick" onclick="addSticker('${s}')">${s}</span>`).join('');
}

function addSticker(emoji) {
  const layer = document.getElementById('sticker-layer');
  if (!layer) return;
  layer.style.pointerEvents = 'auto';
  const el = document.createElement('div');
  el.className = 'sticker-on-canvas'; el.textContent = emoji;
  el.style.left = (25 + Math.random() * 45) + '%';
  el.style.top  = (20 + Math.random() * 50) + '%';
  makeDraggable(el); layer.appendChild(el);
  showToast('Sticker added! Drag to reposition 🌸');
}

function makeDraggable(el) {
  let ox = 0, oy = 0, dragging = false;
  el.addEventListener('mousedown', e => { dragging = true; ox = e.clientX - el.getBoundingClientRect().left; oy = e.clientY - el.getBoundingClientRect().top; e.preventDefault(); });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const parent = el.parentElement.getBoundingClientRect();
    el.style.left = ((e.clientX - parent.left - ox) / parent.width  * 100) + '%';
    el.style.top  = ((e.clientY - parent.top  - oy) / parent.height * 100) + '%';
  });
  document.addEventListener('mouseup', () => { dragging = false; });
}

function savePhoto() {
  const img = document.getElementById('editor-img');
  if (!img || !img.src || img.style.display === 'none') { showToast('No photo loaded!'); return; }
  const canvas = document.createElement('canvas');
  const image  = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.filter = FILTER_CSS[activeFilter] || 'none';
    ctx.drawImage(image, 0, 0);
    const link = document.createElement('a');
    link.download = 'sakura-photo.png'; link.href = canvas.toDataURL('image/png'); link.click();
    showToast('📸 Photo saved!');
  };
  image.src = img.src;
}

function renderFolderSelectList() {
  const el = document.getElementById('folder-select-list');
  if (!el) return;
  el.innerHTML = folders.map(f => `
    <button class="folder-save-btn" onclick="saveToFolder(${f.id})">
      <span>${f.emoji}</span> Save to ${f.name}
    </button>`).join('');
}

function saveToFolder(folderId) {
  const f = folders.find(fl => fl.id === folderId);
  const img = document.getElementById('editor-img');
  if (!f || !img || !img.src) return;
  if (!f.photos.find(p => p.src === img.src)) f.photos.push({ id: Date.now(), src: img.src, filter: activeFilter });
  showToast(`Saved to ${f.emoji} ${f.name}!`);
}

function renderCollage() {
  const grid = document.getElementById('collage-grid');
  if (!grid) return;
  const cells = Array.from({ length: collageCount }, (_, i) => collageCells[i] || null);
  grid.innerHTML = cells.map((c, i) => `
    <div class="collage-cell" onclick="addToCollage(${i})">
      ${c ? `<img src="${c.src}" class="${c.filter}" alt="">` : `<span style="font-size:36px;color:var(--petal-pink)">+</span>`}
    </div>`).join('');
}

function addToCollage(idx) {
  if (photos.length === 0) { showToast('Upload some photos first! 🌸'); return; }
  const currentSrc = collageCells[idx]?.src;
  const currentIdx = photos.findIndex(p => p.src === currentSrc);
  collageCells[idx] = photos[(currentIdx + 1) % photos.length];
  renderCollage();
}

function setCollageLayout(count, cols, btn) {
  collageCount = count; collageCells = [];
  document.querySelectorAll('.layout-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const grid = document.getElementById('collage-grid');
  if (grid) grid.style.gridTemplateColumns = cols;
  renderCollage();
}
function clearCollage() { collageCells = []; renderCollage(); }
function saveCollage()  { showToast('🎴 Collage saved! (Demo)'); }

function renderFolders() {
  const sec  = document.getElementById('folder-photos-section');
  const grid = document.getElementById('folder-grid');
  if (!grid) return;
  if (sec) sec.style.display = 'none';
  grid.style.display = 'grid';
  grid.innerHTML = folders.map(f => `
    <div class="folder-card" onclick="openFolder(${f.id})">
      <div class="folder-icon">${f.emoji}</div>
      <div class="folder-name">${f.name}</div>
      <div class="folder-count">${f.photos.length} photo${f.photos.length !== 1 ? 's' : ''}</div>
    </div>`).join(`
    <div class="folder-card new-folder" onclick="document.getElementById('folder-name-input').focus()">
      <div class="folder-icon">＋</div>
      <div class="folder-name" style="color:var(--text-muted)">New Folder</div>
    </div>`);
}

function openFolder(id) {
  const f = folders.find(fl => fl.id === id);
  if (!f) return;
  activeFolderView = id;
  const grid = document.getElementById('folder-grid');
  const sec  = document.getElementById('folder-photos-section');
  if (grid) grid.style.display = 'none';
  if (sec)  sec.style.display  = 'block';
  const title = document.getElementById('folder-photos-title');
  if (title) title.textContent = `${f.emoji} ${f.name}`;
  const g = document.getElementById('folder-photos-grid');
  if (!g) return;
  if (f.photos.length === 0) {
    g.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🌸</div><div class="empty-title">Empty folder</div><div>Save photos from the editor to fill it up</div></div>`;
    return;
  }
  g.innerHTML = f.photos.map(p => `<div class="photo-thumb"><img src="${p.src}" class="${p.filter}" alt=""></div>`).join('');
}

function closeFolderView() {
  const grid = document.getElementById('folder-grid');
  const sec  = document.getElementById('folder-photos-section');
  if (grid) grid.style.display = 'grid';
  if (sec)  sec.style.display  = 'none';
}

function selectFolderEmoji(el) {
  document.querySelectorAll('#folder-emoji-pick .sticker-pick').forEach(s => { s.style.background = ''; s.style.borderColor = ''; });
  el.style.background = 'var(--sakura-50)'; el.style.borderColor = 'var(--blossom)';
  selectedFolderEmoji = el.textContent;
}

function createFolder() {
  const inp = document.getElementById('folder-name-input');
  if (!inp || !inp.value.trim()) { showToast('Enter a folder name! 🌸'); return; }
  folders.push({ id: Date.now(), name: inp.value.trim(), emoji: selectedFolderEmoji, photos: [] });
  inp.value = '';
  renderFolders(); renderFolderSelectList();
  showToast(`${selectedFolderEmoji} Folder created!`);
}

function spawnPetals() {
  const container = document.getElementById('petals');
  if (!container) return;
  for (let i = 0; i < 16; i++) {
    const p = document.createElement('div');
    p.className = 'petal';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = (7 + Math.random() * 10) + 's';
    p.style.animationDelay    = (Math.random() * 14) + 's';
    const size = 10 + Math.random() * 8;
    const pink = Math.random() > 0.5 ? '#F7C5D5' : '#E8789A';
    p.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 20 20"><ellipse cx="10" cy="10" rx="5" ry="10" fill="${pink}" opacity="0.75" transform="rotate(${Math.random()*360} 10 10)"/></svg>`;
    container.appendChild(p);
  }
}

function initDropzone() {
  const zone = document.getElementById('dropzone');
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--blossom)'; zone.style.background = 'var(--sakura-50)'; });
  zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; zone.style.background = ''; });
  zone.addEventListener('drop', e => { e.preventDefault(); zone.style.borderColor = ''; zone.style.background = ''; handleFiles(e.dataTransfer.files); });
}

// ─── Expose all to window for onclick attributes ──────────────────────────────
window.switchTab         = switchTab;
window.handleFiles       = handleFiles;
window.toggleSelect      = toggleSelect;
window.selectAll         = selectAll;
window.deletePhoto       = deletePhoto;
window.openEditor        = openEditor;
window.applyFilter       = applyFilter;
window.resetFilter       = resetFilter;
window.clearStickers     = clearStickers;
window.addSticker        = addSticker;
window.savePhoto         = savePhoto;
window.saveToFolder      = saveToFolder;
window.addToCollage      = addToCollage;
window.setCollageLayout  = setCollageLayout;
window.clearCollage      = clearCollage;
window.saveCollage       = saveCollage;
window.openFolder        = openFolder;
window.closeFolderView   = closeFolderView;
window.selectFolderEmoji = selectFolderEmoji;
window.createFolder      = createFolder;

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  spawnPetals();
  renderCollage();
  renderFolders();
  renderGallery();
  renderStickerGrid();
  initDropzone();
});