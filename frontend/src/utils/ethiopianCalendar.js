// Standard Julian-Day-Number-based Gregorian <-> Ethiopian calendar conversion.
// No network calls — this is a deterministic calendar offset, safe to run
// entirely client-side.

const ETHIOPIAN_MONTHS = [
  "Meskerem", "Tikimt", "Hidar", "Tahsas", "Tir", "Yekatit",
  "Megabit", "Miazia", "Ginbot", "Sene", "Hamle", "Nehase", "Pagume",
];

const JD_EPOCH_OFFSET_AMETE_MIHRET = 1723856;

function gregorianToJdn(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

function jdnToEthiopian(jdn) {
  const r = (jdn - JD_EPOCH_OFFSET_AMETE_MIHRET) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const year =
    4 * Math.floor((jdn - JD_EPOCH_OFFSET_AMETE_MIHRET) / 1461) +
    Math.floor(r / 365) -
    Math.floor(r / 1460);
  const month = Math.floor(n / 30) + 1;
  const day = (n % 30) + 1;
  return { year, month, day };
}

// Accepts a JS Date or an ISO date string. Returns { year, month, day, monthName } or null.
export function toEthiopianDate(input) {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(input);
  if (isNaN(date.getTime())) return null;

  const jdn = gregorianToJdn(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const { year, month, day } = jdnToEthiopian(jdn);
  return { year, month, day, monthName: ETHIOPIAN_MONTHS[month - 1] };
}

// "12 Meskerem 2018"
export function formatEthiopianDate(input) {
  const e = toEthiopianDate(input);
  if (!e) return "—";
  return `${e.day} ${e.monthName} ${e.year}`;
}

// "2026-07-31 (G.C.)  ·  24 Hamle 2018 (E.C.)" — full date, used in Registrar tables
export function formatBothCalendars(input) {
  if (!input) return "—";
  const date = input instanceof Date ? input : new Date(input);
  const gc = date.toLocaleDateString();
  const ec = formatEthiopianDate(input);
  return `${gc} (G.C.) · ${ec} (E.C.)`;
}

// "2026 G.C / 2018 E.C." — year-only, for certificates (full date isn't needed there)
export function formatBothYears(input) {
  if (!input) return "—";
  const date = input instanceof Date ? input : new Date(input);
  const gcYear = date.getFullYear();
  const ec = toEthiopianDate(input);
  return `${gcYear} G.C / ${ec ? ec.year : "—"} E.C.`;
}

// { gc: "2026", ec: "2018" } — for certificate overlays that need G.C. and
// E.C. positioned as two distinct text blocks rather than one combined string.
export function splitYears(input) {
  if (!input) return { gc: "—", ec: "—" };
  const date = input instanceof Date ? input : new Date(input);
  const ec = toEthiopianDate(input);
  return { gc: String(date.getFullYear()), ec: ec ? String(ec.year) : "—" };
}
