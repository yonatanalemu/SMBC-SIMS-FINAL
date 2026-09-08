import { Router } from "express";
import prisma from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/rbac.js";
import { hashPassword, generateTempPassword } from "../utils/auth.js";
import { generateUsername, stripInterimPrefix } from "../utils/id-generator.js";
import { getInvoiceDefaults } from "./settings.routes.js";

const router = Router();
router.use(authenticate, requireRole("registrar", "admin"));

// TVET advanced-entry levels — the Registrar also registers students who are
// already partway through the program elsewhere/already known to the school,
// not just brand-new first-timers. Any of these levels skips the interim/N-
// workflow and Registration Fee entirely; only a department's actual
// first-time entry level(s) go through the normal interim flow. Explicit
// (department, level name) pairs rather than an "is this the lowest-order
// level" general rule, because Accounting/HRM's "Level 2 Terminal" and
// "Level 2 Diploma" are parallel entry tracks that happen to be stored with
// sequential `order` values (0 and 1) — a general order-based rule would
// incorrectly also treat a brand-new Diploma-track registration as an
// advanced entry. For Accounting/HRM specifically, that leaves only the two
// Level 2 tracks as true first-time entry — Level 3 *and* Level 4 both skip
// interim, same as Nursing/Medical Laboratory/Midwifery's Level 4 (their
// Level 3 is the only true entry point, since they have no Level 2 at all).
const TVET_SKIP_INTERIM = new Set([
  "Accounting|Level 3", "Accounting|Level 4",
  "HRM|Level 3", "HRM|Level 4",
  "Nursing|Level 4", "Medical Laboratory|Level 4", "Midwifery|Level 4",
]);

// Degree has no parallel-track complication — "Year I Semester I" is
// unambiguously the only entry point (order 0), so this can just be a
// general order check rather than a hardcoded level-name list.
function shouldSkipInterim(track, departmentName, levelName, levelOrder) {
  if (track === "tvet") return TVET_SKIP_INTERIM.has(`${departmentName}|${levelName}`);
  if (track === "degree") return levelOrder > 0;
  return false;
}

// ---------- Registration (creates interim N-STU-xxxx account, unless
// shouldSkipInterim — see above) ----------
router.post("/students", async (req, res) => {
  const {
    fullName, fullNameAmharic, sex, age, dateOfBirth, placeOfBirth, nationality, guardianName, grandfatherName, poBox, residence,
    esclceGpa, nationalId, departmentId, levelId, track, programType, admissionYear, admissionClassification,
    courseStartDate, courseEndDate,
  } = req.body;

  if (!departmentId || !levelId || !track) {
    return res.status(400).json({ error: "departmentId, levelId, and track are required" });
  }

  const level = await prisma.level.findUnique({ where: { id: levelId }, include: { department: true } });
  if (!level) return res.status(400).json({ error: "Level not found" });

  const skipInterim = shouldSkipInterim(track, level.department.name, level.name, level.order);

  const username = await generateUsername(prisma, "student", { interim: !skipInterim });
  const tempPassword = generateTempPassword("STU");
  const passwordHash = await hashPassword(tempPassword);

  const user = await prisma.user.create({
    data: {
      username,
      fullName,
      passwordHash,
      role: "student",
      mustChangePassword: true,
      createdById: req.user.id,
      studentProfile: {
        create: {
          departmentId, levelId, track, programType: programType || null,
          sex, age, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null, placeOfBirth,
          nationality, guardianName, grandfatherName, poBox, residence, esclceGpa, nationalId,
          fullNameAmharic: fullNameAmharic || null,
          // Degree only — ignored for TVET even if sent, since the form only shows it for Degree track.
          admissionClassification: track === "degree" ? (admissionClassification || null) : null,
          courseStartDate: courseStartDate ? new Date(courseStartDate) : null,
          courseEndDate: courseEndDate ? new Date(courseEndDate) : null,
          admissionYear, recordStatus: skipInterim ? "active" : "interim",
        },
      },
    },
    include: { studentProfile: true },
  });

  // Registration Fee is a one-time, brand-new-student charge — skipped
  // entirely for advanced-entry registrations (see shouldSkipInterim), which
  // only ever get Tuition Fee. Amounts are admin-editable via /settings.
  const { registrationFeeAmount, tuitionFeeAmount } = await getInvoiceDefaults();
  await prisma.invoice.createMany({
    data: [
      ...(skipInterim ? [] : [{ studentId: user.studentProfile.id, title: "Registration Fee", amount: registrationFeeAmount, createdById: req.user.id }]),
      { studentId: user.studentProfile.id, title: "Tuition Fee", amount: tuitionFeeAmount, createdById: req.user.id },
    ],
  });

  res.status(201).json({
    message: skipInterim
      ? "Student registered and activated immediately (advanced entry — no Registration Fee required)"
      : "Student registered (interim) — payment proof needed before activation",
    username: user.username,
    tempPassword,
    studentId: user.studentProfile.id,
  });
});

