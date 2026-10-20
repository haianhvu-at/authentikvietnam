// Met à jour la carte de la page « Incontournables du Vietnam » à partir du Google Sheet publié.
// Lancé chaque jour par .github/workflows/places-incontournables.yml (et à la demande : « Run workflow »).
// Usage local : node incontournables-vietnam/scripts/update-places.mjs   (Node 18+ ; aucune dépendance)
//
// Entrée  : le CSV publié du Sheet (Fichier › Partager › Publier sur le web › un seul onglet › CSV).
//           Le script cherche la ligne des clés (id, status, name_fr, lat, lng…) dans les 5 premières lignes :
//           la ligne d'explications en vietnamien peut rester au-dessus.
// Sorties : data/places.json          → lu par la carte (sans la colonne notes_internal)
//           data/article-images.json  → cache des vignettes des articles (colonne article_url)
//           index.html                → liste des lieux écrite entre <!-- LIEUX:DEBUT --> et <!-- LIEUX:FIN -->
//                                       (visible sans JavaScript et lisible par Google)
//
// Réglages (variables d'environnement ; sinon valeurs par défaut ci-dessous) :
//   PLACES_CSV_URL   adresse du CSV publié
//   PLACES_CSV_FILE  fichier CSV local à utiliser à la place (tests)
//   SHOW_DRAFT       "1" = affiche aussi les lignes « draft » ; "0" = seulement « published »

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "places.json");
const CACHE = path.join(ROOT, "data", "article-images.json");
const HTML = path.join(ROOT, "index.html");

// Onglet destListVN du fichier publié (19/10/2026). À remplacer par l'adresse de l'onglet d'export quand il sera publié.
const DEFAULT_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTHJkqaauyX6qZGymKZkElhC_InHsx8Kz7WBKDQ9vflgJT8OG0ljMx66GI-l_OJF1-dFwRzjgEwcrGN/pub?gid=1591212693&single=true&output=csv";
// Décision du 20/10/2026 : afficher aussi les lieux « draft » tant que le Sheet est en cours de vérification.
const DEFAULT_SHOW_DRAFT = "1";
const CSV_URL = (process.env.PLACES_CSV_URL || "").trim() || DEFAULT_CSV;
const CSV_FILE = (process.env.PLACES_CSV_FILE || "").trim();
const SHOW_DRAFT = ((process.env.SHOW_DRAFT || "").trim() || DEFAULT_SHOW_DRAFT) === "1";
const USER_AGENT = "AuthentikVietnam-Incontournables/1.0 (+https://authentik-vietnam.web.app/incontournables-vietnam/)";
const MAX_NEW_IMAGES = 40;          // nouveaux articles à analyser par passage
const RETRY_DAYS = 30;              // nouvel essai pour un article sans image après ce délai
const MIN_PLACES = 10;              // en dessous, on ne touche à rien (Sheet vide ou mal publié)

const CATS = ["heritage", "religious", "museum", "craft_village", "ethnic_village", "nature", "beach_island", "market_local", "food", "experience", "photo_spot"];
const CATLABEL = { heritage: "Patrimoine", museum: "Musée", religious: "Temple & pagode", nature: "Nature", photo_spot: "Point de vue", beach_island: "Plage & île",
  ethnic_village: "Village & rencontre", craft_village: "Village d’artisanat", market_local: "Marché", food: "Gastronomie", experience: "Expérience" };
const GROUP = { heritage: "patrimoine", museum: "patrimoine", religious: "temples", nature: "nature", photo_spot: "nature", beach_island: "plages",
  ethnic_village: "villages", craft_village: "artisanat", market_local: "marches", food: "marches", experience: "experiences" };
const REGIONS = ["Nord", "Centre", "Sud"];
const warnings = [];
const warn = (m) => { warnings.push(m); console.log("::warning::" + m); };

