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

  function setLang(lang) {
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    var t = root.getAttribute('data-title-' + lang);
    if (t) document.title = t;
    try { localStorage.setItem('pokmira-lang', lang); } catch (e) {}
  }

  setLang(pickStart());

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('langBtn');
    if (btn) btn.addEventListener('click', function () {
      setLang(root.lang === 'ar' ? 'en' : 'ar');
    });
    var y = document.getElementById('yr');
    if (y) y.textContent = new Date().getFullYear();
  });
})();
