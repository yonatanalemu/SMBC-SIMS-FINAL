// Run with: node scripts/sync-content.js
// Walks backend/content/curriculum and syncs whatever files it finds into
// the Curriculum table — matching folder names against existing
// Department/Level names exactly. Safe to run on every container boot: it
// fully resyncs (clears out anything sourced from content/ that's no longer
// on disk, then re-adds what is).
//
// NOTE: Certificate templates are NOT handled here anymore. They're managed
// via prisma/seed-certificates.js (bootstraps the 18 real department
// templates on first boot) and the admin upload API
// (POST/GET/DELETE /admin/certificate-templates) — not a content/ folder.
import "dotenv/config";
import fs from "fs";
import path from "path";
import prisma from "../src/config/prisma.js";

const CONTENT_DIR = path.join(process.cwd(), "content");
const CURRICULUM_DIR = path.join(CONTENT_DIR, "curriculum");

function listFiles(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(ext))
    .map((e) => ({ name: e.name, mtime: fs.statSync(path.join(dir, e.name)).mtimeMs }));
}

async function syncCurriculum() {
  const departments = await prisma.department.findMany({ include: { levels: true } });
  let added = 0;

  await prisma.curriculum.deleteMany({ where: { fileUrl: { startsWith: "/content/curriculum/" } } });

  for (const dept of departments) {
    const deptDir = path.join(CURRICULUM_DIR, dept.name);
    if (!fs.existsSync(deptDir)) continue;

    for (const level of dept.levels) {
      const levelDir = path.join(deptDir, level.name);
      const pdfs = listFiles(levelDir, ".pdf");
      for (const pdf of pdfs) {
        const fileUrl = `/content/curriculum/${encodeURIComponent(dept.name)}/${encodeURIComponent(level.name)}/${encodeURIComponent(pdf.name)}`;
        await prisma.curriculum.create({ data: { departmentId: dept.id, levelId: level.id, fileUrl } });
        added++;
      }
    }
  }
  console.log(`Curriculum sync: ${added} file(s) registered.`);
}

async function main() {
  await syncCurriculum();
}

main()
  .catch((err) => {
    console.error("Content sync failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
