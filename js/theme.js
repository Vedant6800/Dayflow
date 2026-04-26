/**
 * theme.js — Light/Dark theme toggle
 * Persists preference in localStorage, wires up the toggle button.
 */

const Theme = (() => {
  const KEY = 'dayflow_theme';

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // Update all toggle icons on the page
    document.querySelectorAll('.theme-icon').forEach(el => {
      el.textContent = theme === 'dark' ? '🌙' : '☀️';
    });
    localStorage.setItem(KEY, theme);
  }

  function toggle() {
    const current = localStorage.getItem(KEY) || 'light';
    apply(current === 'dark' ? 'light' : 'dark');
  }

  function init() {
    const saved = localStorage.getItem(KEY) || 'light';
    apply(saved);

    document.querySelectorAll('#theme-toggle').forEach(btn => {
      btn.addEventListener('click', toggle);
    });
  }

  return { init, apply, toggle };
})();

// Auto-init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', Theme.init);
} else {
  Theme.init();
}
