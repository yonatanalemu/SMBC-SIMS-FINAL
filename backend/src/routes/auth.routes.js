import { Router } from "express";
import rateLimit from "express-rate-limit";
import prisma from "../config/prisma.js";
import {
  comparePassword,
  hashPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  LOGIN_DUMMY_HASH,
} from "../utils/auth.js";
import { authenticate } from "../middleware/rbac.js";

const router = Router();

// Keyed per account, not per IP — an office of Registrar/Finance/Teacher
// staff all sharing one public WiFi IP shouldn't get locked out together
// because one of them mistyped their password. Case-insensitive so
// "Registrar" and "registrar" share the same counter. skipSuccessfulRequests
// means a correct login never counts against the limit — only wrong ones do.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.body?.username?.toLowerCase()?.trim() || req.ip,
  message: { error: "Too many failed attempts on this account. Try again in 15 minutes." },
});

// Generous backstop against one IP hammering many different usernames at
// once (credential stuffing) — high enough a whole office logging in during
// morning rush never comes close to it.
const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts from this network. Try again in 15 minutes." },
});

router.post("/login", loginIpLimiter, loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const user = await prisma.user.findUnique({
    where: { username },
    include: { staffProfile: true, studentProfile: true },
  });

  const valid = await comparePassword(password, user?.isActive ? user.passwordHash : LOGIN_DUMMY_HASH);
  if (!user || !user.isActive || !valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const departmentId =
    user.staffProfile?.departmentId || user.studentProfile?.departmentId || null;

  const payload = { id: user.id, role: user.role, departmentId, tokenVersion: user.tokenVersion };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  res.json({
    accessToken,
    refreshToken,
    mustChangePassword: user.mustChangePassword,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      departmentId,
      levelId: user.studentProfile?.levelId || null,
    },
  });
});

router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: "refreshToken is required" });
  try {
    const payload = verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || !user.isActive || user.tokenVersion !== payload.tokenVersion) {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }
    const accessToken = signAccessToken({
      id: user.id, role: user.role, departmentId: payload.departmentId, tokenVersion: user.tokenVersion,
    });
    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

router.post("/change-password", authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const valid = await comparePassword(currentPassword || "", user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: req.user.id },
    data: { passwordHash, mustChangePassword: false, tokenVersion: { increment: 1 } },
  });
  res.json({ message: "Password updated" });
});

router.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      staffProfile: { include: { department: true } },
      studentProfile: { include: { department: true, level: true } },
    },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    department: user.staffProfile?.department?.name || user.studentProfile?.department?.name || null,
    level: user.studentProfile?.level?.name || null,
  });
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.patch("/me", authenticate, async (req, res) => {
  const { phone, email } = req.body;
  if (email && !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "That doesn't look like a valid email address" });
  }
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { phone, email },
  });
  res.json({ message: "Profile updated", phone: user.phone, email: user.email });
});

export default router;