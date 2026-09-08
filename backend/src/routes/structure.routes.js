import { Router } from "express";
import prisma from "../config/prisma.js";
import { authenticate } from "../middleware/rbac.js";

const router = Router();
router.use(authenticate);

router.get("/departments", async (req, res) => {
  res.json(await prisma.department.findMany({ orderBy: { name: "asc" } }));
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

router.get("/courses", async (req, res) => {
  const { levelId } = req.query;
  res.json(
    await prisma.course.findMany({
      where: levelId ? { levelId } : undefined,
      include: { teacher: { select: { id: true, username: true, fullName: true } }, level: true },
    })
  );
});

// Finds the right certificate template for a given student.
// ?type=original|temporary — the Registrar's choice.
// Level 2 Terminal students (Accounting/HRM's Level 2 Terminal path) are not
// eligible for certificate generation at all — returns { eligible: false }
// instead of a template, and the Registrar UI hides the generation flow
// entirely for them rather than offering Original/Temporary.
router.get("/certificate-template-for-student/:studentId", async (req, res) => {
  const student = await prisma.student.findUnique({ where: { id: req.params.studentId } });
  if (!student) return res.status(404).json({ error: "Student not found" });

  if (student.track === "tvet" && student.programType === "level2_terminal") {
    return res.json({ eligible: false, template: null, certificateType: null });
  }

  const certificateType = req.query.type === "temporary" ? "temporary" : "original";
  const template = await prisma.certificateTemplate.findFirst({
    where: { track: student.track, certificateType, departmentId: student.departmentId },
  });
  res.json({ eligible: true, template: template || null, certificateType });
});

export default router;
