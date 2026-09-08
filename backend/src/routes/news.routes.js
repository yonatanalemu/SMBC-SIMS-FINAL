import { Router } from "express";
import prisma from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/rbac.js";
import { uploadNewsImage, publicUrlFor } from "../lib/upload.js";

const router = Router();
router.use(authenticate);

// Visible to every authenticated role.
router.get("/", async (req, res) => {
  const news = await prisma.news.findMany({ orderBy: [{ isBreaking: "desc" }, { createdAt: "desc" }] });
  res.json(news);
});

router.post("/", requireRole("admin"), uploadNewsImage.single("image"), async (req, res) => {
  const { title, body, isBreaking } = req.body;
  if (!title || !body) return res.status(400).json({ error: "title and body are required" });

  const news = await prisma.news.create({
    data: {
      title, body,
      imageUrl: req.file ? publicUrlFor("news", req.file.filename) : null,
      isBreaking: isBreaking === "true" || isBreaking === true,
      createdById: req.user.id,
    },
  });
  res.status(201).json(news);
});

router.delete("/:id", requireRole("admin"), async (req, res) => {
  await prisma.news.delete({ where: { id: req.params.id } });
  res.json({ message: "Removed" });
});

export default router;
