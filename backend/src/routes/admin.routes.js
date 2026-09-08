import { Router } from "express";
import prisma from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/rbac.js";
import { hashPassword, generateTempPassword } from "../utils/auth.js";
import { generateUsername } from "../utils/id-generator.js";
import { uploadCurriculumPdf, uploadCertificateTemplate, publicUrlFor } from "../lib/upload.js";

const router = Router();
router.use(authenticate, requireRole("admin"));

// ---------- Departments ----------
router.post("/departments", async (req, res) => {
  const { name, track } = req.body; // track: "tvet" | "degree"
  if (!name || !["tvet", "degree"].includes(track)) {
    return res.status(400).json({ error: "name and a valid track (tvet|degree) are required" });
  }
  const department = await prisma.department.create({ data: { name, track } });
  res.status(201).json(department);
});

router.get("/departments", async (req, res) => {
  res.json(await prisma.department.findMany({ orderBy: { name: "asc" } }));
});

// ---------- Levels ----------
router.post("/levels", async (req, res) => {
  const { departmentId, name, order } = req.body;
  if (!departmentId || !name) {
    return res.status(400).json({ error: "departmentId and name are required" });
  }
  const level = await prisma.level.create({ data: { departmentId, name, order: order || 0 } });
  res.status(201).json(level);
});

router.get("/levels", async (req, res) => {
  const { departmentId } = req.query;
  res.json(
    await prisma.level.findMany({
      where: departmentId ? { departmentId } : undefined,
      orderBy: { order: "asc" },
      include: { department: true },
    })
  );
});

// ---------- Courses ----------
router.post("/courses", async (req, res) => {
  const { levelId, name, code, courseNo, creditHours, teacherId } = req.body;
  if (!levelId || !name) return res.status(400).json({ error: "levelId and name are required" });
  const course = await prisma.course.create({
    data: {
      levelId, name, code: code || null, courseNo: courseNo || null,
      creditHours: creditHours ? Number(creditHours) : null,
      teacherId: teacherId || null,
    },
  });
  res.status(201).json(course);
});

router.get("/courses", async (req, res) => {
  const { levelId } = req.query;
  res.json(
    await prisma.course.findMany({
      where: levelId ? { levelId } : undefined,
      include: { teacher: { select: { id: true, username: true, fullName: true } }, level: true },
    })
  );
});

router.patch("/courses/:id/teacher", async (req, res) => {
  const { teacherId } = req.body;
  const course = await prisma.course.update({
    where: { id: req.params.id },
    data: { teacherId: teacherId || null },
  });
  res.json(course);
});

// ---------- Teachers ----------
// Creates a brand-new Teacher account (TCR-xxx). Admin also tracks submission
// status and assigns courses (via PATCH /courses/:id/teacher above).
router.post("/teachers", async (req, res) => {
  const { departmentId, fullName, email, phone } = req.body;
  if (!departmentId) return res.status(400).json({ error: "departmentId is required" });

  const username = await generateUsername(prisma, "teacher");
  const tempPassword = generateTempPassword("TCR");
  const passwordHash = await hashPassword(tempPassword);

  const user = await prisma.user.create({
    data: {
      username,
      fullName,
      email,
      phone,
      passwordHash,
      role: "teacher",
      mustChangePassword: true,
      createdById: req.user.id,
      staffProfile: { create: { departmentId } },
    },
    include: { staffProfile: true },
  });

  res.status(201).json({
    message: "Teacher account created",
    username: user.username,
    tempPassword,
    departmentId: user.staffProfile.departmentId,
  });
});

router.get("/teachers", async (req, res) => {
  const { departmentId } = req.query;
  const teachers = await prisma.user.findMany({
    where: { role: "teacher", staffProfile: departmentId ? { departmentId } : undefined },
    include: {
      staffProfile: { include: { department: true } },
      taughtCourses: { include: { level: true } },
    },
  });
  res.json(teachers);
});

// Delete once a teacher's courses are finished, per spec.
router.delete("/teachers/:id", async (req, res) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ message: "Teacher deactivated" });
});

router.get("/dept-heads", async (req, res) => {
  const deptHeads = await prisma.user.findMany({
    where: { role: "dept_head" },
    include: { staffProfile: { include: { department: true } } },
  });
  res.json(deptHeads);
});

// Deactivate a Department Head account — mirrors DELETE /teachers/:id.
// Disables login on their separate DHD-xxx account only; the source
// Teacher account (linked via promotedFromId) is untouched.
router.delete("/dept-heads/:id", async (req, res) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ message: "Department Head deactivated" });
});
// Reset a Teacher, Dept Head, Registrar, or Finance account's password — same
// response shape as the Registrar's student reset, so the frontend can reuse
// one modal: { username, tempPassword }. New password must be used or
// changed under Settings; mustChangePassword is forced back on.
// Admin's own account is deliberately excluded — resetting yourself this way
// would be a footgun with no real use case (use the normal change-password
// flow under Settings instead).
const RESETTABLE_ROLES = { teacher: "TCR", dept_head: "DHD", registrar: "REG", finance: "FIN" };
router.patch("/users/:id/reset-password", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user || !RESETTABLE_ROLES[user.role]) {
    return res.status(404).json({ error: "No resettable account found with that id" });
  }

  const tempPassword = generateTempPassword(RESETTABLE_ROLES[user.role]);
  const passwordHash = await hashPassword(tempPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: true, tokenVersion: { increment: 1 } },
  });

  res.json({ username: user.username, tempPassword });
});

