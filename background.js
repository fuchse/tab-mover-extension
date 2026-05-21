chrome.action.onClicked.addListener(tab => {
  injectOverlay(tab);
});

chrome.commands.onCommand.addListener(async command => {
  if (command !== 'open-tab-mover') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await injectOverlay(tab);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleOverlayMessage(message, sender)
    .then(sendResponse)
    .catch(error => {
      console.error(error);
      sendResponse({ ok: false, error: error.message || 'Unexpected error' });
    });

  return true;
});

async function injectOverlay(tab) {
  if (!tab?.id || !canInjectIntoUrl(tab.url)) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
  } catch (error) {
    console.error('Unable to open Tab Mover overlay:', error);
  }
}

function canInjectIntoUrl(url = '') {
  return /^https?:\/\//.test(url) || /^file:\/\//.test(url);
}

async function handleOverlayMessage(message, sender) {
  const tab = sender.tab;
  if (!tab?.id) {
    throw new Error('No active tab found');
  }

  switch (message?.type) {
    case 'TAB_MOVER_GET_STATE':
      return getOverlayState(tab);
    case 'TAB_MOVER_MOVE_TO_GROUP':
      await moveToGroup(tab, message.groupId, message.windowId);
      return { ok: true };
    case 'TAB_MOVER_MOVE_TO_WINDOW':
      await moveToWindow(tab, message.windowId);
      return { ok: true };
    case 'TAB_MOVER_UNGROUP':
      await chrome.tabs.ungroup(tab.id);
      return { ok: true };
    case 'TAB_MOVER_CREATE_GROUP':
      await createGroupAndMove(tab, message.title, message.color);
      return { ok: true };
    case 'TAB_MOVER_OPEN_NEW_WINDOW':
      await chrome.windows.create({ tabId: tab.id });
      return { ok: true };
    default:
      throw new Error('Unknown Tab Mover message');
  }
}

async function getOverlayState(tab) {
  const [groups, windows] = await Promise.all([
    chrome.tabGroups.query({}),
    chrome.windows.getAll({ populate: false, windowTypes: ['normal'] }),
  ]);

  return {
    ok: true,
    currentTab: {
      id: tab.id,
      title: tab.title,
      url: tab.url,
      groupId: tab.groupId,
      windowId: tab.windowId,
    },
    groups,
    windows,
  };
}

async function moveToGroup(tab, groupId, windowId) {
  if (windowId !== tab.windowId) {
    await chrome.tabs.move(tab.id, { windowId, index: -1 });
  }

  await chrome.tabs.group({ tabIds: [tab.id], groupId });
}

async function moveToWindow(tab, windowId) {
  await chrome.tabs.move(tab.id, { windowId, index: -1 });
  await chrome.windows.update(windowId, { focused: true });
}

async function createGroupAndMove(tab, title, color) {
  const groupId = await chrome.tabs.group({ tabIds: [tab.id] });

  await chrome.tabGroups.update(groupId, {
    title: title?.trim() || undefined,
    color: color || 'blue',
  });
}
