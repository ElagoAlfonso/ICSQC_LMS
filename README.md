# ICSQC-LMS
### International Christian School of Quezon City, Inc.
#### Learning Management System — Full-Stack School Management Portal

---

## 🏫 Overview

ICSQC-LMS is a full-stack School Management System (SMS) + Learning Management System (LMS) built for the International Christian School of Quezon City, Inc. It features strict role-based access control, AI-powered tools, exam engine, report card generation, and a modern, responsive UI.

---

## 🚀 Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| **Frontend**| React 18, TypeScript, Vite 6      |
| **Routing** | React Router v6                   |
| **State**   | Zustand (with persist middleware) |
| **Charts**  | Recharts                          |
| **Backend** | Node.js, Express 5, TypeScript    |
| **Database**| MongoDB (Mongoose)                |
| **Auth**    | JWT (HttpOnly Cookies, 30-day)    |
| **Security**| Helmet, bcryptjs, CORS            |
| **AI**      | Anthropic Claude API (in-browser) |

---

## 📁 Project Structure

```
ICSQC-LMS/
├── backend/
│   └── src/
│       ├── config/         db.ts
│       ├── controllers/    user.ts, academicYear.ts, class.ts, subject.ts,
│       │                   combined.ts (exams, submissions, announcements,
│       │                   dashboard, timetable, reportCards), activitieslog.ts
│       ├── middleware/     auth.ts (protect + authorize)
│       ├── models/         user.ts, academicYear.ts, class.ts, subject.ts,
│       │                   exam.ts, submission.ts, reportCard.ts,
│       │                   timetable.ts, announcement.ts, activitieslog.ts
│       ├── routes/         user.ts, academicYear.ts, activitieslog.ts,
│       │                   combined.ts (all new routes)
│       ├── utils/          generateToken.ts, activitieslog.ts
│       └── server.ts
│
└── frontend/
    └── src/
        ├── components/
        │   ├── layout/     Sidebar.tsx, Topbar.tsx, DashboardLayout.tsx
        │   └── ui/         index.tsx (StatCard, Card, Badge, Button, Input,
        │                   Select, Modal, DataTable, Pagination, EmptyState)
        ├── pages/
        │   ├── auth/       LoginPage.tsx
        │   ├── admin/      Dashboard.tsx, UsersPage.tsx, AcademicYearsPage.tsx,
        │   │               ClassesPage.tsx, SubjectsPage.tsx, ActivityLogsPage.tsx,
        │   │               AnalyticsPage.tsx
        │   ├── teacher/    Dashboard.tsx, ExamsPage.tsx, SubmissionsPage.tsx
        │   ├── student/    Dashboard.tsx, ExamsPage.tsx (Exam Engine), GradesPage.tsx
        │   └── shared/     AIAssistantPage.tsx, AnnouncementsPage.tsx,
        │                   TimetablePage.tsx, ReportCardsPage.tsx
        ├── store/          authStore.ts (Zustand)
        ├── types/          index.ts
        └── utils/          api.ts (full Axios service layer)
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js 18+ or Bun
- MongoDB Atlas account (or local MongoDB)

### 1. Backend Setup
```bash
cd backend

# Create/verify .env file:
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGO_URL=<your-mongodb-connection-string>
JWT_SECRET=your_super_secret_jwt_key_here

# Install & run (using Bun)
bun install
bun run dev

# OR using npm + nodemon
npm install
npm run dev
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Visit: **http://localhost:5173**

---

## 👥 User Roles & Access

| Role    | Access                                                       |
|---------|--------------------------------------------------------------|
| **Admin**   | Full system control — users, academic years, classes, subjects, exams, analytics, logs |
| **Teacher** | Own classes/subjects, create/publish exams, grade submissions, generate report cards |
| **Student** | Take exams, view grades, see timetable, use AI Reviewer     |

### Default Admin Setup
Register the first user via `POST /api/users/register` with `role: "admin"`, then use the login page.

