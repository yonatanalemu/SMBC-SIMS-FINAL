// Run with: npm run seed
// Creates the three permanent accounts and the full department/level
// structure so there's real academic scaffolding to work with immediately,
// not just an empty Admin login.
import "dotenv/config";
import prisma from "../src/config/prisma.js";
import { hashPassword, generateTempPassword } from "../src/utils/auth.js";
import { TVET_COURSES } from "./course-data.js";

const TVET_DEPARTMENTS = {
  Nursing: ["Level 3", "Level 4"],
  "Medical Laboratory": ["Level 3", "Level 4"],
  Midwifery: ["Level 3", "Level 4"],
  Accounting: ["Level 2 Terminal", "Level 2 Diploma", "Level 3", "Level 4"],
  HRM: ["Level 2 Terminal", "Level 2 Diploma", "Level 3", "Level 4"],
};

const DEGREE_YEAR_SEMESTER_LEVELS = [
  "Year I Semester I", "Year I Semester II",
  "Year II Semester I", "Year II Semester II",
  "Year III Semester I", "Year III Semester II",
  "Year IV Semester I", "Year IV Semester II",
];

const DEGREE_DEPARTMENTS = {
  "BSc Nursing": DEGREE_YEAR_SEMESTER_LEVELS,
  "BSc Human Nutrition": DEGREE_YEAR_SEMESTER_LEVELS,
  "BA Business Management": DEGREE_YEAR_SEMESTER_LEVELS,
  "BA Accounting & Finance": DEGREE_YEAR_SEMESTER_LEVELS,
};

async function createPermanentUser(role, envPrefix, defaultUsername) {
  const existing = await prisma.user.findFirst({ where: { role } });
  if (existing) {
    console.log(`${role} already exists: ${existing.username}`);
    return;
  }

  const username = process.env[`SEED_${envPrefix}_USERNAME`] || defaultUsername;
  const password = process.env[`SEED_${envPrefix}_PASSWORD`] || generateTempPassword(envPrefix);
  const passwordHash = await hashPassword(password);

  await prisma.user.create({
    data: { username, passwordHash, role, mustChangePassword: true },
  });

  console.log(`${role} created: ${username} / ${password}`);
}

async function seedDepartments(map, track) {
  for (const [deptName, levels] of Object.entries(map)) {
    const department = await prisma.department.upsert({
      where: { name: deptName },
      update: {},
      create: { name: deptName, track },
    });

    for (let i = 0; i < levels.length; i++) {
      const level = await prisma.level.upsert({
        where: { departmentId_name: { departmentId: department.id, name: levels[i] } },
        update: {},
        create: { departmentId: department.id, name: levels[i], order: i },
      });

      const courseList = TVET_COURSES[`${deptName}|${levels[i]}`];
      if (courseList) {
        for (const [code, name] of courseList) {
          const existing = await prisma.course.findFirst({ where: { levelId: level.id, code } });
          if (!existing) {
            await prisma.course.create({ data: { levelId: level.id, name, code } });
          }
        }
      }
    }
    console.log(`Department ready: ${deptName} (${levels.length} levels)`);
  }
}

async function main() {
  console.log("--- Permanent accounts ---");
  await createPermanentUser("admin", "ADMIN", "admin");
  await createPermanentUser("registrar", "REGISTRAR", "registrar");
  await createPermanentUser("finance", "FINANCE", "finance");

  console.log("--- TVET departments ---");
  await seedDepartments(TVET_DEPARTMENTS, "tvet");

  console.log("--- Degree departments ---");
  await seedDepartments(DEGREE_DEPARTMENTS, "degree");

  console.log("Done. Log in and change any temp passwords immediately.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
