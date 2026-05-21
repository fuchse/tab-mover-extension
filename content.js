(function () {
  if (window.__tabMoverOverlay) {
    window.__tabMoverOverlay.toggle();
    return;
  }

  const TAB_GROUP_ID_NONE = -1;
  const GROUP_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
  const COLOR_HEX = {
    grey: '#6b7280',
    blue: '#3b82f6',
    red: '#ef4444',
    yellow: '#eab308',
    green: '#22c55e',
    pink: '#ec4899',
    purple: '#a855f7',
    cyan: '#06b6d4',
    orange: '#f97316',
  };

  let host = null;
  let root = null;
  let state = {
    currentTab: null,
    groups: [],
    windows: [],
    activePanel: 'groups',
    selectedColor: 'blue',
    isGroupFormOpen: false,
    isWindowFormOpen: false,
  };

  window.__tabMoverOverlay = {
    toggle,
    close,
  };

  open();

  async function toggle() {
    if (host?.isConnected) {
      close();
      return;
    }

    await open();
  }

  async function open() {
    mount();
    renderLoading();

    try {
      const response = await sendMessage({ type: 'TAB_MOVER_GET_STATE' });
      state = {
        ...state,
        currentTab: response.currentTab,
        groups: response.groups || [],
        windows: response.windows || [],
        isGroupFormOpen: false,
        isWindowFormOpen: false,
      };
      render();
    } catch (error) {
      renderError(error.message || 'Unable to load Tab Mover');
    }
  }

  function close() {
    host?.remove();
  }

  function mount() {
    if (host?.isConnected) return;

    host = document.createElement('div');
    host.id = 'tab-mover-overlay-host';
    root = host.attachShadow({ mode: 'open' });
    root.addEventListener('keydown', handleRootKeydown);
    document.documentElement.appendChild(host);
  }

  function renderLoading() {
    root.innerHTML = `
      <style>${styles()}</style>
      <div class="backdrop" part="backdrop">
        <section class="launcher" role="dialog" aria-modal="true" aria-label="Tab Mover">
          ${headerMarkup('Loading...')}
          <div class="loading">Loading tabs and groups...</div>
        </section>
      </div>
    `;
  }

  function renderError(message) {
    root.innerHTML = `
      <style>${styles()}</style>
      <div class="backdrop" part="backdrop">
        <section class="launcher" role="dialog" aria-modal="true" aria-label="Tab Mover">
          ${headerMarkup('Unavailable')}
          <div class="empty">${escapeHtml(message)}</div>
        </section>
      </div>
    `;
    bindGlobalEvents();
  }

  function render() {
    const title = state.currentTab?.title || state.currentTab?.url || 'Current tab';
    root.innerHTML = `
      <style>${styles()}</style>
      <div class="backdrop" part="backdrop">
        <section class="launcher" role="dialog" aria-modal="true" aria-label="Tab Mover">
          ${headerMarkup(title)}
          <div class="tab-nav">
            <button class="tab-btn ${state.activePanel === 'groups' ? 'active' : ''}" data-panel="groups">
              ${groupsIcon()} Groups
            </button>
            <button class="tab-btn ${state.activePanel === 'windows' ? 'active' : ''}" data-panel="windows">
              ${windowIcon()} Windows
            </button>
          </div>
          <div class="panels">
            <div class="panel ${state.activePanel === 'groups' ? 'active' : ''}" id="groups-panel"></div>
            <div class="panel ${state.activePanel === 'windows' ? 'active' : ''}" id="windows-panel"></div>
          </div>
          <div class="toast" id="toast"></div>
        </section>
      </div>
    `;

    renderGroups();
    renderWindows();
    bindGlobalEvents();
    bindTabEvents();

    const firstAction = root.querySelector('.item:not(.current)');
    firstAction?.focus({ preventScroll: true });
  }

  function headerMarkup(title) {
    return `
      <header class="header">
        <div class="header-icon">${appIcon()}</div>
        <div>
          <div class="eyebrow">Tab Mover</div>
          <div class="subtitle">Move the active tab without leaving the page</div>
        </div>
        <div class="current-tab" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
      </header>
    `;
  }

  function renderGroups() {
    const container = root.getElementById('groups-panel');
    container.innerHTML = '';

    if (state.currentTab && state.currentTab.groupId !== TAB_GROUP_ID_NONE) {
      container.appendChild(makeItem({
        icon: ungroupIcon(),
        label: 'Remove from group',
        meta: 'Current tab',
        onClick: () => runAction('Tab removed from group', {
          type: 'TAB_MOVER_UNGROUP',
        }),
      }));
      container.appendChild(makeDivider());
    }

    if (state.groups.length > 0) {
      container.appendChild(makeLabel('Existing groups'));

      state.groups.forEach(group => {
        const dot = document.createElement('span');
        dot.className = 'item-dot';
        dot.style.background = COLOR_HEX[group.color] || COLOR_HEX.grey;

        container.appendChild(makeItem({
          prefix: dot,
          label: group.title || '(unnamed group)',
          meta: `Window ${group.windowId}`,
          isCurrent: state.currentTab?.groupId === group.id,
          onClick: () => runAction('Tab moved to group', {
            type: 'TAB_MOVER_MOVE_TO_GROUP',
            groupId: group.id,
            windowId: group.windowId,
          }),
        }));
      });

      container.appendChild(makeDivider());
    }

    container.appendChild(makeItem({
      icon: plusIcon(),
      label: 'New group...',
      meta: 'Create and move',
      isNew: true,
      onClick: () => {
        state.isGroupFormOpen = true;
        render();
      },
    }));

    if (state.isGroupFormOpen) {
      container.appendChild(makeGroupForm());
    }
  }

  function renderWindows() {
    const container = root.getElementById('windows-panel');
    container.innerHTML = '';

    const otherWindows = state.windows.filter(windowInfo => windowInfo.id !== state.currentTab?.windowId);
    if (otherWindows.length > 0) {
      container.appendChild(makeLabel('Existing windows'));

      otherWindows.forEach(windowInfo => {
        container.appendChild(makeItem({
          icon: windowIcon(),
          label: makeWindowLabel(windowInfo),
          onClick: () => runAction('Tab moved to window', {
            type: 'TAB_MOVER_MOVE_TO_WINDOW',
            windowId: windowInfo.id,
          }),
        }));
      });

      container.appendChild(makeDivider());
    }

    container.appendChild(makeItem({
      icon: plusIcon(),
      label: 'New window...',
      meta: 'Move tab out',
      isNew: true,
      onClick: () => {
        state.isWindowFormOpen = true;
        render();
      },
    }));

    if (state.isWindowFormOpen) {
      container.appendChild(makeWindowForm());
    }
  }

  function makeWindowLabel(windowInfo) {
    const tabs = windowInfo.tabs || [];
    const titleTab = tabs.find(tab => tab.active) || tabs[tabs.length - 1];
    const title = titleTab?.title || titleTab?.url;
    const label = document.createElement('span');

    if (!title || tabs.length <= 1) {
      label.textContent = title || `Window ${windowInfo.id}`;
      return label;
    }

    const otherTabCount = tabs.length - 1;
    const titleEl = document.createElement('span');
    titleEl.className = 'window-title';
    titleEl.textContent = title;
    titleEl.title = title;

    const suffixEl = document.createElement('span');
    suffixEl.className = 'window-suffix';
    suffixEl.textContent = `... and ${otherTabCount} other ${pluralize('tab', otherTabCount)}`;

    label.className = 'window-label';
    label.append(titleEl, suffixEl);
    return label;
  }

  function pluralize(word, count) {
    return count === 1 ? word : `${word}s`;
  }

  function makeGroupForm() {
    const form = document.createElement('form');
    form.className = 'new-form';

    const input = document.createElement('input');
    input.className = 'form-input';
    input.placeholder = 'Group name (optional)';
    input.maxLength = 40;

    const swatches = document.createElement('div');
    swatches.className = 'color-picker';
    GROUP_COLORS.forEach(color => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = `color-swatch ${color === state.selectedColor ? 'selected' : ''}`;
      swatch.title = color;
      swatch.style.background = COLOR_HEX[color];
      swatch.addEventListener('click', () => {
        state.selectedColor = color;
        render();
      });
      swatches.appendChild(swatch);
    });

    const actions = document.createElement('div');
    actions.className = 'form-actions';

    const cancel = makeButton('Cancel', 'ghost');
    cancel.type = 'button';
    cancel.addEventListener('click', () => {
      state.isGroupFormOpen = false;
      render();
    });

    const submit = makeButton('Create & Move', 'primary');
    submit.type = 'submit';

    actions.append(cancel, submit);
    form.append(input, swatches, actions);

    form.addEventListener('submit', event => {
      event.preventDefault();
      runAction('Moved to new group', {
        type: 'TAB_MOVER_CREATE_GROUP',
        title: input.value,
        color: state.selectedColor,
      });
    });

    setTimeout(() => input.focus(), 0);
    return form;
  }

  function makeWindowForm() {
    const form = document.createElement('div');
    form.className = 'new-form';

    const actions = document.createElement('div');
    actions.className = 'form-actions';

    const cancel = makeButton('Cancel', 'ghost');
    cancel.addEventListener('click', () => {
      state.isWindowFormOpen = false;
      render();
    });

    const confirm = makeButton('Open New Window', 'primary');
    confirm.addEventListener('click', () => runAction('Moved to new window', {
      type: 'TAB_MOVER_OPEN_NEW_WINDOW',
    }));

    actions.append(cancel, confirm);
    form.append(actions);
    return form;
  }

  function makeItem({ prefix, icon, label, meta, isCurrent, isNew, onClick }) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `item${isCurrent ? ' current' : ''}${isNew ? ' item-new' : ''}`;

    if (prefix) {
      item.appendChild(prefix);
    } else if (icon) {
      const iconWrap = document.createElement('span');
      iconWrap.className = 'item-icon';
      iconWrap.innerHTML = icon;
      item.appendChild(iconWrap);
    }

    const labelEl = document.createElement('span');
    labelEl.className = 'item-label';
    if (label instanceof Node) {
      labelEl.appendChild(label);
    } else {
      labelEl.textContent = label;
    }
    item.appendChild(labelEl);

    const metaEl = document.createElement('span');
    metaEl.className = isCurrent ? 'item-badge' : 'item-meta';
    metaEl.textContent = isCurrent ? 'here' : meta || '';
    item.appendChild(metaEl);

    if (onClick && !isCurrent) item.addEventListener('click', onClick);
    return item;
  }

  function makeLabel(text) {
    const label = document.createElement('div');
    label.className = 'section-label';
    label.textContent = text;
    return label;
  }

  function makeDivider() {
    const divider = document.createElement('div');
    divider.className = 'divider';
    return divider;
  }

  function makeButton(text, variant) {
    const button = document.createElement('button');
    button.className = `btn btn-${variant}`;
    button.textContent = text;
    return button;
  }

  function bindGlobalEvents() {
    root.querySelector('.backdrop')?.addEventListener('click', event => {
      if (event.target === event.currentTarget) close();
    });
  }

  function handleRootKeydown(event) {
    if (event.key !== 'Escape') return;

    if (state.isGroupFormOpen || state.isWindowFormOpen) {
      state.isGroupFormOpen = false;
      state.isWindowFormOpen = false;
      render();
      return;
    }

    close();
  }

  function bindTabEvents() {
    root.querySelectorAll('.tab-btn').forEach(button => {
      button.addEventListener('click', () => {
        state.activePanel = button.dataset.panel;
        state.isGroupFormOpen = false;
        state.isWindowFormOpen = false;
        render();
      });
    });
  }

  async function runAction(successMessage, message) {
    try {
      await sendMessage(message);
      showToast(successMessage);
      setTimeout(close, 450);
    } catch (error) {
      showToast(error.message || 'Tab Mover failed', true);
    }
  }

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response?.ok) {
          reject(new Error(response?.error || 'Tab Mover failed'));
          return;
        }

        resolve(response);
      });
    });
  }

  function showToast(message, isError = false) {
    const toast = root.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1500);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function styles() {
    return `
      :host {
        all: initial;
        color-scheme: light;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      .backdrop {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(circle at 50% 24%, rgba(255, 255, 255, 0.74), transparent 26%),
          rgba(248, 248, 246, 0.72);
        backdrop-filter: blur(5px) saturate(0.96);
      }

      .launcher {
        position: relative;
        width: min(520px, calc(100vw - 48px));
        max-height: min(500px, calc(100vh - 48px));
        display: flex;
        flex-direction: column;
        overflow: hidden;
        color: #1f2933;
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid rgba(20, 20, 20, 0.06);
        border-radius: 16px;
        box-shadow:
          0 22px 54px rgba(31, 35, 40, 0.14),
          0 4px 14px rgba(31, 35, 40, 0.08),
          inset 0 1px 0 rgba(255, 255, 255, 0.9);
      }

      .header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 15px 17px 13px;
        background: rgba(255, 255, 255, 0.76);
        border-bottom: 1px solid #eeeeec;
      }

      .header-icon {
        width: 26px;
        height: 26px;
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        border: 1px solid #ededeb;
        border-radius: 8px;
        background: #fafafa;
        box-shadow: 0 1px 2px rgba(31, 35, 40, 0.04);
      }

      .header-icon svg {
        width: 14px;
        height: 14px;
        fill: #b7b7b2;
      }

      .eyebrow {
        color: #232323;
        font: 520 13px/1.25 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: -0.01em;
        text-transform: none;
      }

      .subtitle {
        margin-top: 1px;
        color: #9b9b95;
        font: 11px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .current-tab {
        margin-left: auto;
        max-width: 210px;
        overflow: hidden;
        color: #9b9b95;
        font: 11px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-align: right;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .tab-nav {
        display: flex;
        align-self: center;
        gap: 4px;
        margin: 12px 0 2px;
        padding: 3px;
        background: #f4f4f1;
        border: 1px solid #ecece8;
        border-radius: 999px;
      }

      .tab-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        min-width: 96px;
        padding: 5px 11px;
        color: #74746f;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 999px;
        cursor: pointer;
        font: 500 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: -0.01em;
        text-transform: none;
        transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
      }

      .tab-btn svg {
        width: 12px;
        height: 12px;
        fill: none;
        stroke: currentColor;
      }

      .tab-btn:hover,
      .tab-btn.active {
        color: #443a7a;
        background: #fff;
        border-color: #e9e7f7;
        box-shadow: 0 1px 2px rgba(31, 35, 40, 0.04);
      }

      .panels {
        flex: 1;
        min-height: 0;
        padding: 10px 14px 14px;
        overflow-y: auto;
        scrollbar-color: #e4e4df transparent;
        scrollbar-width: thin;
      }

      .panel {
        display: none;
      }

      .panel.active {
        display: block;
      }

      .section-label {
        padding: 8px 6px 6px;
        color: #aaa9a2;
        font: 520 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: -0.01em;
        text-transform: none;
      }

      .item {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 1px 0;
        padding: 10px 11px;
        color: inherit;
        background: transparent;
        border: 0;
        border-radius: 10px;
        cursor: pointer;
        text-align: left;
        transition: background 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease;
      }

      .item:hover,
      .item:focus-visible {
        outline: none;
        background: #f7f7f4;
        box-shadow: inset 0 0 0 1px #eeeeea;
      }

      .item.current {
        cursor: default;
        background: #f6f3ff;
        box-shadow: inset 0 0 0 1px #e7e0ff;
      }

      .item-dot {
        width: 9px;
        height: 9px;
        flex: 0 0 auto;
        border-radius: 999px;
      }

      .item-icon {
        width: 18px;
        height: 18px;
        display: grid;
        place-items: center;
        flex: 0 0 auto;
      }

      .item-icon svg {
        width: 14px;
        height: 14px;
        fill: none;
        stroke: #a5a59f;
      }

      .item-label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        color: #2d2d2b;
        font: 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .window-label {
        display: flex;
        min-width: 0;
      }

      .window-title {
        min-width: 0;
        overflow: hidden;
        text-overflow: clip;
        white-space: nowrap;
      }

      .window-suffix {
        flex: 0 0 auto;
        white-space: nowrap;
      }

      .item-new .item-label,
      .item-new .item-icon svg {
        color: #7c6cfc;
        stroke: #7c6cfc;
      }

      .item-meta,
      .item-badge {
        flex: 0 0 auto;
        color: #aaa9a2;
        font: 10px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .item-badge {
        padding: 2px 6px;
        color: #7b729d;
        background: #f2efff;
        border: 1px solid #e5defb;
        border-radius: 999px;
      }

      .divider {
        height: 1px;
        margin: 8px 6px;
        background: #eeeeea;
      }

      .new-form {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 8px 0 4px;
        padding: 12px;
        background: #fafaf8;
        border: 1px solid #eeeeea;
        border-radius: 12px;
      }

      .form-input {
        width: 100%;
        padding: 10px 11px;
        color: #2d2d2b;
        background: #fff;
        border: 1px solid #e7e7e3;
        border-radius: 11px;
        outline: none;
        font: 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .form-input:focus {
        border-color: #d9d2ff;
        box-shadow: 0 0 0 3px rgba(124, 108, 252, 0.10);
      }

      .color-picker {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }

      .color-swatch {
        width: 18px;
        height: 18px;
        padding: 0;
        border: 2px solid transparent;
        border-radius: 999px;
        cursor: pointer;
      }

      .color-swatch.selected {
        border-color: #2d2d2b;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
      }

      .btn {
        padding: 8px 12px;
        border-radius: 9px;
        cursor: pointer;
        font: 520 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: -0.01em;
      }

      .btn-ghost {
        color: #777771;
        background: #fff;
        border: 1px solid #e7e7e3;
      }

      .btn-primary {
        color: #fff;
        background: #7c6cfc;
        border: 1px solid #7c6cfc;
      }

      .loading,
      .empty {
        padding: 32px 18px;
        color: #8d8c86;
        font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-align: center;
      }

      .toast {
        position: absolute;
        bottom: 14px;
        left: 50%;
        padding: 8px 14px;
        color: #207a48;
        background: rgba(255, 255, 255, 0.98);
        border: 1px solid #e7e7e3;
        border-radius: 999px;
        opacity: 0;
        pointer-events: none;
        transform: translateX(-50%) translateY(12px);
        transition: opacity 0.18s ease, transform 0.18s ease;
        white-space: nowrap;
        box-shadow: 0 8px 24px rgba(31, 35, 40, 0.10);
        font: 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .toast.show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      .toast.error {
        color: #b42318;
      }
    `;
  }

  function appIcon() {
    return '<svg viewBox="0 0 16 16"><path d="M2 3h12v10H2z"/><path d="M2 6h12" stroke="#b7b7b2" stroke-width="1.5" fill="none"/></svg>';
  }

  function groupsIcon() {
    return '<svg viewBox="0 0 16 16" stroke-width="1.5"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6h12"/></svg>';
  }

  function plusIcon() {
    return '<svg viewBox="0 0 16 16" stroke-width="1.5" stroke-linecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>';
  }

  function windowIcon() {
    return '<svg viewBox="0 0 16 16" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="12" height="10" rx="1.5"/><line x1="2" y1="6.5" x2="14" y2="6.5"/></svg>';
  }

  function ungroupIcon() {
    return '<svg viewBox="0 0 16 16" stroke-width="1.5" stroke-linecap="round"><line x1="4" y1="8" x2="12" y2="8"/><line x1="4" y1="5" x2="4" y2="11"/><line x1="12" y1="5" x2="12" y2="11"/></svg>';
  }
})();
