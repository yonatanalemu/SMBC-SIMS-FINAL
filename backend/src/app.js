import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import path from "path";

import prisma from "./config/prisma.js";
import { verifyAccessToken } from "./utils/auth.js";

import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import adminAcademicsRoutes from "./routes/admin-academics.routes.js";
import registrarRoutes from "./routes/registrar.routes.js";
import teacherRoutes from "./routes/teacher.routes.js";
import deptheadRoutes from "./routes/depthead.routes.js";
import financeRoutes from "./routes/finance.routes.js";
import studentRoutes from "./routes/student.routes.js";
import newsRoutes from "./routes/news.routes.js";
import scheduleRoutes from "./routes/schedule.routes.js";
import structureRoutes from "./routes/structure.routes.js";
import settingsRoutes from "./routes/settings.routes.js";

const app = express();
const UPLOAD_DIR = process.env.UPLOAD_DIR || "/app/uploads";
const CONTENT_DIR = process.env.CONTENT_DIR || path.join(process.cwd(), "content");

// Deployed behind Coolify's reverse proxy (and nginx in front of that, per
// docker-compose/nginx.conf) — without this, req.ip resolves to the proxy's
// own address for every request, which would make the rate limiters below
// key every single client as "the same IP" and either block everyone
// together or nobody at all. `1` trusts exactly one hop (the immediate
// proxy), not an arbitrary/spoofable chain.
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    // No CORS_ORIGIN set = same-origin only (nginx serves frontend+API from
    // one origin in production, per nginx.conf's /api proxy block) — NOT
    // wide open by default the way bare `cors()` is. Comma-separated list
    // supports e.g. a separate preview/staging frontend origin alongside
    // the main one.
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()) : false,
  })
);

app.use(express.json({ limit: "5mb" }));

// Payment-proof screenshots are financial documents (personal, sensitive) —
// unlike certificate templates or curriculum PDFs, they need real access
// control, not just an unguessable filename. Gated ahead of the generic
// /uploads static handler below so this specific subpath requires a valid
// access token: Admin/Finance/Registrar can view any proof; a Student can
// only view a proof that's actually their own. Mirrors the pattern already
// used for CSV exports (fetched as an authenticated blob, not a plain
// <img src>/<a href>) — see downloadFile in the frontend's api/resources.js
// and the matching viewFile helper for images.
async function paymentProofAccess(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  let payload;
  try {
    payload = verifyAccessToken(header.slice(7));
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (["admin", "finance", "registrar"].includes(payload.role)) return next();
  if (payload.role === "student") {
    const filePath = `/uploads/payment-proofs${req.path}`;
    const owns = await prisma.paymentProof.findFirst({
      where: { student: { userId: payload.id }, screenshotUrls: { has: filePath } },
    });
    if (owns) return next();
  }
  return res.status(403).json({ error: "Forbidden" });
}
app.use("/uploads/payment-proofs", paymentProofAccess, express.static(path.join(UPLOAD_DIR, "payment-proofs")));
app.use("/uploads", express.static(UPLOAD_DIR));
app.use("/content", express.static(CONTENT_DIR));

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/admin/academics", adminAcademicsRoutes);
app.use("/registrar", registrarRoutes);
app.use("/teacher", teacherRoutes);
app.use("/dept-head", deptheadRoutes);
app.use("/finance", financeRoutes);
app.use("/student", studentRoutes);
app.use("/news", newsRoutes);
app.use("/schedules", scheduleRoutes);
app.use("/structure", structureRoutes);
app.use("/settings", settingsRoutes);

app.use((err, req, res, next) => {
  console.error(err);

  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "File is too large" : err.message;
    return res.status(400).json({ error: message });
  }
  // Multer's fileFilter rejections arrive as a plain Error, not a
  // MulterError — distinguished here by the message text set in upload.js.
  if (err instanceof Error && /files are allowed$/.test(err.message)) {
    return res.status(400).json({ error: err.message });
  }

  // Never leak raw internal error text (stack traces, Prisma/DB error
  // details, file paths) to the client in production — full detail still
  // goes to the server log above. Local/dev keeps the real message to make
  // debugging tolerable.
  const exposeDetail = process.env.NODE_ENV !== "production";
  res.status(err.status || 500).json({ error: exposeDetail ? err.message || "Something went wrong" : "Something went wrong" });
});

export default app;
