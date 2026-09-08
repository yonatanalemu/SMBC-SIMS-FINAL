import { Router } from "express";
import prisma from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/rbac.js";
import { uploadSchedulePdf, publicUrlFor } from "../lib/upload.js";

const router = Router();
router.use(authenticate);

// teacher/dept_head see only their own department by default; admin sees all
// or filters via ?departmentId=
router.get("/", async (req, res) => {
  const scopedRoles = ["teacher", "dept_head"];
  const departmentId = scopedRoles.includes(req.user.role) ? req.user.departmentId : req.query.departmentId;

  const schedules = await prisma.schedule.findMany({
    where: departmentId ? { departmentId } : undefined,
    include: { department: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(schedules);
});

router.post("/", requireRole("admin"), uploadSchedulePdf.single("file"), async (req, res) => {
  const { departmentId, type, title } = req.body; // type: "teaching" | "exam"
  if (!departmentId || !["teaching", "exam"].includes(type)) {
    return res.status(400).json({ error: "departmentId and a valid type (teaching|exam) are required" });
  }
  if (!req.file) return res.status(400).json({ error: "A PDF file is required" });

  const schedule = await prisma.schedule.create({
    data: {
      departmentId, type, title,
      fileUrl: publicUrlFor("schedules", req.file.filename),
      createdById: req.user.id,
    },
  });
  res.status(201).json(schedule);
});

// Admin-only cleanup — lets Admin drop a schedule (e.g. last term's) so a
// replacement can be dropped in without the list accumulating stale PDFs.
router.delete("/:id", requireRole("admin"), async (req, res) => {
  const schedule = await prisma.schedule.findUnique({ where: { id: req.params.id } });
  if (!schedule) return res.status(404).json({ error: "Schedule not found" });
  await prisma.schedule.delete({ where: { id: req.params.id } });
  res.json({ message: "Schedule deleted" });
});

export default router;