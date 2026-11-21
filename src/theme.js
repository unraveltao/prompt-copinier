const THEME_MODE_KEY = 'themeMode';
const LEGACY_FORCE_DARK_KEY = 'forceDarkMode';
const THEME_MODES = new Set(['system', 'light', 'dark']);

function readThemeSettings() {
  return new Promise((resolve) => {
    OPMApi.storage.local.get([THEME_MODE_KEY, LEGACY_FORCE_DARK_KEY], resolve);
  });
}

/** Resolve old forceDarkMode data without deleting or rewriting the legacy value. */
export async function getThemeMode() {
  const settings = await readThemeSettings();
  return THEME_MODES.has(settings[THEME_MODE_KEY])
    ? settings[THEME_MODE_KEY]
    : settings[LEGACY_FORCE_DARK_KEY] ? 'dark' : 'system';
}

export async function saveThemeMode(mode) {
  if (!THEME_MODES.has(mode)) throw new Error(`Unsupported theme mode: ${mode}`);
  await new Promise((resolve) => {
    OPMApi.storage.local.set({
      [THEME_MODE_KEY]: mode,
      [LEGACY_FORCE_DARK_KEY]: mode === 'dark',
    }, resolve);
  });
}

export function applyThemeMode(mode, root = document.documentElement) {
  const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const effectiveTheme = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
  root.dataset.themeMode = mode;
  root.dataset.theme = effectiveTheme;
  root.style.colorScheme = effectiveTheme;
  return effectiveTheme;
}

/** Apply the selected mode and keep extension pages in sync with settings and OS changes. */
export async function initializeTheme(onChange = () => {}) {
  let mode = await getThemeMode();
  const apply = () => {
    const effectiveTheme = applyThemeMode(mode);
    onChange(effectiveTheme, mode);
  };
  const refresh = async () => {
    mode = await getThemeMode();
    apply();
  };

  apply();
  const storageListener = (changes, area) => {
    if (area === 'local' && (changes[THEME_MODE_KEY] || changes[LEGACY_FORCE_DARK_KEY])) {
      refresh().catch(console.error);
    }
  };
  OPMApi.storage.onChanged.addListener(storageListener);

  const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
  const mediaListener = () => {
    if (mode === 'system') apply();
  };
  if (mediaQuery?.addEventListener) mediaQuery.addEventListener('change', mediaListener);
  else mediaQuery?.addListener?.(mediaListener);

  return () => {
    OPMApi.storage.onChanged.removeListener(storageListener);
    if (mediaQuery?.removeEventListener) mediaQuery.removeEventListener('change', mediaListener);
    else mediaQuery?.removeListener?.(mediaListener);
  };
}
