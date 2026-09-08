// Overlay positions for the real certificate template PNGs (18 total: 5 TVET
// departments x {original, temporary} + 4 Degree majors x {original,
// temporary} — "terminal" was removed, see HANDOVER.md §7).
//
// Coordinates are `top`/`left` percentages of the template IMAGE's own
// width/height (not the rendered element), so they scale correctly
// regardless of display size: top% = y_pixel / image_height_px * 100,
// left% = x_pixel / image_width_px * 100, measured against the FULL
// native-resolution PNG (3301x2550 for the landscape TVET/Degree Original
// templates, 2550x3301 for the portrait Temporary templates).
//
// Measured with Pixspy directly on each of the 18 native PNGs (left edge of
// the blank, vertical center of the line) and supplied by the school —
// these replace an earlier automated pixel/word-gap-detection pass.
//
// Field shapes by certificate type:
//   - TVET Original / Degree Original (bilingual templates): name, nameAmharic,
//     endYear{Gc,Ec} (+ startYear{Gc,Ec} for TVET Original only, which prints
//     "from ___ to ___"). Gc fields overlay the Gregorian year on the English
//     side ("___ G.C."); Ec fields overlay the Ethiopian year on the Amharic
//     side ("___ ዓ.ም") — use utils/ethiopianCalendar.js's splitYears() to get
//     both from one date.
//   - TVET Temporary / Degree Temporary (English-only templates): name,
//     endYearGc only.
//
// Shrink-to-fit (`maxWidth`, optional, per field): a percentage of the
// certificate image's own width. When set, RegistrarCertificates.jsx's
// Overlay component auto-scales the rendered text down (anchored at its
// `left` start point, so the shrink never shifts where the text begins) if
// it would otherwise run past that width — e.g. an unusually long name
// overwriting the printed text next to the blank on TVET Original. Omit it
// (as everything currently does) and the field behaves exactly as before —
// fixed size, no shrinking. `minScale` (optional, default 0.5) sets the
// floor it won't shrink past, to keep extremely long values legible rather
// than illegibly tiny. Add `maxWidth: "NN%"` to a field once its blank's
// available width has been measured — currently unset everywhere pending
// those measurements for TVET Original's name/nameAmharic fields.
//
// Font sizes are all set to 16pt (converted to rem via rem = pt / 12, so
// 16pt -> 1.33rem) across every field on every template, per the school's
// request for a consistent, larger overlay size.
//
// All fields use align:"left" with `left` set to the exact start of the
// measured blank (text grows rightward from that point via translateY(-50%)
// only — see RegistrarCertificates.jsx).