// ---------- CSV ----------
export function parseCSV(text) {
  const rows = []; let row = [], f = "", q = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const safeUrl = (u) => {
  u = clean(u);
  if (!/^https?:\/\//i.test(u)) return "";
  try { return encodeURI(decodeURI(u)); } catch { return encodeURI(u); }
};
const firstUrl = (s) => clean(s).split(/\s*\|\s*|\s+/).map(safeUrl).find(Boolean) || "";
const shorten = (s, n) => { s = clean(s); if (s.length <= n) return s; const cut = s.slice(0, n - 1); return cut.slice(0, cut.lastIndexOf(" ")) + "…"; };
const num = (s) => { const v = parseFloat(clean(s).replace(",", ".")); return Number.isFinite(v) ? v : NaN; };
const yes = (s) => /^(true|vrai|1|x|oui|yes|có)$/i.test(clean(s));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function toPlaces(rows) {
  const hi = rows.slice(0, 5).findIndex((r) => { const k = r.map((v) => clean(v).toLowerCase()); return k.includes("id") && k.includes("lat") && k.includes("lng") && k.includes("name_fr"); });
  if (hi < 0) throw new Error("Ligne des clés introuvable (id, name_fr, lat, lng…) dans les 5 premières lignes du CSV.");
  const keys = rows[hi].map((v) => clean(v).toLowerCase());
  const col = (r, k) => { const i = keys.indexOf(k); return i < 0 ? "" : r[i] ?? ""; };
  const seen = new Set(), out = [];
  let skippedStatus = 0, skippedXY = 0;
  for (const r of rows.slice(hi + 1)) {
    let id = clean(col(r, "id")).toLowerCase();
    if (!id) continue;
    if (!/^[a-z0-9-]+$/.test(id)) { const fixed = id.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); warn(`id « ${id} » corrigé en « ${fixed} »`); id = fixed; }
    if (seen.has(id)) { warn(`id en double ignoré : ${id}`); continue; }
    const status = clean(col(r, "status")).toLowerCase() || "draft";
    if (status === "archived" || (status !== "published" && !SHOW_DRAFT)) { skippedStatus++; continue; }
    const lat = num(col(r, "lat")), lng = num(col(r, "lng"));
    if (!(lat > 6 && lat < 24 && lng > 101.5 && lng < 118)) { skippedXY++; continue; }
    const name = clean(col(r, "name_fr"));
    if (!name) { warn(`${id} : name_fr vide, ligne ignorée`); continue; }
    let region = clean(col(r, "region"));
    region = REGIONS.find((x) => x.toLowerCase() === region.toLowerCase()) || "";
    if (!region) { region = lat >= 19.5 ? "Nord" : lat >= 11.4 ? "Centre" : "Sud"; warn(`${id} : région absente ou inconnue, « ${region} » déduite des coordonnées`); }
    let c = clean(col(r, "category")).toLowerCase();
    if (!CATS.includes(c)) { warn(`${id} : catégorie « ${c} » inconnue, remplacée par « experience »`); c = "experience"; }
    seen.add(id);
    out.push({
      id, n: name, d: shorten(col(r, "short_desc_fr"), 220), r: region,
      pv: clean(col(r, "province")), dest: clean(col(r, "destination")),
      c, t: clean(col(r, "tags")).toLowerCase().split(/\s*[|,;]\s*/).filter(Boolean),
      lat: +lat.toFixed(5), lng: +lng.toFixed(5), f: yes(col(r, "featured")) ? 1 : 0,
      a: firstUrl(col(r, "article_url")), tour: firstUrl(col(r, "tour_url")), img: firstUrl(col(r, "image_url")), st: status
    });
  }
  console.log(`Lignes retenues : ${out.length} · ignorées (statut) : ${skippedStatus} · ignorées (sans coordonnées valides) : ${skippedXY}`);
  return out;
}

// ---------- vignettes des articles (og:image, version 450×230 si elle existe) ----------
async function fetchText(url, ms = 12000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: ctl.signal, redirect: "follow" }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.text(); }
  finally { clearTimeout(t); }
}
async function exists(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  try { const r = await fetch(url, { method: "HEAD", headers: { "User-Agent": USER_AGENT }, signal: ctl.signal }); return r.ok && (r.headers.get("content-type") || "").startsWith("image"); }
  catch { return false; } finally { clearTimeout(t); }
}
async function articleImage(url) {
  const html = await fetchText(url);
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]*>/i);
  const og = m && (m[0].match(/content=["']([^"']+)["']/i) || [])[1];
  if (!og) return { og: null, thumb: null };
  const abs = safeUrl(new URL(og, url).href);
  let thumb = abs;
  const p = new URL(abs);
  if (/^\/media\/blog\/[^/]+$/.test(p.pathname)) {
    const t = abs.replace("/media/blog/", "/media/blog/450_230/");
    if (await exists(t)) thumb = t;
  }
  return { og: abs, thumb };
}
async function fillImages(places) {
  let cache = {};
  try { cache = JSON.parse(await readFile(CACHE, "utf8")); } catch {}
  const today = new Date().toISOString().slice(0, 10);
  const stale = (e) => !e || (!e.thumb && (Date.now() - Date.parse(e.checked || 0)) / 864e5 > RETRY_DAYS);
  const todo = [...new Set(places.filter((p) => !p.img && p.a).map((p) => p.a))].filter((u) => stale(cache[u])).slice(0, MAX_NEW_IMAGES);
  for (const u of todo) {
    try { cache[u] = { ...(await articleImage(u)), checked: today }; }
    catch (e) { cache[u] = { og: null, thumb: null, checked: today }; warn(`vignette introuvable pour ${u} (${e.message})`); }
  }
  for (const p of places) if (!p.img && p.a && cache[p.a]?.thumb) p.img = cache[p.a].thumb;
  const sorted = Object.fromEntries(Object.keys(cache).sort().map((k) => [k, cache[k]]));
  await writeFile(CACHE, JSON.stringify(sorted, null, 1) + "\n");
  console.log(`Vignettes : ${places.filter((p) => p.img).length}/${places.length} lieux (${todo.length} article(s) analysé(s) ce passage)`);
}

