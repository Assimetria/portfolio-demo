// @system — GDPR cookie consent handler for static HTML banner (#42948).
// Shows/hides the #cc-banner element in index.html based on localStorage.
// Uses the same localStorage key ('cookie_consent') as the React
// CookieConsentBanner component — when React hydrates it checks this key
// and will NOT show a duplicate banner.
(function () {
  var KEY = 'cookie_consent';
  var TTL = 365 * 24 * 60 * 60 * 1000;
  function loadConsent() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (!p || !p.ts) return null;
      if (Date.now() - p.ts > TTL) { localStorage.removeItem(KEY); return null; }
      return p.value;
    } catch (e) { return null; }
  }
  function saveConsent(v) {
    try { localStorage.setItem(KEY, JSON.stringify({ value: v, ts: Date.now() })); } catch (e) {}
  }
  function logConsent(v) {
    try {
      fetch('/api/gdpr/consent', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent_value: v })
      }).catch(function () {});
    } catch (e) {}
  }
  function loadAnalytics() {
    // Placeholder: load analytics scripts when user accepts all cookies.
  }
  var stored = loadConsent();
  if (stored) {
    window.__cookieConsent = stored;
    if (stored === 'all') loadAnalytics();
    return;
  }
  var banner = document.getElementById('cc-banner');
  if (!banner) return;
  setTimeout(function () { banner.style.display = 'flex'; }, 600);
  function accept(v) {
    saveConsent(v);
    logConsent(v);
    window.__cookieConsent = v;
    banner.style.display = 'none';
    if (v === 'all') loadAnalytics();
  }
  document.getElementById('cc-essential').addEventListener('click', function () { accept('essential'); });
  document.getElementById('cc-accept').addEventListener('click', function () { accept('all'); });
}());
