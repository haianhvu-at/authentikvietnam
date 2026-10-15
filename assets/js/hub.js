/* Authentik Vietnam · Hub « Infos pratiques »
   Amélioration progressive : sans JS, tout le contenu reste visible.
   (Menu mobile et bouton « haut de page » : /assets/site/site.js) */
(function () {
  'use strict';
  var doc = document;
  doc.documentElement.classList.add('js');

  /* ---------- Sommaire : replié sur mobile ---------- */
  var toc = doc.querySelector('.toc');
  var mqDesktop = window.matchMedia('(min-width: 981px)');
  function syncToc() { if (toc) toc.open = mqDesktop.matches; }
  syncToc();
  if (mqDesktop.addEventListener) mqDesktop.addEventListener('change', syncToc);
  if (toc) {
    toc.addEventListener('click', function (e) {
      if (e.target.closest('a') && !mqDesktop.matches) toc.open = false;
    });
  }

  /* ---------- Sommaire : rubrique en cours ---------- */
  var tocLinks = Array.prototype.slice.call(doc.querySelectorAll('.toc ol a'));
  if ('IntersectionObserver' in window && tocLinks.length) {
    var byId = {};
    tocLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var current = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var a = byId[en.target.id];
          if (a && a !== current) {
            if (current) { current.classList.remove('is-active'); current.removeAttribute('aria-current'); }
            a.classList.add('is-active');
            a.setAttribute('aria-current', 'location');
            current = a;
          }
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    Object.keys(byId).forEach(function (id) {
      var el = doc.getElementById(id);
      if (el) io.observe(el);
    });
  }

  /* ---------- Horloges (décalage horaire) ---------- */
  var clocks = doc.querySelectorAll('[data-tz]');
  function tzOffsetHours(tz, d) {
    var a = new Date(d.toLocaleString('en-US', { timeZone: tz }));
    var u = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
    return Math.round((a - u) / 36e5);
  }
  function tickClocks() {
    var now = new Date();
    var vn;
    try { vn = tzOffsetHours('Asia/Ho_Chi_Minh', now); } catch (e) { return; }
    Array.prototype.forEach.call(clocks, function (el) {
      var tz = el.getAttribute('data-tz');
      var t = el.querySelector('.clock__time');
      var dEl = el.querySelector('.clock__diff');
      try {
        t.textContent = now.toLocaleTimeString('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
        t.setAttribute('datetime', now.toISOString());
        if (dEl && el.hasAttribute('data-diff')) {
          var diff = vn - tzOffsetHours(tz, now);
          dEl.textContent = 'Le Vietnam a ' + diff + ' h d’avance aujourd’hui';
        }
      } catch (e) { /* fuseau non supporté : on garde le texte statique */ }
    });
  }
  if (clocks.length) { tickClocks(); setInterval(tickClocks, 30000); }

  /* ---------- FAQ : onglets ---------- */
  var tabs = Array.prototype.slice.call(doc.querySelectorAll('.faq-tab'));
  var panels = tabs.map(function (t) { return doc.getElementById(t.getAttribute('aria-controls')); });
  function selectTab(i, focus) {
    tabs.forEach(function (t, k) {
      var on = k === i;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (panels[k]) panels[k].hidden = !on;
    });
    if (focus) tabs[i].focus();
  }
  if (tabs.length) {
    var tablist = doc.querySelector('.faq-tabs');
    if (tablist) tablist.hidden = false;
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { selectTab(i, false); });
      t.addEventListener('keydown', function (e) {
        var n = tabs.length, k = null;
        if (e.key === 'ArrowRight') k = (i + 1) % n;
        else if (e.key === 'ArrowLeft') k = (i - 1 + n) % n;
        else if (e.key === 'Home') k = 0;
        else if (e.key === 'End') k = n - 1;
        if (k !== null) { e.preventDefault(); selectTab(k, true); }
      });
    });
    // Lien direct vers une question (#faq-12) : ouvrir le bon onglet
    var openFromHash = function () {
      var id = location.hash.slice(1);
      var target = id && doc.getElementById(id);
      if (!target || !target.classList.contains('faq-item')) return;
      var panel = target.closest('.faq-panel');
      var idx = panels.indexOf(panel);
      if (idx > -1) selectTab(idx, false);
      target.open = true;
    };
    selectTab(0, false);
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
  }

  /* ---------- FAQ : une seule réponse ouverte par thème ---------- */
  Array.prototype.forEach.call(doc.querySelectorAll('.faq-item'), function (item) {
    item.addEventListener('toggle', function () {
      if (!item.open) return;
      var siblings = item.parentNode.querySelectorAll('.faq-item[open]');
      Array.prototype.forEach.call(siblings, function (s) { if (s !== item) s.open = false; });
    });
  });
})();
