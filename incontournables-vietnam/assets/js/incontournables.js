/* =========================================================
   Authentik Vietnam · Incontournables du Vietnam
   Carte filtrable des lieux + onglets des régions + sommaire collant.
   Données : data/places.json (créé chaque jour depuis le Google Sheet par
   scripts/update-places.mjs) et data/carte-vietnam.json (fond de carte Natural Earth,
   archipels Hoàng Sa et Trường Sa rattachés au Vietnam).
   Bibliothèque : d3 v7 (zoom et dessin SVG), chargée avant ce fichier.
   Sans JavaScript, la page reste lisible : la liste des lieux est écrite dans le HTML.
   ========================================================= */
(function () {
"use strict";
var doc = document;
doc.documentElement.classList.add("js");

/* ---------------- onglets des régions ---------------- */
var tabs = [].slice.call(doc.querySelectorAll(".rtab"));
function selectTab(t, focus) {
  tabs.forEach(function (x) {
    var on = x === t;
    x.setAttribute("aria-selected", String(on));
    x.tabIndex = on ? 0 : -1;
    doc.getElementById(x.getAttribute("aria-controls")).hidden = !on;
  });
  if (focus) t.focus();
}
tabs.forEach(function (t, i) {
  t.addEventListener("click", function () { selectTab(t); });
  t.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    selectTab(tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length], true);
  });
});
if (tabs.length) selectTab(tabs[0]);

/* ---------------- « Sur cette page » : rubrique en cours ---------------- */
var links = [].slice.call(doc.querySelectorAll(".subnav__links a"));
if ("IntersectionObserver" in window) {
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      links.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("href") === "#" + e.target.id); });
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  links.forEach(function (a) { var s = doc.querySelector(a.getAttribute("href")); if (s) io.observe(s); });
}

/* ---------------- carte ---------------- */
var mapEl = doc.getElementById("map");
if (!mapEl || !window.d3 || !window.fetch) return;
var d3 = window.d3;
var ART = "https://authentikvietnam.com/";
var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Catégorie du Sheet (colonne O) → groupe « envie » affiché
var CATS = { heritage: "patrimoine", museum: "patrimoine", religious: "temples", nature: "nature", photo_spot: "nature",
  beach_island: "plages", ethnic_village: "villages", craft_village: "artisanat", market_local: "marches", food: "marches", experience: "experiences" };
var GROUPS = [["patrimoine", "Patrimoine & histoire"], ["temples", "Temples & pagodes"], ["nature", "Nature & paysages"], ["plages", "Plages & îles"],
  ["villages", "Villages & rencontres"], ["artisanat", "Artisanat"], ["marches", "Marchés & cuisine"], ["experiences", "Expériences"]];
var CATLABEL = { heritage: "Patrimoine", museum: "Musée", religious: "Temple & pagode", nature: "Nature", photo_spot: "Point de vue", beach_island: "Plage & île",
  ethnic_village: "Village & rencontre", craft_village: "Village d’artisanat", market_local: "Marché", food: "Gastronomie", experience: "Expérience" };
var TAGLABEL = { walking: "Randonnée" };
var col = function (g) { return "var(--c-" + g + ")"; };

