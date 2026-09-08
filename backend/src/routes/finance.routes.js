import { Router } from "express";
import prisma from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/rbac.js";
import { resetExpiredTuition } from "../utils/tuition.js";
import { getInvoiceDefaults } from "./settings.routes.js";

const router = Router();
router.use(authenticate);

// ---------- Students: paid/unpaid list ----------
// Admin mirrors everything Finance does here EXCEPT the Registration tab below.
router.get("/students", requireRole("finance", "admin"), async (req, res) => {
  await resetExpiredTuition();
  const { departmentId, search } = req.query;
  const students = await prisma.student.findMany({
    where: {
      recordStatus: { not: "graduated" },
      ...(departmentId ? { departmentId } : {}),
      ...(search ? { user: { OR: [
        { username: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
      ] } } : {}),
    },
    include: {
      user: true, department: true, level: true,
      invoices: true,
      paymentProofs: { orderBy: { uploadedAt: "desc" }, take: 1 },
    },
  });
  res.json(students);
});

// CSV export of all students filtered by paid/unpaid tuition status.
// Registered BEFORE /students/:id so "export" isn't swallowed as an id param.
router.get("/students/export", requireRole("finance", "admin"), async (req, res) => {
  await resetExpiredTuition();
  const { status, departmentId } = req.query; // status: "paid" | "unpaid" | omitted for all
  if (status && !["paid", "unpaid"].includes(status)) {
    return res.status(400).json({ error: "status must be paid or unpaid" });
  }

  const students = await prisma.student.findMany({
    where: {
      recordStatus: { not: "graduated" },
      ...(status ? { tuitionStatus: status } : {}),
      ...(departmentId ? { departmentId } : {}),
    },
    include: {
      user: true, department: true, level: true,
      paymentProofs: { orderBy: { uploadedAt: "desc" }, take: 1 },
    },
  });

  const header = "username,full_name,department,level,tuition_status,last_payment_period,record_status\n";
  const rows = students
    .map((s) =>
      [
        s.user.username,
        (s.user.fullName || "").replace(/,/g, ";"),
        s.department.name,
        s.level.name,
        s.tuitionStatus,
        s.paymentProofs[0]?.periodMonth || "",
        s.recordStatus,
      ].join(",")
    )
    .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=students-${status || "all"}.csv`);
  res.send(header + rows);
});

router.get("/students/:id", requireRole("finance", "admin"), async (req, res) => {
  await resetExpiredTuition();
  const student = await prisma.student.findUnique({
    where: { id: req.params.id },
    include: {
      user: true, department: true, level: true,
      invoices: true,
      paymentProofs: { orderBy: { uploadedAt: "desc" } },
    },
  });
  if (!student) return res.status(404).json({ error: "Student not found" });
  res.json(student);
});

// Overall tuition paid/unpaid toggle — distinct from itemized Invoices below.
router.patch("/students/:id/tuition-status", requireRole("finance", "admin"), async (req, res) => {
  const { status } = req.body; // "paid" | "unpaid"
  if (!["paid", "unpaid"].includes(status)) {
    return res.status(400).json({ error: "status must be paid or unpaid" });
  }
  const student = await prisma.student.update({
    where: { id: req.params.id },
    data: { tuitionStatus: status },
  });
  res.json(student);
});

// ---------- Invoices ----------
// Assignment (single or bulk-by-department) is an Admin action per spec.
router.post("/invoices", requireRole("admin"), async (req, res) => {
  const { studentId, departmentId, levelId, title, amount } = req.body;
  if (!title || !amount) return res.status(400).json({ error: "title and amount are required" });

 if (studentId) {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return res.status(400).json({ error: "Student not found — check the ID and try again" });

    const invoice = await prisma.invoice.create({
      data: { studentId, title, amount, createdById: req.user.id },
    });
    return res.status(201).json(invoice);
  }

  if (levelId || departmentId) {
    const students = await prisma.student.findMany({
      where: { recordStatus: "active", ...(levelId ? { levelId } : { departmentId }) },
      select: { id: true },
    });
    const result = await prisma.invoice.createMany({
      data: students.map((s) => ({ studentId: s.id, title, amount, createdById: req.user.id })),
    });
    return res.status(201).json({ message: `Invoice assigned to ${result.count} students` });
  }

  res.status(400).json({ error: "Either studentId or departmentId is required" });
});

router.patch("/invoices/:id/status", requireRole("finance", "admin"), async (req, res) => {
  const { status } = req.body; // "paid" | "unpaid"
  if (!["paid", "unpaid"].includes(status)) {
    return res.status(400).json({ error: "status must be paid or unpaid" });
  }
  let invoice = await prisma.invoice.update({ where: { id: req.params.id }, data: { status } });

  // The Tuition Fee invoice specifically drives the monthly cycle — once
  // Finance marks it paid, the student isn't asked again until next month.
  if (invoice.title === "Tuition Fee") {
    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    if (status === "unpaid") {
      // Same reasoning as the automatic monthly reset in utils/tuition.js —
      // re-sync to the CURRENT rate the moment this becomes unpaid, so a
      // rate change reaches this student even if they were "paid" (and
      // therefore skipped) when the setting was originally changed.
      const { tuitionFeeAmount } = await getInvoiceDefaults();
      invoice = await prisma.invoice.update({ where: { id: invoice.id }, data: { amount: tuitionFeeAmount } });
    }

    await prisma.student.update({
      where: { id: invoice.studentId },
      data: {
        tuitionStatus: status,
        tuitionPaidUntil: status === "paid" ? endOfMonth : null,
      },
    });
  }

  res.json(invoice);
});

// ---------- Registration queue (N-badge students) — Finance only, per spec ----------
router.get("/registration", requireRole("finance"), async (req, res) => {
  const students = await prisma.student.findMany({
    where: { recordStatus: "interim" },
    include: { user: true, department: true, level: true, paymentProofs: { orderBy: { uploadedAt: "desc" } } },
  });
  res.json(students);
});

router.patch("/registration/proofs/:proofId/verify", requireRole("finance"), async (req, res) => {
  const { status } = req.body; // "verified" | "rejected"
  if (!["verified", "rejected"].includes(status)) {
    return res.status(400).json({ error: "status must be verified or rejected" });
  }
  const proof = await prisma.paymentProof.update({
    where: { id: req.params.proofId },
    data: { status, verifiedById: req.user.id },
  });
  res.json(proof);
});

// ---------- Daily transactions (EBIRR only) ----------
router.post("/transactions", requireRole("finance", "admin"), async (req, res) => {
  const { amount, date, studentId, note } = req.body;
  if (!amount || !date) return res.status(400).json({ error: "amount and date are required" });

  const transaction = await prisma.transaction.create({
    data: { amount, date: new Date(date), method: "ebirr", recordedById: req.user.id, studentId: studentId || null, note },
  });
  res.status(201).json(transaction);
});

router.get("/transactions", requireRole("finance", "admin"), async (req, res) => {
  const { range } = req.query; // today | week | month | year | all
  const now = new Date();
  let from = null;
  if (range === "today") from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  else if (range === "week") from = new Date(now.getTime() - 7 * 86400000);
  else if (range === "month") from = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (range === "year") from = new Date(now.getFullYear(), 0, 1);

  const transactions = await prisma.transaction.findMany({
    where: from ? { date: { gte: from } } : undefined,
    include: { recordedBy: { select: { username: true, fullName: true } }, student: { include: { user: true } } },
    orderBy: { date: "desc" },
  });

  const totalIncome = transactions.reduce((sum, t) => sum + t.amount, 0);
  res.json({ transactions, totalIncome, count: transactions.length });
});

router.get("/transactions/export", requireRole("finance", "admin"), async (req, res) => {
  const { range } = req.query;
  const now = new Date();
  let from = null;
  if (range === "today") from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  else if (range === "week") from = new Date(now.getTime() - 7 * 86400000);
  else if (range === "month") from = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (range === "year") from = new Date(now.getFullYear(), 0, 1);

  const transactions = await prisma.transaction.findMany({
    where: from ? { date: { gte: from } } : undefined,
    include: { recordedBy: true, student: { include: { user: true } } },
  });

  const header = "date,amount,method,recorded_by,student,note\n";
  const rows = transactions
    .map((t) =>
      [
        t.date.toISOString().slice(0, 10), t.amount, t.method,
        t.recordedBy.username, t.student?.user?.username || "", (t.note || "").replace(/,/g, ";"),
      ].join(",")
    )
    .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=transactions-${range || "all"}.csv`);
  res.send(header + rows);
});

export default router;
