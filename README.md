# Tab Mover

A lightweight Chrome extension for moving the active tab into another tab group or window from a keyboard-driven overlay.

## Features

- Open an in-page launcher with the extension icon or keyboard shortcut.
- Move the active tab to an existing tab group.
- Move the active tab to another Chrome window.
- Create a new tab group and move the active tab into it.
- Move the active tab into a new window.
- Search groups and windows with a fuzzy finder.
- Navigate results with the keyboard.
- Use favicons and tab titles to identify destination windows.

## Installation

This extension is currently intended to be loaded unpacked.

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project directory.
5. Reload the extension after making local code changes.

## Usage

Open Tab Mover with:

- macOS: `Command+Shift+Space`
- Windows/Linux: `Ctrl+Shift+Space`
- Or click the extension icon.

The launcher is injected into the active webpage. It will not open on restricted Chrome pages like `chrome://...` or the Chrome Web Store.

## Keyboard Controls

- Type to search across both tab groups and windows.
- `ArrowDown` or `Tab`: move selection down.
- `ArrowUp` or `Shift+Tab`: move selection up.
- `ArrowLeft`: switch to Groups when search is empty.
- `ArrowRight`: switch to Windows when search is empty.
- `Enter`: move the current tab to the selected destination.
- `Shift+Enter`: move the current tab, then focus the destination window and activate the moved tab.
- `Escape`: close the launcher or cancel an open form.

## Notes

- Only open/live Chrome tab groups can be used as destinations. Saved but inactive tab groups are not exposed by Chrome's tab group APIs.
- Collapsed tab groups should still appear as long as they are open in a Chrome window.
- The extension can focus Chrome windows and activate tabs, but it cannot directly switch macOS Spaces or OS-level screens.
- The overlay traps page interactions while open so underlying page shortcuts and clicks do not interfere.

## Permissions

The extension uses:

- `activeTab`: access the current tab when opening the overlay.
- `scripting`: inject the overlay into the current page.
- `tabs`: read and move tabs.
- `tabGroups`: list and update tab groups.
- `windows`: list and focus Chrome windows.

## Project Structure

- `manifest.json`: extension manifest, permissions, icons, and keyboard command.
- `background.js`: service worker for privileged Chrome API actions.
- `content.js`: injected launcher UI and keyboard interaction logic.
- `popup.html` / `popup.js`: legacy popup UI kept in the repo.
- `icons/`: extension icons.
