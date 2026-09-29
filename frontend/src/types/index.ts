export type UserRole = 'admin' | 'teacher' | 'student';

export interface User {
  _id: string;
  name: string;
  email: string;
  lrn?: string;
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
  coTeachers?: User[];
  students?: User[];
  subjects?: Subject[];
  inviteCode?: string;
  inviteExpiresAt?: string | null;
  maxStudents?: number | null;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  createdBy?: string;
  isActive: boolean;
}

export interface ClassRequest {
  _id: string;
  teacher: User | string;
  subject: Subject | string;
  academicYear: AcademicYear | string;
  name: string;
  section: string;
  gradeLevel: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectedReason?: string;
  createdAt: string;
  approvedBy?: User | string;
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

export interface QuestionAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  isImage: boolean;
}

export interface Question {
  id?: string;
  question: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  choices?: string[];
  correctAnswer: string;
  points: number;
  image?: string | null;
  imageName?: string | null;
  attachments?: QuestionAttachment[];
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
  randomizeQuestions?: boolean;
  startDate: string;
  endDate: string;
  examType: 'quiz' | 'periodical' | 'midterm' | 'finals' | 'assignment' | 'formative';
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
  subject?: Subject | string;
  targetClass?: Class | string;
  attachments?: Attachment[];
  targetRole: 'all' | 'student' | 'teacher' | 'admin';
  targetUsers?: string[] | User[];
  isPinned: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Attachment {
  _id: string;
  originalName: string;
  extension: string;
  mimeType: string;
  size: number;
  uploadedAt?: string;
}

export interface SubjectWorkspace {
  subject: Subject;
  classes: Class[];
  students: User[];
  posts: Announcement[];
  exams: Pick<Exam, '_id' | 'title' | 'description' | 'examType' | 'status' | 'startDate' | 'endDate' | 'totalPoints'>[];
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

export interface Meeting {
  _id: string;
  meetingTitle: string;
  description?: string;
  meetLink: string;
  eventId: string;
  startDateTime: string;
  endDateTime: string;
  status: 'Scheduled' | 'Live' | 'Finished' | 'Cancelled';
  subjectId: Subject | string;
  classId: Class | string;
  teacherId?: User | string;
}

export interface Classwork {
  _id: string;
  title: string;
  description: string;
  type: 'assignment' | 'activity' | 'assessment' | 'syllabus' | 'lesson' | 'asynchronous' | 'performance_task';
  submissionMode: 'response' | 'mark_done';
  status: 'draft' | 'scheduled' | 'published' | 'closed';
  class: Class | string;
  subject: Subject | string;
  rubric?: Rubric | string;
  createdBy: User | string;
  academicYear: AcademicYear | string;
  instructions?: string;
  attachments: Attachment[];
  resourceLinks?: Array<{ title: string; url: string }>;
  dueDate?: string;
  dueTime?: string;
  points: number;
  allowLateSubmission: boolean;
  questions?: Question[];
  questionCount?: number;
  questionPoints?: number[];
  publishedAt?: string;
  scheduledPublishDate?: string;
  scheduledPublishTime?: string;
  closedAt?: string;
  totalSubmissions?: number;
  gradedSubmissions?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClassworkSubmission {
  _id: string;
  classwork: Classwork | string;
  student: User | string;
  class: Class | string;
  subject: Subject | string;
  attachments: Attachment[];
  submittedNotes?: string;
  submittedAt: string;
  isLate: boolean;
  score?: number;
  totalPoints: number;
  percentage?: number;
  feedback?: string;
  rubricScores?: RubricScore[];
  gradedAt?: string;
  gradedBy?: User | string;
  status: 'submitted' | 'graded' | 'pending' | 'missing' | 'late';
  revisionCount: number;
  lastRevisedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClassworkGrade {
  _id: string;
  classwork: Classwork | string;
  student: User | string;
  score: number;
  totalPoints: number;
  percentage: number;
  feedback?: string;
  rubricScores?: RubricScore[];
  gradedAt: string;
}

export interface RubricCriterion {
  id: string;
  title: string;
  description: string;
  maxPoints: number;
}

export interface RubricScore {
  criterionId: string;
  score: number;
}

export interface Rubric {
  _id: string;
  name: string;
  criteria: RubricCriterion[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Conversation {
  _id: string;
  type: 'private_user' | 'private_teacher_student' | 'private_student_student' | 'class_group';
  members: User[] | string[];
  name?: string;
  icon?: string;
  class?: Class | string;
  academicYear?: AcademicYear | string;
  lastMessage?: Message | string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  isActive: boolean;
  announcementOnly?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  conversation: Conversation | string;
  sender: User | string;
  text: string;
  attachments: Attachment[];
  replyTo?: {
    replyToMessageId?: string | Message | null;
    replyToText?: string;
    replyToAuthorName?: string;
  };
  reactions?: Array<{
    userId: User | string;
    emoji: string;
    createdAt: string;
  }>;
  isEdited: boolean;
  editedAt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  readBy?: User[] | string[];
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  _id: string;
  announcement: Announcement | string;
  author: User | string;
  class: Class | string;
  replyTo?: Comment | string;
  text: string;
  isEdited: boolean;
  editedAt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  likeCount?: number;
  replyCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Reaction {
  _id: string;
  announcement: Announcement | string;
  user: User | string;
  emoji: '👍' | '❤️' | '🎉' | '👏' | '💯' | '🙏' | '😮' | '😂';
  createdAt: string;
}
