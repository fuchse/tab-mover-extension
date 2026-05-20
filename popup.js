// ── Constants ──────────────────────────────────────────────────────────────
const GROUP_COLORS = ['grey','blue','red','yellow','green','pink','purple','cyan','orange'];

const COLOR_HEX = {
  grey:   '#6b7280', blue:   '#3b82f6', red:    '#ef4444',
  yellow: '#eab308', green:  '#22c55e', pink:   '#ec4899',
  purple: '#a855f7', cyan:   '#06b6d4', orange: '#f97316',
};

// ── State ──────────────────────────────────────────────────────────────────
let currentTab       = null;
let allGroups        = [];
let allWindows       = [];
let selectedColor    = 'blue';
let newGroupFormOpen = false;
let newWindowFormOpen = false;

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  document.body.classList.toggle('launcher-mode', isLauncherMode());
  await loadAll();
  setupNavTabs();
  setupGroupForm();
  setupWindowForm();
  setupLauncherKeys();
});

async function loadAll() {
  const [groups, windows] = await Promise.all([
    chrome.tabGroups.query({}),
    chrome.windows.getAll({ populate: false, windowTypes: ['normal'] }),
  ]);
  const targetWindow = await getTargetBrowserWindow(windows);
  const tabs = targetWindow
    ? await chrome.tabs.query({ active: true, windowId: targetWindow.id })
    : [];

  currentTab = tabs[0];
  allGroups  = groups;
  allWindows = windows;

  // Set current tab title
  const titleEl = document.getElementById('current-tab-title');
  if (currentTab) {
    titleEl.textContent = currentTab.title || currentTab.url || 'Current tab';
    titleEl.title = currentTab.title || '';
  } else {
    titleEl.textContent = 'No active tab';
    titleEl.title = '';
  }

  renderGroups();
  renderWindows();
}

function isLauncherMode() {
  return new URLSearchParams(window.location.search).get('launcher') === '1';
}

async function getTargetBrowserWindow(windows) {
  try {
    return await chrome.windows.getLastFocused({
      populate: false,
      windowTypes: ['normal'],
    });
  } catch {
    return windows.find(win => win.focused) || windows[0] || null;
  }
}

function setupLauncherKeys() {
  if (!isLauncherMode()) return;

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (event.target instanceof Element && event.target.closest('.new-form.visible')) return;

    window.close();
  });
}

// ── Nav tabs ───────────────────────────────────────────────────────────────
function setupNavTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`panel-${btn.dataset.panel}`).classList.add('active');
    });
  });
}

// ── Groups rendering ───────────────────────────────────────────────────────
function renderGroups() {
  const container = document.getElementById('groups-content');
  container.innerHTML = '';

  // "No group" / ungroup option (only if tab is currently in a group)
  if (currentTab && currentTab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
    const ungroup = makeItem({
      icon: ungroupIcon(),
      label: 'Remove from group',
      meta: '',
      onClick: async () => { await ungroupCurrentTab(); },
    });
    ungroup.classList.add('item-ungroup');
    container.appendChild(ungroup);
    container.appendChild(makeDivider());
  }

  // Existing groups
  if (allGroups.length > 0) {
    const label = makeLabel('Existing groups');
    container.appendChild(label);

    allGroups.forEach(group => {
      const isCurrent = currentTab && currentTab.groupId === group.id;
      const dot = document.createElement('div');
      dot.className = `item-dot gc-${group.color}`;

      const tabCount = ''; // We'll skip tab count to keep it simple
      const item = makeItem({
        prefix: dot,
        label: group.title || '(unnamed group)',
        meta: `win ${group.windowId}`,
        isCurrent,
        onClick: async () => { await moveToGroup(group.id, group.windowId); },
      });
      container.appendChild(item);
    });

    container.appendChild(makeDivider());
  }

  // New group action
  const newGroupBtn = makeItem({
    icon: plusIcon(),
    label: 'New group…',
    isNew: true,
    onClick: () => toggleNewGroupForm(true),
  });
  container.appendChild(newGroupBtn);
}

// ── Windows rendering ──────────────────────────────────────────────────────
function renderWindows() {
  const container = document.getElementById('windows-content');
  container.innerHTML = '';

  const otherWindows = allWindows.filter(w => w.id !== currentTab?.windowId);

  if (otherWindows.length > 0) {
    container.appendChild(makeLabel('Existing windows'));
    otherWindows.forEach((win, i) => {
      const item = makeItem({
        icon: windowIcon(),
        label: `Window ${i + 1}`,
        meta: `id ${win.id}`,
        onClick: async () => { await moveToWindow(win.id); },
      });
      container.appendChild(item);
    });
    container.appendChild(makeDivider());
  }

  // New window
  const newWinBtn = makeItem({
    icon: plusIcon(),
    label: 'New window…',
    isNew: true,
    onClick: () => toggleNewWindowForm(true),
  });
  container.appendChild(newWinBtn);
}

// ── Group form ─────────────────────────────────────────────────────────────
function setupGroupForm() {
  // Build color swatches
  const picker = document.getElementById('color-picker');
  GROUP_COLORS.forEach(color => {
    const swatch = document.createElement('button');
    swatch.className = `color-swatch gc-${color}${color === selectedColor ? ' selected' : ''}`;
    swatch.title = color;
    swatch.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      selectedColor = color;
    });
    picker.appendChild(swatch);
  });

  document.getElementById('cancel-group').addEventListener('click', () => toggleNewGroupForm(false));
  document.getElementById('confirm-group').addEventListener('click', createGroupAndMove);
  document.getElementById('new-group-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') createGroupAndMove();
    if (e.key === 'Escape') toggleNewGroupForm(false);
  });
}