// Le top 10 de la page (fixe, validé par l'équipe) : toujours affiché, numéroté
var TOP10 = [
  [1, "Hanoï", "Hanoï", "Nord", "heritage", "night walking", 21.0340, 105.8500, "La capitale millénaire : vieux quartier, temple de la Littérature et cuisine de rue.", "top-10-des-meilleures-choses-a-faire-a-hanoi-vietnam", "../assets/img/vendeuse-fleurs-hanoi-480.webp"],
  [2, "Réserve naturelle de Vân Long", "Ninh Bình", "Nord", "nature", "off_beaten_track", 20.3600, 105.8620, "La plus grande zone humide du delta du fleuve Rouge : barque entre les pitons, oiseaux et langurs de Delacour.", "guide-complet-van-long-ninh-binh", "assets/img/reserve-van-long-barque-480.webp"],
  [3, "Huế", "Huế", "Centre", "heritage", "unesco", 16.4690, 107.5780, "Citadelle, tombeaux royaux et pagodes de l’ancienne capitale impériale des Nguyễn.", "top-10-des-meilleures-choses-a-faire-a-hue-au-vietnam", "assets/img/cite-imperiale-hue-480.webp"],
  [4, "Hô Chi Minh-Ville", "Hô Chi Minh-Ville", "Sud", "heritage", "night", 10.7769, 106.7009, "Marchés, Chợ Lớn, architecture coloniale et cuisine de rue jusque tard.", "10-meilleures-choses-a-faire-ho-chi-minh-ville", "assets/img/cathedrale-notre-dame-saigon-480.webp"],
  [5, "Hà Giang", "Tuyên Quang (ex-Hà Giang)", "Nord", "nature", "walking", 23.2780, 105.3630, "Le plateau de Đồng Văn, le col de Mã Pí Lèng et les villages hmong, tout au nord du pays.", "ha-giang-vietnam-guide-complet", "../assets/img/femme-hmong-ha-giang-480.webp"],
  [6, "Baie de Bái Tử Long", "Quảng Ninh", "Nord", "nature", "off_beaten_track", 20.9500, 107.4500, "Le prolongement nord-est de la baie d’Hạ Long : îlots calcaires, villages flottants et peu de bateaux.", "baie-bai-tu-long-guide-voyage", "assets/img/baie-bai-tu-long-480.webp"],
  [7, "Phong Nha-Kẻ Bàng", "Quảng Trị (ex-Quảng Bình)", "Centre", "nature", "unesco", 17.5900, 106.2830, "Grottes géantes et rivières souterraines dans une jungle karstique classée par l’UNESCO.", "10-choses-a-faire-parc-national-de-phong-nha-ke-bang", "assets/img/grotte-phong-nha-480.webp"],
  [8, "Delta du Mékong", "Vĩnh Long (ex-Bến Tre)", "Sud", "experience", "family", 10.2415, 106.3759, "Canaux, vergers et marchés flottants, à explorer en barque et à vélo.", "10-activites-a-ne-pas-manquer-dans-le-delta-du-mekong", "assets/img/delta-mekong-my-tho-480.webp"],
  [9, "Hội An", "Đà Nẵng (ex-Quảng Nam)", "Centre", "heritage", "unesco night", 15.8770, 108.3260, "Vieille ville UNESCO aux lanternes, campagne à vélo et plage d’An Bàng.", "hoi-an-vietnam-10-activites-a-ne-pas-manquer-a-hoi-an", "assets/img/vieille-ville-hoi-an-480.webp"],
  [10, "Phú Quốc", "An Giang (ex-Kiên Giang)", "Sud", "beach_island", "", 10.2270, 103.9640, "Plages, poivrières et fruits de mer pour finir le voyage en douceur.", "que-faire-a-phu-quoc-et-quoi-visiter", "assets/img/plage-phu-quoc-480.webp"]
].map(function (r) {
  return { id: "top-" + r[0], top: r[0], n: r[1], w: r[2], r: r[3], c: r[4], g: CATS[r[4]], t: r[5] ? r[5].split(" ") : [], lat: r[6], lng: r[7], d: r[8], a: ART + r[9], tour: "", img: r[10], f: 0 };
});
// Zones des onglets « Par région » (pour « Voir sur la carte ») : [lat min, lng min, lat max, lng max]
var ZONES = { delta: [20.1, 105.3, 21.3, 107.8], "nord-ouest": [20.3, 102.9, 22.8, 104.9], "nord-est": [21.6, 104.5, 23.4, 106.9],
  centre: [13.2, 106.0, 17.8, 109.4], plateaux: [11.6, 107.6, 14.6, 108.8], sud: [10.5, 106.0, 11.6, 107.6], mekong: [9.2, 104.9, 10.9, 106.8] };

