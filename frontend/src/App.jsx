import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import RequireRole from "./routes/RequireRole";

import LoginPage from "./pages/shared/LoginPage";
import Unauthorized from "./pages/shared/Unauthorized";
import SettingsPage from "./pages/shared/SettingsPage";
import NewsPage from "./pages/shared/NewsPage";
import CurriculumPage from "./pages/shared/CurriculumPage";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAcademicStructure from "./pages/admin/AdminAcademicStructure";
import AdminTeachers from "./pages/admin/AdminTeachers";
import AdminDeptHeads from "./pages/admin/AdminDeptHeads";
import AdminStudents from "./pages/admin/AdminStudents";
import AdminGradesAttendance from "./pages/admin/AdminGradesAttendance";
import AdminFinance from "./pages/admin/AdminFinance";
import AdminInvoiceSettings from "./pages/admin/AdminInvoiceSettings";
import AdminSchedules from "./pages/admin/AdminSchedules";
import AdminUserManagement from "./pages/admin/AdminUserManagement";

import RegistrarStudents from "./pages/registrar/RegistrarStudents";
import RegistrarRegistration from "./pages/registrar/RegistrarRegistration";
import RegistrarGrades from "./pages/registrar/RegistrarGrades";
import RegistrarExams from "./pages/registrar/RegistrarExams";
import RegistrarRecords from "./pages/registrar/RegistrarRecords";
import RegistrarTranscripts from "./pages/registrar/RegistrarTranscripts";
import RegistrarCertificates from "./pages/registrar/RegistrarCertificates";

import FinanceStudents from "./pages/finance/FinanceStudents";
import FinanceRegistration from "./pages/finance/FinanceRegistration";
import FinanceTransactions from "./pages/finance/FinanceTransactions";

import DeptHeadAttendance from "./pages/depthead/DeptHeadAttendance";
import DeptHeadGrades from "./pages/depthead/DeptHeadGrades";
import DeptHeadExams from "./pages/depthead/DeptHeadExams";
import DeptHeadSchedule from "./pages/depthead/DeptHeadSchedule";

import TeacherGrades from "./pages/teacher/TeacherGrades";
import TeacherExams from "./pages/teacher/TeacherExams";
import TeacherAttendance from "./pages/teacher/TeacherAttendance";
import TeacherSchedules from "./pages/teacher/TeacherSchedules";

import StudentPayments from "./pages/student/StudentPayments";
import StudentGrades from "./pages/student/StudentGrades";
import StudentAttendance from "./pages/student/StudentAttendance";
import StudentSchedules from "./pages/student/StudentSchedules";

import { deptHeadListCurricula, teacherListCurricula, studentListCurricula } from "./api/resources";

