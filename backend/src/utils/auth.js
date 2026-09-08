import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TTL = process.env.REFRESH_TOKEN_TTL || "7d";
const JWT_ALGORITHM = "HS256";

export async function hashPassword(plain) {
  // 12 rounds rather than 10 — a bit more work factor margin at negligible
  // real-world cost for a login-time hash.
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plain, salt);
}

export async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Used by the login route to keep response timing consistent whether or not
// the username exists — see LOGIN_DUMMY_HASH usage in auth.routes.js. This
// is a real, valid bcrypt hash (of a random unguessable string, not a real
// password) purely so `bcrypt.compare` always does a comparable amount of
// work, closing a timing side-channel that could otherwise be used to
// enumerate valid usernames even though the error message itself never
// reveals whether the username existed.
export const LOGIN_DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8i6NgP/xM.RmpJ.QhoLq4T.YE0/Wf6";

export function signAccessToken(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL, algorithm: JWT_ALGORITHM });
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TTL, algorithm: JWT_ALGORITHM });
}

// `algorithms` is pinned explicitly on verify, not just sign — defense in
// depth against algorithm-confusion attacks (a token crafted with a
// different/unexpected alg should never be accepted, even though this app
// only ever signs with HS256 today).
export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET, { algorithms: [JWT_ALGORITHM] });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET, { algorithms: [JWT_ALGORITHM] });
}

// Temp password for newly-issued temporary-role accounts (Student/Teacher/DeptHead)
// and password resets. crypto.randomInt/randomBytes — Math.random() is a
// non-cryptographic PRNG and shouldn't generate anything security-sensitive.
export function generateTempPassword(prefix = "SMBC") {
  const num = crypto.randomInt(1000, 10000);
  const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${num}-${rand}`;
}
