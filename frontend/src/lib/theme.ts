/**
 * Kurinda - theme (light/dark) persistence.
 *
 * Defaults to light unconditionally (not prefers-color-scheme) - a defense
 * or field demo on an unfamiliar projector should never come up dark just
 * because someone's OS is set to dark mode. Dark is opt-in via ThemeToggle
 * and remembered in localStorage from then on.
 */
const STORAGE_KEY = "kurinda-theme";

export type Theme = "light" | "dark";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function setStoredTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

// Inlined into a blocking <script> in the root layout so the correct class
// is on <html> before first paint - avoids a light->dark (or vice versa)
// flash on load. Kept as a string, not a function reference, since it runs
// outside the React/module graph entirely.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem("${STORAGE_KEY}");
    if (t === "dark") document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;