function toggleNewGroupForm(open) {
  newGroupFormOpen = open;
  document.getElementById('new-group-form').classList.toggle('visible', open);
  if (open) {
    setTimeout(() => document.getElementById('new-group-name').focus(), 50);
  }
}

async function createGroupAndMove() {
  if (!currentTab) return;
  const name = document.getElementById('new-group-name').value.trim();
  const btn = document.getElementById('confirm-group');
  btn.disabled = true;

  try {
    const groupId = await chrome.tabs.group({ tabIds: [currentTab.id] });
    await chrome.tabGroups.update(groupId, {
      title: name || undefined,
      color: selectedColor,
    });
    showToast(`Moved to new group${name ? ` "${name}"` : ''}`);
    setTimeout(() => window.close(), 800);
  } catch (e) {
    console.error(e);
    showToast('Error creating group', true);
    btn.disabled = false;
  }
}

// ── Window form ────────────────────────────────────────────────────────────
function setupWindowForm() {
  document.getElementById('cancel-window').addEventListener('click', () => toggleNewWindowForm(false));
  document.getElementById('confirm-window').addEventListener('click', openNewWindow);
}

function toggleNewWindowForm(open) {
  newWindowFormOpen = open;
  document.getElementById('new-window-form').classList.toggle('visible', open);
}

async function openNewWindow() {
  if (!currentTab) return;
  const btn = document.getElementById('confirm-window');
  btn.disabled = true;
  try {
    await chrome.windows.create({ tabId: currentTab.id });
    showToast('Moved to new window');
    setTimeout(() => window.close(), 800);
  } catch (e) {
    console.error(e);
    showToast('Error opening window', true);
    btn.disabled = false;
  }
}

// ── Move actions ───────────────────────────────────────────────────────────
async function moveToGroup(groupId, windowId) {
  if (!currentTab) return;
  try {
    // If target group is in a different window, move the tab there first
    if (windowId !== currentTab.windowId) {
      await chrome.tabs.move(currentTab.id, { windowId, index: -1 });
    }
    await chrome.tabs.group({ tabIds: [currentTab.id], groupId });
    showToast('Tab moved to group');
    setTimeout(() => window.close(), 800);
  } catch (e) {
    console.error(e);
    showToast('Error moving tab', true);
  }
}

async function moveToWindow(windowId) {
  if (!currentTab) return;
  try {
    await chrome.tabs.move(currentTab.id, { windowId, index: -1 });
    await chrome.windows.update(windowId, { focused: true });
    showToast('Tab moved to window');
    setTimeout(() => window.close(), 800);
  } catch (e) {
    console.error(e);
    showToast('Error moving tab', true);
  }
}

async function ungroupCurrentTab() {
  if (!currentTab) return;
  try {
    await chrome.tabs.ungroup(currentTab.id);
    showToast('Tab removed from group');
    setTimeout(() => window.close(), 800);
  } catch (e) {
    console.error(e);
    showToast('Error removing from group', true);
  }
}

// ── DOM helpers ────────────────────────────────────────────────────────────
function makeItem({ prefix, icon, label, meta, isCurrent, isNew, onClick }) {
  const el = document.createElement('button');
  el.className = `item${isCurrent ? ' current' : ''}${isNew ? ' item-new' : ''}`;

  if (prefix) {
    el.appendChild(prefix);
  } else if (icon) {
    const wrap = document.createElement('div');
    wrap.className = 'item-icon';
    wrap.innerHTML = icon;
    el.appendChild(wrap);
  }

  const labelEl = document.createElement('span');
  labelEl.className = 'item-label';
  labelEl.textContent = label;
  el.appendChild(labelEl);

  if (isCurrent) {
    const badge = document.createElement('span');
    badge.className = 'item-badge';
    badge.textContent = 'here';
    el.appendChild(badge);
  } else if (meta) {
    const metaEl = document.createElement('span');
    metaEl.className = 'item-meta';
    metaEl.textContent = meta;
    el.appendChild(metaEl);
  }

  if (onClick && !isCurrent) el.addEventListener('click', onClick);
  return el;
}

function makeLabel(text) {
  const el = document.createElement('div');
  el.className = 'section-label';
  el.textContent = text;
  return el;
}

function makeDivider() {
  const el = document.createElement('div');
  el.className = 'divider';
  return el;
}

// ── Icons (inline SVG strings) ─────────────────────────────────────────────
function plusIcon() {
  return `<svg viewBox="0 0 16 16" stroke-width="1.5" stroke-linecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>`;
}

function windowIcon() {
  return `<svg viewBox="0 0 16 16" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="12" height="10" rx="1.5"/><line x1="2" y1="6.5" x2="14" y2="6.5"/></svg>`;
}

function ungroupIcon() {
  return `<svg viewBox="0 0 16 16" stroke-width="1.5" stroke-linecap="round"><line x1="4" y1="8" x2="12" y2="8"/><line x1="4" y1="5" x2="4" y2="11"/><line x1="12" y1="5" x2="12" y2="11"/></svg>`;
}

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.color = isError ? 'var(--red)' : 'var(--green)';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}
