import { verifyAccessToken } from "../utils/auth.js";

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }
  try {
    req.user = verifyAccessToken(header.split(" ")[1]); // { id, role, departmentId }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions for this action" });
    }
    next();
  };
}

// Teacher/Dept Head are locked to their own department. Resolver defaults to
// req.params.departmentId but can be overridden for routes where the
// department is implied by a course/level id instead.
export function scopeToDepartment(resolveDepartmentId = (req) => req.params.departmentId) {
  return (req, res, next) => {
    const scopedRoles = ["teacher", "dept_head"];
    if (!scopedRoles.includes(req.user.role)) return next();

    const targetDeptId = resolveDepartmentId(req);
    if (!targetDeptId) {
      return res.status(400).json({ error: "Could not resolve department for this request" });
    }
    if (targetDeptId !== req.user.departmentId) {
      return res.status(403).json({ error: "Not authorized for this department" });
    }
    next();
  };
}
