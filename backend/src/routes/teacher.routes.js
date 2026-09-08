import { Router } from "express";
import prisma from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/rbac.js";
import { uploadExamPdf, publicUrlFor } from "../lib/upload.js";
import { computeTotalScore, computeLetterGrade } from "../utils/grade-scale.js";
import { isValidDegreeLetterGrade } from "../utils/degree-grade-scale.js";

const router = Router();
router.use(authenticate, requireRole("teacher"));

// ---------- Courses assigned to this teacher ----------
router.get("/courses", async (req, res) => {
  const courses = await prisma.course.findMany({
    where: { teacherId: req.user.id },
    include: { level: { include: { department: true } } },
  });
  res.json(courses);
});

async function assertOwnCourse(req, res, courseId) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { level: { include: { department: true } } },
  });
  if (!course || course.teacherId !== req.user.id) {
    res.status(403).json({ error: "You are not the assigned teacher for this course" });
    return null;
  }
  return course;
}

// ---------- Students for a course (by level) ----------
router.get("/courses/:courseId/students", async (req, res) => {
  const course = await assertOwnCourse(req, res, req.params.courseId);
  if (!course) return;
  const students = await prisma.student.findMany({
    where: { levelId: course.levelId, recordStatus: "active" },
    include: { user: true },
  });
  res.json(students);
});

// Teacher-editable status on their own course — purely informational,
// visible to Admin on the Teachers page. Reuses the same ownership check
// as grade submission (assertOwnCourse, defined below) so a teacher can
// only ever change the status of a course actually assigned to them.
router.patch("/courses/:id/status", async (req, res) => {
  const { status } = req.body;
  if (!["ongoing", "completed"].includes(status)) {
    return res.status(400).json({ error: "status must be 'ongoing' or 'completed'" });
  }
  const course = await assertOwnCourse(req, res, req.params.id);
  if (!course) return;
  const updated = await prisma.course.update({ where: { id: course.id }, data: { status } });
  res.json(updated);
});

// Students for a level directly — used for Attendance, which isn't tied to
// a specific course. Scoped to the teacher's own department.
router.get("/levels/:levelId/students", async (req, res) => {
  const level = await prisma.level.findUnique({ where: { id: req.params.levelId } });
  if (!level || level.departmentId !== req.user.departmentId) {
    return res.status(403).json({ error: "Not authorized for this level" });
  }
  const students = await prisma.student.findMany({
    where: { levelId: level.id, recordStatus: "active" },
    include: { user: true },
  });
  res.json(students);
});

// ---------- Grades ----------
// Submitting always (re)starts at pending_dept_head — including edits after
// a rejection, per the spec's teacher -> dept head -> admin -> registrar chain.
// Statuses still owned by the teacher — anything past this point means a
// Department Head has already made a decision, and the grade is locked.
const TEACHER_EDITABLE_STATUSES = ["pending_dept_head", "rejected_by_dept_head"];

router.post("/grades", async (req, res) => {
  const { studentId, courseId, theoryScore, practiceScore, cooperativeScore, letterGrade: submittedLetterGrade } = req.body;

  const course = await assertOwnCourse(req, res, courseId);
  if (!course) return;

  // Lock check: once a Dept Head has approved (status moves to
  // pending_admin) or Admin has given final approval (status: approved),
  // the teacher can no longer overwrite this grade via re-submission.
  const existing = await prisma.grade.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
  });
  if (existing && !TEACHER_EDITABLE_STATUSES.includes(existing.status)) {
    return res.status(403).json({
      error: "This grade has already been approved by the Department Head and is locked. Contact Admin for corrections.",
    });
  }

  const isDegree = course.level.department.track === "degree";
  let theory = null, practice = null, cooperative = null, totalScore = null, letterGrade = null;

  if (isDegree) {
    if (!isValidDegreeLetterGrade(submittedLetterGrade)) {
      return res.status(400).json({ error: "Invalid letter grade" });
    }
    letterGrade = submittedLetterGrade;
  } else {
    theory = theoryScore; practice = practiceScore; cooperative = cooperativeScore;
    totalScore = computeTotalScore({ theoryScore, practiceScore, cooperativeScore });
    letterGrade = computeLetterGrade(totalScore);
  }

  const grade = await prisma.grade.upsert({
    where: { studentId_courseId: { studentId, courseId } },
    update: {
      theoryScore: theory, practiceScore: practice, cooperativeScore: cooperative, totalScore, letterGrade,
      status: "pending_dept_head",
      deptHeadDecisionById: null, deptHeadDecidedAt: null,
      adminDecisionById: null, adminDecidedAt: null,
    },
    create: {
      studentId, courseId,
      theoryScore: theory, practiceScore: practice, cooperativeScore: cooperative, totalScore, letterGrade,
      submittedById: req.user.id, status: "pending_dept_head",
    },
  });

  res.status(201).json(grade);
});

