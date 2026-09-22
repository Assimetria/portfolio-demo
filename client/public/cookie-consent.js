// @system — GDPR cookie consent handler (#42948 / #43427).
// Self-contained: creates and injects #cc-banner into the DOM without any
// HTML dependency. Uses the same localStorage key ('cookie_consent') as the
// React CookieConsentBanner component — React checks for #cc-banner presence
// on mount and will NOT render a duplicate while the static banner is visible.
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

  // Already consented — nothing to do.
  var stored = loadConsent();
  if (stored) {
    window.__cookieConsent = stored;
    if (stored === 'all') loadAnalytics();
    return;
  }

  // Build banner element.
  var doc = document;
  var banner = doc.createElement('div');
  banner.id = 'cc-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-live', 'polite');
  banner.setAttribute('aria-label', 'Cookie consent');
  banner.style.cssText = [
    'position:fixed', 'bottom:0', 'left:0', 'right:0', 'z-index:9999',
    'background:#fff', 'border-top:1px solid #e2e8f0',
    'box-shadow:0 -2px 12px rgba(0,0,0,0.08)',
    'padding:1rem 1.5rem',
    "font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif",
    'display:none', 'align-items:center', 'justify-content:center',
    'gap:1rem', 'flex-wrap:wrap', 'font-size:0.875rem', 'color:#475569'
  ].join(';') + ';';

  var text = doc.createElement('p');
  text.style.cssText = 'margin:0;line-height:1.5;flex:1;min-width:200px;';
  text.innerHTML =
    'We use cookies to improve your experience and analyse site usage. ' +
    'Essential cookies are always active. ' +
    '<a href="/cookies" style="color:#64748B;text-decoration:underline;">Cookie Policy</a>';

  var actions = doc.createElement('div');
  actions.style.cssText = 'display:flex;gap:0.5rem;flex-shrink:0;';

  function accept(v) {
    saveConsent(v);
    logConsent(v);
    window.__cookieConsent = v;
    banner.style.display = 'none';
    if (v === 'all') loadAnalytics();
  }

  var btnEssential = doc.createElement('button');
  btnEssential.id = 'cc-essential';
  btnEssential.type = 'button';
  btnEssential.textContent = 'Essential only';
  btnEssential.style.cssText =
    'padding:0.4rem 0.85rem;border-radius:0.5rem;font-size:0.8125rem;font-weight:500;' +
    'cursor:pointer;border:1px solid #e2e8f0;background:#fff;color:#0f172a;font-family:inherit;';
  btnEssential.addEventListener('click', function () { accept('essential'); });

  var btnAccept = doc.createElement('button');
  btnAccept.id = 'cc-accept';
  btnAccept.type = 'button';
  btnAccept.textContent = 'Accept all';
  btnAccept.style.cssText =
    'padding:0.4rem 0.85rem;border-radius:0.5rem;font-size:0.8125rem;font-weight:500;' +
    'cursor:pointer;border:none;background:#64748B;color:#fff;font-family:inherit;';
  btnAccept.addEventListener('click', function () { accept('all'); });

  actions.appendChild(btnEssential);
  actions.appendChild(btnAccept);
  banner.appendChild(text);
  banner.appendChild(actions);

  function init() {
    doc.body.appendChild(banner);
    setTimeout(function () { banner.style.display = 'flex'; }, 600);
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
