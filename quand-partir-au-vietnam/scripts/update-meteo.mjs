// Met à jour data/meteo.json à partir de MET Norway (Locationforecast 2.0, licence CC BY 4.0).
// Lancé chaque jour par GitHub Actions (.github/workflows/meteo-quand-partir.yml).
// Usage local : node scripts/update-meteo.mjs   (Node 18+ ; aucune dépendance)

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLACES_FILE = path.join(ROOT, "data", "places.json");
const OUT_FILE = path.join(ROOT, "data", "meteo.json");
const API = "https://api.met.no/weatherapi/locationforecast/2.0/complete";
// MET Norway exige un User-Agent qui identifie l'application.
const USER_AGENT = "AuthentikVietnam-QuandPartir/1.0 (+https://authentikvietnam.com)";
const TZ_OFFSET_H = 7; // heure du Vietnam (UTC+7, pas d'heure d'été)
const NB_DAYS = 7;
const H = 3600e3;

// ---------- agrégation horaire -> journalier ----------
const RANK = {
  clearsky: 0, fair: 1, partlycloudy: 2, cloudy: 3, fog: 3.5,
  lightrainshowers: 4, lightrain: 4.2, lightsleetshowers: 4.3, lightsleet: 4.3, lightsnowshowers: 4.3, lightsnow: 4.3,
  rainshowers: 5, rain: 5.2, sleetshowers: 5.3, sleet: 5.3, snowshowers: 5.3, snow: 5.3,
  heavyrainshowers: 6, heavyrain: 6.2, heavysleetshowers: 6.3, heavysleet: 6.3, heavysnowshowers: 6.3, heavysnow: 6.3
};
const base = (c) => c.replace(/_(day|night|polartwilight)$/, "");
const rank = (s) => (s.includes("thunder") ? 7 + (s.startsWith("heavy") ? 0.5 : 0) : (RANK[s] ?? 3));

export function localDays(now = Date.now()) {
  const start = new Date(now + TZ_OFFSET_H * H);
  start.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: NB_DAYS }, (_, i) => new Date(start.getTime() + i * 24 * H).toISOString().slice(0, 10));
}

export function aggregate(timeseries, days) {
  const acc = days.map(() => ({ hi: -99, lo: 99, rain: 0, day: [], any: [] }));
  for (let k = 0; k < timeseries.length; k++) {
    const t = timeseries[k];
    const ms = Date.parse(t.time);
    const local = new Date(ms + TZ_OFFSET_H * H);
    const i = days.indexOf(local.toISOString().slice(0, 10));
    if (i < 0) continue;
    const hour = local.getUTCHours();
    const d = acc[i];
    const data = t.data || {};
    const n1 = data.next_1_hours;
    const n6 = data.next_6_hours;
    const gap = k + 1 < timeseries.length ? (Date.parse(timeseries[k + 1].time) - ms) / H : 1;

    const temp = data.instant?.details?.air_temperature;
    if (typeof temp === "number") { d.hi = Math.max(d.hi, temp); d.lo = Math.min(d.lo, temp); }
    if (gap >= 6 && n6?.details) {
      const { air_temperature_max: mx, air_temperature_min: mn } = n6.details;
      if (typeof mx === "number") d.hi = Math.max(d.hi, mx);
      if (typeof mn === "number") d.lo = Math.min(d.lo, mn);
    }
    if (gap <= 1 && typeof n1?.details?.precipitation_amount === "number") d.rain += n1.details.precipitation_amount;
    else if (typeof n6?.details?.precipitation_amount === "number") d.rain += n6.details.precipitation_amount * Math.min(gap, 6) / 6;

    // Pictogramme du jour : le plus marquant des créneaux 7h–13h et 13h–19h (heure locale)
    const s6 = n6?.summary?.symbol_code;
    if (s6 && (hour === 7 || hour === 13)) d.day.push(base(s6));
    const s = (n1 || n6)?.summary?.symbol_code;
    if (s) d.any.push(base(s));
  }
  return acc.map((d) => {
    if (d.hi === -99) return null;
    const pool = d.day.length ? d.day : d.any;
    const s = pool.length ? pool.reduce((a, b) => (rank(b) > rank(a) ? b : a)) : null;
    return { hi: Math.round(d.hi), lo: Math.round(d.lo), mm: Math.round(d.rain * 10) / 10, s };
  });
}

// ---------- programme ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPlace(p) {
  const url = `${API}?lat=${p.lat.toFixed(4)}&lon=${p.lon.toFixed(4)}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.properties.timeseries;
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(1500 * attempt);
    }
  }
}

async function main() {
  const places = JSON.parse(await readFile(PLACES_FILE, "utf8"));
  let previous = null;
  try { previous = JSON.parse(await readFile(OUT_FILE, "utf8")); } catch { /* premier lancement */ }
  const prevById = {};
  if (previous?.regions) {
    for (const list of Object.values(previous.regions)) for (const e of list) prevById[e.id] = { days: previous.days, f: e.f };
  }

  const days = localDays();
  const regions = {};
  let ok = 0, failed = 0;
  for (const region of ["nord", "centre", "sud"]) {
    regions[region] = [];
    for (const p of places[region] || []) {
      let f;
      try {
        f = aggregate(await fetchPlace(p), days);
        ok++;
      } catch (err) {
        failed++;
        console.warn(`! ${p.name} : ${err.message} — données précédentes conservées`);
        const prev = prevById[p.id];
        f = days.map((day) => (prev ? prev.f[prev.days.indexOf(day)] ?? null : null));
      }
      regions[region].push({ id: p.id, name: p.name, province: p.province, f });
      await sleep(150); // reste poli avec l'API
    }
  }

  if (ok === 0) {
    console.error("Aucune prévision récupérée : meteo.json n'est pas modifié.");
    process.exit(1);
  }
  const out = {
    generated: new Date().toISOString(),
    source: "MET Norway — Locationforecast 2.0 (CC BY 4.0)",
    timezone: "Asia/Ho_Chi_Minh",
    days,
    regions
  };
  await writeFile(OUT_FILE, JSON.stringify(out) + "\n");
  console.log(`meteo.json mis à jour : ${ok} lieux OK, ${failed} en échec.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
