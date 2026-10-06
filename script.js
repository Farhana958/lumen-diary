/* ═══════════════════════════════════════════════════════════
   LUMEN DIARY — Complete Application Logic
   ═══════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'lumenDiary.v2';

/* ─────── DOM helper ─────── */
const $ = (id) => document.getElementById(id);

/* ─────── DOM refs ─────── */
const grid          = $('grid');
const empty         = $('empty');
const statEntries   = $('statEntries');
const statWords     = $('statWords');
const searchInput   = $('search');
const btnNew        = $('btnNew');
const btnEmptyNew   = $('btnEmptyNew');

const editorOverlay  = $('editorOverlay');
const editorTitle    = $('editorTitle');
const editorDate     = $('editorDate');
const inputTitle     = $('inputTitle');
const inputContent   = $('inputContent');
const moodRow        = $('moodRow');
const btnSave        = $('btnSave');
const btnCancel      = $('btnCancel');
const btnCloseEditor = $('btnCloseEditor');
const metaDate       = $('metaDate');
const metaChars      = $('metaChars');
const metaWords      = $('metaWords');

const viewOverlay   = $('viewOverlay');
const viewMood      = $('viewMood');
const viewTitle     = $('viewTitle');
const viewDate      = $('viewDate');
const viewContent   = $('viewContent');
const btnFav        = $('btnFav');
const btnEdit       = $('btnEdit');
const btnShare      = $('btnShare');
const btnDelete     = $('btnDelete');
const btnCloseView  = $('btnCloseView');

const deleteOverlay    = $('deleteOverlay');
const btnDeleteCancel  = $('btnDeleteCancel');
const btnDeleteConfirm = $('btnDeleteConfirm');

const toast = $('toast');

/* ─────── STATE ─────── */
let entries = [];
let editingId = null;
let viewingId = null;
let pendingDeleteId = null;
let currentFilter = 'all';
let currentQuery = '';

/* ═══════════════════════════════════════════════════════════
   STORAGE
   ═══════════════════════════════════════════════════════════ */
function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Load failed:', err);
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.error('Save failed:', err);
    showToast('Failed to save', 'error');
  }
}

/* ═══════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════ */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(ts, withTime = false) {
  const opts = {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  };
  if (withTime) {
    opts.hour = '2-digit';
    opts.minute = '2-digit';
  }
  return new Date(ts).toLocaleString(undefined, opts);
}

function showToast(msg, type = 'success') {
  toast.textContent = msg;
  toast.className = 'toast ' + type;
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 2400);
}