// ---------- liste HTML (même balisage que la liste créée par la carte) ----------
const PH = '<span class="ph-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg></span>';
export function cardHtml(p) {
  const where = [...new Set([p.dest, p.pv].filter(Boolean))].join(" · ");
  const tags = (p.f ? '<span class="tag tag--t">Coup de cœur</span>' : "") +
    (p.t.includes("unesco") ? '<span class="tag tag--u">UNESCO</span>' : "") +
    (p.t.includes("off_beaten_track") ? '<span class="tag tag--o">Hors des sentiers battus</span>' : "");
  return `<li><article class="pcard" data-id="${esc(p.id)}" tabindex="0" style="--pc:var(--c-${GROUP[p.c]})">` +
    `<div class="pcard__img">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy" decoding="async" width="76" height="76">` : PH}</div>` +
    `<div class="pcard__body"><span class="pcard__cat"><i></i>${esc(CATLABEL[p.c])}</span>` +
    `<p class="pcard__t">${esc(p.n)}</p><span class="pcard__w">${esc(where)} · ${esc(p.r)}</span>` +
    `<p class="pcard__d">${esc(p.d)}</p><div class="pcard__tags">${tags}</div>` +
    `<div class="pcard__links">${p.a ? `<a href="${esc(p.a)}" target="_blank" rel="noopener">Lire le guide</a>` : ""}` +
    `<a href="${esc(p.tour || "https://authentikvietnam.com/circuit-vietnam")}" target="_blank" rel="noopener">${p.tour ? "Le circuit" : "Circuits"}</a>` +
    `<a href="https://www.google.com/maps/search/?api=1&amp;query=${p.lat},${p.lng}" target="_blank" rel="noopener">Google Maps</a></div>` +
    `</div></article></li>`;
}
const ORDER = { Nord: 0, Centre: 1, Sud: 2 };
export const sortPlaces = (a) => a.slice().sort((x, y) => (y.f - x.f) || (ORDER[x.r] - ORDER[y.r]) || (y.lat - x.lat) || x.id.localeCompare(y.id));

async function writeHtml(places) {
  let html = await readFile(HTML, "utf8");
  const a = "<!-- LIEUX:DEBUT -->", b = "<!-- LIEUX:FIN -->";
  const i = html.indexOf(a), j = html.indexOf(b);
  if (i < 0 || j < i) { warn("Repères LIEUX:DEBUT / LIEUX:FIN introuvables dans index.html : liste HTML non mise à jour"); return; }
  const list = "\n" + places.map((p) => "          " + cardHtml(p)).join("\n") + "\n          ";
  html = html.slice(0, i + a.length) + list + html.slice(j);
  html = html.replace(/(<b id="count">)\d*(<\/b>)/, `$1${places.length}$2`);
  html = html.replace(/(<b id="statCount">)\d*(<\/b>)/, `$1${places.length + 10}$2`);
  await writeFile(HTML, html);
}

// ---------- programme ----------
async function main() {
  const text = CSV_FILE ? await readFile(CSV_FILE, "utf8") : await fetchText(CSV_URL, 30000);
  if (/^\s*</.test(text)) throw new Error("Le lien ne renvoie pas un CSV (page HTML reçue) : vérifier « Publier sur le web › CSV ».");
  const places = sortPlaces(toPlaces(parseCSV(text)));
  if (places.length < MIN_PLACES) throw new Error(`Seulement ${places.length} lieu(x) lisible(s) : carte non modifiée. Vérifier le Sheet publié.`);
  await fillImages(places);
  const data = { updated: new Date().toISOString(), source: "Google Sheet publié (onglet des lieux)", show_draft: SHOW_DRAFT, count: places.length, places };
  let old = null; try { old = JSON.parse(await readFile(OUT, "utf8")); } catch {}
  const same = old && JSON.stringify({ ...old, updated: 0 }) === JSON.stringify({ ...data, updated: 0 });
  if (!same) await writeFile(OUT, JSON.stringify(data) + "\n");
  await writeHtml(places);
  console.log(same ? "places.json inchangé." : `places.json écrit : ${places.length} lieux.`);
  if (warnings.length) console.log(`${warnings.length} avertissement(s) : voir ci-dessus.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.log("::error::" + e.message); process.exit(1); });
}
