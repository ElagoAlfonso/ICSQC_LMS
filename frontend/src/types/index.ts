export type UserRole = 'admin' | 'teacher' | 'student';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  studentClass?: string | null;
  teacherSubject?: string[] | null;
  profileImage?: string | null;
  createdAt?: string;
}

export interface AcademicYear {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  createdAt?: string;
}

export interface Class {
  _id: string;
  name: string;
  section: string;
  gradeLevel: string;
  academicYear: AcademicYear | string;
  adviser?: User | string | null;
  students?: User[];
  subjects?: Subject[];
  isActive: boolean;
}

export interface Subject {
  _id: string;
  name: string;
  code: string;
  description?: string;
  teacher?: User | string | null;
  gradeLevel: string;
  academicYear: AcademicYear | string;
  units: number;
  isActive: boolean;
}

export interface Question {
  question: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  choices?: string[];
  correctAnswer: string;
  points: number;
}

export interface Exam {
  _id: string;
  title: string;
  description?: string;
  subject: Subject | string;
  class: Class | string;
  academicYear: AcademicYear | string;
  createdBy: User | string;
  questions: Question[];
  totalPoints: number;
  duration: number;
  startDate: string;
  endDate: string;
  examType: 'quiz' | 'periodical' | 'midterm' | 'finals' | 'assignment';
  status: 'draft' | 'published' | 'closed';
  passingScore: number;
}

export interface Submission {
  _id: string;
  exam: Exam | string;
  student: User | string;
  answers: { questionIndex: number; answer: string; isCorrect?: boolean; pointsEarned?: number }[];
  score: number;
  totalPoints: number;
  percentage: number;
  isPassed: boolean;
  submittedAt: string;
  status: 'submitted' | 'graded' | 'pending';
  feedback?: string;
}

export interface ActivityLog {
  _id: string;
  user: User | string;
  action: string;
  details?: string;
  createdAt: string;
}

export interface Announcement {
  _id: string;
  title: string;
  content: string;
  author: User | string;
  targetRole: 'all' | 'student' | 'teacher' | 'admin';
  isPinned: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Pagination {
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalSubjects: number;
  activeExams: number;
  pendingSubmissions: number;
  currentAcademicYear?: AcademicYear;
  recentActivities: ActivityLog[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
