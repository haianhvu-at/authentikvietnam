/* Quand partir au Vietnam — Authentik Vietnam
   Sommaire actif, onglets, valise, mois en cours, météo 7 jours.
   (Menu mobile et bouton « haut de page » : /assets/site/site.js) */
(function () {
  "use strict";

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var TZ = "Asia/Ho_Chi_Minh";

  // Date du jour à Hanoï, au format AAAA-MM-JJ
  function todayVN() {
    var d = new Date(Date.now() + 7 * 3600e3);
    return d.toISOString().slice(0, 10);
  }

  /* ---------- rubrique active dans le sommaire de la page ---------- */
  var subnav = $(".subnav__links");
  var navLinks = $$(".subnav__links a");
  if ("IntersectionObserver" in window && navLinks.length) {
    var byId = {};
    navLinks.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && byId[en.target.id]) {
          navLinks.forEach(function (a) { a.classList.remove("is-active"); });
          var link = byId[en.target.id];
          link.classList.add("is-active");
          // sur mobile, faire défiler le sommaire pour garder la rubrique visible (sans bouger la page)
          if (subnav && subnav.scrollWidth > subnav.clientWidth) {
            var left = link.offsetLeft - subnav.offsetLeft;
            if (left < subnav.scrollLeft || left + link.offsetWidth > subnav.scrollLeft + subnav.clientWidth) {
              subnav.scrollTo({ left: Math.max(0, left - 12), behavior: "smooth" });
            }
          }
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(byId).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  /* ---------- carrousels mobiles : points de pagination ---------- */
  $$("[data-carousel]").forEach(function (track) {
    var items = track.children;
    if (items.length < 2) return;
    var dots = document.createElement("div");
    dots.className = "dots";
    dots.setAttribute("aria-hidden", "true");
    for (var i = 0; i < items.length; i++) dots.appendChild(document.createElement("i"));
    var anchor = track.closest(".table-scroll") || track;
    anchor.parentNode.insertBefore(dots, anchor.nextSibling);
    var update = function () {
      var step = items[1].offsetLeft - items[0].offsetLeft || 1;
      var idx = Math.round(track.scrollLeft / step);
      if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 4) idx = items.length - 1;
      for (var j = 0; j < dots.children.length; j++) dots.children[j].classList.toggle("is-on", j === idx);
    };
    track.addEventListener("scroll", update, { passive: true });
    update();
  });

  /* ---------- mois en cours ---------- */
  var monthNow = Number(todayVN().slice(5, 7)) - 1;
  $$('[data-m="' + monthNow + '"]').forEach(function (el) { el.classList.add("is-now"); });
  var year = $("#year");
  if (year) year.textContent = todayVN().slice(0, 4);

  /* ---------- onglets (clavier compris) ---------- */
  function setupTabs(list, onSelect) {
    var tabs = $$('[role="tab"]', list);
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
      });
      if (focus) tab.focus();
      onSelect(tab.getAttribute("data-region"), tab);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t, false); });
      t.addEventListener("keydown", function (e) {
        var n = null;
        if (e.key === "ArrowRight") n = tabs[(i + 1) % tabs.length];
        if (e.key === "ArrowLeft") n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === "Home") n = tabs[0];
        if (e.key === "End") n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
    return function (region) {
      var t = tabs.filter(function (x) { return x.getAttribute("data-region") === region; })[0];
      if (t) select(t, false);
    };
  }

  var climateList = $('[aria-label="Climat par région"]');
  var liveList = $('[aria-label="Météo par région"]');
  var selectLive = function () {};

  if (climateList) {
    setupTabs(climateList, function (region) {
      $$(".climate__panel").forEach(function (p) { p.hidden = p.id !== "clim-panel-" + region; });
      selectLive(region); // la météo suit la région choisie
    });
  }

  /* ---------- valise ---------- */
  var packState = { region: "nord", season: "dry" };
  $$(".seg").forEach(function (seg) {
    var key = seg.getAttribute("data-seg");
    $$("button", seg).forEach(function (b) {
      b.addEventListener("click", function () {
        $$("button", seg).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        packState[key] = b.getAttribute("data-value");
        var id = packState.region + "-" + packState.season;
        $$(".pack").forEach(function (p) { p.hidden = p.getAttribute("data-pack") !== id; });
      });
    });
  });

  /* ---------- météo 7 jours ---------- */
  var LABELS = {
    clearsky: "Ciel dégagé", fair: "Beau temps", partlycloudy: "Éclaircies", cloudy: "Couvert", fog: "Brouillard",
    lightrainshowers: "Quelques averses", rainshowers: "Averses", heavyrainshowers: "Fortes averses",
    lightrain: "Pluie faible", rain: "Pluie", heavyrain: "Fortes pluies",
    lightsleet: "Grésil", sleet: "Grésil", heavysleet: "Grésil", lightsleetshowers: "Grésil", sleetshowers: "Grésil", heavysleetshowers: "Grésil",
    lightsnow: "Neige", snow: "Neige", heavysnow: "Neige", lightsnowshowers: "Neige", snowshowers: "Neige", heavysnowshowers: "Neige"
  };
  function label(s) {
    if (!s) return "—";
    if (s.indexOf("thunder") > -1) return s.indexOf("heavy") === 0 ? "Orages violents" : "Orages";
    return LABELS[s] || "Nuageux";
  }
  function cat(s) {
    if (!s) return "cloud";
    if (s.indexOf("thunder") > -1) return "storm";
    if (/rain|sleet|snow/.test(s)) return "rain";
    if (s === "fog") return "fog";
    if (s === "cloudy") return "cloud";
    if (s === "partlycloudy") return "partly";
    return "sun";
  }
  function icon(s, extra) {
    var c = cat(s);
    return '<svg class="ico ico--' + c + (extra ? " " + extra : "") + '" role="img" aria-label="' + label(s) + '"><use href="#i-' + c + '"></use></svg>';
  }
  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; });
  }
  var fmtDow = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" });
  var fmtDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  var fmtStamp = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: TZ });
  var fmtTime = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  var live = { data: null, region: "nord", selected: {}, offset: 0, days: [] };
  var chipsEl = $("#live-chips"), daysEl = $("#live-days"), nameEl = $("#live-name"), metaEl = $("#live-meta"), statusEl = $("#live-status"), panelEl = $("#live-panel");

  function renderLive() {
    if (!live.data || !chipsEl) return;
    var list = live.data.regions[live.region] || [];
    var idx = live.selected[live.region] || 0;
    if (idx >= list.length) idx = 0;
    var off = live.offset;

    chipsEl.innerHTML = list.map(function (p, i) {
      var d0 = p.f[off];
      return '<button type="button" class="chip" data-i="' + i + '" aria-pressed="' + (i === idx) + '">' +
        (d0 ? icon(d0.s) : "") + esc(p.name) + (d0 ? " <small>" + d0.hi + "°</small>" : "") + "</button>";
    }).join("");

    var place = list[idx];
    if (!place) { daysEl.innerHTML = ""; return; }
    var f = place.f.slice(off);
    var valid = f.filter(Boolean);
    nameEl.textContent = place.name;
    if (valid.length) {
      var lo = Math.min.apply(null, valid.map(function (d) { return d.lo; }));
      var hi = Math.max.apply(null, valid.map(function (d) { return d.hi; }));
      var wet = valid.filter(function (d) { return d.mm >= 1; }).length;
      metaEl.textContent = "Province de " + place.province + " · " + lo + "–" + hi + " °C · pluie " +
        (wet === 0 ? "peu probable cette semaine" : "attendue " + wet + " jour" + (wet > 1 ? "s" : "") + " sur " + valid.length);
    } else {
      metaEl.textContent = "Province de " + place.province;
    }

    var today = todayVN();
    daysEl.innerHTML = live.days.map(function (day, i) {
      var d = f[i];
      var dt = new Date(day + "T00:00:00Z");
      var dow = day === today ? "Aujourd’hui" : cap(fmtDow.format(dt));
      if (!d) return '<div class="day day--empty"><div class="day__dow">' + dow + '</div><div class="day__date">' + fmtDate.format(dt) + "</div>Données indisponibles</div>";
      return '<div class="day' + (day === today ? " is-today" : "") + '">' +
        '<div class="day__dow">' + dow + "</div>" +
        '<div class="day__date">' + fmtDate.format(dt) + "</div>" +
        '<div class="day__icon">' + icon(d.s) + "</div>" +
        '<div class="day__label">' + label(d.s) + "</div>" +
        '<div class="day__t"><strong>' + d.hi + "°</strong> <span>" + d.lo + "°</span></div>" +
        '<div class="day__rain"><svg class="ico" aria-hidden="true"><use href="#i-drop"></use></svg>' + String(d.mm).replace(".", ",") + " mm</div>" +
        "</div>";
    }).join("");

    $$(".chip", chipsEl).forEach(function (b) {
      b.addEventListener("click", function () {
        live.selected[live.region] = Number(b.getAttribute("data-i"));
        renderLive();
        var c = $('.chip[data-i="' + b.getAttribute("data-i") + '"]', chipsEl);
        if (c) c.focus({ preventScroll: true });
      });
    });
  }

  if (liveList) {
    selectLive = setupTabs(liveList, function (region, tab) {
      live.region = region;
      if (panelEl) panelEl.setAttribute("aria-labelledby", tab.id);
      renderLive();
    });
  }

  function loadMeteo() {
    if (!chipsEl) return;
    fetch("data/meteo.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var today = todayVN();
        var off = data.days.indexOf(today);
        if (off < 0) off = data.days[0] > today ? 0 : data.days.length; // données trop anciennes
        live.data = data;
        live.offset = off;
        live.days = data.days.slice(off);
        var g = new Date(data.generated);
        var stamp = "Prévisions du " + fmtStamp.format(g) + " à " + fmtTime.format(g) + " (heure du Vietnam)";
        var ageH = (Date.now() - Date.parse(data.generated)) / 3600e3;
        statusEl.textContent = stamp;
        statusEl.classList.toggle("is-old", ageH > 36);
        if (!live.days.length) throw new Error("perime");
        renderLive();
      })
      .catch(function () {
        statusEl.textContent = "Prévisions momentanément indisponibles";
        statusEl.classList.add("is-error");
        daysEl.innerHTML = '<p class="live__msg">La météo n’a pas pu être chargée. Nos conseillers vous renseignent volontiers sur <a href="https://wa.me/84912121091">WhatsApp</a>.</p>';
      });
  }
  loadMeteo();
})();
