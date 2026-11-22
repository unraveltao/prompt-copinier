import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyThemeMode,
  getThemeMode,
  initializeTheme,
  saveThemeMode,
} from '../src/theme.js';

let localData;
let storageListeners;
let mediaQuery;

function setupThemeEnvironment(initialData = {}, systemDark = false) {
  localData = { ...initialData };
  storageListeners = new Set();
  const mediaListeners = new Set();
  mediaQuery = {
    matches: systemDark,
    addEventListener: (_event, listener) => mediaListeners.add(listener),
    removeEventListener: (_event, listener) => mediaListeners.delete(listener),
    change(matches) {
      this.matches = matches;
      mediaListeners.forEach((listener) => listener({ matches }));
    },
  };
  globalThis.window = { matchMedia: () => mediaQuery };
  globalThis.document = {
    documentElement: { dataset: {}, style: {} },
  };
  globalThis.OPMApi = {
    storage: {
      local: {
        get(keys, callback) {
          callback(Object.fromEntries(keys.filter((key) => key in localData).map((key) => [key, localData[key]])));
        },
        set(values, callback) {
          Object.assign(localData, values);
          callback?.();
        },
      },
      onChanged: {
        addListener(listener) { storageListeners.add(listener); },
        removeListener(listener) { storageListeners.delete(listener); },
      },
    },
  };
  return { mediaQuery, mediaListeners };
}

test('legacy forceDarkMode maps true to dark and false or missing to system', async () => {
  setupThemeEnvironment({ forceDarkMode: true });
  assert.equal(await getThemeMode(), 'dark');

  setupThemeEnvironment({ forceDarkMode: false });
  assert.equal(await getThemeMode(), 'system');

  setupThemeEnvironment();
  assert.equal(await getThemeMode(), 'system');
});

test('explicit themeMode takes precedence and saves backward-compatible data', async () => {
  setupThemeEnvironment({ forceDarkMode: true, themeMode: 'light' });
  assert.equal(await getThemeMode(), 'light');

  await saveThemeMode('dark');
  assert.deepEqual(localData, { forceDarkMode: true, themeMode: 'dark' });
  await assert.rejects(saveThemeMode('contrast'), /Unsupported theme mode/);
});

test('system mode resolves against the current OS preference', () => {
  setupThemeEnvironment({}, false);
  const root = { dataset: {}, style: {} };
  assert.equal(applyThemeMode('system', root), 'light');
  mediaQuery.matches = true;
  assert.equal(applyThemeMode('system', root), 'dark');
  assert.equal(root.dataset.themeMode, 'system');
  assert.equal(root.style.colorScheme, 'dark');
});

test('open surfaces update on stored mode changes and OS changes only in system mode', async () => {
  const { mediaQuery: media, mediaListeners } = setupThemeEnvironment({ themeMode: 'system' }, false);
  const updates = [];
  const cleanup = await initializeTheme((theme, mode) => updates.push({ theme, mode }));
  assert.deepEqual(updates.at(-1), { theme: 'light', mode: 'system' });

  media.change(true);
  assert.deepEqual(updates.at(-1), { theme: 'dark', mode: 'system' });

  localData.themeMode = 'light';
  storageListeners.forEach((listener) => listener({ themeMode: { newValue: 'light' } }, 'local'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(updates.at(-1), { theme: 'light', mode: 'light' });

  const count = updates.length;
  media.change(false);
  assert.equal(updates.length, count);

  cleanup();
  assert.equal(storageListeners.size, 0);
  assert.equal(mediaListeners.size, 0);
  assert.equal(media.matches, false);
});