router.get("/students", async (req, res) => {
  const { departmentId, levelId, recordStatus, search } = req.query;
  // recordStatus can be a single value ("active") or comma-separated
  // ("active,graduated") — the latter is how certificate generation finds
  // students, since certificates must remain generatable after graduation.
  const statusFilter = recordStatus
    ? recordStatus.includes(",")
      ? { in: recordStatus.split(",") }
      : recordStatus
    : "active";
  const students = await prisma.student.findMany({
    where: {
      ...(departmentId ? { departmentId } : {}),
      ...(levelId ? { levelId } : {}),
      recordStatus: statusFilter,
      ...(search ? { user: { OR: [
        { username: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
      ] } } : {}),
    },
    include: { user: true, department: true, level: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(students);
});

// Aggregate student-population report, scoped to one track at a time —
// TVET breaks down by (department, level) with a male/female/total split
// (levels can mean very different things across TVET departments, so this
// is the useful granularity); Degree breaks down by department only, since
// "how many students in BA Business Management" is the useful question
// there, not per-semester counts. Active students only, matching the scope
// of the Students tab itself — interim and graduated students aren't
// counted. Must be registered ahead of GET /students/:id, or "/report"
// would be swallowed as an :id value.
router.get("/students/report", async (req, res) => {
  const { track } = req.query;
  if (!["tvet", "degree"].includes(track)) {
    return res.status(400).json({ error: "track must be 'tvet' or 'degree'" });
  }

  const students = await prisma.student.findMany({
    where: { track, recordStatus: "active" },
    include: { department: true, level: true },
  });

  const rowsMap = new Map();
  for (const s of students) {
    const key = track === "tvet" ? `${s.department.name}|${s.level.name}` : s.department.name;
    if (!rowsMap.has(key)) {
      rowsMap.set(key, {
        label: track === "tvet" ? `${s.department.name} - ${s.level.name}` : s.department.name,
        departmentName: s.department.name, levelOrder: s.level.order,
        male: 0, female: 0,
      });
    }
    const row = rowsMap.get(key);
    if (s.sex === "M") row.male++;
    else if (s.sex === "F") row.female++;
  }

  const rows = [...rowsMap.values()]
    .sort((a, b) => a.departmentName.localeCompare(b.departmentName) || a.levelOrder - b.levelOrder)
    .map(({ label, male, female }) => ({ label, male, female, total: male + female }));

  res.json({ track, rows });
});

router.get("/students/:id", async (req, res) => {
  const student = await prisma.student.findUnique({
    where: { id: req.params.id },
    include: { user: true, department: true, level: true, paymentProofs: true, invoices: true },
  });
  if (!student) return res.status(404).json({ error: "Student not found" });
  res.json(student);
});

// Toggles login access on/off for a student's account (User.isActive — already
// enforced at login in auth.routes.js, this is just the switch). Distinct from
// `recordStatus` (interim/active/graduated) — a student can be "active"
// record-status-wise but have login disabled, e.g. a disciplinary hold.
router.patch("/students/:id/active-status", async (req, res) => {
  const { isActive } = req.body;
  const student = await prisma.student.findUnique({ where: { id: req.params.id } });
  if (!student) return res.status(404).json({ error: "Student not found" });
  await prisma.user.update({ where: { id: student.userId }, data: { isActive: !!isActive } });
  res.json({ isActive: !!isActive });
});

// Deletes a student outright — for mis-registrations (wrong person, duplicate,
// typo'd into existence), not a disciplinary/withdrawal action. Works for
// both interim (Registration Queue) and active (Students tab) students; not
// exposed for graduated students (Records tab), since that's a completed,
// historical record rather than a live mistake to undo.
// Cascades through every table that references this student — Prisma won't
// do this automatically since none of these relations are onDelete: Cascade
// — Grade/AttendanceRecord/Invoice/PaymentProof are deleted outright since
// they only exist because of this student's enrollment; Transaction rows are
// detached (studentId set to null) rather than deleted, since a Transaction
// represents money actually received and is kept as a financial record even
// if the student registration itself was a mistake.
router.delete("/students/:id", async (req, res) => {
  const student = await prisma.student.findUnique({ where: { id: req.params.id } });
  if (!student) return res.status(404).json({ error: "Student not found" });
  if (student.recordStatus === "graduated") {
    return res.status(400).json({ error: "Graduated students can't be deleted from here" });
  }

  await prisma.$transaction([
    prisma.grade.deleteMany({ where: { studentId: student.id } }),
    prisma.attendanceRecord.deleteMany({ where: { studentId: student.id } }),
    prisma.invoice.deleteMany({ where: { studentId: student.id } }),
    prisma.paymentProof.deleteMany({ where: { studentId: student.id } }),
    prisma.transaction.updateMany({ where: { studentId: student.id }, data: { studentId: null } }),
    prisma.student.delete({ where: { id: student.id } }),
    prisma.user.delete({ where: { id: student.userId } }),
  ]);

  res.json({ message: "Student deleted" });
});

// Strips the interim "N-" prefix — requires Finance to have already verified
// a payment proof for this student (checked here, not just trusted).
router.post("/students/:id/approve", async (req, res) => {
  const student = await prisma.student.findUnique({
    where: { id: req.params.id },
    include: { user: true, paymentProofs: true },
  });
  if (!student) return res.status(404).json({ error: "Student not found" });
  if (student.recordStatus !== "interim") {
    return res.status(400).json({ error: "Student is not in interim status" });
  }

  const hasVerifiedProof = student.paymentProofs.some((p) => p.status === "verified");
  if (!hasVerifiedProof) {
    return res.status(400).json({ error: "Finance has not verified a payment proof for this student yet" });
  }

  const newUsername = stripInterimPrefix(student.user.username);
  await prisma.$transaction([
    prisma.user.update({ where: { id: student.userId }, data: { username: newUsername } }),
    prisma.student.update({ where: { id: student.id }, data: { recordStatus: "active" } }),
    // Registration Fee is a one-time payment collected only during the
    // interim (N-) period — once activated, it's done its job and shouldn't
    // keep showing up as a line item. Tuition Fee (recurring) and any
    // admin-added invoices are untouched.
    prisma.invoice.deleteMany({ where: { studentId: student.id, title: "Registration Fee" } }),
  ]);

  res.json({ message: "Student activated", username: newUsername });
});

router.patch("/students/:id/reset-password", async (req, res) => {
  const student = await prisma.student.findUnique({ where: { id: req.params.id }, include: { user: true } });
  if (!student) return res.status(404).json({ error: "Student not found" });

  const tempPassword = generateTempPassword("STU");
  const passwordHash = await hashPassword(tempPassword);
  await prisma.user.update({
    where: { id: student.userId },
    data: { passwordHash, mustChangePassword: true, tokenVersion: { increment: 1 } },
  });
  res.json({ username: student.user.username, tempPassword });
});

// Edit certificate-relevant details after registration — Amharic name and
// course start/end dates aren't always known at initial registration time.
router.patch("/students/:id/details", async (req, res) => {
  const { fullNameAmharic, courseStartDate, courseEndDate } = req.body;
  const student = await prisma.student.findUnique({ where: { id: req.params.id } });
  if (!student) return res.status(404).json({ error: "Student not found" });

  const updated = await prisma.student.update({
    where: { id: req.params.id },
    data: {
      ...(fullNameAmharic !== undefined ? { fullNameAmharic } : {}),
      ...(courseStartDate !== undefined ? { courseStartDate: courseStartDate ? new Date(courseStartDate) : null } : {}),
      ...(courseEndDate !== undefined ? { courseEndDate: courseEndDate ? new Date(courseEndDate) : null } : {}),
    },
  });
  res.json(updated);
});

// ---------- Grades: Admin-approved -> Registrar view/export only ----------
router.get("/grades", async (req, res) => {
  const { departmentId, levelId, courseId } = req.query;
  const grades = await prisma.grade.findMany({
    where: {
      status: "approved",
      // Grades belong to the course/level, not the student's current
      // status — a graduated student's Level 4 grades don't disappear or
      // change when they graduate, so without this filter they'd keep
      // showing up in the Grades tab forever, even though graduated
      // students should only be reachable through Transcript/Certificate
      // generation (which deliberately DO include them — see
      // GET /registrar/students/:id/transcript and the certificate
      // eligibility check, both untouched by this).
      student: { recordStatus: "active" },
      ...(courseId ? { courseId } : {}),
      ...(!courseId && (departmentId || levelId)
        ? { course: { level: { ...(levelId ? { id: levelId } : {}), ...(departmentId ? { departmentId } : {}) } } }
        : {}),
    },
    include: {
      student: { include: { user: true } },
      course: { include: { level: { include: { department: true } }, teacher: true } },
    },
  });
  res.json(grades);
});

router.get("/grades/export", async (req, res) => {
  const { departmentId } = req.query;
  const grades = await prisma.grade.findMany({
    where: {
      status: "approved",
      student: { recordStatus: "active" },
      ...(departmentId ? { course: { level: { departmentId } } } : {}),
    },
    include: {
      student: { include: { user: true } },
      course: { include: { level: { include: { department: true } } } },
    },
  });

 const header = "student_username,student_full_name,department,level,course,theory,practice,cooperative,total,grade\n";
  const rows = grades
    .map((g) =>
      [
        g.student.user.username,
        (g.student.user.fullName || "").replace(/,/g, ";"),
        g.course.level.department.name,
        g.course.level.name,
        g.course.name,
        g.theoryScore ?? "",
        g.practiceScore ?? "",
        g.cooperativeScore ?? "",
        g.totalScore ?? "",
        g.letterGrade,
      ].join(",")
    )
    .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=approved-grades.csv");
  res.send(header + rows);
});

// ---------- Exams: Approved -> Registrar prints ----------
router.get("/exams", async (req, res) => {
  const { departmentId, levelId, courseId } = req.query;
  const exams = await prisma.exam.findMany({
    where: {
      status: "approved",
      ...(courseId ? { courseId } : {}),
      ...(!courseId && (departmentId || levelId)
        ? { course: { level: { ...(levelId ? { id: levelId } : {}), ...(departmentId ? { departmentId } : {}) } } }
        : {}),
    },
    include: { course: { include: { level: { include: { department: true } } } }, submittedBy: true },
  });
  res.json(exams);
});

router.patch("/exams/:id/mark-printed", async (req, res) => {
  const exam = await prisma.exam.update({ where: { id: req.params.id }, data: { printedAt: new Date() } });
  res.json(exam);
});

// ---------- Records: graduated students archive ----------
router.get("/records", async (req, res) => {
  const students = await prisma.student.findMany({
    where: { recordStatus: "graduated" },
    include: { user: true, department: true, level: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(students);
});

// Bulk-moves every currently-active student in a level to "graduated" —
// used from the Students tab once a level's cohort has finished (the button
// only appears there for a department's final level, i.e. highest `order`).
// Graduated students keep every field collected at registration untouched —
// this is a status change only, not a data reset — and remain fully
// eligible for certificate generation (see GET /students's recordStatus
// filter above, and RegistrarCertificates.jsx's search).
router.post("/students/graduate", async (req, res) => {
  const { levelId } = req.body;
  if (!levelId) return res.status(400).json({ error: "levelId is required" });

  const level = await prisma.level.findUnique({ where: { id: levelId }, include: { department: true } });
  if (!level) return res.status(404).json({ error: "Level not found" });

  // Find who's about to graduate first, since revoking login access means
  // updating their User rows too — updateMany on Student can't reach across
  // the relation, so this needs its own list of userIds.
  const graduating = await prisma.student.findMany({
    where: { levelId, recordStatus: "active" },
    select: { userId: true },
  });

  const result = await prisma.student.updateMany({
    where: { levelId, recordStatus: "active" },
    data: { recordStatus: "graduated" },
  });

  // Graduation revokes login access — record data (grades, transcript,
  // certificate eligibility) is untouched, only the account is deactivated.
  // tokenVersion is bumped too so any refresh token already issued for one
  // of these accounts stops working immediately instead of coasting for up
  // to its full 7-day lifetime.
  if (graduating.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: graduating.map((s) => s.userId) } },
      data: { isActive: false, tokenVersion: { increment: 1 } },
    });
  }

  res.json({ graduatedCount: result.count, department: level.department.name, level: level.name });
});

// Moves every active student at a level up to the department's NEXT level
// (by `order`) — the system otherwise has no year-to-year/semester-to-
// semester progression at all: a student's `levelId` is set once at
// registration and never changes on its own. This is the missing
// complement to "Graduate Students" (which only applies at a department's
// FINAL level) — every other level uses this instead.
// HRM/Accounting's "Level 2 Terminal" is a one-year, dead-end path — its
// students should only ever be graduated, never promoted. It's not the
// department's highest-`order` level (Level 4 is), so without this guard
// the generic "next level by order" lookup below would incorrectly move
// them into "Level 2 Diploma" — a completely different track, not a
// continuation of Terminal. See the matching TERMINAL_GRADUATION_LEVELS
// check the frontend uses to decide which button to even show.
const TVET_TERMINAL_LEVELS = new Set(["Accounting|Level 2 Terminal", "HRM|Level 2 Terminal"]);

router.post("/students/promote", async (req, res) => {
  const { levelId } = req.body;
  if (!levelId) return res.status(400).json({ error: "levelId is required" });

  const level = await prisma.level.findUnique({ where: { id: levelId }, include: { department: true } });
  if (!level) return res.status(404).json({ error: "Level not found" });

  if (TVET_TERMINAL_LEVELS.has(`${level.department.name}|${level.name}`)) {
    return res.status(400).json({ error: "Level 2 Terminal students complete a one-year program — use Graduate Students instead" });
  }

  const nextLevel = await prisma.level.findFirst({
    where: { departmentId: level.departmentId, order: { gt: level.order } },
    orderBy: { order: "asc" },
  });
  if (!nextLevel) {
    return res.status(400).json({ error: "This is the department's final level — use Graduate Students instead" });
  }

  const result = await prisma.student.updateMany({
    where: { levelId, recordStatus: "active" },
    data: { levelId: nextLevel.id },
  });
  res.json({
    promotedCount: result.count, department: level.department.name,
    fromLevel: level.name, toLevel: nextLevel.name,
  });
});

// CSV report of graduated students, with a summary block (totals, per-department
// breakdown) prepended above the row data.
router.get("/records/export", async (req, res) => {
  const students = await prisma.student.findMany({
    where: { recordStatus: "graduated" },
    include: { user: true, department: true, level: true },
    orderBy: { createdAt: "desc" },
  });

  const byDept = {};
  for (const s of students) byDept[s.department.name] = (byDept[s.department.name] || 0) + 1;

  const summaryLines = [
    `Graduated Students Report`,
    `Generated:,${new Date().toISOString().slice(0, 10)}`,
    `Total Graduated Students:,${students.length}`,
    ...Object.entries(byDept).map(([dept, count]) => `  ${dept}:,${count}`),
    ``,
  ];

  const header = "username,full_name,department,track,final_level,sex,date_of_birth,nationality,admission_year,national_id\n";
  const rows = students
    .map((s) =>
      [
        s.user.username,
        `"${(s.user.fullName || "").replace(/"/g, '""')}"`,
        s.department.name,
        s.track,
        s.level.name,
        s.sex || "",
        s.dateOfBirth ? s.dateOfBirth.toISOString().slice(0, 10) : "",
        s.nationality || "",
        s.admissionYear || "",
        s.nationalId || "",
      ].join(",")
    )
    .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=graduated-students.csv");
  res.send(summaryLines.join("\n") + header + rows);
});

// ---------- Transcript / Certificate data ----------
// Returns everything needed to render the transcript layout client-side.
// Actual PDF generation is a follow-up once curriculum PDFs are wired in.
router.get("/students/:id/transcript", async (req, res) => {
  const student = await prisma.student.findUnique({
    where: { id: req.params.id },
    include: {
      user: true, department: true, level: true,
      grades: { where: { status: "approved" }, include: { course: { include: { level: true } } } },
    },
  });
  if (!student) return res.status(404).json({ error: "Student not found" });
  res.json(student);
});

export default router;