var GEO, P = [], byId = {}, mk, cl, K = 1;
var S = { region: "all", group: "all", top: false, unesco: false, off: false, tag: null, active: null };
var list = doc.getElementById("plist");
var big = function (d) { return d.top > 0 || d.f === 1; };
var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
var regionOrder = { Nord: 0, Centre: 1, Sud: 2 };
var sortPlaces = function (a) {
  return a.slice().sort(function (x, y) {
    return (y.top > 0) - (x.top > 0) || (x.top - y.top) || (y.f - x.f) || (regionOrder[x.r] - regionOrder[y.r]) || (y.lat - x.lat);
  });
};

Promise.all([
  fetch("data/carte-vietnam.json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }),
  fetch("data/places.json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
]).then(function (res) {
  GEO = res[0];
  var places = (res[1].places || []).map(function (p) {
    return { id: p.id, n: p.n, w: [p.dest, p.pv].filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(" · "),
      r: p.r, c: p.c, g: CATS[p.c] || "experiences", t: p.t || [], lat: p.lat, lng: p.lng, d: p.d, a: p.a || "", tour: p.tour || "", img: p.img || "", f: p.f ? 1 : 0, top: 0 };
  });
  P = TOP10.concat(places);
  P.forEach(function (p) { byId[p.id] = p; });
  init();
}).catch(function () {
  var m = doc.createElement("p");
  m.className = "map__msg";
  m.textContent = "La carte n’a pas pu se charger. La liste des lieux reste disponible à côté.";
  mapEl.appendChild(m);
});

function init() {
  var proj = function (lat, lng) {
    var l = lng * Math.PI / 180, p = lat * Math.PI / 180;
    return [GEO.scale * l + GEO.tx, GEO.ty - GEO.scale * Math.log(Math.tan(Math.PI / 4 + p / 2))];
  };
  P.forEach(function (p) { p.xy = proj(p.lat, p.lng); });
  var VB = { x: GEO.X0, y: GEO.Y0, w: GEO.W, h: GEO.H }, CX = VB.x + VB.w / 2, CY = VB.y + VB.h / 2;

  var svg = d3.select("#svg"), zg = d3.select("#zoomg"), gGeo = d3.select("#geo"), gLab = d3.select("#glabels"),
      gMk = d3.select("#marks"), gCl = d3.select("#clusters");
  GEO.others.forEach(function (o) { gGeo.append("path").attr("class", "land-o").attr("d", o.d); });
  gGeo.append("path").attr("class", "land-vn").attr("d", GEO.vn);
  gGeo.append("path").attr("class", "land-vn").attr("d", GEO.arch);
  // Archipels vietnamiens : îles principales en points, lisibles à toutes les échelles
  var ISL = [[16.83,112.34],[16.53,111.61],[16.45,111.51],[16.46,111.74],[16.45,111.71],[15.78,111.20],[16.05,111.77],[16.67,112.73],[16.98,112.26],[16.97,112.30],[16.95,112.33],[16.04,112.51],
    [8.65,111.92],[9.88,114.33],[11.43,114.33],[11.45,114.30],[10.18,114.36],[10.37,114.48],[10.38,114.36],[11.05,114.28],[10.68,114.42],[8.97,113.69],[7.89,112.92],[8.17,113.30],[8.85,112.25],[8.93,112.35],[10.06,113.85],[9.78,114.37],[7.37,113.84],[9.90,115.53],[9.98,114.65]];
  var gIsl = gGeo.append("g").attr("class", "isl");
  ISL.forEach(function (c) { var xy = proj(c[0], c[1]); gIsl.append("circle").attr("cx", xy[0]).attr("cy", xy[1]); });
  var LBL = [["Archipel Hoàng Sa|(Vietnam)", 17.75, 112.0, "alabel"], ["Archipel Trường Sa|(Vietnam)", 12.35, 113.6, "alabel"],
    ["CHINE", 22.5, 108.8, "glabel"], ["LAOS", 19.4, 102.6, "glabel"], ["CAMBODGE", 12.6, 104.6, "glabel"], ["THAÏLANDE", 15.6, 101.2, "glabel"],
    ["Golfe du Bắc Bộ", 19.6, 107.2, "slabel"], ["Mer de l’Est (Biển Đông)", 14.0, 112.4, "slabel"], ["Golfe de Thaïlande", 9.4, 102.6, "slabel"]];
  LBL.forEach(function (l) {
    var xy = proj(l[1], l[2]);
    var tx = gLab.append("text").attr("class", l[3]).attr("x", xy[0]).attr("y", xy[1]).attr("text-anchor", "middle");
    l[0].split("|").forEach(function (line, i) { tx.append("tspan").attr("x", xy[0]).attr("dy", i ? "1.2em" : 0).text(line); });
  });

  /* ----- marqueurs ----- */
  function drawMarks() {
    mk = gMk.selectAll("g.mk").data(sortPlaces(P).reverse(), function (d) { return d.id; }).join(function (enter) {
      var g = enter.append("g");
      g.append("circle"); g.append("text").attr("class", "n"); g.append("text").attr("class", "l");
      return g;
    })
      .attr("class", function (d) { return "mk" + (big(d) ? " is-top" : ""); })
      .attr("tabindex", 0).attr("role", "button").attr("aria-label", function (d) { return d.n; })
      .on("click", function (e, d) { setActive(d.id, { scroll: true }); })
      .on("keydown", function (e, d) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActive(d.id, { scroll: true }); } });
    mk.select("circle").style("fill", function (d) { return col(d.g); });
    mk.select("text.n").text(function (d) { return d.top ? d.top : (d.f ? "★" : ""); }).style("display", function (d) { return big(d) ? null : "none"; });
    mk.select("text.l").text(function (d) { return d.n; });
  }
  drawMarks();

  var ppu = function () { var r = mapEl.getBoundingClientRect(); return Math.min(r.width / VB.w, r.height / VB.h) || 1; };
  var visible = function () {
    return P.filter(function (p) {
      return (S.region === "all" || p.r === S.region) && (S.group === "all" || p.g === S.group) && (!S.top || p.top > 0) &&
        (!S.unesco || p.t.indexOf("unesco") > -1) && (!S.off || p.t.indexOf("off_beaten_track") > -1) && (!S.tag || p.t.indexOf(S.tag) > -1);
    });
  };

  /* ----- regroupement des points proches (sauf top 10 et lieu sélectionné) ----- */
  var clustered = {};
  function centre(g) { var x = 0, y = 0; g.forEach(function (p) { x += p.xy[0]; y += p.xy[1]; }); return [x / g.length, y / g.length]; }
  function cluster() {
    var u = 1 / (ppu() * K), cell = 30 * u, cells = {};
    clustered = {};
    visible().forEach(function (p) {
      if (p.top || p.id === S.active) return;
      var k = Math.floor(p.xy[0] / cell) + ":" + Math.floor(p.xy[1] / cell);
      (cells[k] = cells[k] || []).push(p);
    });
    // regroupe d'abord par case de 30 px, puis fusionne les groupes voisins (moins de 34 px entre leurs centres)
    var raw = Object.keys(cells).map(function (k) { return cells[k]; }).sort(function (a, b) { return b.length - a.length; });
    var merged = [];
    raw.forEach(function (g) {
      var c = centre(g), m = merged.filter(function (h) { return Math.hypot(h.c[0] - c[0], h.c[1] - c[1]) < 34 * u; })[0];
      if (m) { m.g = m.g.concat(g); m.c = centre(m.g); } else merged.push({ g: g, c: c });
    });
    var groups = merged.map(function (m) { return m.g; }).filter(function (g) { return g.length > 1; });
    groups.forEach(function (g) { g.forEach(function (p) { clustered[p.id] = true; }); });
    // un groupe collé à un numéro du top 10 est décalé en haut à droite pour rester visible
    var tops = visible().filter(function (p) { return p.top; });
    cl = gCl.selectAll("g.cl").data(groups.map(function (g) {
      var x = 0, y = 0; g.forEach(function (p) { x += p.xy[0]; y += p.xy[1]; });
      x /= g.length; y /= g.length;
      if (tops.some(function (t) { return Math.hypot(t.xy[0] - x, t.xy[1] - y) < 22 * u; })) { x += 17 * u; y -= 17 * u; }
      return { n: g.length, x: x, y: y, members: g };
    })).join(function (enter) { var g = enter.append("g").attr("class", "cl"); g.append("circle").attr("class", "halo"); g.append("circle").attr("class", "core"); g.append("text"); return g; })
      .attr("tabindex", 0).attr("role", "button").attr("aria-label", function (d) { return d.n + " lieux : zoomer"; })
      .on("click", function (e, d) { fit(d.members, 160); })
      .on("keydown", function (e, d) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fit(d.members, 160); } });
    cl.select("text").text(function (d) { return d.n; });
    var ids = {}; visible().forEach(function (p) { ids[p.id] = 1; });
    mk.style("display", function (d) { return ids[d.id] && !clustered[d.id] ? null : "none"; });
    sizeMarks();
  }

  function sizeMarks() {
    var u = 1 / (ppu() * K);
    mk.attr("transform", function (d) { return "translate(" + d.xy[0] + "," + d.xy[1] + ")"; });
    mk.select("circle").attr("r", function (d) { return (big(d) ? 11 : 6.5) * u * (d.id === S.active ? 1.35 : 1); });
    mk.select("text.n").attr("font-size", 11.5 * u);
    mk.select("text.l").attr("font-size", 12.5 * u).attr("x", function (d) { return (big(d) ? 15 : 10) * u; }).attr("dy", 4.2 * u).style("stroke-width", 3.5 * u)
      .style("display", function (d) { return (d.id === S.active || (d.top && ppu() * K > 0.95) || (d.f && ppu() * K > 1.8) || ppu() * K > 3.2) ? null : "none"; });
    if (cl) {
      cl.attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });
      var rc = function (d) { return d.n > 99 ? 16.5 : d.n > 9 ? 14 : 12; };
      cl.select("circle.core").attr("r", function (d) { return rc(d) * u; });
      cl.select("circle.halo").attr("r", function (d) { return (rc(d) + 4.5) * u; });
      cl.select("text").attr("font-size", 12 * u);
    }
    gLab.selectAll("text").attr("font-size", function () {
      return (this.classList.contains("slabel") ? 13 : this.classList.contains("alabel") ? 11.5 : 11) / (ppu() * K);
    });
    gIsl.selectAll("circle").attr("r", 1.9 * u);
    // étiquettes qui se chevauchent : on garde le lieu choisi, puis le top 10 et les coups de cœur
    var placed = [];
    mk.filter(function () { return this.style.display !== "none"; }).select("text.l")
      .filter(function () { return this.style.display !== "none"; }).nodes()
      .map(function (n) { return { n: n, d: d3.select(n).datum() }; })
      .sort(function (a, b) { return (b.d.id === S.active) - (a.d.id === S.active) || big(b.d) - big(a.d) || (a.d.top || 99) - (b.d.top || 99); })
      .forEach(function (o) {
        var d = o.d, x0 = d.xy[0] + (big(d) ? 15 : 10) * u, w = d.n.length * 6.6 * u, y0 = d.xy[1] - 7 * u, y1 = d.xy[1] + 7 * u;
        var hit = placed.some(function (r) { return !(x0 + w < r[0] || x0 > r[2] || y1 < r[1] || y0 > r[3]); });
        if (hit && d.id !== S.active) o.n.style.display = "none"; else placed.push([x0, y0, x0 + w, y1]);
      });
  }

  var zoom = d3.zoom().scaleExtent([1, 160]).translateExtent([[VB.x - 300, VB.y - 200], [VB.x + VB.w + 300, VB.y + VB.h + 200]])
    .on("zoom", function (e) { zg.attr("transform", e.transform); K = e.transform.k; sizeMarks(); })
    .on("end", function () { cluster(); });
  svg.call(zoom).on("dblclick.zoom", null);
  var dur = function (ms) { return reduce ? 0 : ms; };
  doc.getElementById("zin").addEventListener("click", function () { svg.transition().duration(dur(300)).call(zoom.scaleBy, 1.8); });
  doc.getElementById("zout").addEventListener("click", function () { svg.transition().duration(dur(300)).call(zoom.scaleBy, 1 / 1.8); });
  doc.getElementById("zfit").addEventListener("click", function () { svg.transition().duration(dur(500)).call(zoom.transform, d3.zoomIdentity); });

  function fitXY(xs, ys, maxK) {
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var r = mapEl.getBoundingClientRect(), u = ppu(), visW = r.width / u, visH = r.height / u;
    var k = Math.min(visW * 0.78 / Math.max(x1 - x0, 6), visH * 0.78 / Math.max(y1 - y0, 6));
    k = Math.max(1, Math.min(k, maxK || 14));
    svg.transition().duration(dur(650)).call(zoom.transform, d3.zoomIdentity.translate(CX - k * (x0 + x1) / 2, CY - k * (y0 + y1) / 2).scale(k));
  }
  function fit(points, maxK) {
    if (!points.length) return;
    fitXY(points.map(function (p) { return p.xy[0]; }), points.map(function (p) { return p.xy[1]; }), maxK);
  }
  function fitBox(b, maxK) { var a = proj(b[0], b[1]), c = proj(b[2], b[3]); fitXY([a[0], c[0]], [a[1], c[1]], maxK); }
  function panTo(p) {
    var t = d3.zoomTransform(svg.node()), r = mapEl.getBoundingClientRect(), u = ppu();
    var sx = t.k * p.xy[0] + t.x, sy = t.k * p.xy[1] + t.y, visW = r.width / u, visH = r.height / u, left = CX - visW / 2, top = CY - visH / 2, m = 0.12;
    if (sx < left + visW * m || sx > left + visW * (1 - m) || sy < top + visH * m || sy > top + visH * (1 - m))
      svg.transition().duration(dur(450)).call(zoom.translateBy, (CX - sx) / t.k, (CY - sy) / t.k);
  }

  /* ----- liste des lieux ----- */
  var PH = '<span class="ph-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg></span>';
  var tagHtml = function (p) {
    return (p.top ? '<span class="tag tag--t">Top ' + p.top + "</span>" : (p.f ? '<span class="tag tag--t">Coup de cœur</span>' : "")) +
      (p.t.indexOf("unesco") > -1 ? '<span class="tag tag--u">UNESCO</span>' : "") +
      (p.t.indexOf("off_beaten_track") > -1 ? '<span class="tag tag--o">Hors des sentiers battus</span>' : "");
  };
  function renderList(vis) {
    doc.getElementById("count").textContent = vis.length;
    if (!vis.length) { list.innerHTML = '<li class="empty">Aucun lieu ne correspond à ces filtres. Touchez « Tout afficher » pour repartir de zéro.</li>'; return; }
    list.innerHTML = sortPlaces(vis).map(function (p) {
      return '<li><article class="pcard" data-id="' + esc(p.id) + '" tabindex="0" style="--pc:' + col(p.g) + '">' +
        '<div class="pcard__img">' + (p.img ? '<img src="' + esc(p.img) + '" alt="" loading="lazy" decoding="async" width="76" height="76">' : PH) + "</div>" +
        '<div class="pcard__body"><span class="pcard__cat"><i></i>' + esc(CATLABEL[p.c] || "") + "</span>" +
        '<p class="pcard__t">' + esc(p.n) + '</p><span class="pcard__w">' + esc(p.w) + " · " + esc(p.r) + "</span>" +
        '<p class="pcard__d">' + esc(p.d) + "</p>" +
        '<div class="pcard__tags">' + tagHtml(p) + "</div>" +
        '<div class="pcard__links">' + (p.a ? '<a href="' + esc(p.a) + '" target="_blank" rel="noopener">Lire le guide</a>' : "") +
        '<a href="' + esc(p.tour || ART + "circuit-vietnam") + '" target="_blank" rel="noopener">' + (p.tour ? "Le circuit" : "Circuits") + "</a>" +
        '<a href="https://www.google.com/maps/search/?api=1&amp;query=' + p.lat + "," + p.lng + '" target="_blank" rel="noopener">Google Maps</a></div>' +
        "</div></article></li>";
    }).join("");
  }
  list.addEventListener("click", function (e) {
    if (e.target.closest("a")) return;
    var c = e.target.closest(".pcard"); if (c) setActive(c.dataset.id, { zoom: true });
  });
  list.addEventListener("keydown", function (e) {
    var c = e.target.closest(".pcard"); if (c && e.key === "Enter" && !e.target.closest("a")) setActive(c.dataset.id, { zoom: true });
  });
  // mobile : la carte suit la fiche affichée dans le carrousel
  var st, narrow = function () { return window.matchMedia("(max-width:980px)").matches; };
  list.addEventListener("scroll", function () {
    if (!narrow()) return;
    clearTimeout(st);
    st = setTimeout(function () {
      var r = list.getBoundingClientRect(), mid = r.left + r.width / 2, best = null, bd = 1e9;
      list.querySelectorAll(".pcard").forEach(function (c) { var b = c.getBoundingClientRect(), d = Math.abs(b.left + b.width / 2 - mid); if (d < bd) { bd = d; best = c; } });
      if (best && best.dataset.id !== S.active) setActive(best.dataset.id, { pan: true });
    }, 140);
  }, { passive: true });

  function setActive(id, o) {
    o = o || {};
    var p = byId[id]; if (!p) return;
    S.active = id;
    mk.classed("is-active", function (d) { return d.id === id; });
    mk.filter(function (d) { return d.id === id; }).raise();
    list.querySelectorAll(".pcard").forEach(function (c) { c.classList.toggle("is-active", c.dataset.id === id); });
    if (o.zoom) fit([p], Math.max(K, 9));
    else if (o.pan) panTo(p);
    cluster();
    if (o.scroll) {
      var c = list.querySelector('.pcard[data-id="' + id + '"]');
      if (c) {
        var li = c.parentElement;
        if (narrow()) list.scrollTo({ left: li.offsetLeft - (list.clientWidth - li.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth" });
        else list.scrollTo({ top: li.offsetTop - 10, behavior: reduce ? "auto" : "smooth" });
      }
    }
  }

  /* ----- filtres ----- */
  var fCat = doc.getElementById("fCat");
  function countFor(g) {
    return P.filter(function (p) {
      return (S.region === "all" || p.r === S.region) && (g === "all" || p.g === g) && (!S.top || p.top > 0) &&
        (!S.unesco || p.t.indexOf("unesco") > -1) && (!S.off || p.t.indexOf("off_beaten_track") > -1) && (!S.tag || p.t.indexOf(S.tag) > -1);
    }).length;
  }
  function renderCats() {
    [].slice.call(fCat.querySelectorAll(".fchip")).forEach(function (b) { b.remove(); });
    var mkBtn = function (g, label) {
      var b = doc.createElement("button");
      b.type = "button"; b.className = "fchip";
      b.setAttribute("aria-pressed", String(S.group === g));
      b.innerHTML = (g === "all" ? "" : '<span class="fchip__dot" style="--dc:' + col(g) + '"></span>') + esc(label) + " <small>" + countFor(g) + "</small>";
      b.addEventListener("click", function () { S.group = (S.group === g && g !== "all") ? "all" : g; apply(); });
      fCat.appendChild(b);
    };
    mkBtn("all", "Toutes les envies");
    GROUPS.forEach(function (g) { mkBtn(g[0], g[1]); });
    if (S.tag) {
      var b = doc.createElement("button");
      b.type = "button"; b.className = "fchip fchip--toggle"; b.setAttribute("aria-pressed", "true");
      b.textContent = (TAGLABEL[S.tag] || S.tag) + " ✕";
      b.addEventListener("click", function () { S.tag = null; apply(); });
      fCat.appendChild(b);
    }
  }
  function apply(o) {
    o = o || {};
    var vis = visible(), ids = {};
    vis.forEach(function (p) { ids[p.id] = 1; });
    [].slice.call(doc.querySelectorAll("#fRegion button")).forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === S.region)); });
    doc.getElementById("fTop").setAttribute("aria-pressed", String(S.top));
    doc.getElementById("fUnesco").setAttribute("aria-pressed", String(S.unesco));
    doc.getElementById("fOff").setAttribute("aria-pressed", String(S.off));
    renderCats(); renderList(vis);
    if (S.active && !ids[S.active]) S.active = null;
    if (S.active) list.querySelectorAll(".pcard").forEach(function (c) { c.classList.toggle("is-active", c.dataset.id === S.active); });
    cluster();
    if (o.fit !== false) {
      if (vis.length && (S.region !== "all" || vis.length < P.length)) fit(vis, 9);
      else svg.transition().duration(dur(500)).call(zoom.transform, d3.zoomIdentity);
    }
  }
  [].slice.call(doc.querySelectorAll("#fRegion button")).forEach(function (b) { b.addEventListener("click", function () { S.region = b.dataset.v; apply(); }); });
  doc.getElementById("fTop").addEventListener("click", function () { S.top = !S.top; apply(); });
  doc.getElementById("fUnesco").addEventListener("click", function () { S.unesco = !S.unesco; apply(); });
  doc.getElementById("fOff").addEventListener("click", function () { S.off = !S.off; apply(); });
  var resetAll = function () { S.region = "all"; S.group = "all"; S.top = false; S.unesco = false; S.off = false; S.tag = null; S.active = null; };
  doc.getElementById("reset").addEventListener("click", function () { resetAll(); apply(); });
  var toMap = function () { doc.getElementById("carte").scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); };

  // « Voir sur la carte » des onglets régions, des envies et des alternatives
  [].slice.call(doc.querySelectorAll("[data-zone]")).forEach(function (b) {
    b.addEventListener("click", function () {
      resetAll();
      if (b.dataset.zone === "plages") { S.group = "plages"; apply({ fit: false }); toMap(); setTimeout(function () { fit(visible(), 9); }, 350); return; }
      apply({ fit: false }); toMap();
      setTimeout(function () { fitBox(ZONES[b.dataset.zone], 9); }, 350);
    });
  });
  [].slice.call(doc.querySelectorAll("[data-env]")).forEach(function (b) {
    b.addEventListener("click", function () {
      resetAll();
      var v = b.dataset.env;
      if (v === "unesco") S.unesco = true; else if (v === "off") S.off = true; else if (v === "walking") S.tag = "walking"; else S.group = v;
      apply({ fit: false }); toMap();
      setTimeout(function () { fit(visible(), 9); }, 350);
    });
  });
  [].slice.call(doc.querySelectorAll("[data-lat]")).forEach(function (b) {
    b.addEventListener("click", function () {
      resetAll(); apply({ fit: false }); toMap();
      var la = +b.dataset.lat, ln = +b.dataset.lng;
      setTimeout(function () { fitBox([la - 0.15, ln - 0.2, la + 0.15, ln + 0.2], 12); }, 350);
    });
  });

  // nombres affichés à partir des données
  var n = doc.getElementById("statCount"); if (n) n.textContent = P.length;
  [].slice.call(doc.querySelectorAll("[data-env-count]")).forEach(function (el) {
    var v = el.dataset.envCount, c = P.filter(function (p) {
      return v === "unesco" ? p.t.indexOf("unesco") > -1 : v === "off" ? p.t.indexOf("off_beaten_track") > -1 : v === "walking" ? p.t.indexOf("walking") > -1 : p.g === v;
    }).length;
    el.textContent = "Voir " + c + " lieu" + (c > 1 ? "x" : "") + " sur la carte";
  });

  var rs; window.addEventListener("resize", function () { clearTimeout(rs); rs = setTimeout(cluster, 150); });
  apply({ fit: false });
}
})();
