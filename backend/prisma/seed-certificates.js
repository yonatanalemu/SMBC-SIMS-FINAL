// Run with: node prisma/seed-certificates.js
// Loads the certificate template PNGs bundled in prisma/certificate-assets/
// into UPLOAD_DIR/certificate-templates and upserts matching CertificateTemplate
// rows, keyed by (track, certificateType, departmentId). Idempotent — safe to
// run on every boot (wired into the Dockerfile CMD chain right after seed.js).
//
// Certificates are no longer managed via the content/ folder-drop system —
// only Curriculum still uses that (see scripts/sync-content.js). Certificate
// templates are uploaded through POST /admin/certificate-templates; this
// script is just the one-time bootstrap for the 18 real department templates
// so the system isn't empty on first boot.
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "../src/config/prisma.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, "certificate-assets");
const UPLOAD_DIR = process.env.UPLOAD_DIR || "/app/uploads";
const DEST_DIR = path.join(UPLOAD_DIR, "certificate-templates");

// Maps each bundled filename to its (track, certificateType, department name).
// Department names must match seed.js's TVET_DEPARTMENTS / DEGREE_DEPARTMENTS keys exactly.
const TEMPLATES = [
  { file: "tvet-original-accounting.png", track: "tvet", certificateType: "original", department: "Accounting" },
  { file: "tvet-original-hrm.png", track: "tvet", certificateType: "original", department: "HRM" },
  { file: "tvet-original-medical-laboratory.png", track: "tvet", certificateType: "original", department: "Medical Laboratory" },
  { file: "tvet-original-midwifery.png", track: "tvet", certificateType: "original", department: "Midwifery" },
  { file: "tvet-original-nursing.png", track: "tvet", certificateType: "original", department: "Nursing" },

  { file: "tvet-temporary-accounting.png", track: "tvet", certificateType: "temporary", department: "Accounting" },
  { file: "tvet-temporary-hrm.png", track: "tvet", certificateType: "temporary", department: "HRM" },
  { file: "tvet-temporary-medical-laboratory.png", track: "tvet", certificateType: "temporary", department: "Medical Laboratory" },
  { file: "tvet-temporary-midwifery.png", track: "tvet", certificateType: "temporary", department: "Midwifery" },
  { file: "tvet-temporary-nursing.png", track: "tvet", certificateType: "temporary", department: "Nursing" },

  { file: "degree-original-ba-accounting-finance.png", track: "degree", certificateType: "original", department: "BA Accounting & Finance" },
  { file: "degree-original-ba-business-management.png", track: "degree", certificateType: "original", department: "BA Business Management" },
  { file: "degree-original-bsc-human-nutrition.png", track: "degree", certificateType: "original", department: "BSc Human Nutrition" },
  { file: "degree-original-bsc-nursing.png", track: "degree", certificateType: "original", department: "BSc Nursing" },

  { file: "degree-temporary-ba-accounting-finance.png", track: "degree", certificateType: "temporary", department: "BA Accounting & Finance" },
  { file: "degree-temporary-ba-business-management.png", track: "degree", certificateType: "temporary", department: "BA Business Management" },
  { file: "degree-temporary-bsc-human-nutrition.png", track: "degree", certificateType: "temporary", department: "BSc Human Nutrition" },
  { file: "degree-temporary-bsc-nursing.png", track: "degree", certificateType: "temporary", department: "BSc Nursing" },
];

async function main() {
  fs.mkdirSync(DEST_DIR, { recursive: true });

  let ok = 0, skipped = 0;
  for (const t of TEMPLATES) {
    const src = path.join(ASSETS_DIR, t.file);
    if (!fs.existsSync(src)) {
      console.log(`  [skip] missing asset file: ${t.file}`);
      skipped++;
      continue;
    }
    const department = await prisma.department.findUnique({ where: { name: t.department } });
    if (!department) {
      console.log(`  [skip] department not found: "${t.department}" (run prisma/seed.js first)`);
      skipped++;
      continue;
    }

    const destFilename = t.file; // stable, human-readable filename (unlike multer's random names)
    fs.copyFileSync(src, path.join(DEST_DIR, destFilename));
    const imageUrl = `/uploads/certificate-templates/${destFilename}`;

    await prisma.certificateTemplate.upsert({
      where: {
        track_certificateType_departmentId: {
          track: t.track,
          certificateType: t.certificateType,
          departmentId: department.id,
        },
      },
      update: { imageUrl },
      create: {
        track: t.track,
        certificateType: t.certificateType,
        departmentId: department.id,
        imageUrl,
      },
    });
    ok++;
  }
  console.log(`Certificate templates seeded: ${ok} loaded, ${skipped} skipped.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