// Grades this teacher has entered — the frontend keeps a local draft copy so
// in-progress entry survives an accidental refresh; this is what's actually
// been submitted so far.
router.get("/grades", async (req, res) => {
  const grades = await prisma.grade.findMany({
    where: { submittedById: req.user.id },
    include: { student: { include: { user: true } }, course: true },
  });
  res.json(grades);
});

// ---------- Exams (PDF only) ----------
router.post("/exams", uploadExamPdf.single("file"), async (req, res) => {
  const { courseId, title } = req.body;
  const course = await assertOwnCourse(req, res, courseId);
  if (!course) return;
  if (!title?.trim()) {
    return res.status(400).json({
      error: "A title is required — include the academic year and exam type, e.g. \"2018 E.C. — Midterm Exam\"",
    });
  }
  if (!req.file) return res.status(400).json({ error: "A PDF file is required — exams can only be uploaded as PDF" });

  const exam = await prisma.exam.create({
    data: {
      courseId,
      title: title.trim(),
      fileUrl: publicUrlFor("exams", req.file.filename),
      submittedById: req.user.id,
      status: "pending_dept_head",
    },
  });
  res.status(201).json(exam);
});

router.get("/exams", async (req, res) => {
  const exams = await prisma.exam.findMany({
    where: { submittedById: req.user.id },
    include: { course: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(exams);
});

// Remove a rejected exam so the teacher can re-upload a corrected one.
router.delete("/exams/:id", async (req, res) => {
  const exam = await prisma.exam.findUnique({ where: { id: req.params.id } });
  if (!exam || exam.submittedById !== req.user.id) {
    return res.status(403).json({ error: "Not your exam submission" });
  }
  if (!["rejected_by_dept_head", "rejected_by_admin"].includes(exam.status)) {
    return res.status(400).json({ error: "Only a rejected exam can be removed and reuploaded" });
  }
  await prisma.exam.delete({ where: { id: req.params.id } });
  res.json({ message: "Removed — upload a corrected PDF" });
});

// ---------- Attendance (digital, per department+level+date) ----------
router.post("/attendance", async (req, res) => {
  const { departmentId, levelId, instructorName, date, records } = req.body;
  // records: [{ studentId, present: boolean }]
  if (!departmentId || !levelId || !instructorName || !date || !Array.isArray(records)) {
    return res.status(400).json({ error: "departmentId, levelId, instructorName, date, and records are required" });
  }
  if (departmentId !== req.user.departmentId) {
    return res.status(403).json({ error: "Not authorized for this department" });
  }

  const session = await prisma.attendanceSession.upsert({
    where: {
      departmentId_levelId_teacherId_date: {
        departmentId, levelId, teacherId: req.user.id, date: new Date(date),
      },
    },
    update: { instructorName },
    create: { departmentId, levelId, teacherId: req.user.id, instructorName, date: new Date(date) },
  });

  // Editable always: wipe and reinsert this session's records.
  await prisma.attendanceRecord.deleteMany({ where: { sessionId: session.id } });
  await prisma.attendanceRecord.createMany({
    data: records.map((r) => ({ sessionId: session.id, studentId: r.studentId, present: r.present })),
  });

  res.status(201).json({ message: "Attendance submitted", sessionId: session.id });
});

router.get("/attendance", async (req, res) => {
  const sessions = await prisma.attendanceSession.findMany({
    where: { teacherId: req.user.id },
    include: { records: true },
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