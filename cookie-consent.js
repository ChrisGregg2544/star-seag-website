(function () {
  var GA_ID = 'G-JK4ZG1FSY7';
  var STORAGE_KEY = 'star_cookie_consent';

  function loadGA() {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_ID);
  }

  function hideBanner() {
    var b = document.getElementById('cookie-banner');
    if (b) b.remove();
  }

  function showBanner() {
    var banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.innerHTML =
      '<div style="' +
        'position:fixed;bottom:0;left:0;right:0;z-index:99999;' +
        'background:#0B1F3A;border-top:2px solid #C9A84C;' +
        'padding:16px 24px;display:flex;align-items:center;justify-content:space-between;' +
        'flex-wrap:wrap;gap:12px;font-family:Lato,sans-serif;font-size:14px;color:#fff;' +
        'box-shadow:0 -4px 20px rgba(0,0,0,.4);">' +
        '<span style="flex:1;min-width:220px;line-height:1.5;">' +
          'We use cookies to understand how students use STAR and improve your experience. ' +
          'See our <a href="/privacy.html" style="color:#C9A84C;text-decoration:underline;">Privacy Policy</a>.' +
        '</span>' +
        '<div style="display:flex;gap:10px;flex-shrink:0;">' +
          '<button id="cookie-decline" style="' +
            'padding:9px 20px;border-radius:6px;border:1px solid #C9A84C;' +
            'background:transparent;color:#C9A84C;font-family:Lato,sans-serif;' +
            'font-size:14px;font-weight:700;cursor:pointer;">' +
            'Decline' +
          '</button>' +
          '<button id="cookie-accept" style="' +
            'padding:9px 20px;border-radius:6px;border:none;' +
            'background:#C9A84C;color:#0B1F3A;font-family:Lato,sans-serif;' +
            'font-size:14px;font-weight:900;cursor:pointer;">' +
            'Accept' +
          '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(banner);

    document.getElementById('cookie-accept').addEventListener('click', function () {
      localStorage.setItem(STORAGE_KEY, 'accepted');
      hideBanner();
      loadGA();
    });

    document.getElementById('cookie-decline').addEventListener('click', function () {
      localStorage.setItem(STORAGE_KEY, 'declined');
      hideBanner();
    });
  }

  var consent = localStorage.getItem(STORAGE_KEY);
  if (consent === 'accepted') {
    loadGA();
  } else if (consent !== 'declined') {
    // No choice yet — show banner once DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showBanner);
    } else {
      showBanner();
    }
  }
})();
