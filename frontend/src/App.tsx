<<<<<<< HEAD
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import DashboardLayout from './components/layout/DashboardLayout';

/* ── Auth ─────────────────────────────────────── */
const LoginPage            = lazy(() => import('./pages/auth/LoginPage'));

/* ── Admin ────────────────────────────────────── */
const AdminDashboard       = lazy(() => import('./pages/admin/Dashboard'));
const UsersPage            = lazy(() => import('./pages/admin/UsersPage'));
const AcademicYearsPage    = lazy(() => import('./pages/admin/AcademicYearsPage'));
const ClassesPage          = lazy(() => import('./pages/admin/ClassesPage'));
const SubjectsPage         = lazy(() => import('./pages/admin/SubjectsPage'));
const AdminExamsPage       = lazy(() => import('./pages/admin/ExamsPage'));
const ActivityLogsPage     = lazy(() => import('./pages/admin/ActivityLogsPage'));
const AnalyticsPage        = lazy(() => import('./pages/admin/AnalyticsPage'));

/* ── Teacher ──────────────────────────────────── */
const TeacherDashboard     = lazy(() => import('./pages/teacher/Dashboard'));
const TeacherClassesPage   = lazy(() => import('./pages/teacher/ClassesPage'));
const TeacherClassDetail   = lazy(() => import('./pages/teacher/ClassDetailPage'));
const TeacherExamsPage     = lazy(() => import('./pages/teacher/ExamsPage'));
const SubmissionsPage      = lazy(() => import('./pages/teacher/SubmissionsPage'));

/* ── Student ──────────────────────────────────── */
const StudentDashboard     = lazy(() => import('./pages/student/Dashboard'));
const StudentExamsPage     = lazy(() => import('./pages/student/ExamsPage'));
const StudentGradesPage    = lazy(() => import('./pages/student/GradesPage'));

/* ── Shared ───────────────────────────────────── */
const AIAssistantPage      = lazy(() => import('./pages/shared/AIAssistantPage'));
const TimetablePage        = lazy(() => import('./pages/shared/TimetablePage'));
const AnnouncementsPage    = lazy(() => import('./pages/shared/AnnouncementsPage'));
const ReportCardsPage      = lazy(() => import('./pages/shared/ReportCardsPage'));

function Loading() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F9FAFB' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:40, height:40, border:'3px solid #E5E7EB', borderTopColor:'#7a1010', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
        <p style={{ color:'#6B7280', fontSize:'0.875rem', fontFamily:'system-ui,sans-serif' }}>Loading…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: { fontFamily: 'system-ui,sans-serif', fontSize: '0.875rem', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' },
          success: { iconTheme: { primary: '#059669', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#DC2626', secondary: '#fff' } },
        }}
      />

      <Suspense fallback={<Loading />}>
        <Routes>
          {/* ── Public ───────────────────────────── */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/"      element={<Navigate to="/login" replace />} />

          {/* ── ADMIN ────────────────────────────── */}
          <Route element={<DashboardLayout requiredRole="admin" />}>
            <Route path="/admin/dashboard"      element={<AdminDashboard />} />
            <Route path="/admin/users"          element={<UsersPage />} />
            <Route path="/admin/academic-years" element={<AcademicYearsPage />} />
            <Route path="/admin/classes"        element={<ClassesPage />} />
            <Route path="/admin/subjects"       element={<SubjectsPage />} />
            <Route path="/admin/exams"          element={<AdminExamsPage />} />
            <Route path="/admin/report-cards"   element={<ReportCardsPage />} />
            <Route path="/admin/timetable"      element={<TimetablePage />} />
            <Route path="/admin/announcements"  element={<AnnouncementsPage />} />
            <Route path="/admin/analytics"      element={<AnalyticsPage />} />
            <Route path="/admin/logs"           element={<ActivityLogsPage />} />
            <Route path="/admin/ai-assistant"   element={<AIAssistantPage />} />
          </Route>

          {/* ── TEACHER ──────────────────────────── */}
          <Route element={<DashboardLayout requiredRole="teacher" />}>
            <Route path="/teacher/dashboard"         element={<TeacherDashboard />} />
            <Route path="/teacher/classes"           element={<TeacherClassesPage />} />
            <Route path="/teacher/classes/:id"       element={<TeacherClassDetail />} />
            <Route path="/teacher/exams"             element={<TeacherExamsPage />} />
            <Route path="/teacher/submissions"       element={<SubmissionsPage />} />
            <Route path="/teacher/report-cards"      element={<ReportCardsPage />} />
            <Route path="/teacher/timetable"         element={<TimetablePage />} />
            <Route path="/teacher/announcements"     element={<AnnouncementsPage />} />
            <Route path="/teacher/ai-assistant"      element={<AIAssistantPage />} />
          </Route>

          {/* ── STUDENT ──────────────────────────── */}
          <Route element={<DashboardLayout requiredRole="student" />}>
            <Route path="/student/dashboard"     element={<StudentDashboard />} />
            <Route path="/student/subjects"      element={<SubjectsPage />} />
            <Route path="/student/exams"         element={<StudentExamsPage />} />
            <Route path="/student/grades"        element={<StudentGradesPage />} />
            <Route path="/student/timetable"     element={<TimetablePage />} />
            <Route path="/student/ai-reviewer"   element={<AIAssistantPage />} />
            <Route path="/student/announcements" element={<AnnouncementsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
=======
import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
>>>>>>> a77495f626dbe90aaff470650f7e47812e2b1d22
