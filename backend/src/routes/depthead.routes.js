import { Router } from "express";
import prisma from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/rbac.js";

const router = Router();
router.use(authenticate, requireRole("dept_head"));

// ---------- Grades: view + approve/reject (own department only) ----------
router.get("/grades", async (req, res) => {
  const { levelId, courseId, status, search } = req.query;
  const grades = await prisma.grade.findMany({
    where: {
      course: {
        level: { departmentId: req.user.departmentId, ...(levelId ? { id: levelId } : {}) },
        ...(courseId ? { id: courseId } : {}),
      },
      ...(status ? { status } : {}),
      ...(search ? { student: { user: { OR: [
        { username: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
      ] } } } : {}),
    },
    include: {
      student: { include: { user: true } },
      course: { include: { level: true } },
      submittedBy: { select: { username: true, fullName: true } },
    },
  });
  res.json(grades);
});

router.patch("/grades/:id/decision", async (req, res) => {
  const { decision } = req.body; // "approved" -> pending_admin ; "rejected"
  if (!["approved", "rejected"].includes(decision)) {
    return res.status(400).json({ error: "decision must be approved or rejected" });
  }

  const grade = await prisma.grade.findUnique({
    where: { id: req.params.id },
    include: { course: { include: { level: true } } },
  });
  if (!grade) return res.status(404).json({ error: "Grade not found" });
  if (grade.course.level.departmentId !== req.user.departmentId) {
    return res.status(403).json({ error: "Grade is outside your department" });
  }

  const updated = await prisma.grade.update({
    where: { id: req.params.id },
    data: {
      status: decision === "approved" ? "pending_admin" : "rejected_by_dept_head",
      deptHeadDecisionById: req.user.id,
      deptHeadDecidedAt: new Date(),
    },
  });
  res.json(updated);
});

// ---------- Exams: view + approve/reject (rejection REQUIRES a note) ----------
router.get("/exams", async (req, res) => {
  const { levelId, status } = req.query;
  const exams = await prisma.exam.findMany({
    where: {
      course: { level: { departmentId: req.user.departmentId, ...(levelId ? { id: levelId } : {}) } },
      ...(status ? { status } : {}),
    },
    include: { course: { include: { level: true } }, submittedBy: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(exams);
});

router.patch("/exams/:id/decision", async (req, res) => {
  const { decision, rejectionNote } = req.body;
  if (!["approved", "rejected"].includes(decision)) {
    return res.status(400).json({ error: "decision must be approved or rejected" });
  }
  if (decision === "rejected" && !rejectionNote?.trim()) {
    return res.status(400).json({ error: "A rejection note is required so the teacher knows what to fix" });
  }

  const exam = await prisma.exam.findUnique({
    where: { id: req.params.id },
    include: { course: { include: { level: true } } },
  });
  if (!exam) return res.status(404).json({ error: "Exam not found" });
  if (exam.course.level.departmentId !== req.user.departmentId) {
    return res.status(403).json({ error: "Exam is outside your department" });
  }

  const updated = await prisma.exam.update({
    where: { id: req.params.id },
    data: {
      status: decision === "approved" ? "pending_admin" : "rejected_by_dept_head",
      rejectionNote: decision === "rejected" ? rejectionNote : null,
      deptHeadDecisionById: req.user.id,
      deptHeadDecidedAt: new Date(),
    },
  });
  res.json(updated);
});

// ---------- Attendance: view all submitted for this department ----------
router.get("/attendance", async (req, res) => {
  const { levelId } = req.query;
  const sessions = await prisma.attendanceSession.findMany({
    where: { departmentId: req.user.departmentId, ...(levelId ? { levelId } : {}) },
    include: { records: true, teacher: { select: { username: true, fullName: true } } },
    orderBy: { date: "desc" },
  });
  res.json(sessions);
});

// ---------- Curriculum (own department — PDFs added in a later pass) ----------
router.get("/curricula", async (req, res) => {
  const curricula = await prisma.curriculum.findMany({
    where: { departmentId: req.user.departmentId },
    include: { level: true },
  });
  res.json(curricula);
});

export default router;
