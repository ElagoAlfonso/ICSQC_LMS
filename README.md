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
| **AI**      | Google Gemini API (server-side)   |

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
MONGODB_URI=<your-mongodb-connection-string>
JWT_SECRET=your_super_secret_jwt_key_here
GEMINI_API_KEY=<your-google-gemini-api-key>

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

### Vercel Deployment

Deploy the `frontend` directory as a Vercel project. Set these Vercel environment variables:

```env
VITE_API_URL=https://your-backend.example.com/api
VITE_REALTIME_URL=https://your-backend.example.com
```

`VITE_API_URL` must include `/api` and must not end with `/`. The frontend includes a Vercel SPA rewrite so direct links to dashboard routes continue to work.

Deploy the `backend` as a separate long-running Node.js service on Render, Railway, Fly.io, or a similar host. This project uses Socket.IO for messaging and live updates, which requires a persistent server and is not supported by Vercel Functions. Set the backend `CLIENT_URL` to the deployed Vercel URL and configure all backend secrets in the hosting provider rather than committing `.env` files.

For production Google Calendar OAuth, register the backend URL as the redirect URI:

```env
GOOGLE_REDIRECT_URI=https://your-backend.example.com/api/google/callback
```

The backend must also allow the exact Vercel frontend origin through `CLIENT_URL`. After deployment, test login, API requests, Socket.IO messaging, and the Google Calendar callback separately.

### Google Meet Setup

Google Meet creation uses the official Google Calendar API. The backend creates a Calendar event with `conferenceData`, and Google returns the real Meet URL. The frontend never receives OAuth client secrets or refresh tokens.

1. In Google Cloud Console, create/select a project, enable **Google Calendar API**, configure the OAuth consent screen, and create a **Web application** OAuth client.
2. Add the backend callback URL to the OAuth client, for example `http://localhost:5000/api/google/callback`. Add the LMS frontend origin as an authorized JavaScript origin if required by the Cloud Console.
3. Add these values to `backend/.env` only:

```env
GOOGLE_CLIENT_ID=<web-client-id>
GOOGLE_CLIENT_SECRET=<web-client-secret>
GOOGLE_REDIRECT_URI=http://localhost:5000/api/google/callback
GOOGLE_TIME_ZONE=Asia/Manila
```

The requested OAuth scope is `https://www.googleapis.com/auth/calendar.events`. A teacher can click **Connect** in the Google Calendar card on the teacher dashboard, which opens the authenticated backend route `/api/google/auth`, or open that route directly while logged in. OAuth state is signed and short-lived; access and refresh tokens are stored in MongoDB by the backend and must not be committed or exposed to the frontend. Use HTTPS and a secret-managed deployment for production.

The connection status is available at `GET /api/google/status` for teachers. Reconnecting is supported when a Google account or consent grant changes.

Class Meet endpoints are `POST /api/classes/:classId/meet` (teacher/admin create), `GET /api/classes/:classId/meet` (teacher/student/admin view), and `DELETE /api/classes/:classId/meet` (teacher/admin end). The backend verifies adviser or enrollment membership against the requested class ID, so changing the URL cannot grant access to another class.

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

### ✅ Google Meet Sessions
- Teachers connect Google Calendar through OAuth and create Meet-enabled Calendar events.
- Students see enrolled-class sessions with a ten-minute join window, live countdown, and expiry.
- Admins can filter, edit, and delete sessions; deletion also removes the Calendar event.
- Meeting creation writes student notification records with `type: "meeting"`.

#### Google Calendar setup
1. In Google Cloud Console, create or select a project and enable **Google Calendar API**.
2. Configure the OAuth consent screen. Add the Calendar Events scope and add teacher test users while the app is in testing.
3. Create an OAuth 2.0 **Web application** client. Add `http://localhost:5000/api/google/callback` as an authorized redirect URI.
4. Copy `backend/.env.example` to `backend/.env` and set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_PROJECT_ID`, and `GOOGLE_TIME_ZONE`.
5. Start the backend and open `/api/google/auth` while logged in as a teacher. Tokens are stored server-side in `GoogleToken`; they are never returned to the frontend.

Meeting endpoints:
```text
GET    /api/google/auth
GET    /api/google/callback
GET    /api/google/status          teacher
POST   /api/meetings/create          teacher
PUT    /api/meetings/:id             teacher/admin
DELETE /api/meetings/:id             teacher/admin
GET    /api/meetings/teacher         teacher
GET    /api/meetings/student         student
GET    /api/meetings/:id             authenticated user
GET    /api/admin/meetings           admin
DELETE /api/admin/meetings/:id       admin
```

### ✅ Announcements
- Role-targeted (all/student/teacher/admin)
- Pin important announcements
- Class-specific announcements

### ✅ Analytics Dashboard (Admin)
- Database-backed KPI cards for active students, teachers, classes, and published exams
- Current academic-year student enrollment trend from active student records
- Unique active students grouped by class grade level
- Academic performance distribution from graded submissions
- Recent activity from the audit log
- Extended analytics view for submission, exam, score, and subject performance data

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
GET    /api/analytics?period=month|quarter|year    (admin)
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

- The AI Assistant uses the Google Gemini API through the backend and requires `GEMINI_API_KEY` (or `GOOGLE_API_KEY`).
- Google Meet sessions are created as Google Calendar events through the backend OAuth integration.
- Google OAuth credentials, Calendar tokens, and Gemini API keys must remain server-side and must never be committed.
- The `.env` file contains your real MongoDB credentials — keep it secure and never commit to public repos.

---

*© 2024–2025 International Christian School of Quezon City, Inc. All rights reserved.*
