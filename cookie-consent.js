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
        'background:#FFF9E6;border-top:3px solid #FF6D00;' +
        'padding:16px 24px;display:flex;align-items:center;justify-content:space-between;' +
        'flex-wrap:wrap;gap:12px;font-family:Nunito,sans-serif;font-size:14px;color:#333333;' +
        'box-shadow:0 -4px 16px rgba(0,0,0,.12);">' +
        '<span style="flex:1;min-width:220px;line-height:1.5;font-weight:600;">' +
          'We use cookies to understand how students use STAR and improve your experience. ' +
          'See our <a href="/privacy.html" style="color:#FF6D00;text-decoration:underline;font-weight:700;">Privacy Policy</a>.' +
        '</span>' +
        '<div style="display:flex;gap:10px;flex-shrink:0;">' +
          '<button id="cookie-decline" style="' +
            'padding:9px 20px;border-radius:8px;border:2px solid #E0E0E0;' +
            'background:#fff;color:#666666;font-family:Nunito,sans-serif;' +
            'font-size:14px;font-weight:700;cursor:pointer;">' +
            'Decline' +
          '</button>' +
          '<button id="cookie-accept" style="' +
            'padding:9px 20px;border-radius:8px;border:none;' +
            'background:#FF6D00;color:#fff;font-family:Nunito,sans-serif;' +
            'font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 3px 0 #CC5500;">' +
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
