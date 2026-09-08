import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import smbcLogo from "../assets/smbc-logo.png";

const ROLE_LABELS = {
  admin: "Admin", registrar: "Registrar", finance: "Finance",
  dept_head: "Department Head", teacher: "Teacher", student: "Student",
};

const SETTINGS_GROUP = {
  label: "Settings",
  children: [
    { to: "/settings/profile", label: "Profile" },
    { to: "/settings/display", label: "Display" },
    { to: "/settings/password", label: "Password" },
  ],
};
const NEWS_ITEM = { to: "/news", label: "News" };

const NAV = {
  admin: [
    { to: "/admin", label: "Dashboard", end: true },
    { to: "/admin/academic-structure", label: "Academic Structure" },
    { label: "Staff", children: [
      { to: "/admin/teachers", label: "Teachers" },
      { to: "/admin/dept-heads", label: "Department Heads" },
    ] },
    { to: "/admin/students", label: "Students" },
    { label: "Grades & Attendance", children: [
      { to: "/admin/grades-attendance/grades", label: "Grades" },
      { to: "/admin/grades-attendance/exams", label: "Exams" },
      { to: "/admin/grades-attendance/attendance", label: "Attendance" },
    ] },
    { label: "Finance", children: [
      { to: "/admin/finance/students", label: "Students" },
      { to: "/admin/finance/invoices", label: "Assign Invoice" },
      { to: "/admin/finance/invoice-settings", label: "Invoice Settings" },
      { to: "/admin/finance/transactions", label: "Transactions" },
    ] },
    { to: "/admin/schedules", label: "Schedules" },
    { to: "/admin/user-management", label: "User Management" },
    NEWS_ITEM,
    SETTINGS_GROUP,
  ],
  registrar: [
    { to: "/registrar/students", label: "Students" },
    { to: "/registrar/registration", label: "Registration" },
    { to: "/registrar/grades", label: "Grades" },
    { to: "/registrar/exams", label: "Exams" },
    { to: "/registrar/records", label: "Records" },
    { to: "/registrar/transcripts", label: "Transcripts" },
    { to: "/registrar/certificates", label: "Certificates" },
    NEWS_ITEM,
    SETTINGS_GROUP,
  ],
  finance: [
    { to: "/finance", label: "Students", end: true },
    { to: "/finance/registration", label: "Registration" },
    { to: "/finance/transactions", label: "Daily Transactions" },
    NEWS_ITEM,
    SETTINGS_GROUP,
  ],
  dept_head: [
    { to: "/dept-head/attendance", label: "Attendance" },
    { to: "/dept-head/grades", label: "Grades" },
    { to: "/dept-head/exams", label: "Exam" },
    { to: "/dept-head/curriculum", label: "Curriculum" },
    { to: "/dept-head/schedule", label: "Schedule" },
    NEWS_ITEM,
    SETTINGS_GROUP,
  ],
  teacher: [
    { to: "/teacher/grades", label: "Grade" },
    { to: "/teacher/exams", label: "Exam" },
    { to: "/teacher/attendance", label: "Attendance" },
    { to: "/teacher/curriculum", label: "Curriculum" },
    { to: "/teacher/schedules", label: "Schedules" },
    NEWS_ITEM,
    SETTINGS_GROUP,
  ],
  student: [
    { to: "/student/payments", label: "Payments" },
    { to: "/student/grades", label: "Grades" },
    { to: "/student/schedules", label: "Schedules" },
    { to: "/student/attendance", label: "Attendance" },
    { to: "/student/curriculum", label: "Curriculum" },
    NEWS_ITEM,
    SETTINGS_GROUP,
  ],
};

function NavGroup({ item }) {
  const location = useLocation();
  const containsActive = item.children.some((c) => location.pathname.startsWith(c.to));
  const [open, setOpen] = useState(containsActive);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-4 py-2 text-sm ${
          containsActive ? "text-white" : "text-slate-300 hover:bg-navy-800"
        }`}
      >
        {item.label}
        <svg viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}>
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.293l3.71-4.06a.75.75 0 111.08 1.04l-4.25 4.65a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="pl-4 border-l border-navy-800 ml-4">
          {item.children.map((c) => (
            <NavLink
              key={c.to}
              to={c.to}
              className={({ isActive }) =>
                `block px-4 py-1.5 text-sm rounded ${isActive ? "bg-teal-600 text-white" : "text-slate-400 hover:bg-navy-800 hover:text-slate-200"}`
              }
            >
              {c.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarContent({ user, logout, items }) {
  return (
    <>
      <div className="p-4 flex items-center gap-2 border-b border-navy-800">
        <img src={smbcLogo} alt="SMBC" className="h-9 w-auto" />
         <div>
          <p className="text-xs font-semibold leading-tight font-display">SMBC</p>
          <p className="text-[10px] text-slate-400 leading-tight">SIS</p>
        </div>
      </div>
      <nav className="flex-1 py-3 space-y-1 overflow-y-auto">
        {items.map((item) =>
          item.children ? (
            <NavGroup key={item.label} item={item} />
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-4 py-2 text-sm ${isActive ? "bg-teal-600 text-white" : "text-slate-300 hover:bg-navy-800"}`
              }
            >
              {item.label}
            </NavLink>
          )
        )}
      </nav>
      <div className="p-4 border-t border-navy-800">
        <p className="text-xs font-medium id-chip !bg-white/10 !text-slate-200 inline-block">{user?.username}</p>
        <p className="text-[10px] text-slate-400 mt-1 mb-2">{ROLE_LABELS[user?.role]}</p>
        <button onClick={logout} className="text-xs bg-navy-800 hover:bg-navy-700 rounded px-3 py-1.5 w-full text-slate-200">
          Sign out
        </button>
      </div>
    </>
  );
}

export default function DashboardLayout({ children }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = NAV[user?.role] || [];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-paper dark:bg-paper-dark">
      <aside className="hidden lg:flex w-60 bg-navy-950 text-white flex-col shrink-0">
        <SidebarContent user={user} logout={logout} items={items} />
      </aside>

      {/*
        `sticky`, not `fixed` — a fixed header is removed from document flow
        entirely, so the content below it needs a manually-guessed padding
        (the old `pt-20`) to avoid being covered, and that guess silently
        drifts out of sync with the header's real rendered height. `sticky`
        stays pinned to the top on scroll too, but stays IN the flow, so the
        browser pushes <main> down by the header's actual height automatically
        — there's no padding number to keep in sync, so this can't regress.
      */}
      <div className="lg:hidden sticky top-0 z-40 bg-navy-950 text-white flex items-center justify-between px-4 py-3">
        <button onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <img src={smbcLogo} alt="SMBC" className="h-7 w-auto" />
        <div className="w-6" />
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-navy-950 text-white flex flex-col">
            <SidebarContent user={user} logout={logout} items={items} />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <main className="flex-1 p-4 sm:p-6 overflow-x-auto">{children}</main>
    </div>
  );
}
