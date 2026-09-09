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

// Case-insensitive directory lookup helper
function findMatchingDir(parentDir, targetName) {
  if (!fs.existsSync(parentDir)) return null;
  const entries = fs.readdirSync(parentDir, { withFileTypes: true });
  const matched = entries.find(
    (e) => e.isDirectory() && e.name.trim().toLowerCase() === targetName.trim().toLowerCase()
  );
  return matched ? path.join(parentDir, matched.name) : null;
}

async function syncCurriculum() {
  const departments = await prisma.department.findMany({ include: { levels: true } });
  let added = 0;

  if (!fs.existsSync(CURRICULUM_DIR)) {
    console.error(`Directory missing: ${CURRICULUM_DIR}`);
    return;
  }

  await prisma.curriculum.deleteMany({ where: { fileUrl: { startsWith: "/content/curriculum/" } } });

  for (const dept of departments) {
    // Dynamically match directory name regardless of letter case or spaces
    const deptDir = findMatchingDir(CURRICULUM_DIR, dept.name);
    if (!deptDir) {
      console.warn(`No folder match found for Department: "${dept.name}" in ${CURRICULUM_DIR}`);
      continue;
    }

    const deptDirName = path.basename(deptDir);

    for (const level of dept.levels) {
      const levelDir = findMatchingDir(deptDir, level.name);
      if (!levelDir) {
        console.warn(`No folder match found for Level: "${level.name}" under ${deptDirName}`);
        continue;
      }

      const levelDirName = path.basename(levelDir);
      const pdfs = listFiles(levelDir, ".pdf");

      for (const pdf of pdfs) {
        const fileUrl = `/content/curriculum/${encodeURIComponent(deptDirName)}/${encodeURIComponent(levelDirName)}/${encodeURIComponent(pdf.name)}`;
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
