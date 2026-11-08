// Runs before first paint: applies the cached raw theme setting so a new tab
// never flashes the wrong theme. The app corrects it once settings load.
(function () {
  var raw = 'dark';
  try {
    raw = localStorage.getItem('sb_theme') || 'dark';
  } catch (e) {
    // Storage unavailable: fall back to the default theme.
  }
  if (raw === 'system') {
    raw = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = raw;
})();
