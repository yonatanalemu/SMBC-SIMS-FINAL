import api from "./client";

// Plain <a href="/api/..."> navigation never carries the Bearer auth token
// (it's only attached by the axios interceptor in client.js, which a raw
// browser navigation doesn't go through) — every CSV export in the app was
// silently 401'ing because of this. Fetch as an authenticated blob via the
// same `api` instance instead, then trigger the download client-side.
export async function downloadFile(path, filename) {
  const response = await api.get(path, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// Opens an authenticated file (currently just payment-proof screenshots) in
// a new tab. Same reasoning as downloadFile above — payment proofs require
// a valid Bearer token to fetch now (see app.js's paymentProofAccess), and a
// plain <img src="/uploads/...">/<a href="/uploads/..."> never carries that
// token since it's not a real navigation through the axios client.
export async function viewFile(path) {
  const response = await api.get(path, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  window.open(url, "_blank", "noopener,noreferrer");
  // Deliberately not revoking immediately — the new tab needs the object
  // URL to stay valid while it's open. Left to the browser to reclaim on
  // tab close/navigation rather than tracked and revoked manually here.
}

// Resolves a stored `/uploads/payment-proofs/...` URL to an authenticated
// blob object-URL for use as an <img>'s src. Payment-proof paths need this;
// everything else (certificate templates, curriculum PDFs, news images) is
// still served as a plain public static URL and can just be used directly.
export async function fetchAuthenticatedImageUrl(path) {
  const response = await api.get(path, { responseType: "blob" });
  return window.URL.createObjectURL(new Blob([response.data]));
}

// ---------- Structure (read-only, any authenticated role) ----------
export const listDepartments = () => api.get("/structure/departments").then((r) => r.data);
export const deactivateDeptHead = (id) => api.delete(`/admin/dept-heads/${id}`).then((r) => r.data);
export const listLevels = (departmentId) => api.get("/structure/levels", { params: { departmentId } }).then((r) => r.data);
export const listCourses = (levelId) => api.get("/structure/courses", { params: { levelId } }).then((r) => r.data);
export const getCertificateTemplateForStudent = (studentId, type) =>
  api.get(`/structure/certificate-template-for-student/${studentId}`, { params: { type } }).then((r) => r.data);

// ---------- Admin: academic structure (create/edit — Admin only) ----------
export const createDepartment = (payload) => api.post("/admin/departments", payload).then((r) => r.data);
export const createLevel = (payload) => api.post("/admin/levels", payload).then((r) => r.data);
export const createCourse = (payload) => api.post("/admin/courses", payload).then((r) => r.data); // payload: {levelId, name, code, courseNo, creditHours, teacherId}
export const assignCourseTeacher = (courseId, teacherId) =>
  api.patch(`/admin/courses/${courseId}/teacher`, { teacherId }).then((r) => r.data);

// ---------- Admin: staff ----------
export const createTeacher = (payload) => api.post("/admin/teachers", payload).then((r) => r.data);
export const listTeachers = (departmentId) => api.get("/admin/teachers", { params: { departmentId } }).then((r) => r.data);
export const deactivateTeacher = (id) => api.delete(`/admin/teachers/${id}`).then((r) => r.data);
export const listEligibleDeptHeads = () => api.get("/admin/eligible-dept-heads").then((r) => r.data);
export const assignDeptHead = (payload) => api.post("/admin/dept-heads/assign", payload).then((r) => r.data);
export const listDeptHeads = () => api.get("/admin/dept-heads").then((r) => r.data);
export const resetStaffPassword = (userId) => api.patch(`/admin/users/${userId}/reset-password`).then((r) => r.data);
export const listPermanentUsers = () => api.get("/admin/permanent-users").then((r) => r.data);
export const getAdminDashboard = () => api.get("/admin/dashboard").then((r) => r.data);

// ---------- Admin academics: grade final-approval + attendance ----------
export const adminListGrades = (params) => api.get("/admin/academics/grades", { params }).then((r) => r.data);
export const adminEditGrade = (id, payload) => api.patch(`/admin/academics/grades/${id}`, payload).then((r) => r.data);
export const adminApproveGrade = (id) => api.patch(`/admin/academics/grades/${id}/approve`).then((r) => r.data);
export const adminListExams = (params) => api.get("/admin/academics/exams", { params }).then((r) => r.data);
export const adminExamDecision = (id, payload) => api.patch(`/admin/academics/exams/${id}/decision`, payload).then((r) => r.data);
export const adminListAttendance = ({ levelId, teacherId } = {}) =>
  api.get("/admin/academics/attendance", { params: { levelId, teacherId } }).then((r) => r.data);

export const adminExportAttendanceUrl = ({ levelId, teacherId } = {}) => {
  const params = new URLSearchParams();
  if (levelId) params.set("levelId", levelId);
  if (teacherId) params.set("teacherId", teacherId);
  const qs = params.toString();
  return `/admin/academics/attendance/export${qs ? `?${qs}` : ""}`;
};

// ---------- Registrar ----------
export const registerStudent = (payload) => api.post("/registrar/students", payload).then((r) => r.data);
export const listRegistrarStudents = (params) => api.get("/registrar/students", { params }).then((r) => r.data);
export const getRegistrarStudent = (id) => api.get(`/registrar/students/${id}`).then((r) => r.data);
export const approveInterimStudent = (id) => api.post(`/registrar/students/${id}/approve`).then((r) => r.data);
export const resetStudentPassword = (id) => api.patch(`/registrar/students/${id}/reset-password`).then((r) => r.data);
export const updateStudentDetails = (id, payload) => api.patch(`/registrar/students/${id}/details`, payload).then((r) => r.data);
export const setStudentActiveStatus = (id, isActive) => api.patch(`/registrar/students/${id}/active-status`, { isActive }).then((r) => r.data);
export const deleteStudent = (id) => api.delete(`/registrar/students/${id}`).then((r) => r.data);
export const listApprovedGradesForRegistrar = (params) => api.get("/registrar/grades", { params }).then((r) => r.data);
export const registrarGradesExportUrl = (departmentId) => `/registrar/grades/export${departmentId ? `?departmentId=${departmentId}` : ""}`;
export const listApprovedExamsForRegistrar = (params) => api.get("/registrar/exams", { params }).then((r) => r.data);
export const markExamPrinted = (id) => api.patch(`/registrar/exams/${id}/mark-printed`).then((r) => r.data);
export const listRecords = () => api.get("/registrar/records").then((r) => r.data);
export const graduateStudentsInLevel = (levelId) => api.post("/registrar/students/graduate", { levelId }).then((r) => r.data);
export const promoteStudentsInLevel = (levelId) => api.post("/registrar/students/promote", { levelId }).then((r) => r.data);
export const getStudentsReport = (track) => api.get("/registrar/students/report", { params: { track } }).then((r) => r.data);
export const registrarRecordsExportUrl = () => `/registrar/records/export`;
export const getTranscript = (studentId) => api.get(`/registrar/students/${studentId}/transcript`).then((r) => r.data);

// ---------- Finance ----------
export const listFinanceStudents = (params) => api.get("/finance/students", { params }).then((r) => r.data);
export const getFinanceStudent = (id) => api.get(`/finance/students/${id}`).then((r) => r.data);
export const setTuitionStatus = (id, status) => api.patch(`/finance/students/${id}/tuition-status`, { status }).then((r) => r.data);
export const financeStudentsExportUrl = (status, departmentId) => {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (departmentId) params.set("departmentId", departmentId);
  return `/finance/students/export?${params.toString()}`;
};
export const createInvoice = (payload) => api.post("/finance/invoices", payload).then((r) => r.data);
export const setInvoiceStatus = (id, status) => api.patch(`/finance/invoices/${id}/status`, { status }).then((r) => r.data);
export const listRegistrationQueue = () => api.get("/finance/registration").then((r) => r.data);
export const verifyPaymentProof = (proofId, status) =>
  api.patch(`/finance/registration/proofs/${proofId}/verify`, { status }).then((r) => r.data);
export const recordTransaction = (payload) => api.post("/finance/transactions", payload).then((r) => r.data);
export const listTransactions = (range) => api.get("/finance/transactions", { params: { range } }).then((r) => r.data);
export const transactionsExportUrl = (range) => `/finance/transactions/export?range=${range || "all"}`;

// ---------- Dept Head ----------
export const deptHeadListGrades = (params) => api.get("/dept-head/grades", { params }).then((r) => r.data);
export const deptHeadGradeDecision = (id, decision) => api.patch(`/dept-head/grades/${id}/decision`, { decision }).then((r) => r.data);
export const deptHeadListExams = (params) => api.get("/dept-head/exams", { params }).then((r) => r.data);
export const deptHeadExamDecision = (id, payload) => api.patch(`/dept-head/exams/${id}/decision`, payload).then((r) => r.data);
export const deptHeadListAttendance = (levelId) => api.get("/dept-head/attendance", { params: { levelId } }).then((r) => r.data);
export const deptHeadListCurricula = () => api.get("/dept-head/curricula").then((r) => r.data);

// ---------- Teacher ----------
export const teacherListCourses = () => api.get("/teacher/courses").then((r) => r.data);
export const teacherUpdateCourseStatus = (courseId, status) =>
  api.patch(`/teacher/courses/${courseId}/status`, { status }).then((r) => r.data);
export const teacherCourseStudents = (courseId) => api.get(`/teacher/courses/${courseId}/students`).then((r) => r.data);
export const teacherLevelStudents = (levelId) => api.get(`/teacher/levels/${levelId}/students`).then((r) => r.data);
export const teacherSubmitGrade = (payload) => api.post("/teacher/grades", payload).then((r) => r.data);
export const teacherListGrades = () => api.get("/teacher/grades").then((r) => r.data);
export const teacherSubmitExam = (formData) =>
  api.post("/teacher/exams", formData, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
export const teacherListExams = () => api.get("/teacher/exams").then((r) => r.data);
export const teacherDeleteExam = (id) => api.delete(`/teacher/exams/${id}`).then((r) => r.data);
export const teacherSubmitAttendance = (payload) => api.post("/teacher/attendance", payload).then((r) => r.data);
export const teacherListAttendance = () => api.get("/teacher/attendance").then((r) => r.data);
export const teacherListCurricula = () => api.get("/teacher/curricula").then((r) => r.data);

// ---------- Student ----------
export const studentGrades = () => api.get("/student/grades").then((r) => r.data);
export const studentTranscript = () => api.get("/student/transcript").then((r) => r.data);
export const studentInvoices = () => api.get("/student/invoices").then((r) => r.data);
export const studentPaymentProofs = () => api.get("/student/payment-proofs").then((r) => r.data);
export const studentUploadPaymentProof = (formData) =>
  api.post("/student/payment-proofs", formData, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
export const studentAttendance = () => api.get("/student/attendance").then((r) => r.data);
export const studentSchedules = () => api.get("/student/schedules").then((r) => r.data);
export const studentListCurricula = () => api.get("/student/curricula").then((r) => r.data);

// ---------- Settings (invoice defaults) ----------
export const getAppSettings = () => api.get("/settings").then((r) => r.data);
export const updateAppSettings = (payload) => api.patch("/settings", payload).then((r) => r.data);

// ---------- Shared: Schedules ----------
export const listSchedules = (departmentId) => api.get("/schedules", { params: { departmentId } }).then((r) => r.data);
export const createSchedule = (formData) =>
  api.post("/schedules", formData, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
export const deleteSchedule = (id) => api.delete(`/schedules/${id}`).then((r) => r.data);