const ALL_ROLES = ["admin", "registrar", "finance", "dept_head", "teacher", "student"];

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            <Route path="/settings" element={<Navigate to="/settings/profile" replace />} />
            <Route path="/settings/:tabParam" element={<RequireRole roles={ALL_ROLES}><SettingsPage /></RequireRole>} />
            <Route path="/news" element={<RequireRole roles={ALL_ROLES}><NewsPage /></RequireRole>} />

            {/* Admin */}
            <Route path="/admin" element={<RequireRole roles={["admin"]}><AdminDashboard /></RequireRole>} />
            <Route path="/admin/academic-structure" element={<RequireRole roles={["admin"]}><AdminAcademicStructure /></RequireRole>} />
            <Route path="/admin/teachers" element={<RequireRole roles={["admin"]}><AdminTeachers /></RequireRole>} />
            <Route path="/admin/dept-heads" element={<RequireRole roles={["admin"]}><AdminDeptHeads /></RequireRole>} />
            <Route path="/admin/students" element={<RequireRole roles={["admin"]}><AdminStudents /></RequireRole>} />
            <Route path="/admin/grades-attendance/:tab" element={<RequireRole roles={["admin"]}><AdminGradesAttendance /></RequireRole>} />
            <Route path="/admin/finance/invoice-settings" element={<RequireRole roles={["admin"]}><AdminInvoiceSettings /></RequireRole>} />
            <Route path="/admin/finance/:tab" element={<RequireRole roles={["admin"]}><AdminFinance /></RequireRole>} />
            <Route path="/admin/schedules" element={<RequireRole roles={["admin"]}><AdminSchedules /></RequireRole>} />
            <Route path="/admin/user-management" element={<RequireRole roles={["admin"]}><AdminUserManagement /></RequireRole>} />

            {/* Registrar */}
            <Route path="/registrar/students" element={<RequireRole roles={["registrar"]}><RegistrarStudents /></RequireRole>} />
            <Route path="/registrar/registration" element={<RequireRole roles={["registrar"]}><RegistrarRegistration /></RequireRole>} />
            <Route path="/registrar/grades" element={<RequireRole roles={["registrar"]}><RegistrarGrades /></RequireRole>} />
            <Route path="/registrar/exams" element={<RequireRole roles={["registrar"]}><RegistrarExams /></RequireRole>} />
            <Route path="/registrar/records" element={<RequireRole roles={["registrar"]}><RegistrarRecords /></RequireRole>} />
            <Route path="/registrar/transcripts" element={<RequireRole roles={["registrar"]}><RegistrarTranscripts /></RequireRole>} />
            <Route path="/registrar/certificates" element={<RequireRole roles={["registrar"]}><RegistrarCertificates /></RequireRole>} />

            {/* Finance */}
            <Route path="/finance" element={<RequireRole roles={["finance"]}><FinanceStudents /></RequireRole>} />
            <Route path="/finance/registration" element={<RequireRole roles={["finance"]}><FinanceRegistration /></RequireRole>} />
            <Route path="/finance/transactions" element={<RequireRole roles={["finance"]}><FinanceTransactions /></RequireRole>} />

            {/* Dept Head */}
            <Route path="/dept-head/attendance" element={<RequireRole roles={["dept_head"]}><DeptHeadAttendance /></RequireRole>} />
            <Route path="/dept-head/grades" element={<RequireRole roles={["dept_head"]}><DeptHeadGrades /></RequireRole>} />
            <Route path="/dept-head/exams" element={<RequireRole roles={["dept_head"]}><DeptHeadExams /></RequireRole>} />
            <Route path="/dept-head/curriculum" element={<RequireRole roles={["dept_head"]}><CurriculumPage fetcher={deptHeadListCurricula} /></RequireRole>} />
            <Route path="/dept-head/schedule" element={<RequireRole roles={["dept_head"]}><DeptHeadSchedule /></RequireRole>} />

            {/* Teacher */}
            <Route path="/teacher/grades" element={<RequireRole roles={["teacher"]}><TeacherGrades /></RequireRole>} />
            <Route path="/teacher/exams" element={<RequireRole roles={["teacher"]}><TeacherExams /></RequireRole>} />
            <Route path="/teacher/attendance" element={<RequireRole roles={["teacher"]}><TeacherAttendance /></RequireRole>} />
            <Route path="/teacher/curriculum" element={<RequireRole roles={["teacher"]}><CurriculumPage fetcher={teacherListCurricula} showCourseStatus /></RequireRole>} />
            <Route path="/teacher/schedules" element={<RequireRole roles={["teacher"]}><TeacherSchedules /></RequireRole>} />

            {/* Student */}
            <Route path="/student/payments" element={<RequireRole roles={["student"]}><StudentPayments /></RequireRole>} />
            <Route path="/student/grades" element={<RequireRole roles={["student"]}><StudentGrades /></RequireRole>} />
            <Route path="/student/attendance" element={<RequireRole roles={["student"]}><StudentAttendance /></RequireRole>} />
            <Route path="/student/curriculum" element={<RequireRole roles={["student"]}><CurriculumPage fetcher={studentListCurricula} /></RequireRole>} />
            <Route path="/student/schedules" element={<RequireRole roles={["student"]}><StudentSchedules /></RequireRole>} />

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}
