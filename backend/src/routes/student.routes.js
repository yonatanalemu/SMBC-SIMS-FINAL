import { Router } from "express";
import prisma from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/rbac.js";
import { uploadPaymentProof, publicUrlFor } from "../lib/upload.js";
import { resetExpiredTuition } from "../utils/tuition.js";

const router = Router();
router.use(authenticate, requireRole("student"));

async function getOwnStudent(req) {
  return prisma.student.findUnique({ where: { userId: req.user.id } });
}

// ---------- Grades (approved only, fetched via own Unique ID) ----------
router.get("/grades", async (req, res) => {
  const student = await getOwnStudent(req);
  const grades = await prisma.grade.findMany({
    where: { studentId: student.id, status: "approved" },
    include: { course: { include: { level: true } } },
  });
  res.json(grades);
});

// Full transcript-shaped view of the student's own approved grades — same
// document format the Registrar exports, so what a student sees on their
// Grades page is exactly the transcript that gets generated for them later.
router.get("/transcript", async (req, res) => {
  const student = await prisma.student.findUnique({
    where: { userId: req.user.id },
    include: {
      user: true, department: true, level: true,
      grades: { where: { status: "approved" }, include: { course: { include: { level: true } } } },
    },
  });
  res.json(student);
});

// ---------- Payments ----------
router.get("/invoices", async (req, res) => {
  // Same monthly-reset check as Finance/Admin's routes — a student loading
  // their own dashboard is often the FIRST person to hit a route after the
  // month rolls over, so this needs to run here too, not just staff-side.
  await resetExpiredTuition();
  const student = await getOwnStudent(req);
  const invoices = await prisma.invoice.findMany({ where: { studentId: student.id }, orderBy: { createdAt: "desc" } });
  res.json(invoices);
});

router.get("/payment-proofs", async (req, res) => {
  const student = await getOwnStudent(req);
  const proofs = await prisma.paymentProof.findMany({
    where: { studentId: student.id },
    orderBy: { uploadedAt: "desc" },
  });
  res.json(proofs);
});

router.post("/payment-proofs", uploadPaymentProof.array("screenshots", 6), async (req, res) => {
  const { periodMonth } = req.body; // e.g. "2026-07"
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: "At least one payment screenshot is required" });
  if (!periodMonth) return res.status(400).json({ error: "periodMonth is required" });

  const student = await getOwnStudent(req);
  const proof = await prisma.paymentProof.create({
    data: {
      studentId: student.id,
      screenshotUrls: req.files.map((f) => publicUrlFor("payment-proofs", f.filename)),
      periodMonth,
      status: "pending",
    },
  });
  res.status(201).json(proof);
});

// ---------- Attendance (via own Student ID) ----------
router.get("/attendance", async (req, res) => {
  const student = await getOwnStudent(req);
  const records = await prisma.attendanceRecord.findMany({
    where: { studentId: student.id },
    include: { session: true },
    orderBy: { session: { date: "desc" } },
  });
  res.json(records);
});

// ---------- Schedules (Admin-uploaded, filtered by own department+level) ----------
router.get("/schedules", async (req, res) => {
  const student = await getOwnStudent(req);
  const schedules = await prisma.schedule.findMany({
    where: { departmentId: student.departmentId },
    orderBy: { createdAt: "desc" },
  });
  res.json(schedules);
});

// ---------- Curriculum (own department+level) ----------
router.get("/curricula", async (req, res) => {
  const student = await getOwnStudent(req);
  const curricula = await prisma.curriculum.findMany({
    where: { departmentId: student.departmentId, levelId: student.levelId },
  });
  res.json(curricula);
});

export default router;