function countWords(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/* ═══════════════════════════════════════════════════════════
   RENDER
   ═══════════════════════════════════════════════════════════ */
function getVisible() {
  let list = [...entries];
  if (currentFilter === 'favorites') list = list.filter(e => e.favorite);
  if (currentQuery) {
    const q = currentQuery.toLowerCase();
    list = list.filter(e =>
      (e.title || '').toLowerCase().includes(q) ||
      (e.content || '').toLowerCase().includes(q)
    );
  }
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

function render() {
  // Stats
  statEntries.textContent = entries.length;
  const totalWords = entries.reduce((s, e) => s + countWords(e.content || ''), 0);
  statWords.textContent = totalWords;

  // Empty state
  if (entries.length === 0) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  const visible = getVisible();

  if (visible.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--ink-faint);">
        <p style="font-size:1.05rem;">No entries match your search.</p>
      </div>`;
    return;
  }

  grid.innerHTML = visible.map(entry => {
    const mood = entry.mood ? `<div class="card-mood">${entry.mood}</div>` : '';
    const title = escapeHTML(entry.title || 'Untitled');
    const body = escapeHTML(entry.content || '');
    const fav = entry.favorite;

    return `
      <article class="card" data-id="${entry.id}" tabindex="0">
        ${mood}
        <h3 class="card-title">${title}</h3>
        <div class="card-date">📅 ${formatDate(entry.createdAt)}</div>
        <p class="card-body">${body || '<em>No content</em>'}</p>
        <div class="card-actions">
          <button class="round-btn ${fav ? 'starred' : ''}" data-act="fav" data-id="${entry.id}" title="Favorite">${fav ? '★' : '☆'}</button>
          <button class="round-btn" data-act="share" data-id="${entry.id}" title="Share">🔗</button>
          <button class="round-btn danger" data-act="del" data-id="${entry.id}" title="Delete">🗑️</button>
        </div>
      </article>
    `;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════
   EDITOR
   ═══════════════════════════════════════════════════════════ */
function openEditor(id = null) {
  editingId = id;

  if (id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    editorTitle.textContent = 'Edit Entry';
    inputTitle.value = entry.title || '';
    inputContent.value = entry.content || '';
    editorDate.textContent = 'Created ' + formatDate(entry.createdAt, true);
    metaDate.textContent = formatDate(entry.createdAt);
    btnCancel.hidden = false;

    [...moodRow.children].forEach(b =>
      b.classList.toggle('selected', b.dataset.mood === entry.mood)
    );
  } else {
    editorTitle.textContent = 'New Entry';
    inputTitle.value = '';
    inputContent.value = '';
    const now = Date.now();
    editorDate.textContent = formatDate(now, true);
    metaDate.textContent = 'Today';
    btnCancel.hidden = true;
    [...moodRow.children].forEach(b => b.classList.remove('selected'));
  }

  updateCounters();
  editorOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => inputTitle.focus(), 100);
}

function closeEditor() {
  editorOverlay.hidden = true;
  document.body.style.overflow = '';
  editingId = null;
}

function updateCounters() {
  const text = inputContent.value;
  metaChars.textContent = text.length;
  metaWords.textContent = countWords(text);
}

function saveEntry() {
  const title = inputTitle.value.trim();
  const content = inputContent.value.trim();
  const mood = [...moodRow.children].find(b => b.classList.contains('selected'))?.dataset.mood || '';

  if (!title && !content) {
    showToast('Write something first ✍️', 'error');
    inputTitle.focus();
    return;
  }

  const finalTitle = title || 'Untitled';

  if (editingId) {
    const idx = entries.findIndex(e => e.id === editingId);
    if (idx === -1) { closeEditor(); return; }
    Object.assign(entries[idx], {
      title: finalTitle,
      content,
      mood,
      updatedAt: Date.now()
    });
    showToast('Entry updated ✓');
  } else {
    entries.push({
      id: uid(),
      title: finalTitle,
      content,
      mood,
      favorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    showToast('Entry saved ✓');
  }

  persist();
  render();
  closeEditor();
}

/* ═══════════════════════════════════════════════════════════
   VIEW
   ═══════════════════════════════════════════════════════════ */
function openView(id) {
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  viewingId = id;
  viewMood.textContent = entry.mood || '';
  viewTitle.textContent = entry.title || 'Untitled';
  viewDate.textContent = 'Created ' + formatDate(entry.createdAt, true);
  viewContent.textContent = entry.content || '';
  btnFav.textContent = entry.favorite ? '★' : '☆';
  btnFav.classList.toggle('starred', !!entry.favorite);
  viewOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeView() {
  viewOverlay.hidden = true;
  document.body.style.overflow = '';
  viewingId = null;
}

/* ═══════════════════════════════════════════════════════════
   FAVORITE / SHARE / DELETE
   ═══════════════════════════════════════════════════════════ */
function toggleFavorite(id) {
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  entry.favorite = !entry.favorite;
  persist();
  render();
  if (viewingId === id) {
    btnFav.textContent = entry.favorite ? '★' : '☆';
    btnFav.classList.toggle('starred', entry.favorite);
  }
  showToast(entry.favorite ? '⭐ Favorited' : 'Removed from favorites');
}

async function shareEntry(id) {
  const entry = entries.find(e => e.id === id);
  if (!entry) return;

  const text = `${entry.mood ? entry.mood + ' ' : ''}${entry.title}\n\n${entry.content}\n\n— from my Lumen diary`;

  if (navigator.share) {
    try {
      await navigator.share({ title: entry.title, text });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast('📋 Copied to clipboard');
  } catch {
    prompt('Copy your entry:', text);
  }
}

function askDelete(id) {
  pendingDeleteId = id;
  deleteOverlay.hidden = false;
}

function confirmDelete() {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;
  entries = entries.filter(e => e.id !== id);
  persist();
  render();
  if (viewingId === id) closeView();
  if (editingId === id) closeEditor();
  pendingDeleteId = null;
  deleteOverlay.hidden = true;
  showToast('Entry deleted');
}

/* ═══════════════════════════════════════════════════════════
   EVENTS
   ═══════════════════════════════════════════════════════════ */
btnNew.addEventListener('click', () => openEditor(null));
btnEmptyNew.addEventListener('click', () => openEditor(null));

btnSave.addEventListener('click', saveEntry);
btnCancel.addEventListener('click', closeEditor);
btnCloseEditor.addEventListener('click', closeEditor);
inputContent.addEventListener('input', updateCounters);

moodRow.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const wasSelected = btn.classList.contains('selected');
  [...moodRow.children].forEach(b => b.classList.remove('selected'));
  if (!wasSelected) btn.classList.add('selected');
});

editorOverlay.addEventListener('click', (e) => {
  if (e.target === editorOverlay) closeEditor();
});

grid.addEventListener('click', (e) => {
  const actionBtn = e.target.closest('button[data-act]');
  if (actionBtn) {
    e.stopPropagation();
    const { act, id } = actionBtn.dataset;
    if (act === 'fav') toggleFavorite(id);
    if (act === 'share') shareEntry(id);
    if (act === 'del') askDelete(id);
    return;
  }
  const card = e.target.closest('.card');
  if (card) openView(card.dataset.id);
});

grid.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    const card = e.target.closest('.card');
    if (card) {
      e.preventDefault();
      openView(card.dataset.id);
    }
  }
});

btnCloseView.addEventListener('click', closeView);
viewOverlay.addEventListener('click', (e) => {
  if (e.target === viewOverlay) closeView();
});
btnFav.addEventListener('click', () => viewingId && toggleFavorite(viewingId));
btnEdit.addEventListener('click', () => {
  if (viewingId) {
    const id = viewingId;
    closeView();
    openEditor(id);
  }
});
btnShare.addEventListener('click', () => viewingId && shareEntry(viewingId));
btnDelete.addEventListener('click', () => {
  if (viewingId) {
    const id = viewingId;
    closeView();
    askDelete(id);
  }
});

btnDeleteCancel.addEventListener('click', () => {
  pendingDeleteId = null;
  deleteOverlay.hidden = true;
});
btnDeleteConfirm.addEventListener('click', confirmDelete);
deleteOverlay.addEventListener('click', (e) => {
  if (e.target === deleteOverlay) {
    pendingDeleteId = null;
    deleteOverlay.hidden = true;
  }
});

searchInput.addEventListener('input', (e) => {
  currentQuery = e.target.value.trim();
  render();
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentFilter = chip.dataset.filter;
    render();
  });
});

document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === 'Escape') {
    if (!deleteOverlay.hidden) {
      pendingDeleteId = null;
      deleteOverlay.hidden = true;
      return;
    }
    if (!viewOverlay.hidden) return closeView();
    if (!editorOverlay.hidden) return closeEditor();
  }
  if (mod && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
  if (mod && e.key.toLowerCase() === 's' && !editorOverlay.hidden) {
    e.preventDefault();
    saveEntry();
  }
  if (mod && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    openEditor(null);
  }
});

/* ═══════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════ */
function seed() {
  entries.push({
    id: uid(),
    title: 'Welcome to Lumen ✨',
    content:
      'This is your private sanctuary. Everything stays on your device.\n\n' +
      'Tips:\n' +
      '• Click "New Entry" to write\n' +
      '• Pick a mood emoji ✨\n' +
      '• Star ⭐ entries to find them later\n' +
      '• Share 🔗 copies the entry to your clipboard\n' +
      '• Search or filter by favorites\n\n' +
      'Now close this and write your first real thought.',
    mood: '✨',
    favorite: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  persist();
}

function init() {
  entries = loadEntries();
  if (!entries.length) seed();
  render();
}

init();