function slugifyDept(name) {
  return (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const pt = (n) => `${(n / 12).toFixed(2)}rem`;

const TVET_ORIGINAL = {
  // 16pt for every field. name/nameAmharic support an optional `maxWidth`
  // (see the shrink-to-fit note above) — not set yet, pending real
  // measurements of each blank's usable width before the next printed word.
  accounting: {
    name: { top: "52.97%", left: "57.98%", fontSize: pt(16), maxWidth: "17.65%" },
    nameAmharic: { top: "53.69%", left: "13.66%", fontSize: pt(16), maxWidth: "17.09%" },
    startYearEc: { top: "59.34%", left: "10.63%", fontSize: pt(16) },
    endYearEc: { top: "59.34%", left: "24.38%", fontSize: pt(16) },
    startYearGc: { top: "60.97%", left: "65.65%", fontSize: pt(16) },
    endYearGc: { top: "60.97%", left: "73.44%", fontSize: pt(16) },
  },
  hrm: {
    name: { top: "49.07%", left: "61.06%", fontSize: pt(16), maxWidth: "23.95%" },
    // nameAmharic re-measured — earlier data for this field was a duplicate
    // of Accounting's "name English" values; this is the corrected reading.
    nameAmharic: { top: "49.98%", left: "13.59%", fontSize: pt(16), maxWidth: "17.72%" },
    startYearEc: { top: "55.48%", left: "14.98%", fontSize: pt(16) },
    endYearEc: { top: "55.61%", left: "28.17%", fontSize: pt(16) },
    startYearGc: { top: "61.22%", left: "67.48%", fontSize: pt(16) },
    endYearGc: { top: "61.22%", left: "80.39%", fontSize: pt(16) },
  },
  medicallaboratory: {
    name: { top: "52.97%", left: "57.98%", fontSize: pt(16), maxWidth: "17.86%" },
    nameAmharic: { top: "53.87%", left: "13.66%", fontSize: pt(16), maxWidth: "17.30%" },
    startYearEc: { top: "59.30%", left: "10.77%", fontSize: pt(16) },
    endYearEc: { top: "59.39%", left: "24.24%", fontSize: pt(16) },
    startYearGc: { top: "60.94%", left: "69.51%", fontSize: pt(16) },
    endYearGc: { top: "60.94%", left: "77.44%", fontSize: pt(16) },
  },
  midwifery: {
    name: { top: "48.71%", left: "57.91%", fontSize: pt(16), maxWidth: "18.21%" },
    nameAmharic: { top: "49.78%", left: "14.22%", fontSize: pt(16), maxWidth: "17.37%" },
    startYearEc: { top: "56.03%", left: "15.96%", fontSize: pt(16) },
    endYearEc: { top: "55.85%", left: "30.98%", fontSize: pt(16) },
    startYearGc: { top: "56.67%", left: "62.63%", fontSize: pt(16) },
    endYearGc: { top: "56.67%", left: "73.16%", fontSize: pt(16) },
  },
  nursing: {
    name: { top: "51.97%", left: "57.21%", fontSize: pt(16), maxWidth: "19.12%" },
    nameAmharic: { top: "52.88%", left: "13.73%", fontSize: pt(16), maxWidth: "16.74%" },
    startYearEc: { top: "55.67%", left: "39.40%", fontSize: pt(16) },
    endYearEc: { top: "58.39%", left: "12.45%", fontSize: pt(16) },
    startYearGc: { top: "62.03%", left: "55.48%", fontSize: pt(16) },
    endYearGc: { top: "62.03%", left: "62.70%", fontSize: pt(16) },
  },
};

// 16pt for name + date on every TVET Temporary template
const TVET_TEMPORARY = {
  accounting: { name: { top: "38.57%", left: "39.70%", fontSize: pt(16) }, endYearGc: { top: "50.29%", left: "52.86%", fontSize: pt(16) } },
  hrm: { name: { top: "38.38%", left: "39.76%", fontSize: pt(16) }, endYearGc: { top: "50.39%", left: "63.32%", fontSize: pt(16) } },
  medicallaboratory: { name: { top: "38.82%", left: "40.14%", fontSize: pt(16) }, endYearGc: { top: "50.34%", left: "57.08%", fontSize: pt(16) } },
  midwifery: { name: { top: "38.38%", left: "40.01%", fontSize: pt(16) }, endYearGc: { top: "50.39%", left: "51.92%", fontSize: pt(16) } },
  nursing: { name: { top: "38.62%", left: "39.82%", fontSize: pt(16) }, endYearGc: { top: "50.31%", left: "50.41%", fontSize: pt(16) } },
};

// 16pt for names and dates, per department
const DEGREE_ORIGINAL = {
  baaccountingfinance: {
    name: { top: "54.35%", left: "59.04%", fontSize: pt(16) },
    nameAmharic: { top: "55.09%", left: "11.10%", fontSize: pt(16) },
    endYearGc: { top: "62.50%", left: "81.97%", fontSize: pt(16) },
    endYearEc: { top: "66.58%", left: "25.97%", fontSize: pt(16) },
  },
  babusinessmanagement: {
    name: { top: "50.11%", left: "59.23%", fontSize: pt(16) },
    nameAmharic: { top: "50.76%", left: "11.29%", fontSize: pt(16) },
    endYearGc: { top: "58.18%", left: "81.78%", fontSize: pt(16) },
    endYearEc: { top: "62.34%", left: "25.59%", fontSize: pt(16) },
  },
  bschumannutrition: {
    name: { top: "52.93%", left: "58.85%", fontSize: pt(16) },
    nameAmharic: { top: "53.66%", left: "10.97%", fontSize: pt(16) },
    endYearGc: { top: "61.00%", left: "81.78%", fontSize: pt(16) },
    endYearEc: { top: "65.16%", left: "25.71%", fontSize: pt(16) },
  },
  bscnursing: {
    name: { top: "50.11%", left: "58.91%", fontSize: pt(16) },
    nameAmharic: { top: "50.76%", left: "11.10%", fontSize: pt(16) },
    endYearGc: { top: "58.10%", left: "81.90%", fontSize: pt(16) },
    endYearEc: { top: "62.42%", left: "25.90%", fontSize: pt(16) },
  },
};

// 16pt for name + date on every Degree Temporary template
const DEGREE_TEMPORARY = {
  baaccountingfinance: { name: { top: "40.33%", left: "42.66%", fontSize: pt(16) }, endYearGc: { top: "61.87%", left: "46.82%", fontSize: pt(16) } },
  babusinessmanagement: { name: { top: "42.95%", left: "42.91%", fontSize: pt(16) }, endYearGc: { top: "64.65%", left: "46.69%", fontSize: pt(16) } },
  bschumannutrition: { name: { top: "43.38%", left: "42.91%", fontSize: pt(16) }, endYearGc: { top: "64.79%", left: "46.50%", fontSize: pt(16) } },
  bscnursing: { name: { top: "43.15%", left: "42.66%", fontSize: pt(16) }, endYearGc: { top: "64.74%", left: "46.63%", fontSize: pt(16) } },
};

const BY_TRACK_TYPE = {
  "tvet-original": TVET_ORIGINAL,
  "tvet-temporary": TVET_TEMPORARY,
  "degree-original": DEGREE_ORIGINAL,
  "degree-temporary": DEGREE_TEMPORARY,
};

// Generic centered fallback, used only if a department/type combination has
// no measured entry yet (e.g. a newly added department without a template).
const FALLBACK = {
  name: { top: "50%", left: "50%", align: "center", fontSize: pt(16) },
  nameAmharic: { top: "55%", left: "50%", align: "center", fontSize: pt(16) },
  endYearGc: { top: "70%", left: "50%", align: "center", fontSize: pt(16) },
  endYearEc: { top: "72%", left: "50%", align: "center", fontSize: pt(16) },
  startYearGc: { top: "60%", left: "35%", fontSize: pt(16) },
  startYearEc: { top: "60%", left: "20%", fontSize: pt(16) },
};

export function getLayout(track, certificateType, departmentName) {
  const table = BY_TRACK_TYPE[`${track}-${certificateType}`];
  const slug = slugifyDept(departmentName);
  return (table && table[slug]) || FALLBACK;
}
