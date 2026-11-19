/* PokMira website — country, currency and slogan localization.
   Settings live in assets/locale-config.js. This file only applies them. */
(function () {
  var C = window.POKMIRA_LOCALE;
  if (!C) return;
  var root = document.documentElement;
  var KEY = 'pokmira-country';
  var review = C.showPendingSlogans === true;

  var T = {
    en: {
      title: 'Choose your country',
      hintSuggest: 'Based on your browser settings, we suggest {country}. Confirm it or choose another country.',
      hintNone: 'Pick your country to see examples in your currency.',
      search: 'Search countries or currencies',
      suggested: 'Suggested',
      empty: 'No country matches your search.',
      confirm: 'Confirm',
      later: 'Not now',
      close: 'Close',
      change: 'Change country',
      country: 'Country',
      pending: 'Slogan pending approval (preview only)',
      reviewBar: 'Preview: slogans pending approval are shown.',
      cardCap: 'Example amounts in {cur} for {country}.',
      cardCapNone: 'Example amounts in {cur}.',
      cardCapLB: 'Example amounts in USD and LBP for Lebanon.',
      paidIn: 'Paid in {cur}',
      total: 'Total spent',
      perMonth: ' / mo',
      fxCap: 'Example at {rate} {cur} per {per}. You set the rate and change it whenever you need.',
      perUSD: 'US dollar', perEUR: 'euro'
    },
    ar: {
      title: 'اختار بلدك',
      hintSuggest: 'حسب إعدادات متصفحك، منقترح {country}. أكّد أو اختار بلد تاني.',
      hintNone: 'اختار بلدك لتشوف الأمثلة بعملتك.',
      search: 'فتّش عن بلد أو عملة',
      suggested: 'مقترح',
      empty: 'ما في بلد بيطابق البحث.',
      confirm: 'تأكيد',
      later: 'مش هلّق',
      close: 'سكّر',
      change: 'غيّر البلد',
      country: 'البلد',
      pending: 'الشعار بانتظار الموافقة (معاينة بس)',
      reviewBar: 'معاينة: الشعارات اللي بانتظار الموافقة ظاهرة.',
      cardCap: 'أرقام تجريبية بعملة {country} ({cur}).',
      cardCapNone: 'أرقام تجريبية بالـ {cur}.',
      cardCapLB: 'أرقام تجريبية بالدولار والليرة للبنان.',
      paidInUSD: 'دفعت بالدولار', paidInEUR: 'دفعت باليورو', paidInLBP: 'ودفعت بالليرة',
      paidInLocal: 'ودفعت بالعملة المحلية ({cur})',
      total: 'مجموع المصروف',
      perMonth: ' بالشهر',
      fxCap: 'مثال على سعر {rate} {cur} لل{per}. إنت بتحدّد السعر وبتغيّره ساعة ما بدّك.',
      perUSD: 'دولار', perEUR: 'يورو'
    }
  };

  function L() { return root.lang === 'ar' ? 'ar' : 'en'; }
  function t(key, vars) {
    var s = T[L()][key] || T.en[key] || '';
    if (vars) for (var k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }
  function store(get, k, v) {
    try { return get ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch (e) { return null; }
  }
  function getCountry() { var c = store(true, KEY); return c && C.countries[c] ? c : null; }

  var nameCache = {};
  function cname(cc, lang) {
    lang = lang || L();
    var key = lang + cc;
    if (!nameCache[key]) {
      try { nameCache[key] = new Intl.DisplayNames([lang], { type: 'region' }).of(cc) || cc; }
      catch (e) { nameCache[key] = cc; }
    }
    return nameCache[key];
  }

  // Region from the browser's language settings only (e.g. "ar-SA" -> SA). No location request.
  function suggestCountry() {
    var list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < list.length; i++) {
      var r = null;
      try { r = new Intl.Locale(list[i]).region; } catch (e) {
        var m = /[-_]([A-Za-z]{2})(?:[-_]|$)/.exec(list[i] || ''); r = m && m[1];
      }
      if (r && C.countries[r.toUpperCase()]) return r.toUpperCase();
    }
    return null;
  }

  function marketLang(cc) {
    var l = C.countries[cc][1];
    return C.approvedLanguages.indexOf(l) >= 0 ? l : 'en';
  }
  function market(cc) { return (cc && C.markets && C.markets[cc]) || {}; }
  function localCur(cc) {
    if (!cc) return 'USD';
    var cur = market(cc).primary || C.countries[cc][0];
    return C.exampleRates[cur] ? cur : 'USD';
  }
  function nice(x, sig) { return x ? Number(x.toPrecision(sig)) : 0; }
  function locale(cc) { return L() + '-' + (cc || 'US') + '-u-nu-latn'; }
  function money(v, cur, cc, keepDecimals) {
    var loc = locale(cc), d;
    try { d = new Intl.NumberFormat(loc, { style: 'currency', currency: cur }).resolvedOptions().maximumFractionDigits; }
    catch (e) { d = 2; }
    var f = Number.isInteger(v) ? 0 : keepDecimals ? Math.min(d, 2) : (v >= 100 ? 0 : Math.min(d, 2));
    try {
      var parts = new Intl.NumberFormat(loc, { style: 'currency', currency: cur, minimumFractionDigits: f, maximumFractionDigits: f }).formatToParts(v);
      // Keep Latin symbols like "US$" readable inside Arabic (right-to-left) text
      return parts.map(function (p) {
        return p.type === 'currency' && /[A-Za-z$€£¥]/.test(p.value) ? '\u2066' + p.value + '\u2069' : p.value;
      }).join('');
    } catch (e) { return cur + ' ' + v; }
  }
  function plain(v, cc) {
    try { return new Intl.NumberFormat(locale(cc), { maximumSignificantDigits: 3 }).format(v); } catch (e) { return String(v); }
  }

  // Arabic slogan: market (approved) -> general Arabic (approved) -> English slogan
  function arSlogan(cc) {
    var s = cc && C.slogans[cc];
    if (s && (s.status === 'approved' || review)) return s;
    var g = C.slogans['ar-general'];
    if (g && (g.status === 'approved' || review)) return g;
    return null;
  }

  function each(sel, fn) { var n = document.querySelectorAll(sel); for (var i = 0; i < n.length; i++) fn(n[i]); }
  function setText(id, s) { var el = document.getElementById(id); if (el) el.textContent = s; }

  function render() {
    var cc = getCountry();

    // Slogan (hero, footer, Arabic page title)
    var s = arSlogan(cc);
    var arabicHeadline = 'بوك ميرا تطبيق لمصروفك اليومي.';
    each('[data-l10n="slogan-ar"]', function (el) {
      el.textContent = s ? s.text : arabicHeadline;
    });
    if (document.getElementById('hero-card')) {
      root.setAttribute('data-title-ar', 'بوك ميرا — ' + (s ? s.text.split('،')[0] : arabicHeadline));
      if (L() === 'ar') document.title = root.getAttribute('data-title-ar');
    }
    each('[data-l10n="slogan-tag"]', function (el) {
      el.hidden = !(s && s.status !== 'approved' && L() === 'ar');
      el.textContent = t('pending');
    });

    updateButton(cc);

    // Homepage examples
    if (!document.getElementById('hero-card')) return;
    var m = market(cc), copy = m.copy || 'general';
    each('[data-copy]', function (el) { el.hidden = el.getAttribute('data-copy') !== copy; });

    var cur = localCur(cc), rate = C.exampleRates[cur];
    var lb = copy === 'lb';
    each('[data-usd]', function (el) {
      var usd = Number(el.getAttribute('data-usd'));
      el.textContent = lb || cur === 'USD' ? money(usd, 'USD', cc) : money(nice(usd * rate, 3), cur, cc);
    });
    each('[data-l10n="permonth"]', function (el) { el.textContent = t('perMonth'); });

    var sub = document.getElementById('ph-sub');
    if (sub) {
      sub.hidden = !lb;
      if (lb) sub.textContent = '≈ ' + money(1240 * C.exampleRates[m.secondary], m.secondary, cc);
    }
    setText('card-cap', lb ? t('cardCapLB') : cc ? t('cardCap', { cur: cur, country: cname(cc) }) : t('cardCapNone', { cur: cur }));

    // Two-currency example
    var S, Lc, r, paidL, total, totalCur;
    if (lb) {
      S = 'USD'; Lc = m.secondary; r = C.exampleRates[Lc]; paidL = 250000;
      total = 40 + paidL / r; totalCur = 'USD';
    } else {
      Lc = cur; S = cur === 'USD' ? 'EUR' : 'USD';
      r = nice(C.exampleRates[Lc] / C.exampleRates[S], 3);
      paidL = nice(2.79 * r, 2);
      total = 40 * r + paidL; totalCur = Lc;
    }
    var ar = L() === 'ar';
    setText('fx-s-label', ar ? t(S === 'USD' ? 'paidInUSD' : 'paidInEUR') : t('paidIn', { cur: S }));
    setText('fx-l-label', ar ? (Lc === 'LBP' ? t('paidInLBP') : t('paidInLocal', { cur: Lc })) : t('paidIn', { cur: Lc }));
    setText('fx-t-label', t('total'));
    setText('fx-s-val', money(40, S, cc));
    setText('fx-l-val', money(paidL, Lc, cc));
    setText('fx-t-val', money(Math.round(total * 100) / 100, totalCur, cc, true));
    setText('fx-cap', t('fxCap', { rate: plain(r, cc), cur: Lc, per: t(S === 'USD' ? 'perUSD' : 'perEUR') }));
  }

  // Header button
  var btn;
  function updateButton(cc) {
    if (!btn) return;
    btn.querySelector('.cc-code').textContent = cc || t('country');
    var cur = btn.querySelector('.cc-cur');
    cur.textContent = cc ? C.countries[cc][0] : '';
    cur.hidden = !cc;
    var label = t('change') + (cc ? ': ' + cname(cc) + ', ' + C.countries[cc][0] : '');
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }
  function makeButton() {
    var lang = document.getElementById('langBtn');
    if (!lang) return;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cc-btn';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg><span class="cc-code"></span><span class="cc-cur"></span>';
    btn.addEventListener('click', function () { openDialog(false); });
    lang.parentNode.insertBefore(btn, lang);
  }

  // Country dialog
  var dlg, list, search, ok, empty, firstVisit = false;
  function norm(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  }
  function buildDialog() {
    dlg = document.createElement('dialog');
    dlg.className = 'cc-dialog';
    dlg.setAttribute('aria-labelledby', 'cc-title');
    dlg.innerHTML =
      '<form method="dialog" class="cc-form">' +
      '<div class="cc-head"><h2 id="cc-title"></h2><button type="button" class="cc-x"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<p class="cc-hint" id="cc-hint"></p>' +
      '<input type="search" class="cc-search" autocomplete="off" spellcheck="false">' +
      '<div class="cc-list" role="radiogroup"></div>' +
      '<p class="cc-empty" hidden></p>' +
      '<div class="cc-actions"><button type="button" class="btn btn-ghost cc-later"></button><button type="submit" class="btn btn-primary cc-ok" disabled></button></div>' +
      '</form>';
    document.body.appendChild(dlg);
    list = dlg.querySelector('.cc-list');
    search = dlg.querySelector('.cc-search');
    ok = dlg.querySelector('.cc-ok');
    empty = dlg.querySelector('.cc-empty');

    search.addEventListener('input', filter);
    search.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var vis = list.querySelectorAll('.cc-item:not([hidden]) input');
        if (vis.length === 1) { vis[0].checked = true; ok.disabled = false; }
      }
    });
    list.addEventListener('change', function () { ok.disabled = !list.querySelector('input:checked'); });
    dlg.querySelector('.cc-x').addEventListener('click', dismiss);
    dlg.querySelector('.cc-later').addEventListener('click', dismiss);
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); dismiss(); });
    dlg.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var picked = list.querySelector('input:checked');
      if (!picked) return;
      store(false, KEY, picked.value);
      dlg.close();
      // Country decides the default language; the visitor can switch it afterwards
      if (window.PokMira && window.PokMira.setLang) window.PokMira.setLang(marketLang(picked.value));
      render();
      if (btn) btn.focus();
    });
  }
  function dismiss() {
    try { sessionStorage.setItem('pokmira-country-later', '1'); } catch (e) {}
    dlg.close();
  }
  function filter() {
    var q = norm(search.value.trim()), shown = 0;
    var items = list.querySelectorAll('.cc-item');
    for (var i = 0; i < items.length; i++) {
      var hit = !q || items[i].getAttribute('data-k').indexOf(q) >= 0;
      items[i].hidden = !hit; if (hit) shown++;
    }
    empty.hidden = shown > 0;
  }
  function openDialog(isFirst) {
    if (!dlg) buildDialog();
    firstVisit = isFirst;
    var current = getCountry();
    var sug = current ? null : suggestCountry();
    var selected = current || sug;
    var lang = L();
    dlg.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    dlg.querySelector('#cc-title').textContent = t('title');
    dlg.querySelector('.cc-x').setAttribute('aria-label', t('close'));
    dlg.querySelector('#cc-hint').textContent = sug ? t('hintSuggest', { country: cname(sug) }) : (current ? '' : t('hintNone'));
    dlg.querySelector('#cc-hint').hidden = !sug && !!current;
    search.placeholder = t('search');
    search.setAttribute('aria-label', t('search'));
    list.setAttribute('aria-label', t('title'));
    empty.textContent = t('empty');
    ok.textContent = t('confirm');
    dlg.querySelector('.cc-later').textContent = isFirst ? t('later') : t('close');

    var codes = Object.keys(C.countries).sort(function (a, b) { return cname(a).localeCompare(cname(b), lang); });
    if (selected) codes.splice(codes.indexOf(selected), 1), codes.unshift(selected);
    var html = '';
    codes.forEach(function (cc) {
      var cur = C.countries[cc][0];
      var key = norm([cname(cc, 'en'), cname(cc, 'ar'), cc, cur, (C.aliases && C.aliases[cc]) || ''].join(' '));
      html += '<label class="cc-item" data-k="' + key.replace(/"/g, '') + '">' +
        '<input type="radio" name="cc" value="' + cc + '"' + (cc === selected ? ' checked' : '') + '>' +
        '<span class="cc-name">' + cname(cc) + (cc === sug ? ' <em class="cc-sug">' + t('suggested') + '</em>' : '') + '</span>' +
        '<span class="cc-c">' + cur + '</span></label>';
    });
    list.innerHTML = html;
    search.value = '';
    filter();
    ok.disabled = !selected;
    dlg.showModal();
    list.scrollTop = 0;
    search.focus();
  }

  document.addEventListener('pokmira:lang', function () { render(); });

  document.addEventListener('DOMContentLoaded', function () {
    if (review) {
      var bar = document.createElement('div');
      bar.className = 'review-bar';
      bar.innerHTML = '<span lang="en">' + T.en.reviewBar + '</span><span lang="ar">' + T.ar.reviewBar + '</span>';
      document.body.insertBefore(bar, document.body.firstChild);
    }
    makeButton();
    render();
    var later = false;
    try { later = sessionStorage.getItem('pokmira-country-later') === '1'; } catch (e) {}
    if (!getCountry() && !later) openDialog(true);
  });
})();
