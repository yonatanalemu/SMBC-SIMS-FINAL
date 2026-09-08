import { Router } from "express";
import prisma from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/rbac.js";
import { computeTotalScore, computeLetterGrade } from "../utils/grade-scale.js";
import { isValidDegreeLetterGrade } from "../utils/degree-grade-scale.js";

const router = Router();
router.use(authenticate, requireRole("admin"));

// ---------- Grades: final Admin checkpoint before Registrar ----------
router.get("/grades", async (req, res) => {
  const { levelId, courseId, status } = req.query;
  const grades = await prisma.grade.findMany({
    where: {
      ...(levelId ? { course: { levelId } } : {}),
      ...(courseId ? { courseId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      student: { include: { user: true } },
      course: { include: { level: { include: { department: true } } } },
      submittedBy: { select: { username: true, fullName: true } },
      deptHeadDecisionBy: { select: { username: true, fullName: true } },
    },
  });
  res.json(grades);
});

// Admin can edit the score at any time, including after their own approval —
// per spec, later edits still need to propagate to the Registrar.
router.patch("/grades/:id", async (req, res) => {
  const existing = await prisma.grade.findUnique({
    where: { id: req.params.id },
    include: { course: { include: { level: { include: { department: true } } } } },
  });
  if (!existing) return res.status(404).json({ error: "Grade not found" });

  const isDegree = existing.course.level.department.track === "degree";
  let data;

  if (isDegree) {
    const { letterGrade } = req.body;
    if (letterGrade && !isValidDegreeLetterGrade(letterGrade)) {
      return res.status(400).json({ error: "Invalid letter grade" });
    }
    data = { letterGrade: letterGrade ?? existing.letterGrade };
  } else {
    const { theoryScore, practiceScore, cooperativeScore } = req.body;
    const merged = {
      theoryScore: theoryScore ?? existing.theoryScore,
      practiceScore: practiceScore ?? existing.practiceScore,
      cooperativeScore: cooperativeScore ?? existing.cooperativeScore,
    };
    const totalScore = computeTotalScore(merged);
    const letterGrade = computeLetterGrade(totalScore);
    data = { ...merged, totalScore, letterGrade };
  }

  const updated = await prisma.grade.update({ where: { id: req.params.id }, data });
  res.json(updated);
});

router.patch("/grades/:id/approve", async (req, res) => {
  const grade = await prisma.grade.findUnique({ where: { id: req.params.id } });
  if (!grade) return res.status(404).json({ error: "Grade not found" });
  if (grade.status !== "pending_admin") {
    return res.status(400).json({ error: "Grade must be Dept-Head-approved first" });
  }
  const updated = await prisma.grade.update({
    where: { id: req.params.id },
    data: { status: "approved", adminDecisionById: req.user.id, adminDecidedAt: new Date() },
  });
  res.json(updated);
});

// ---------- Exams: final Admin checkpoint before Registrar ----------
router.get("/exams", async (req, res) => {
  const { levelId, status } = req.query;
  const exams = await prisma.exam.findMany({
    where: {
      ...(levelId ? { course: { levelId } } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      course: { include: { level: { include: { department: true } } } },
      submittedBy: { select: { username: true, fullName: true } },
      deptHeadDecisionBy: { select: { username: true, fullName: true } },
    },
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

  const exam = await prisma.exam.findUnique({ where: { id: req.params.id } });
  if (!exam) return res.status(404).json({ error: "Exam not found" });
  if (exam.status !== "pending_admin") {
    return res.status(400).json({ error: "Exam must be Dept-Head-approved first" });
  }

  const updated = await prisma.exam.update({
    where: { id: req.params.id },
    data: {
      status: decision === "approved" ? "approved" : "rejected_by_admin",
      rejectionNote: decision === "rejected" ? rejectionNote : null,
      adminDecisionById: req.user.id,
      adminDecidedAt: new Date(),
    },
  });
  res.json(updated);
});

// ---------- Attendance: digital, exportable ----------
router.get("/attendance", async (req, res) => {
  const { levelId, teacherId } = req.query;
  const where = {};
  if (levelId) where.levelId = levelId;
  if (teacherId) where.teacherId = teacherId;
  const sessions = await prisma.attendanceSession.findMany({
    where,
    include: {
      records: { include: { student: { include: { user: true } } } },
    },
    orderBy: { date: "desc" },
  });
  res.json(sessions);
});

router.get("/attendance/export", async (req, res) => {
  const { levelId, teacherId } = req.query;
  if (!levelId || !teacherId) {
    return res.status(400).json({ error: "Select both a level and a teacher before exporting" });
  }

  const [level, teacher] = await Promise.all([
    prisma.level.findUnique({ where: { id: levelId }, include: { department: true } }),
    prisma.user.findUnique({ where: { id: teacherId } }),
  ]);
  if (!level) return res.status(404).json({ error: "Level not found" });
  if (!teacher) return res.status(404).json({ error: "Teacher not found" });

  const sessions = await prisma.attendanceSession.findMany({
    where: { levelId, teacherId },
    include: {
      records: { include: { student: { include: { user: true } } } },
    },
    orderBy: { date: "asc" },
  });

  const dates = [...new Set(sessions.map((s) => s.date.toISOString().slice(0, 10)))].sort();

  const studentsById = new Map();
  for (const s of sessions) {
    for (const r of s.records) {
      if (!studentsById.has(r.studentId)) studentsById.set(r.studentId, r.student.user);
    }
  }
  const students = [...studentsById.entries()].sort((a, b) =>
    (a[1].fullName || a[1].username).localeCompare(b[1].fullName || b[1].username)
  );

  const byDateStudent = {};
  for (const s of sessions) {
    const dateKey = s.date.toISOString().slice(0, 10);
    byDateStudent[dateKey] = byDateStudent[dateKey] || {};
    for (const r of s.records) byDateStudent[dateKey][r.studentId] = r.present;
  }

  const headerBlock = [
    "SITTI MEDICAL AND BUSINESS COLLEGE",
    "Attendance Register",
    `Teacher:,${teacher.fullName || teacher.username}`,
    `Department:,${level.department.name}`,
    `Level:,${level.name}`,
    `Generated:,${new Date().toISOString().slice(0, 10)}`,
    "",
  ];

  const columnHeader = ["student_username", "student_full_name", ...dates, "days_present", "days_absent", "days_marked"].join(",");
  const rows = students
    .map(([studentId, user]) => {
      let present = 0, marked = 0;
      const cells = dates.map((d) => {
        const val = byDateStudent[d]?.[studentId];
        if (val === undefined) return "";
        marked++;
        if (val) present++;
        return val ? "P" : "A";
      });
      const absent = marked - present;
      return [user.username, (user.fullName || "").replace(/,/g, ";"), ...cells, present, absent, marked].join(",");
    })
    .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=attendance-${teacher.username}-${level.name.replace(/\s+/g, "_")}.csv`);
  res.send(headerBlock.join("\n") + columnHeader + "\n" + rows);
});

export default router;
