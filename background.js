const LAUNCHER_WIDTH = 760;
const LAUNCHER_HEIGHT = 620;
const LAUNCHER_URL = 'popup.html?launcher=1';

let launcherWindowId = null;

chrome.action.onClicked.addListener(openLauncherWindow);

chrome.commands.onCommand.addListener(async command => {
  if (command === 'open-tab-mover') {
    await openLauncherWindow();
  }
});

chrome.windows.onRemoved.addListener(windowId => {
  if (windowId === launcherWindowId) {
    launcherWindowId = null;
  }
});

async function openLauncherWindow() {
  const existingLauncher = await getExistingLauncherWindow();
  if (existingLauncher) {
    await chrome.windows.update(existingLauncher.id, { focused: true });
    return;
  }

  const focusedWindow = await getLastFocusedNormalWindow();
  const position = getCenteredPosition(focusedWindow);
  const launcher = await chrome.windows.create({
    url: chrome.runtime.getURL(LAUNCHER_URL),
    type: 'popup',
    focused: true,
    width: LAUNCHER_WIDTH,
    height: LAUNCHER_HEIGHT,
    ...position,
  });

  launcherWindowId = launcher.id;
}

async function getExistingLauncherWindow() {
  if (launcherWindowId === null) return null;

  try {
    return await chrome.windows.get(launcherWindowId);
  } catch {
    launcherWindowId = null;
    return null;
  }
}

async function getLastFocusedNormalWindow() {
  try {
    return await chrome.windows.getLastFocused({
      populate: false,
      windowTypes: ['normal'],
    });
  } catch {
    return null;
  }
}

function getCenteredPosition(windowInfo) {
  if (!windowInfo) return {};

  const { left, top, width, height } = windowInfo;
  if (![left, top, width, height].every(Number.isFinite)) return {};

  return {
    left: Math.round(left + (width - LAUNCHER_WIDTH) / 2),
    top: Math.round(top + (height - LAUNCHER_HEIGHT) / 2),
  };
}