// Registrar and Finance are the two other permanent (non-auto-generated-ID)
// accounts alongside Admin itself — surfaced here so Admin has a single place
// to reset either one's password (see the User Management sidebar tab).
router.get("/permanent-users", async (req, res) => {
  const users = await prisma.user.findMany({
    where: { role: { in: ["registrar", "finance"] } },
    select: { id: true, username: true, fullName: true, email: true, phone: true, role: true, createdAt: true },
    orderBy: { role: "asc" },
  });
  res.json(users);
});

// ---------- Department Head assignment ----------
// Per spec: "a dropdown of all teachers must appear because only teachers in
// the school can be assigned as a Department Head" — the dropdown sources
// from existing Teacher accounts, but Dept Head gets its OWN separate
// DHD-xxx login, distinct from that person's TCR-xxx teacher account (they
// hold two logins). `promotedFromId` links back to the source teacher for
// traceability.
router.get("/eligible-dept-heads", async (req, res) => {
  const teachers = await prisma.user.findMany({
    where: { role: "teacher", isActive: true },
    select: { id: true, username: true, fullName: true, staffProfile: { include: { department: true } } },
  });
  res.json(teachers);
});

router.post("/dept-heads/assign", async (req, res) => {
  const { teacherId, departmentId } = req.body;
  if (!teacherId || !departmentId) {
    return res.status(400).json({ error: "teacherId and departmentId are required" });
  }

  const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
  if (!teacher || teacher.role !== "teacher") {
    return res.status(400).json({ error: "teacherId must reference an existing Teacher account" });
  }

  const username = await generateUsername(prisma, "dept_head");
  const tempPassword = generateTempPassword("DHD");
  const passwordHash = await hashPassword(tempPassword);

  const deptHead = await prisma.user.create({
    data: {
      username,
      fullName: teacher.fullName,
      email: teacher.email,
      phone: teacher.phone,
      passwordHash,
      role: "dept_head",
      mustChangePassword: true,
      createdById: req.user.id,
      promotedFromId: teacher.id,
      staffProfile: { create: { departmentId } },
    },
  });

  res.status(201).json({
    message: "Department Head account created",
    username: deptHead.username,
    tempPassword,
    departmentId,
    promotedFrom: teacher.username,
  });
});

// ---------- Dashboard metrics ----------
router.get("/dashboard", async (req, res) => {
  const [totalStudents, maleCount, femaleCount, totalTeachers, totalDeptHeads, ageRows] =
    await Promise.all([
      prisma.student.count({ where: { recordStatus: { not: "graduated" } } }),
      prisma.student.count({ where: { sex: "M", recordStatus: { not: "graduated" } } }),
      prisma.student.count({ where: { sex: "F", recordStatus: { not: "graduated" } } }),
      prisma.user.count({ where: { role: "teacher", isActive: true } }),
      prisma.user.count({ where: { role: "dept_head", isActive: true } }),
      prisma.student.findMany({
        where: { recordStatus: { not: "graduated" }, age: { not: null } },
        select: { age: true },
      }),
    ]);

  res.json({
    totalStudents,
    genderBreakdown: { male: maleCount, female: femaleCount },
    totalTeachers,
    totalDeptHeads,
    ages: ageRows.map((r) => r.age),
  });
});

// ---------- Curriculum ----------
router.post("/curricula", uploadCurriculumPdf.single("file"), async (req, res) => {
  const { departmentId, levelId } = req.body;
  if (!departmentId || !levelId) return res.status(400).json({ error: "departmentId and levelId are required" });
  if (!req.file) return res.status(400).json({ error: "A PDF file is required" });

  const curriculum = await prisma.curriculum.create({
    data: { departmentId, levelId, fileUrl: publicUrlFor("curricula", req.file.filename) },
  });
  res.status(201).json(curriculum);
});

router.get("/curricula", async (req, res) => {
  const { departmentId, levelId } = req.query;
  const curricula = await prisma.curriculum.findMany({
    where: { ...(departmentId ? { departmentId } : {}), ...(levelId ? { levelId } : {}) },
    include: { department: true, level: true },
    orderBy: { uploadedAt: "desc" },
  });
  res.json(curricula);
});

router.delete("/curricula/:id", async (req, res) => {
  await prisma.curriculum.delete({ where: { id: req.params.id } });
  res.json({ message: "Removed" });
});

// ---------- Certificate Templates ----------
// One PNG per (track, certificateType, department) combination — original or
// temporary only (Level 2 Terminal students are not eligible for a
// certificate at all, see structure.routes.js). This is the primary way
// certificate templates get into the system now; unlike Curriculum, there is
// no content/ folder-drop path for certificates. The 18 real department
// templates are bootstrapped on first boot by prisma/seed-certificates.js —
// this endpoint is for replacing/adding templates afterward.
router.post("/certificate-templates", uploadCertificateTemplate.single("image"), async (req, res) => {
  const { track, certificateType, departmentId } = req.body;
  if (!track || !certificateType || !departmentId) {
    return res.status(400).json({ error: "track, certificateType, and departmentId are required" });
  }
  if (!req.file) return res.status(400).json({ error: "A PNG/image file is required" });

  const imageUrl = publicUrlFor("certificate-templates", req.file.filename);

  const template = await prisma.certificateTemplate.upsert({
    where: { track_certificateType_departmentId: { track, certificateType, departmentId } },
    update: { imageUrl },
    create: { track, certificateType, departmentId, imageUrl },
  });
  res.status(201).json(template);
});

router.get("/certificate-templates", async (req, res) => {
  const templates = await prisma.certificateTemplate.findMany({ include: { department: true } });
  res.json(templates);
});

router.delete("/certificate-templates/:id", async (req, res) => {
  await prisma.certificateTemplate.delete({ where: { id: req.params.id } });
  res.json({ message: "Removed" });
});

export default router;