---

## 🎯 Feature Modules

### ✅ Authentication
- JWT via HttpOnly cookies (30-day expiry)
- Role-based route protection
- Auto-redirect by role on login

### ✅ User Management (Admin)
- Full CRUD with paginated search
- Role filtering (admin/teacher/student)
- Active/inactive status toggle

### ✅ Academic Year Management
- Create multiple academic years
- Set current year (updates all modules)
- Visual progress bar for active year

### ✅ Classes & Subjects
- Class sections with grade level and adviser assignment
- Subject assignment to teachers
- Academic year scoping

### ✅ Exam Engine
- Types: Quiz, Periodical, Midterm, Finals, Assignment
- Question types: Multiple Choice, True/False, Short Answer, Essay
- Auto-grading for objective questions
- Timer with auto-submit
- Student exam navigation with dot indicators
- Results screen with score/percentage/pass status

### ✅ Submissions & Grading
- Teacher view of all submissions per exam
- Manual score override for essay questions
- Feedback system

### ✅ Report Cards
- Auto-generated from exam submission data
- Q1–Q4 + Final periods
- Printable A4 layout with:
  - School header (ICSQC branding)
  - Subject grades table
  - Attendance summary
  - General average + remarks
  - Signature lines
- Print to PDF via browser

### ✅ Timetable
- Visual weekly grid (Mon–Sat)
- Per-class schedule management
- Subject + teacher + room assignment

### ✅ Announcements
- Role-targeted (all/student/teacher/admin)
- Pin important announcements
- Class-specific announcements

### ✅ Analytics Dashboard (Admin)
- Monthly activity charts (Area)
- Score distribution (Horizontal Bar)
- Subject performance comparison
- Exam type distribution (Pie)
- 5-year enrollment trend
- KPI stat cards

### ✅ Activity Audit Logs
- Full system action trail
- Search by action/details
- Pagination

### ✅ AI Assistant (Teacher)
- Create exam questions by topic
- Generate lesson plans
- Assignment reminders
- Academic scheduling help

### ✅ AI Reviewer (Student)
- Explain subjects/concepts
- Exam preparation help
- Study tips

---

## 🔌 API Endpoints

### Auth
```
POST   /api/users/register
POST   /api/users/login
POST   /api/users/logout
GET    /api/users/profile
```

### Users
```
GET    /api/users              (admin/teacher — paginated+filtered)
POST   /api/users/create-user  (admin/teacher)
PUT    /api/users/update/:id   (admin/teacher)
DELETE /api/users/delete/:id   (admin/teacher)
```

### Academic Years
```
GET    /api/academicYear
POST   /api/academicYear
PUT    /api/academicYear/:id
DELETE /api/academicYear/:id
PATCH  /api/academicYear/:id/current
```

### Classes / Subjects / Exams / Submissions / Timetable / Announcements / Report Cards
All follow standard REST patterns under `/api/classes`, `/api/subjects`, `/api/exams`, `/api/submissions`, `/api/timetable`, `/api/announcements`, `/api/reportcards`.

### Dashboard
```
GET    /api/dashboard/stats    (admin)
```

---

## 🎨 Design System

- **Primary Color**: Crimson `#8B1A1A` (ICSQC brand)
- **Accent Color**: Gold `#C9A84C`
- **Dark Tone**: Navy `#1A2744`
- **Font Display**: Playfair Display (headings)
- **Font Body**: DM Sans (UI text)

---

## 📝 Notes

- The AI Assistant uses the Anthropic Claude API directly from the browser. It requires no backend changes.
- No Google Meet or external video call integrations.
- All existing backend files (user.ts, academicYear.ts, activitieslog.ts) are preserved and only improved — not replaced.
- The `.env` file contains your real MongoDB credentials — keep it secure and never commit to public repos.

---

*© 2024–2025 International Christian School of Quezon City, Inc. All rights reserved.*
