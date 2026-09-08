# SMBC SIMS v2 — Handover Document

**Project**: Student Information Management System for Sitti Medical and Business
College (Dire Dawa, Ethiopia). Full rebuild ("v2") replacing an earlier throwaway
Railway MVP. Target deployment: a VPS (Yegara Host, Ubuntu 22.04, 4 vCPU / 8GB RAM
/ 80GB SSD), via Docker Compose. Currently being tested on localhost before the
VPS deploy.

This document is written so a fresh conversation (or another engineer) can pick
up exactly where this one left off, with zero prior context.

---

## 1. Tech Stack

| Layer | Choice |
|---|---|
| Database | PostgreSQL 16 |
| Backend | Node.js 22 + Express, ES modules (`"type": "module"`) |
| ORM | Prisma |
| Auth | Custom JWT (access + refresh), bcrypt |
| File storage | Local disk (`/app/uploads`), served statically by Express, via `multer` |
| Frontend | React 18 + Vite, React Router 6 |
| Styling | Tailwind CSS, custom design tokens (see §4) |
| PDF generation | `jspdf` + `html2canvas` (client-side, renders a styled DOM node to PDF) |
| Deployment | Docker Compose — Postgres + backend + Nginx-served frontend, single `docker compose up` |

No Chapa, no cash/physical payments — Finance handles payment status directly
(paid/unpaid toggle) with proof-screenshot verification backing it.

---

## 2. Repository Structure

```
smbc-sims-v2/
├── docker-compose.yml       # full stack: postgres, backend, web (nginx+frontend)
├── .env.example              # root env template for docker-compose
├── nginx/nginx.conf          # SPA routing + /api and /uploads reverse proxy
├── backend/
│   ├── Dockerfile            # runs `prisma db push` + seed + server on boot
│   ├── package.json
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma     # full data model — see §3
│   │   ├── seed.js           # permanent accounts + department/level/course seed
│   │   ├── course-data.js    # real TVET course data (see §3.1)
│   │   └── reset-admin.js    # `npm run reset-admin -- <admin|registrar|finance>`
│   ├── scripts/
│   │   └── sync-content.js   # folder-drop -> DB sync for curriculum/certificates — see §7
│   ├── content/               # bind-mounted; drop PDFs/PNGs here — see §7
│   │   ├── curriculum/<Department>/<Level>/*.pdf
│   │   └── certificates/{tvet,degree}/<Department>/[Diploma|Terminal/]*.png
│   └── src/
│       ├── app.js            # route mounting
│       ├── server.js         # entrypoint
│       ├── config/prisma.js
│       ├── middleware/rbac.js       # authenticate, requireRole, scopeToDepartment
│       ├── utils/
│       │   ├── auth.js              # hashing, JWT, generateTempPassword
│       │   ├── id-generator.js      # STU-0001 / TCR-001 / DHD-001 formats
│       │   └── grade-scale.js       # official grading table, letter-grade calc
│       ├── lib/upload.js            # multer config (PDF/image upload dirs)
│       └── routes/
│           ├── auth.routes.js
│           ├── admin.routes.js          # departments/levels/courses/staff/dept-heads/curricula/certificate-templates
│           ├── admin-academics.routes.js # grade final-approval + exam admin stage + attendance
│           ├── registrar.routes.js
│           ├── finance.routes.js
│           ├── depthead.routes.js
│           ├── teacher.routes.js
│           ├── student.routes.js
│           ├── structure.routes.js       # shared read-only dept/level/course browsing + certificate-template lookup
│           ├── settings.routes.js        # invoice default amounts
│           ├── news.routes.js
│           └── schedule.routes.js
└── frontend/
    ├── Dockerfile             # multi-stage: vite build -> nginx
    ├── package.json
    ├── tailwind.config.js     # design tokens — see §4
    ├── vite.config.js         # dev proxy to localhost:4000 for /api, /uploads
    └── src/
        ├── App.jsx            # all routes
        ├── main.jsx           # ErrorBoundary + ThemeProvider + AuthProvider
        ├── index.css
        ├── context/{AuthContext,ThemeContext}.jsx
        ├── api/{client.js,resources.js}   # resources.js = every backend call, organized by role
        ├── components/        # shared, see §5
        └── pages/
            ├── shared/    (Login, Settings, News, Curriculum, Unauthorized)
            ├── admin/     (9 pages)
            ├── registrar/ (7 pages)
            ├── finance/   (3 pages)
            ├── depthead/  (4 pages)
            ├── teacher/   (4 pages)
            └── student/   (4 pages)
```

---

## 3. Data Model (Prisma schema highlights)

Full schema at `backend/prisma/schema.prisma`. Key design points:

- **Users**: `role` enum (admin, registrar, finance, dept_head, teacher, student).
  Admin/Registrar/Finance are permanent, credentials set directly. Teacher/Student/DeptHead
  get system-generated usernames (see `id-generator.js`):
  `STU-0001` (expands 4→5 digits), `TCR-001` (3→4), `DHD-001` (3→4).
  **Dept Head accounts are fully separate logins from Teacher accounts** — promoting a
  teacher to Dept Head creates a *new* `DHD-xxx` user with `promotedFromId` linking back
  to the source teacher account for traceability; the teacher account is untouched.
- **Department** has a `track` (`tvet` | `degree`). **Level** belongs to a Department —
  for TVET this is "Level 3", "Level 4", or for Accounting/HRM "Level 2 Terminal" /
  "Level 2 Diploma" / "Level 3" / "Level 4". For Degree, Level is "Year I Semester I"
  through "Year IV Semester II", seeded identically across all 4 degree majors.
  **Level 2 Terminal and Level 2 Diploma are separate Level rows** with their own Course
  rows (even though course *names* are identical) — this is what keeps their students,
  attendance, grades, and teacher assignments fully independent per the "completely
  different" requirement.
- **Course** belongs to a Level, has a `code` (real unit-competency code, e.g.
  `LSA HRM2 01 1221`) and an optional assigned `teacherId`.
- **Grade**: `theoryScore`/`practiceScore`/`cooperativeScore` (30/40/30 weights per the
  school's own grade sheet) → `totalScore` + `letterGrade` (computed via
  `grade-scale.js`, official table: <73 = F, 74-76.99 = C, ... 95-100 = A+).
  `status` enum: `pending_dept_head → rejected_by_dept_head | pending_admin → approved`.
  Admin can edit scores at ANY stage, including after approval — edits propagate live
  to Registrar/Student since both read the same table with no caching.
- **Exam**: PDF-only (enforced via multer fileFilter), same 4-stage status shape as
  Grade (`pending_dept_head/rejected_by_dept_head/pending_admin/rejected_by_admin/approved`),
  rejection at the Dept Head stage requires a note.
- **Student**: `recordStatus` (`interim` → `active` → `graduated`), the "N-" username
  prefix is literally in the `User.username` string during `interim` and gets stripped
  on Registrar approval (`stripInterimPrefix` in id-generator.js). `tuitionStatus` +
  `tuitionPaidUntil` track the monthly tuition cycle separately from itemized `Invoice`
  rows. Also carries `fullNameAmharic` and `courseStartDate`/`courseEndDate` (both
  optional, editable post-registration via `PATCH /registrar/students/:id/details`) —
  used for the Ethiopian-calendar display and certificate generation (§8-9). Full set of
  registration-time personal fields (all optional, all collected on the Registrar's
  Registration form — see §9.1): `sex`, `age`, `dateOfBirth`, `placeOfBirth`,
  `nationality`, `guardianName`, `poBox`, `residence`, `esclceGpa`, `nationalId`,
  `admissionYear`, `admissionClassification` (`regular | extension` — **Degree track
  only**, `null` for TVET; the form only shows the toggle when Degree is selected).
- **Invoice**: every registration auto-creates two permanent invoices — "Registration
  Fee" and "Tuition Fee" — using admin-editable default amounts stored in the `Setting`
  key-value model (`registrationFeeAmount`, `tuitionFeeAmount`, default 500/1000).
- **PaymentProof**: student-uploaded screenshot, Finance verifies/rejects; Registrar's
  "approve interim student" action is blocked until a verified proof exists.
