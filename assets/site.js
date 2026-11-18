/* PokMira website — language switch (Arabic / English)
   Loaded in <head> so the right language shows before the page paints. */
(function () {
  var root = document.documentElement;

  function pickStart() {
    var q = new URLSearchParams(location.search).get('lang');
    if (q === 'ar' || q === 'en') return q;
    try {
      var saved = localStorage.getItem('pokmira-lang');
      if (saved === 'ar' || saved === 'en') return saved;
    } catch (e) {}
    return (navigator.language || '').toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en';
  }

  // Videos with data-src-en / data-src-ar play the version that matches the language
  function syncVideos(lang) {
    var vids = document.querySelectorAll('video[data-src-' + lang + ']');
    for (var i = 0; i < vids.length; i++) {
      var v = vids[i], src = v.getAttribute('data-src-' + lang);
      if (v.getAttribute('src') !== src) {
        v.setAttribute('src', src);
        v.load();
        if (v.hasAttribute('autoplay')) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      }
    }
  }

  function setLang(lang) {
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    var t = root.getAttribute('data-title-' + lang);
    if (t) document.title = t;
    try { localStorage.setItem('pokmira-lang', lang); } catch (e) {}
    syncVideos(lang);
  }

  setLang(pickStart());

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('langBtn');
    if (btn) btn.addEventListener('click', function () {
      setLang(root.lang === 'ar' ? 'en' : 'ar');
    });
    // Respect people who turned off animations on their device
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('video[autoplay]').forEach(function (v) { v.removeAttribute('autoplay'); v.pause(); });
    }
    syncVideos(root.lang);
    var y = document.getElementById('yr');
    if (y) y.textContent = new Date().getFullYear();
  });
})();