- **AttendanceSession**/**AttendanceRecord**: session is keyed by
  `(departmentId, levelId, teacherId, date)`, always editable/overwritable by the
  submitting teacher.
- **Curriculum**: `departmentId` + `levelId` + `fileUrl`. Populated primarily by the
  folder-drop + sync-script system (§7) — API upload routes also exist
  (`POST/GET/DELETE /admin/curricula`) as a secondary path if ever needed, but the
  folder workflow is the intended one.
- **CertificateTemplate**: `track` + `certificateType` (`original | temporary`
  — `terminal` was removed, see §7) + `departmentId` (required — always
  department-specific), unique on that triple. Populated via
  `prisma/seed-certificates.js` (bootstrap) and
  `POST/GET/DELETE /admin/certificate-templates` (ongoing) — NOT folder-drop,
  unlike Curriculum. See §7.
- **Setting**: simple key-value table, currently only holds the two invoice defaults.

### 3.1 Real course data already seeded

`backend/prisma/course-data.js` contains the actual unit-competency course lists
(name + official code) transcribed from the Ministry of Labor and Skills curriculum
PDFs the user uploaded, for: Nursing L3/L4, Medical Laboratory L3/L4, Midwifery
L3/L4, Accounting L2/L3/L4, HRM L2/L3/L4. Level 2 Diploma reuses the exact same
course list as Level 2 Terminal (separate Course rows, same content, per §3).
**Degree course codes are NOT seeded** — those curriculum PDFs haven't been provided
yet.

---

## 4. Frontend Design System

Established this session, replacing a generic slate/blue placeholder look:

- **Colors** (`tailwind.config.js`): `navy` (950/900/800/700 — sidebar, headings),
  `teal` (600/500/100 — primary actions/links/success), `gold` (600/500/100 —
  warnings/secondary accent), `paper`/`paper-dark` (page background), `ink`/`ink-muted`
  (body text).
- **Type**: `font-display` = Newsreader (serif, headings), `font-sans` = Public Sans
  (body/UI, default), `font-mono` = IBM Plex Mono (used via the `.id-chip` utility
  class for usernames/IDs/codes). Loaded via Google Fonts `<link>` in `index.html`.
- **Utility classes** (`index.css`): `.id-chip` (mono ID badge), `.status-pill` (base
  for `<StatusPill>`).
- **Sidebar**: accordion pattern — top-level items are either a direct link or a
  `{ label, children: [...] }` group that expands in place (chevron rotates, auto-opens
  if a child route is active). Applied identically across all 6 roles' navs and to
  Settings (`/settings/profile`, `/settings/display`, `/settings/password` are now
  three separate sub-links under one "Settings" group, not in-page tabs). Mobile: a
  hamburger button (fixed top bar, `lg:hidden`) opens the same sidebar content as a
  slide-in drawer with a click-outside backdrop.

---

## 5. Shared Frontend Components (`frontend/src/components/`)

| Component | Purpose |
|---|---|
| `DashboardLayout.jsx` | The accordion sidebar + mobile drawer + page shell. Nav config lives here per-role. |
| `AcademicSelector.jsx` | **The** reusable cascading picker: Track → Department → Level → Course, with a live course-name search that jumps straight to a match. `mode="level"` stops one level short (for attendance/invoices, which don't drill into courses). Used in Admin's teacher-assignment, Admin's Grades/Exams/Attendance nav, Finance/Admin's bulk invoice assignment, Registrar's registration form. **NOT yet wired into RegistrarGrades/RegistrarExams — see §7.** |
| `Table.jsx`, `Card.jsx` | Generic list/section wrappers, styled to the new tokens. |
| `KpiCard.jsx` | Dashboard metric card with accent dot + subtext slot. |
| `StatusPill.jsx` | Renders any workflow status (grade/exam/payment/record) as a colored pill with a human label. |
| `FileUpload.jsx` | Drag-and-drop file picker replacing the raw browser `<input type=file>` — used for exam PDFs, payment screenshots, news images, schedule PDFs. |
| `CredentialModal.jsx` | "Username: X / New Temp Password: Y" modal, reused for every account-creation and password-reset action across all roles. |
| `PasswordInput.jsx` | Drop-in replacement for `<input type="password">` with a show/hide eye toggle. Used on Login and all three Settings → Password fields. |
| `TranscriptDocument.jsx` | **TVET-only** transcript layout matching the school's official paper format (photo box, trainee info block, unit-competency table with Code/Theory/Practical/Cooperative/Total/Remark columns). `forwardRef` so a parent can grab the DOM node for PDF export. |
| `DegreeTranscriptDocument.jsx` | **Degree-only** transcript layout — a completely different official format from TVET's (see §9.2): header info block, then one table per semester (Level) with course code/No./title/Cr.Hrs/Grade/Grade Pts. columns, Semester & Cumulative G.P.A. rows, a Summary box, and the grading-scale legend. Also `forwardRef`. |
| `StudentsReportDocument.jsx` | Student population report (see §10.7) — bold track heading, one bordered table (TVET: per department+level; Degree: per department), Male/Female/Total columns, bold Total row. Also `forwardRef`, downloaded via `exportElementToPdf` same as the transcripts/certificates. |
| `ErrorBoundary.jsx` | Catches render crashes app-wide, offers a "reset local data and return to login" recovery button instead of a silent blank page (this was a real bug hit and fixed in the v1 build — corrupted `localStorage` was crashing the app silently on load). |

Both `StudentGrades.jsx` and `RegistrarTranscripts.jsx` pick between the two documents via
`student.track === "degree" ? DegreeTranscriptDocument : TranscriptDocument`. **Only the
Registrar can download a transcript PDF** — `StudentGrades.jsx` (the student's own Grades
tab) renders the same document read-only, with no download button; `exportElementToPdf`
is only wired up in `RegistrarTranscripts.jsx`.

`frontend/src/utils/pdf.js` — `exportElementToPdf(domNode, filename)`: renders a DOM
node via `html2canvas` then drops it into a real downloadable multi-page A4 PDF via
`jsPDF`. This replaced an earlier `window.print()` placeholder per explicit
instruction that transcript/certificate generation must produce a real PDF file.

---

## 6. Business Rules Currently Enforced (backend-verified, not just UI)

- Student sees ONLY their own `status: approved` grades and their own attendance —
  enforced at the query level (`studentId` scoped from the JWT, not a client param).
- Admin can edit grade scores at any workflow stage, including post-approval; those
  edits are immediately visible to Registrar and Student (same table, no cache).
- Exam rejection at the Dept Head stage requires a non-empty note (backend 400s
  without one); the note is shown to the teacher, who can delete-and-reupload only
  while status is a rejected state.
- Teacher/Dept Head are hard-scoped to their own `departmentId` (from JWT) via
  `scopeToDepartment` middleware — cannot query another department's data by
  guessing IDs.
- Registrar's student-approval action (`POST /registrar/students/:id/approve`)
  checks server-side that a **verified** `PaymentProof` exists before allowing the
  N-prefix to be stripped — cannot be bypassed from the frontend.
- Course-teacher assignment is enforced server-side: a teacher can only submit an
  exam/grade for a course where `Course.teacherId === req.user.id`.
- Course names identical between Level 2 Terminal and Level 2 Diploma are still
  fully separate `Course` rows (different `levelId`), so grades/attendance/rosters
  never mix between the two paths.

---

## 7. Content Management — Curriculum (folder-based) & Certificates (API-based)

**Curriculum stays folder-based, unchanged**: drop PDFs into
`backend/content/curriculum/<Department Name>/<Level Name>/*.pdf` and
`backend/scripts/sync-content.js` picks them up on every backend boot (wired
into the Dockerfile's `CMD` chain), matching folder names against Department
names exactly. `docker-compose.yml` bind-mounts `./backend/content:/app/content`
so host-added files are picked up on `docker compose restart backend` without
a rebuild. Manual re-sync: `npm run sync-content`.

**Certificates are NO LONGER folder-based** (changed this round — there used
to be a mirrored `content/certificates/` tree; it's been removed). There are
exactly **4 real certificate types** (`CertificateType` enum: `original |
temporary`, combined with `track`): TVET Original, TVET Temporary, Degree
Original, Degree Temporary. `terminal` was removed entirely — Level 2 Terminal
students (Accounting/HRM's Level 2 Terminal path) are simply **not eligible**
for certificate generation, full stop (previously they got an auto-selected
Terminal certificate; the school confirmed this isn't needed).

Certificates now go in via:
- **`backend/prisma/seed-certificates.js`** — bootstraps the 18 real
  department templates (bundled as PNGs in `backend/prisma/certificate-assets/`)
  into `UPLOAD_DIR/certificate-templates/` and upserts matching
  `CertificateTemplate` rows on every boot (wired into the Dockerfile `CMD`
  chain right after `prisma/seed.js`). Idempotent — safe to re-run.
- **`POST/GET/DELETE /admin/certificate-templates`** — the ongoing way to
  add/replace/remove templates afterward (multer upload to
  `UPLOAD_DIR/certificate-templates/`, served at `/uploads/certificate-templates/*`).
  There is intentionally no admin UI page for this yet (registrar-only
  workflow for now) — use the API directly if a template needs replacing.

**Picking the right template for a student**
(`GET /structure/certificate-template-for-student/:id?type=original|temporary`):
if the student's TVET program is Level 2 Terminal, the endpoint returns
`{ eligible: false, template: null, certificateType: null }` and the Registrar
UI shows a plain "not eligible" message instead of any generation controls.
Otherwise it returns `{ eligible: true, template, certificateType }` — `template`
is `null` (not a wrong template) if nothing's been uploaded yet for that exact
department+type, and the UI falls back to a generic styled placeholder
certificate so the PDF flow is still testable.

**Overlay content**: `frontend/src/utils/ethiopianCalendar.js` → `splitYears(date)`
returns `{ gc, ec }` separately (added this round, replacing `formatBothYears()`
for certificate use) because the real templates print the Gregorian and
Ethiopian years in two *separate* blanks on opposite language columns
("___ G.C." on the English side, "___ ዓ.ም" on the Amharic side) rather than
one combined string. TVET Original overlays four year fields (start+end, each
in both calendars, matching the "from ___ to ___ G.C." / "ከ ___ ዓ.ም እስከ ___
ዓ.ም" lines); TVET Temporary / Degree Original / Degree Temporary overlay
fewer — see the field-shape comment at the top of `certificateLayouts.js`.
Student name (English) is always overlaid; Amharic name too on the bilingual
Original templates (TVET and Degree both have a printed Amharic name blank).

**Overlay positions are pixel-measured, not estimated**, off each of the 18
real uploaded PNGs individually — originally via an automated
underline/word-gap detection pass, later replaced entirely with direct
Pixspy measurements the school took off each native-resolution PNG — keyed per department, not
shared/approximated per track+type, since department name length genuinely
shifts where the printed blanks land. All 18 templates are now fully
measured (no placeholder/estimated fields remain). Font sizes are uniformly
16pt (`pt(16)` → 1.33rem) across every field on every template, converted via
`rem = pt / 12`, per the school's request. To adjust any field: edit the
`top`/`left` percentages (of the image's own dimensions) in the relevant
department entry in `frontend/src/utils/certificateLayouts.js`.

**Shrink-to-fit for long names (TVET Original only, for now)**: an unusually
long name (English or Amharic) can run past its blank and overwrite the
printed text next to it — `certificateLayouts.js` fields support an optional
`maxWidth` (a percentage of the certificate image's own width) to guard
against this. When set, `RegistrarCertificates.jsx`'s `Overlay` component
(via the `useFitScale` hook) measures the text's natural rendered width
against `maxWidth` and, if it overflows, scales the text down — anchored at
its `left` start point so shrinking never shifts where the name begins —
down to a floor of `minScale` (default 0.5 = 50% of the base size) so
extremely long names stay legible rather than vanishing. Omitting `maxWidth`
(the default for every field right now) leaves a field exactly as before —
fixed size, no shrinking. It re-measures on both a new value (different
student) and container resize (`ResizeObserver` on the certificate `<img>`),
so it stays correct if the card's rendered width changes.

**Not yet filled in**: `maxWidth` is currently unset on every field — the
mechanism is fully wired up and tested (verified via direct JSX/syntax
checks), but needs the school to measure, per TVET Original department, how
much horizontal space is actually available for the English and Amharic name
fields before they'd run into the next printed word. Once supplied (same
Pixspy-coordinate style already used for `top`/`left` — click the boundary
point, report its `left` %, which then gets turned into a `maxWidth` by
subtracting the field's own `left`), add `maxWidth: "NN%"` to the relevant
`name`/`nameAmharic` entries in `TVET_ORIGINAL`.

**Shrink-to-fit for long names** (added this round, TVET Original only so
far): a field can carry an optional `maxWidth` (percentage of the image's
width) and `minScale` (floor, default 0.5). `RegistrarCertificates.jsx`'s
`Overlay` component measures the rendered text's natural width via
`scrollWidth` (unaffected by CSS `transform`, so it stays accurate across
re-scales) against `containerWidthPx` (the certificate `<img>`'s actual
rendered width, tracked live via a `ResizeObserver` so it stays correct if
the card resizes) and, if it would overflow past `maxWidth`, applies
`transform: scale()` anchored at the text's `left` start point (via
`transformOrigin: "left center"`) so a long name shrinks in place rather than
drifting or overwriting the printed text next to the blank. Fields without
`maxWidth` set are completely unaffected (scale stays 1, unchanged from
before). Currently no field has `maxWidth` populated yet — the plumbing is in
place but the actual per-field available-width measurements (for TVET
Original's `name`/`nameAmharic`) are still pending from the school; see the
comment block at the top of `certificateLayouts.js` for the field format to
add them in.

### 7.1 Bug fixed this round: certificate images 404'd in dev mode

First real local test surfaced this: `RegistrarCertificates.jsx` showed a
broken-image icon instead of the template, with the name/year overlay text
all bunched up on top of itself. Root cause — **not a positioning bug**: the
Vite dev-server proxy (`frontend/vite.config.js`) only forwarded `/api` and
`/uploads` to the backend, never `/content` (where certificate templates and
curriculum PDFs actually live). When an `<img>` fails to load, the browser
collapses its box to near-zero size, so percentage-based overlay positions
(`left: 78%`, `left: 89%`, etc.) all land almost exactly on top of each other
in that tiny collapsed box — that's what produced the overlapping
"2026 2028" / "E.C.E.C." text in the screenshot.

Fixed in two places:
- `frontend/vite.config.js` — added the missing `/content` proxy entry (dev mode)
- `nginx/nginx.conf` — added the matching `location /content/` block (had the
  same gap for the production/Docker path, just not yet exercised)

Also added a permanent safety net in `RegistrarCertificates.jsx` regardless of
this specific cause: overlay text now only renders once the template `<img>`
fires `onLoad` (tracked via `imgStatus` state); an `onError` shows a plain
"template image failed to load, check the path" message instead of ever
silently overlapping text on a broken image again — so if a future
mis-uploaded or missing file causes the same underlying failure, it fails
loud and clear instead of rendering garbled text.

---

## 8. Ethiopian Calendar

`frontend/src/utils/ethiopianCalendar.js` — a pure-math Gregorian→Ethiopian date
converter (standard Julian-Day-Number algorithm, no external API/network dependency).
Exports `formatEthiopianDate()` and `formatBothCalendars()` (renders
`"7/31/2026 (G.C.) · 24 Hamle 2018 (E.C.)"`). Wired into Registrar's **Students** and
**Registration** tabs, showing course start/end dates in both calendars side by side.

---

## 9. Certificate-relevant Student Fields

Added to the `Student` model and the registration form (Registrar → Registration):
- `fullNameAmharic` — optional Amharic name, editable later via
  `PATCH /registrar/students/:id/details` (inline "Edit" action on the Students tab)
- `courseStartDate` / `courseEndDate` — same edit path, used for both the calendar
  display and the certificate overlay

### 9.1 Registration form — full personal field set

`RegistrarRegistration.jsx`'s "Register New Student" form now collects the full set
of personal fields the `Student` model already supported (some existed in the schema
and the `POST /registrar/students` route already accepted them, but weren't exposed
on the form until this round — this was mostly a frontend gap, not a backend one):
Sex, Age, Guardian name, Nationality, Date of birth, Place of birth, Residence,
ESLCE GPA, National ID, Admission year, plus the existing Course start/end dates.
All are optional (`String?`/`Int?`/`DateTime?` in the schema) — nothing here blocks
registration if left blank.

**Admission Classification (Regular / Extension)** is new this round — added to the
`Student` model as `admissionClassification: AdmissionClassification?` (`regular |
extension`). It's **Degree-track only**: the toggle only renders on the form when
Degree is the selected track, and the backend forces it to `null` for TVET
registrations even if a value is somehow sent (`track === "degree" ? value : null`
in the route) — TVET has no equivalent concept.

None of these new fields are yet editable post-registration via
`PATCH /registrar/students/:id/details` (that route is still scoped to the two
certificate-relevant fields above) — extend it if/when an edit flow for these is
needed.

### 9.2 Degree transcript — separate format from TVET, course model split

Degree's official transcript (a real school scan was provided as a reference) is
**structurally different from TVET's**, not just a variant — multi-semester GPA
tables (one per `Level`/semester, in chronological order) rather than TVET's single
unit-competency table. Handled with a completely separate component,
`DegreeTranscriptDocument.jsx` (see §5), rather than branching inside the existing
`TranscriptDocument.jsx`.

**`Course` model gained two Degree-only fields** (`String?`/`Int?`, both `null`/unused
for TVET, which keeps its existing single compact `code` — e.g. `"LSA HRM2 01 1221"`
— unchanged):
- `courseNo` — the official Degree transcript prints "course code" (e.g. `BUMA`) and
  "course No." (e.g. `201`) as two separate columns, not one compound string like
  TVET's. `code` now holds just the prefix for Degree courses, `courseNo` the number.
- `creditHours` — needed for the transcript's "Cr. Hrs" column and, later, GPA
  calculation (GPA math needs credit-hour weighting) — not part of TVET's format at
  all (TVET's "hours" come from the theory/practice/cooperative score breakdown
  instead). Added now because the transcript can't render its Cr.Hrs column without
  it, even though it wasn't explicitly requested — flagged to the user as an addition
  beyond their literal ask.

`AdminAcademicStructure.jsx`'s course-add form branches on the **selected department's
track** (`departments.find(d => d.id === selectedDept)?.track`): Degree shows four
inputs (Course code / Course No. / Course title / Cr. Hrs), TVET keeps its original
two (Course name / Code). Same branch drives the courses table's columns.

**`Student.grandfatherName`** (new field) — the Degree transcript's "Grand Father Name"
header line; Ethiopian naming convention (given name + father's name + grandfather's
name) means this is distinct from `guardianName`, which is a different concept
(a contact person, not part of the student's own name chain). Added to the
Registration form as well.

### 9.3 Degree grade calculation — implemented

Unlike TVET (theory/practice/cooperative scores -> computed letter grade, see
`grade-scale.js`), **Degree teachers submit a single letter grade directly** — no
score breakdown at all. `Grade.theoryScore/practiceScore/cooperativeScore/totalScore`
are now nullable (`Float?`) to accommodate this; they stay populated for TVET and
`null` for Degree.

**`backend/src/utils/degree-grade-scale.js`** (mirrored on the frontend as
`utils/degreeGradeScale.js` — separate FE/BE codebases, no shared package, same
pattern as `grade-scale.js`/`ethiopianCalendar.js`) holds the official table:

| Letter | Points | Letter | Points |
|---|---|---|---|
| A+ | 4.00 | C+ | 2.50 |
| A | 4.00 | C | 2.00 |
| A- | 3.75 | C- | 1.75 |
| B+ | 3.50 | D | 1.00 |
| B | 3.00 | F | 0.00 |
| B- | 2.75 | I (Incomplete) | 0.00 |
| | | DO (Dropout) | 0.00 |

`I` and `DO` carry explicit 0.00 point values on the school's own table, so they're
included in every sum below exactly like `F` — not excluded from GPA the way some
schools treat incompletes/dropouts. This was a judgment call flagged to the user
(no correction received as of this round).

**Formulas** (`computeDegreeSemesterStats` in `degreeGradeScale.js`, consumed by
`DegreeTranscriptDocument.jsx`):
- Grade Point (per course) = Credit Hours × Letter Grade Value
- Semester GPA = semester's total grade points / semester's total credit hours
- Cumulative GPA = running total of grade points through that semester / running
  total of credit hours through that semester (computed progressively, carrying a
  running total forward from `Level.order` 1 through the current semester) — the
  user wasn't fully sure this was the right definition and said to implement it as
  a default they could correct; this is the standard definition and is verified
  against a hand-calculated example (see git history / conversation), not just
  assumed correct.

**Where the branch happens**: `POST /teacher/grades` (submission) and
`PATCH /admin/academics/grades/:id` (admin edit) both check
`course.level.department.track` and take the Degree path (single `letterGrade`,
validated against the table) or the TVET path (three scores → computed total →
computed letter) accordingly. `TeacherGrades.jsx` and `AdminGradesAttendance.jsx`
branch their UI the same way (single letter-grade dropdown vs. three score inputs).
`DeptHeadGrades.jsx`, `RegistrarGrades.jsx`, and `TeacherGrades.jsx`'s "My
Submissions" table all guard their `Total / Grade` display against `totalScore`
being `null` (would otherwise literally print `"null (B+)"` for a Degree grade).

**Print layout simplified**: the real scanned document uses a 2-column print layout
(semesters flow top-to-bottom in a left column, then continue in a right column, for
paper-efficient printing) — `DegreeTranscriptDocument.jsx` renders semesters as a
single top-to-bottom chronological list instead. Functionally equivalent for a web
view / multi-page PDF export (`exportElementToPdf` already paginates automatically),
just not a pixel-for-pixel print-layout match.

**Transcript download is now Registrar-only.** `StudentGrades.jsx` (the student's own
Grades tab) still shows the transcript read-only but the "Download PDF" button and
`exportElementToPdf` wiring were removed from it entirely — only
`RegistrarTranscripts.jsx` can generate/download a PDF now.

---

## 10. Registrar Grades/Exams — now using the full cascade

`RegistrarGrades.jsx` and `RegistrarExams.jsx` were flat department-only filters —
both now use `AcademicSelector` (mode="course") like every other Grades/Exams screen
in the system. Backend routes (`GET /registrar/grades`, `GET /registrar/exams`) gained
`levelId` and `courseId` query support to back this (previously department-only).

---

## 10.1 Graduation flow, Records enrichment, minor UX additions

**Login page** — `LoginPage.jsx`'s password field now has a show/hide eye toggle
(inline SVG, no new icon dependency). Scoped to just the login page for now — other
password-adjacent UI (Settings' password change, `CredentialModal`'s generated temp
passwords) wasn't touched since it wasn't asked for.

**Graduating a level (Students tab → Records tab)**: `RegistrarStudents.jsx` gained a
Level dropdown next to the Department filter (populated via `listLevels`, only enabled
once a department is chosen). When the **selected level is that department's final
level** — determined structurally by `order` being the max among the department's
levels, not by matching a hardcoded name like `"Level 4"` or `"Year IV Semester II"`,
since level names are admin-defined free text and this needed to work identically for
TVET and Degree — a **"GRADUATE STUDENTS"** button appears (plus an explanatory
banner). Clicking it (after a confirm dialog) calls
`POST /registrar/students/graduate` (`{ levelId }`), which bulk-updates every
currently-`active` student at that level to `recordStatus: "graduated"` — a status
change only, every field collected at registration is left untouched. They then show
up on the Records tab.

`RegistrarRecords.jsx` now shows the full registration info per graduated student
(sex, DOB in both calendars, place of birth, nationality, national ID, admission
year, and — Degree only — admission classification) rather than just the original
four columns, plus:
- **"Generate Certificate" per row** — deep-links to
  `/registrar/certificates?studentId=...`, which `RegistrarCertificates.jsx` reads on
  mount (`useSearchParams`) to auto-open that student, skipping the search step.
- **"Export CSV"** (`GET /registrar/records/export`) — a graduated-students report
  with a summary block (total count, per-department breakdown, generated date)
  prepended above the row data, following the same CSV-via-`<a href>` pattern already
  used by `RegistrarGrades.jsx`'s export.

**Certificate generation now works for graduated students, not just active ones** —
this was a real gap: `RegistrarCertificates.jsx`'s search previously hardcoded
`recordStatus: "active"`, so a graduated student (who may need a certificate
generated long after actually finishing) wouldn't turn up in search at all. Backend's
`GET /registrar/students` now accepts a comma-separated `recordStatus`
(`"active,graduated"`), and the Certificates page's search uses that — while
`RegistrarStudents.jsx` (the active roster) and the Registration approval queue still
implicitly default to `"active"` only, unchanged.

---

## 10.2 Finance/invoice fixes, CSV export bug, multi-image payment proofs

**Registration Fee is now removed on activation.** It's a one-time payment collected
only during the interim (N-) period; the `POST /registrar/students/:id/approve` route
now deletes the student's `"Registration Fee"` invoice (by title match) in the same
transaction that strips the username prefix and flips `recordStatus` to `active`.
Tuition Fee (recurring) and any admin-added invoices are untouched — this is a
delete of that one specific invoice, not a data reset.

**Invoice paid/unpaid status is now actually editable from Finance's Students →
View panel.** This was a real bug: `FinanceStudents.jsx`'s invoice table rendered
`status` as a plain, unbound `{ key: "status", label: "Status" }` cell — so it always
showed whatever the DB had at page-load and never changed no matter what Finance
did, because nothing ever called the update endpoint. The endpoint itself
(`PATCH /finance/invoices/:id/status`) already existed and already worked — it just
had no UI wired to it. Now a dropdown, same pattern as the existing Tuition Status
dropdown right above it, calling the existing `setInvoiceStatus` resource function
(already present in `resources.js`, also unused before this). Marking the `"Tuition
Fee"` invoice specifically paid/unpaid still drives `Student.tuitionStatus` +
`tuitionPaidUntil` as before (unchanged backend behavior) — this only fixes the UI
gap for itemized invoices generally.

**The student-side tuition banner (`StudentPayments.jsx`) now actually reflects
payment status.** Previously `tuitionNotice()` fired purely off the calendar day of
month (warning days 8-10, danger after day 10) with **no check on whether anything
was actually unpaid** — so it kept showing even after Finance marked every invoice
paid, until the calendar rolled over. Now it first checks
`invoices.some(inv => inv.status === "unpaid")` and returns `null` immediately if
nothing's unpaid; the day-based severity (warning vs. danger) only applies on top of
that. `StudentPayments.jsx`'s Invoices card also now shows a summed total and total
unpaid amount below the table — the "sum up invoices for easier payment structure"
ask.

**CSV export was actually broken everywhere, not just locally.** Every export button
in the app (`RegistrarGrades`, `RegistrarRecords`, `AdminGradesAttendance`,
`AdminFinance` x2, `FinanceStudents` x2, `FinanceTransactions`) was a plain
`<a href="/api/.../export">` — and a plain browser navigation never carries the
Bearer auth token (that's only attached by the axios interceptor in
`api/client.js`, which a raw `<a>` click never goes through). Every one of these was
silently hitting `authenticate` middleware's 401, not a localhost-specific issue.
Fixed with a shared `downloadFile(path, filename)` helper in `resources.js`: fetches
the CSV as an authenticated blob via the existing `api` instance
(`responseType: "blob"`), then triggers the download client-side via a synthetic
anchor click. All 8 export buttons now call this instead of rendering an `<a href>`;
the 5 `*ExportUrl()` builder functions had their `/api` prefix stripped since
`api.get()`'s `baseURL` already adds it (kept as URL-string builders rather than
inlining the path, so filtering args like `departmentId`/`range`/`status` stay in
one place).

**Payment proof screenshots — students can now upload more than one image per
proof.** `PaymentProof.screenshotUrl` (single `String`) is now
`screenshotUrls` (`String[]`, Postgres native array). `POST /student/payment-proofs`
switched from `uploadPaymentProof.single("screenshot")` to
`.array("screenshots", 6)`. `FileUpload.jsx` gained an optional `multiple` prop
(default `false`, so every other existing caller — `NewsPage`, `AdminSchedules`,
`TeacherExams` — is unaffected and still receives a single `File` as before); when
`true` it accepts multiple files and calls `onFileSelect` with an array instead.
Every place that rendered a proof's screenshot (`StudentPayments.jsx`,
`FinanceStudents.jsx`, `FinanceRegistration.jsx`) now maps over `screenshotUrls`
instead of linking a single `screenshotUrl`.

---

## 10.3 Password show/hide everywhere, Admin User Management tab

**`PasswordInput.jsx`** (new shared component) — a drop-in replacement for
`<input type="password">` with a show/hide eye toggle (same inline-SVG icons used
originally on the Login page, now extracted so they're not duplicated). `LoginPage.jsx`
was refactored to use it (behavior unchanged, just de-duplicated), and all three
fields on Settings → Password (`SettingsPage.jsx`: Current Password, New Password,
Confirm New Password) now use it too — this was the actual ask, Login already had it
from an earlier round.

**New Admin sidebar tab: User Management** (`/admin/user-management`,
`AdminUserManagement.jsx`) — lists the Registrar and Finance accounts (the other two
permanent, non-auto-generated-ID accounts alongside Admin itself) with a per-row
"Reset Password" button, generating a fresh temp password via the same
`CredentialModal` pattern used everywhere else in the app (Teachers, Dept Heads,
Students). Backend-wise this **extended an existing endpoint** rather than adding a
new one: `PATCH /admin/users/:id/reset-password` was previously hardcoded to
`["teacher", "dept_head"]` only — now a `RESETTABLE_ROLES` map also covers
`registrar` (`REG-` prefix) and `finance` (`FIN-` prefix). A new
`GET /admin/permanent-users` endpoint lists just those two roles (id, username,
fullName, email, phone, role, createdAt — no `passwordHash`) to populate the table.
Admin's own account is deliberately not resettable through this flow — no real use
case for self-reset outside the normal Settings change-password form, and doing so
here would be an odd, easily-misclicked footgun sitting in a list of *other* people's
accounts.

---

## 10.4 Login-access toggle, student delete, browse-by-level for Certificates/Transcripts

**`RegistrarStudents.jsx`'s Status column is now a functional Active/Inactive
dropdown** bound to `User.isActive` (already enforced at login in
`auth.routes.js` — `if (!user.isActive) return 401`, this was just never exposed as
a toggle for students before). Previously the column showed a static
`recordStatus` pill that was always "active" on this page anyway (the whole page is
already filtered to `recordStatus: "active"`), so it displayed no real information.
This is a **distinct concept from `recordStatus`** (interim → active → graduated) —
a student can be record-status-active but have login disabled, e.g. a disciplinary
hold — and distinct from *record deletion* below. Backend:
`PATCH /registrar/students/:id/active-status`.

**Delete icon — Students tab and Registration Queue.** For mis-registrations (wrong
person, duplicate, typo), not a disciplinary/withdrawal action. Backend:
`DELETE /registrar/students/:id`, blocked for `recordStatus: "graduated"` (a
completed, historical record — not exposed in Records tab, wasn't asked for there).
Cascades manually since none of the relevant relations are `onDelete: Cascade` in
the schema: `Grade`, `AttendanceRecord`, `Invoice`, `PaymentProof` rows for that
student are deleted outright (they only exist because of this student's
enrollment); `Transaction` rows are **detached** (`studentId` set to `null`) rather
than deleted, since a Transaction represents money actually received and stays as a
financial record even if the registration itself was a mistake — all in one
`$transaction`, `Student` then `User` deleted last. Both call sites
(`RegistrarStudents.jsx`, `RegistrarRegistration.jsx`'s Queue) show a confirm
dialog naming what gets removed before calling it.

**Certificates and Transcripts pages gained a "Browse by Track / Department /
Level" card**, using the existing `AcademicSelector` (`mode="level"`) — reuses the
same Track → Department → Level cascade already used elsewhere (Attendance,
Invoices) rather than building a new picker. Selecting a level lists every
active-or-graduated student in it with a "Generate Certificate"/"Generate
Transcript" action, right above the existing name/username search (both stay
available — browse is the faster path when the registrar knows the cohort, search
is faster for one specific known student). While in there,
`RegistrarTranscripts.jsx`'s search also picked up the same `"active,graduated"`
fix `RegistrarCertificates.jsx` got in §10.1 — it was still `"active"`-only, and a
transcript is exactly the kind of permanent record a graduated student is likely to
need generated after the fact.

---

## 10.5 Payment proof period bug, TVET Occupational Standard, advanced-entry registration

**Payment Proofs "Period" column was genuinely blank** — `StudentPayments.jsx`'s
table column was keyed `"period"` with no `render`, but the actual field on
`PaymentProof` is `periodMonth`; a plain unbound column key just prints
`row.period`, which doesn't exist. Fixed with `render: (r) => r.periodMonth`. Finance's
equivalent views (`FinanceStudents.jsx`, `FinanceRegistration.jsx`) already rendered
`periodMonth` correctly — this was specifically a student-side bug.

**TVET transcript's Occupational Standard now shows the level a student will
*complete* the program at, not whichever level they're currently sitting in.**
Previously `${department.name} (${level.name})` — literally their current enrollment
level, so it'd read "(Level 2 Diploma)" or "(Level 3)" mid-program instead of the
qualification they're actually working toward. `occupationalStandardLevel(student)`
in `TranscriptDocument.jsx` now derives it from `programType` instead:
`"level2_terminal"` → `"Level 2"` (the one path that stops short); everything else
(Level 2 Diploma's path through to Level 4, and Nursing/Medical Laboratory/Midwifery,
which only ever have one path straight to Level 4) → `"Level 4"`. `programType` is
TVET-only and already distinguishes exactly Terminal from everything else, so this
is a simple binary rather than a per-department lookup table.

**Advanced-entry registration — skips the interim/N- workflow and Registration Fee
entirely.** The Registrar also registers students who are already partway through
the program / already known to the school, not just brand-new first-timers — those
shouldn't be treated like a first-time enrollment. `POST /registrar/students` now
computes `shouldSkipInterim(track, departmentName, levelName, levelOrder)` before
creating the account:
- **TVET**: an explicit `(department, level name)` allow-list — for Accounting and
  HRM, `Level 3` *and* `Level 4` (only their two Level 2 tracks are true first-time
  entry); for Nursing, Medical Laboratory, and Midwifery, `Level 4` (their `Level 3`
  is the only true entry point, since they have no Level 2 at all) — **not** a
  general "lowest `order` = entry level" rule. That general rule would actually be
  wrong here: Accounting/HRM's "Level 2 Terminal" and "Level 2 Diploma" are parallel
  entry tracks (a new student picks one or the other), but `seed.js` stores them
  with sequential `order` values (0 and 1, since they're just array positions) — so
  a naive order-based check would incorrectly treat a brand-new Diploma-track
  registration as an advanced entry too, skipping its Registration Fee when it
  shouldn't. Verified against all 14 (department, level) combinations across all 5
  TVET departments with a standalone test before shipping it, not just assumed
  correct — including that exact Diploma edge case.
- **Degree**: a genuine general rule, since Degree has no parallel-track
  complication — any level with `order > 0` (i.e. anything other than "Year I
  Semester I") skips interim.

When `shouldSkipInterim` is true: the student is created directly with
`recordStatus: "active"` and a non-interim username (`generateUsername(..., {interim:
false})`, straight to `STU-0001` rather than `N-STU-0001`), and only the Tuition Fee
invoice is created — no Registration Fee at all, not created-then-deleted. The
Registrar's success modal title reflects which path happened
("Student Registered & Activated" vs "Student Registered (Interim)"), checked via
whether the returned username starts with `"N-"` rather than tracking a separate flag.

---

## 10.6 Mobile responsiveness pass, and academic progression (Promote to Next Level)

**Root-cause fix, affects nearly every page**: `Card.jsx`'s header was a plain
`flex items-center justify-between` with no wrap — fine on desktop, but any page
passing more than one or two controls into `action` (filters, search, buttons) would
overflow off the right edge of the screen on mobile instead of wrapping, which is
almost certainly what "text falls off" meant in practice. Now `flex-col` (stacked)
below the `sm:` breakpoint and `flex-row` above it, with `action`'s contents wrapped
in their own `flex flex-wrap` container. Several pages' own `action` markup
(`RegistrarStudents`, `AdminStudents`, `AdminFinance`, `FinanceStudents`,
`FinanceTransactions`) also had their own internal `flex gap-2` rows that needed
`flex-wrap` added directly, since Card's fix alone only helps when `action` is a
single element — it can't force a multi-button row *inside* `action` to wrap on its
own.

**Every fixed `grid-cols-N` form layout in the app is now responsive** — 16
instances across Registrar/Admin/Finance/Teacher/Student pages (registration forms,
settings, transaction forms, attendance summaries, etc.) were `grid-cols-2` or
`grid-cols-3` unconditionally, meaning on a narrow phone each field got squeezed to
a third or half of an already-narrow screen, which is exactly how placeholder text
like "Course code" or "Email (optional)" ends up visibly overflowing its own input
box. All changed to `grid-cols-1 sm:grid-cols-N` (one column on mobile, the original
layout from `sm:` up) via a scripted pass, not touched by hand one at a time — this
is a purely visual/layout change, doesn't affect any submit logic. The 3 remaining
`grid-cols-2` instances (inside `TranscriptDocument.jsx` and
`DegreeTranscriptDocument.jsx`, both signature-block layouts) were deliberately
**not** touched — those exist to replicate a fixed A4 print layout for PDF export,
and making them responsive would break that fidelity.

**Admin's Course-add form (`AdminAcademicStructure.jsx`, Degree branch specifically)**
— the actual bug behind "course code/course name text going into the text box": four
fixed-width inputs (`w-28`, `w-24`, `flex-1`, `w-24`) in a non-wrapping `flex` row,
so on a narrow screen `flex-1` got squeezed down to near-zero while fighting the
fixed-width siblings for space, and the placeholder text overflowed the resulting
tiny box. Now `flex flex-wrap` with `w-full sm:w-*` per input — full-width stacked
fields on mobile, the original fixed-width row from `sm:` up. Same fix applied to
the TVET course form, the Levels form, and the Departments form on the same page for
consistency, even though only the Degree course form was reported.

**Transcript viewing on mobile was genuinely broken, not just cramped** — both
`StudentGrades.jsx` and `RegistrarTranscripts.jsx` wrapped the transcript preview in
a container with `overflow-hidden`. Since the transcript documents are fixed-width
(designed to mirror an A4 printed page, not to reflow), `overflow-hidden` on a
narrow viewport doesn't just make it cramped — it silently **clips away most of the
document**, hence "can't see their transcript properly on a phone." Changed to
`overflow-x-auto` with a `min-w-[720px]` inner wrapper, so the full document renders
at its intended width and the user can pan across it horizontally, exactly the same
tradeoff every "view a wide fixed document on a small screen" UI makes (spreadsheets,
PDFs, etc.) — reflowing the transcript itself was not attempted, since it needs to
stay pixel-faithful to the official paper format for PDF export.

**Academic progression — investigated and reported honestly, since the true answer
mattered before "fixing" anything.** Before this round, the system had **no
mechanism at all** to move a student from one level to the next as they progress
through a program — `Student.levelId` was set once at registration and never
touched again by any route, except indirectly by "Graduate Students," which only
ever applies at a department's *final* level and changes `recordStatus`, not
`levelId`. A student registered at, say, TVET Level 3 would sit at Level 3 in the
database forever unless someone edited the row directly — there was no "move to
Level 4" action anywhere, and they could never be graduated either, since Graduate
only activates once *at* the final level.

Added the missing complement: **`POST /registrar/students/promote`** (`{ levelId }`)
finds the department's next level by `order` and bulk-moves every active student
there — same shape and confirm-dialog pattern as `/students/graduate`, but changing
`levelId` instead of `recordStatus`. Returns a 400 if the given level is already the
final one (tells the caller to use Graduate instead). On `RegistrarStudents.jsx`,
selecting any **non-final** level now shows a "PROMOTE TO `<next level name>`"
button (teal) right next to where "GRADUATE STUDENTS" (gold) shows for the final
level — mutually exclusive, exactly one of the two ever appears for a given level
selection, with a matching explanatory banner.

---

## 10.7 Level 2 Terminal graduation, and the Students-tab population report

**Bug caught during a deliberate re-verification pass, before it ever shipped to the
user as "done."** After building Promote in §10.6, went back and specifically traced
what Promote would do if triggered on Accounting/HRM's "Level 2 Terminal" — and it
was wrong: Terminal isn't the department's highest-`order` level (Level 4 is), so
the generic "next level by order" lookup would have offered to move Terminal
students into "Level 2 Diploma," a completely different one-year-vs-multi-year track,
not a continuation of it. Terminal students should only ever be graduated, never
promoted anywhere.

Fixed two ways:
- **Frontend** (`RegistrarStudents.jsx`): `TVET_TERMINAL_GRADUATION_LEVELS` (a
  `{department}|{level name}` set, same explicit-pairs style as `TVET_SKIP_INTERIM`
  in §10.4/10.5 — general order-based rules keep breaking on this exact
  Terminal/Diploma parallel-track shape) now makes "Level 2 Terminal" count as a
  graduation level (`isGraduationLevel = isFinalLevel || isTerminalGraduationLevel`)
  even though it isn't the max-order level — so selecting it shows **GRADUATE
  STUDENTS**, not PROMOTE. Verified with a standalone logic test covering both
  Accounting and HRM's full level lists (Terminal, Diploma, 3, 4) plus Nursing's
  simpler 2-level case, before shipping — all 7 cases pass.
- **Backend** (`POST /registrar/students/promote`): also guards against this
  directly (`TVET_TERMINAL_LEVELS`, same pairs), independent of whatever the
  frontend shows — so this can't be triggered by mistake even via a direct API
  call, not just a hidden button.

**New: "Export Report" on the Students tab** — only available while viewing **All
departments** (a Track selector — TVET or Degree — appears there specifically for
this, since the page otherwise has no track concept, only Department/Level).
`GET /registrar/students/report?track=tvet|degree` aggregates **active students
only** (matching the Students tab's own scope — interim and graduated students
aren't counted):
- **TVET**: one row per `(department, level)` combination across every TVET
  department — e.g. "Accounting - Level 3" — with Male / Female / Total columns,
  plus a bold Total row at the bottom. Registered ahead of `GET /students/:id` in
  the route file specifically so `/students/report` isn't swallowed as an `:id`
  value.
- **Degree**: one row per department only (no level breakdown — "how many students
  in BA Business Management," not per-semester counts), same Male/Female/Total
  shape.

Rendered via a new `StudentsReportDocument.jsx` (bold track name as a heading,
bordered table, matching the visual language of the certificate/transcript
documents) and downloaded as a PDF through the same `exportElementToPdf` utility
those already use — not a raw CSV, since "bold track heading" and an "appealing"
layout aren't expressible in plain CSV. Verified the aggregation logic (grouping,
sorting by department name then level order, male/female/total math) against a
hand-built mock dataset before shipping, same as the GPA formula in §9.3.

---

## 11. Known Gaps / Explicitly Deferred (not bugs, just not built)

- Degree course codes unseeded (curriculum PDFs not yet provided for those 4 majors).
- Teacher Attendance page will show an empty student list until at least one student
  has gone through the full N→active approval flow in that department/level — this
  is expected data-dependent behavior, not a bug (verified during last session).
- No real email/SMS delivery of generated credentials — shown once in the
  `CredentialModal` UI, relayed manually by staff.
- No course-enrollment table — a teacher's "students" list for grading/attendance is
  everyone active at that level, not a precise per-course roster.
- Certificate overlay positions are pixel-measured per real department template
  (see §7), all 18 templates fully measured via the school's own Pixspy
  readings — no known placeholder/estimated fields remain as of this round.
- Degree GPA's treatment of `I` (Incomplete) and `DO` (Dropout) — currently
  counted in both grade points and credit hours (same as `F`, per the school's
  own point table) rather than excluded from the GPA denominator, which is how
  some institutions handle incompletes. Flagged as a judgment call (see §9.3);
  not yet confirmed either way.
- Bundle size warning on frontend build (single ~880KB JS chunk, mostly `jspdf`/
  `html2canvas`) — functional, just not code-split. Low priority.

---

## 12. Running It

**Local (Docker, full stack):**
```
cd smbc-sims-v2
cp .env.example .env        # edit in real values, or accept the local-safe defaults
docker compose up --build
```
This builds Postgres + backend (auto-runs `prisma db push` and the seed script on
every boot — idempotent, safe to restart) + the Nginx-served frontend, all on one
command. Backend container logs print the three permanent accounts' generated
credentials on first boot.

**Local (frontend dev server only, against a separately-running backend):**
```
cd frontend
npm install
npm run dev   # Vite dev server proxies /api and /uploads to localhost:4000
```

**Password reset for a permanent account** (if credentials are lost before first login):
```
docker exec -it <backend-container> npm run reset-admin -- admin      # or registrar / finance
```

**VPS deploy**: same `docker compose up --build -d` on the target VPS; see
`docker-compose.yml` and `nginx/nginx.conf` for the reverse-proxy setup (frontend
container proxies `/api/*` and `/uploads/*` to the backend container over the
Docker network — same-origin from the browser's perspective, no CORS config needed).

---

## 13. Security Hardening

Started this round, at the user's request, as the final phase before calling the
project done. **This is a checkpoint mid-pass, not a completed audit** — documented
here in full exactly as asked, split into what's actually been fixed and verified
vs. what's identified but still open, so nothing gets lost or assumed-done between
sessions.

### 13.1 Completed and verified this round

**Timing-safe login (user enumeration fix).** `POST /auth/login` previously
short-circuited with `if (!user) return 401` *before* ever calling
`bcrypt.compare` — meaning a request for a nonexistent username returned near-
instantly, while a request for a real username took the full ~50-100ms bcrypt
comparison. Identical error message either way, but the *timing* difference alone
is enough to enumerate valid usernames. Fixed by always running a bcrypt compare —
against the real hash if the user exists and is active, against a fixed dummy
bcrypt hash (`LOGIN_DUMMY_HASH` in `utils/auth.js`, a real hash of an unguessable
random string, not a real password) if not — so response time is consistent
regardless. Verified the dummy hash is valid and `bcrypt.compare` against it
resolves normally (doesn't throw, returns `false`) before shipping it.

**Refresh tokens now actually respect deactivation and password changes.**
This was a real, fairly serious gap: `POST /auth/refresh` never touched the
database at all — it just re-signed a new 15-minute access token straight from
whatever the refresh token's payload said. That means marking a student's account
Inactive (§10.4's login-access toggle) only blocked *future logins* — anyone
already holding a valid refresh token (7-day lifetime) could keep silently minting
fresh access tokens the entire time, deactivation or not. Same problem for password
changes/resets: the old password's sessions on other devices just kept working.
Fixed with a new `User.tokenVersion` field (`Int @default(0)`): embedded in every
JWT payload at login, `/refresh` now looks the user up in the DB and requires
`user.isActive` AND `user.tokenVersion === payload.tokenVersion` before issuing a
new access token. `tokenVersion` is incremented on: self-service password change
(`POST /auth/change-password`), Admin's Teacher/Dept Head/Registrar/Finance
password reset, and Registrar's student password reset — each of those now
actually terminates every other active session, not just the current one.

**Cryptographically weak randomness replaced with `crypto`, in two places that
matter.** Both `generateTempPassword()` (`utils/auth.js`) and multer's generated
upload filenames (`lib/upload.js`) used `Math.random()` — a non-cryptographic PRNG
with predictable output, not appropriate for anything security-sensitive. Temp
passwords are literally how every Teacher/Dept Head/Student/Registrar/Finance
account gets its first (and reset) credentials — now generated with
`crypto.randomInt`/`crypto.randomBytes`. Upload filenames matter because several
upload types (see next item) were reachable by URL with no other access control —
now `crypto.randomBytes(16).toString("hex")` instead of `Date.now()` + weak
`Math.random()`.

**Payment-proof screenshots were publicly accessible to anyone with the URL — now
require authentication.** This was the most concerning single finding: `/uploads`
was served with plain `express.static`, no auth check at all, and payment-proof
files (personal financial documents — bank transfer screenshots) relied purely on
their filename being hard to guess. Combined with the weak-randomness issue above,
that "protection" was thinner than it looked. Fixed at the route level: a new
`paymentProofAccess` middleware sits in front of `/uploads/payment-proofs`
specifically (every other upload subpath — certificate templates, curriculum PDFs,
news images — stays plain public static, since none of those are personal/
sensitive) and requires a valid Bearer token; Admin/Finance/Registrar can view any
proof, a Student can only view a proof that's genuinely their own (checked via a DB
lookup, not just role). Since a plain `<img src>`/`<a href>` never carries the
Authorization header (the exact same constraint already hit and fixed for CSV
exports in §10.1 — this is the same problem again, on images), every page that
rendered a payment-proof screenshot needed a matching frontend fix:
`FinanceStudents.jsx`, `FinanceRegistration.jsx`, `StudentPayments.jsx` all
switched from a plain `<a href>`/`<img src>` to a new `viewFile()` helper (opens an
authenticated blob in a new tab) and a new `AuthenticatedImage.jsx` component
(fetches the image as an authenticated blob, then uses the resulting object URL as
the actual `<img>` src) — both in `api/resources.js`, same authenticated-blob
pattern as the existing `downloadFile()` CSV helper.

**File upload hardening**, all in `lib/upload.js`:
- **Size limits added** — none existed before (any authenticated user could upload
  an arbitrarily large file, a disk-exhaustion DoS vector). Images capped at 5MB,
  PDFs at 15MB.
- **Mimetype-only validation replaced with mimetype + file-extension allowlist.**
  The old filters (`imageOnly`/`pdfOnly`) only checked the client-*declared*
  `Content-Type` — which is trivially spoofed in a raw multipart request and isn't
  proof of actual content. Now checked against BOTH the declared mimetype and the
  actual file extension. This is not full magic-byte content sniffing (a genuinely
  malicious file with a forged mimetype *and* a matching-looking extension could
  still slip through), but it closes the easy version of the attack.
- **SVG explicitly excluded from "images," even though browsers treat it as an
  image type.** An SVG can carry an embedded `<script>` — harmless as an `<img
  src>`, but this app renders uploaded images behind plain top-level-navigation
  links in a few places (payment-proof "View" links, pre-fix), and a direct
  navigation to an SVG *does* execute any embedded script in that response's
  origin. Simplest fix: never accept SVG as an "image" upload here.
- **`multer` upgraded 1.x → 2.x.** Flagged by `npm install` itself during this
  round: *"multer@1.4.5-lts.2: Multer 1.x is impacted by a number of
  vulnerabilities, which have been patched in 2.x."* Verified the 2.x API surface
  (`diskStorage`, `.single()`, `.array()`, `limits`, `fileFilter`) still matches
  every existing call site before making the change — no call-site changes needed
  beyond the size-limit/filter rewrite above.

**JWT hardening**: `algorithms: ["HS256"]` now pinned explicitly on both
`jwt.verify()` calls (access and refresh) in `utils/auth.js`, rather than left
unrestricted — defense in depth against algorithm-confusion attacks, even though
this app only ever signs with HS256 today and doesn't use asymmetric keys (so the
classic RS256-to-HS256 confusion attack doesn't directly apply here).

**`helmet` added** (`app.js`) — the app previously shipped with zero of the
standard security response headers (`X-Content-Type-Options`,
`X-Frame-Options`/frame-ancestors, `Strict-Transport-Security` when behind HTTPS,
etc.). Added with `helmet()`'s defaults; not yet tuned with a custom CSP (see
§13.2).

**CORS locked down from wide-open to same-origin-by-default.** Previously bare
`cors()` with no options, which reflects/allows any origin. Now reads
`CORS_ORIGIN` from the environment (comma-separated list) and defaults to
`origin: false` (same-origin only) if unset — matching how the app is actually
deployed (nginx serves frontend and proxies `/api` from one origin, per
`nginx.conf`). Documented in `.env.example` for the one legitimate reason to set it
(a genuinely separate frontend origin — staging/preview, local frontend dev
against a remote API).

**Rate limiting added — there was none at all before.** Two layers, both via
`express-rate-limit`:
- A dedicated, tight limiter on `POST /auth/login` specifically (10 requests per 15
  minutes per IP) — login is the single highest-value brute-force target in the
  app, and this closes what was a completely open door (unlimited password
  attempts, any account, no lockout, no delay, nothing).
- A general API-wide limiter (600 requests per 15 minutes per IP) as a baseline
  DoS/abuse backstop across every other route, generous enough not to interfere
  with real usage (a Registrar paging through students, a Teacher submitting a full
  class's grades in one sitting) but capping sustained hammering of any endpoint.
- `app.set("trust proxy", 1)` added alongside this — required for the limiters to
  key on the real client IP rather than the reverse proxy's own address once
  deployed behind Coolify/nginx (`nginx.conf` already forwards `X-Forwarded-For`
  correctly; without `trust proxy` set, Express would ignore that header and treat
  every request as coming from the same IP, breaking per-client rate limiting
  entirely).

**Startup secret validation** — `server.js` now refuses to boot if
`JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` are missing, under 32 characters, or match
a known placeholder (`"change-me-access"`, `"change-me-refresh"`, `"secret"`,
`"changeme"`, empty) — with a clear error message and an `openssl rand -base64 48`
suggestion, rather than silently starting up in a genuinely insecure state.
`.env.example`'s placeholder secrets are exactly the kind of thing that ends up
still in place in a real deployment if nothing ever forces the issue — this was a
concrete, testable fix, and both the pass and fail cases were verified directly
(weak secret exits with code 1 and a clear message; a real random secret starts
normally) before shipping it. Bypassable via `ALLOW_WEAK_SECRETS=true` for local
dev only — documented as such in `.env.example`, defaults to off.

**Error responses no longer leak internal detail in production.** The global
error handler previously returned `err.message` verbatim for *any* unexpected
error — which for a raw Prisma/DB error could leak schema details, file paths, or
other internals to the client. Now gated on `NODE_ENV`: full detail still reaches
the server log either way, but the client only sees the real message when
`NODE_ENV !== "production"`; production gets a generic "Something went wrong."
Multer errors are special-cased ahead of that generic branch — `LIMIT_FILE_SIZE`
becomes a clear "File is too large," and fileFilter rejections (invalid file type)
keep their specific message — both as proper `400`s instead of falling through to
a generic `500`. **This requires `NODE_ENV=production` to actually be set in
`docker-compose.yml`/the Coolify deployment** — see §13.2, not yet done.

**bcrypt work factor bumped** 10 → 12 rounds (`hashPassword` in `utils/auth.js`) —
a bit more margin against offline brute-force of a leaked hash, at negligible
real-world cost (a login-time hash, not a hot path).

### 13.2 Identified, not yet done — needed before calling this "secured"

Roughly in priority order:

1. **`NODE_ENV=production` needs to be set in `docker-compose.yml`** for the
   backend service. Several of the fixes above (error-detail suppression
   specifically) are conditioned on this and are currently **inert** without it —
   was mid-edit on the Dockerfile/compose/nginx pass when this checkpoint was
   requested.
2. **Dockerfile still runs as root.** No `USER` directive — container-hardening
   best practice is to run as an unprivileged user so a compromised app process has
   a smaller blast radius. Was about to add this when stopped.
3. **`nginx.conf` has no security response headers of its own** — relies entirely
   on `helmet()` from the Express backend, but that only covers `/api/*`; static
   frontend assets served directly by nginx get nothing (`X-Content-Type-Options`,
   `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy` at minimum).
4. **Postgres's port is still published to the host** in `docker-compose.yml`
   (`"5432:5432"`) — flagged in an earlier conversation (before this security
   round formally started) and never actually fixed. The comment in the compose
   file even says to remove it for production. Combine with the classic
   Docker-bypasses-`ufw` gotcha already discussed then — this needs to actually be
   removed/commented out for a real deployment, not just noted.
5. **No custom Content-Security-Policy.** `helmet()`'s defaults are a reasonable
   baseline but not tuned for this app specifically (e.g. explicitly restricting
   script/style/img/connect sources). Worth a real CSP pass once the production
   domain is known.
6. **No full route-by-route authorization/IDOR audit performed yet.** This round
   focused on auth itself (login, tokens, sessions) and file access control
   (the payment-proof gap) — genuinely serious, concrete issues that were found and
   fixed — but did **not** yet include a systematic pass over every route in
   `admin.routes.js`, `admin-academics.routes.js`, `registrar.routes.js`,
   `teacher.routes.js`, `depthead.routes.js`, `finance.routes.js`, and
   `student.routes.js` checking that every single endpoint correctly scopes data to
   the requester (e.g. can a Teacher only ever touch their own assigned courses; can
   a Dept Head only ever see their own department; can a Student only ever read
   their own records) rather than trusting a client-supplied ID. Some of this is
   already enforced per `scopeToDepartment`/`assertOwnCourse` per earlier rounds'
   work (see §6), but it hasn't been re-verified end-to-end as part of *this*
   hardening pass specifically.
7. **`npm audit` hasn't been run cleanly.** Attempted during this round;
   blocked by the sandbox's network restrictions on Prisma's binary CDN (unrelated
   to the audit itself, a pre-existing environment limitation hit earlier in this
   project too). Should be run for real in an environment with normal network
   access, for both `backend/` and `frontend/`, before calling dependencies clean.
8. **Frontend dependencies not reviewed at all this round** — this pass was
   backend/infra-focused. Worth at least an `npm audit` pass and a skim for
   anything obviously stale.
9. **Dedicated rate limits on other sensitive endpoints** (password change,
   payment-proof upload, student registration) beyond the general 600/15-min
   backstop — lower priority than the items above, since the general limiter does
   cover them, just not as tightly as login's dedicated one.
10. **Account lockout beyond rate limiting** — not implemented; rate limiting was
    judged sufficient given the added state/complexity a lockout mechanism would
    need (tracking failed attempts per account, an unlock flow, etc.). Worth
    revisiting if this becomes a real concern in practice.
11. **JWT stored in `localStorage`, not an `httpOnly` cookie** — a deliberate,
    accepted architectural tradeoff carried over from the original build (Bearer
    token in the `Authorization` header keeps CORS/mobile-style usage simple, and
    genuinely removes CSRF as a concern since there's no cookie-based session to
    forge). The tradeoff is that any future XSS would be able to read the token
    from `localStorage`. No `dangerouslySetInnerHTML` or `eval`/`new Function`
    usage was found anywhere in the frontend during this round (checked directly),
    so there's currently no known XSS vector — `helmet`'s CSP (once tuned, see #5)
    is the intended compensating control here, not a cookie migration, which would
    be a much larger, riskier change to make this late.
12. **Multer 2.x upgrade verified at the API-surface level only** — confirmed every
    existing call site (`diskStorage`, `.single()`, `.array()`, `limits`,
    `fileFilter`) matches the 2.x API before switching, but this hasn't been
    exercised against a real running server + database in this sandboxed
    environment (no live DB available here). Worth a real upload smoke-test
    (exam PDF, payment-proof screenshot, certificate template) after deploying
    this round's changes, before considering the multer upgrade fully verified.
