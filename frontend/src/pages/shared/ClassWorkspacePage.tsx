import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, ChevronDown, ClipboardList, ExternalLink, FileText, FileUp, HardDrive, Link2, Megaphone, MessageSquare, Plus, Search, Trash2, UserMinus, Users, Video, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Badge, Button, Card, EmptyState, Input, Modal, Select } from '../../components/ui';
import { announcementsApi, classesApi, classworkApi, examsApi, googleApi, meetingsApi, rubricsApi, submissionsApi, usersApi } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import type { Announcement, Class, Classwork, ClassworkGrade, ClassworkSubmission, Exam, Meeting, Rubric, RubricCriterion, RubricScore, Subject, Submission, User } from '../../types';
import { AnnouncementCard } from './AnnouncementsPage';
import QuestionBuilder from '../../components/QuestionBuilder';
import type { Question } from '../../types';
import { io } from 'socket.io-client';
import { MAX_ATTACHMENT_COUNT, MAX_ATTACHMENT_SIZE_BYTES, SUPPORTED_ATTACHMENT_ACCEPT } from '../../utils/attachments';

const INITIAL_ANNOUNCEMENT_FORM = { title: '', content: '', isPinned: false };
const INITIAL_CLASSWORK_FORM = { title: '', description: '', type: 'asynchronous' as Classwork['type'], submissionMode: 'response' as Classwork['submissionMode'], dueDate: '', dueTime: '', points: '100', instructions: '', allowLateSubmission: false, rubricId: '' };
const CLASSWORK_TYPES: Array<{ value: Classwork['type']; label: string; description: string; prompt: string }> = [
  { value: 'syllabus', label: 'Course Syllabus / Curriculum Guide', description: 'Share the course plan and curriculum for students to review.', prompt: 'Describe the course guide and how students should use it.' },
  { value: 'lesson', label: 'Daily Lesson', description: 'Post slides, articles, videos, or other materials for viewing and reading.', prompt: 'Summarize the lesson and what students should review.' },
  { value: 'asynchronous', label: 'Asynchronous Activities & Written Works', description: 'Assign independent activities and written submissions.', prompt: 'What should students complete and submit?' },
  { value: 'performance_task', label: 'Performance Task', description: 'Collect a practical or project-based demonstration of learning.', prompt: 'Describe the performance task and expected output.' },
  { value: 'assignment', label: 'Assignment', description: 'Collect work students complete and submit.', prompt: 'What should students produce or submit?' },
  { value: 'activity', label: 'Activity', description: 'Guide a practice task, exercise, or class activity.', prompt: 'What should students do during this activity?' },
  { value: 'assessment', label: 'Assessment', description: 'Check student understanding with a graded task.', prompt: 'What should students demonstrate or answer?' },
];
const QUIZ_MENU_TYPE = { value: 'quiz' as const, label: 'Quiz' };

const classworkTypeLabel = (type: Classwork['type']) => CLASSWORK_TYPES.find((item) => item.value === type)?.label || type;
const examTypeLabel = (type: Exam['examType']) => ({
  prelim: 'Prelim Exam', periodical: 'Periodical Exam', midterm: 'Midterm Exam',
  summative: 'Summative Exam', final: 'Final Exam', finals: 'Final Exam',
  quiz: 'Quiz', assignment: 'Assignment', formative: 'Formative Assessment',
} as Record<string, string>)[type] || 'Exam';
const examStatusLabel = (status: Exam['status']) => status === 'pending_approval' ? 'Pending Admin Approval' : status.charAt(0).toUpperCase() + status.slice(1);
const CLASSWORK_MENU_TYPES = [...CLASSWORK_TYPES.filter((item) => item.value !== 'assignment' && item.value !== 'activity'), QUIZ_MENU_TYPE];
const isMaterialType = (type: Classwork['type']) => type === 'syllabus' || type === 'lesson';
const materialMenuItemStyle = { display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '11px 14px', border: 0, background: '#fff', color: '#1F2937', fontSize: '0.88rem', textAlign: 'left' as const, cursor: 'pointer' };

const statusFor = (meeting: Meeting) => {
  if (meeting.status === 'Cancelled') return 'Cancelled';
  const now = Date.now();
  if (now < new Date(meeting.startDateTime).getTime()) return 'Upcoming';
  if (now <= new Date(meeting.endDateTime).getTime()) return 'Live';
  return 'Finished';
};

const parseCsvRows = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted && character === '"' && text[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field.trim());
      if (row.some((value) => value)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  row.push(field.trim());
  if (row.some((value) => value)) rows.push(row);
  return rows;
};

type TabKey = 'stream' | 'classwork' | 'grades' | 'people';
type StreamItem =
  | { kind: 'announcement'; item: Announcement; timestamp: number }
  | { kind: 'classwork'; item: Classwork; timestamp: number };

export default function ClassWorkspacePage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [classDoc, setClassDoc] = useState<Class | null>(null);
  const [classMeet, setClassMeet] = useState<Meeting | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classworks, setClassworks] = useState<Classwork[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('stream');
  const [gradebookView, setGradebookView] = useState<'overview' | 'submission'>('overview');
  const [gradebookSubmissions, setGradebookSubmissions] = useState<ClassworkSubmission[]>([]);
  const [gradebookGrades, setGradebookGrades] = useState<ClassworkGrade[]>([]);
  const [gradebookLoading, setGradebookLoading] = useState(false);
  const [gradebookReloadKey, setGradebookReloadKey] = useState(0);
  const [selectedGradeClasswork, setSelectedGradeClasswork] = useState('');
  const [editingGrade, setEditingGrade] = useState<{ studentId: string; studentName: string; classworkId: string; classworkTitle: string; score: string; feedback: string; rubricScores: Array<RubricCriterion & { scoreInput: string }> } | null>(null);
  const [savingGrade, setSavingGrade] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);
  const [announcementForm, setAnnouncementForm] = useState(INITIAL_ANNOUNCEMENT_FORM);
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [announcementComposerOpen, setAnnouncementComposerOpen] = useState(false);
  const [classworkComposerOpen, setClassworkComposerOpen] = useState(false);
  const [classworkForm, setClassworkForm] = useState(INITIAL_CLASSWORK_FORM);
  const [rubricOptions, setRubricOptions] = useState<Rubric[]>([]);
  const [rubricMenuOpen, setRubricMenuOpen] = useState(false);
  const [rubricModalMode, setRubricModalMode] = useState<'create' | 'reuse' | 'import' | null>(null);
  const [rubricName, setRubricName] = useState('');
  const [rubricCriteria, setRubricCriteria] = useState<Array<Omit<RubricCriterion, 'id'>>>([{ title: '', description: '', maxPoints: 5 }]);
  const [savingRubric, setSavingRubric] = useState(false);
  const [classworkQuestions, setClassworkQuestions] = useState<Question[]>([]);
  const [classworkFiles, setClassworkFiles] = useState<File[]>([]);
  const [classworkLinks, setClassworkLinks] = useState<Array<{ title: string; url: string }>>([]);
  const [classworkLinkTitle, setClassworkLinkTitle] = useState('');
  const [classworkLinkUrl, setClassworkLinkUrl] = useState('');
  const [materialMenuOpen, setMaterialMenuOpen] = useState(false);
  const [materialLinkMode, setMaterialLinkMode] = useState<'link' | 'drive' | null>(null);
  const materialMenuRef = useRef<HTMLDivElement>(null);
  const materialFileInputRef = useRef<HTMLInputElement>(null);
  const [savingClasswork, setSavingClasswork] = useState(false);
  const [meetModalOpen, setMeetModalOpen] = useState(false);
  const [creatingMeet, setCreatingMeet] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarChecking, setCalendarChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [removeTarget, setRemoveTarget] = useState<User | null>(null);
  const [removingStudent, setRemovingStudent] = useState(false);
  const [classmateSearch, setClassmateSearch] = useState('');
  const [coTeacherModalOpen, setCoTeacherModalOpen] = useState(false);
  const [coTeacherSearch, setCoTeacherSearch] = useState('');
  const [teacherCandidates, setTeacherCandidates] = useState<User[]>([]);
  const [savingCoTeacher, setSavingCoTeacher] = useState(false);
  const isTeacher = user?.role === 'teacher';
  const streamItems = useMemo<StreamItem[]>(() => [
    ...announcements.map((item) => ({ kind: 'announcement' as const, item, timestamp: new Date(item.createdAt).getTime() })),
    ...classworks.map((item) => ({ kind: 'classwork' as const, item, timestamp: new Date(item.publishedAt || item.createdAt).getTime() })),
  ].sort((first, second) => second.timestamp - first.timestamp), [announcements, classworks]);

  useEffect(() => {
    if (!createMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!createMenuRef.current?.contains(event.target as Node)) setCreateMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCreateMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [createMenuOpen]);

  useEffect(() => {
    if (!materialMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!materialMenuRef.current?.contains(event.target as Node)) setMaterialMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMaterialMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [materialMenuOpen]);

  const load = async () => {
    try {
      const [classResponse, meetingsResponse, announcementsResponse, examsResponse, classworkResponse, submissionsResponse] = await Promise.all([
        classesApi.getById(classId!),
        meetingsApi.getClassMeet(classId!),
        announcementsApi.getAll({ limit: 50 }),
        examsApi.getAll({ class: classId!, limit: 100 }),
        classworkApi.getAll({ classId: classId!, includeSubmitted: 'true' }),
        user?.role === 'student' ? submissionsApi.getMySubmissions() : Promise.resolve({ data: { submissions: [] } }),
      ]);

      const currentClass = classResponse.data as Class;
      setClassDoc(currentClass);
      setClassMeet(meetingsResponse.data.meeting || null);

      const classSubjectIds = (currentClass.subjects || []).map((subject) => typeof subject === 'object' ? subject?._id : subject);
      const relevantAnnouncements = (announcementsResponse.data.announcements || []).filter((announcement: Announcement) => {
        const targetClassId = typeof announcement.targetClass === 'object' ? announcement.targetClass?._id : announcement.targetClass;
        const targetSubjectId = typeof announcement.subject === 'object' ? announcement.subject?._id : announcement.subject;
        return targetClassId
          ? targetClassId === classId
          : Boolean(targetSubjectId && classSubjectIds.includes(targetSubjectId));
      });

      const relevantExams = (examsResponse.data.exams || []).filter((exam: Exam) => {
        const examClassId = typeof exam.class === 'object' ? exam.class?._id : exam.class;
        return examClassId === classId;
      });

      setAnnouncements(relevantAnnouncements.sort((a: Announcement, b: Announcement) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setExams(relevantExams.sort((a: Exam, b: Exam) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()));
      setClassworks((classworkResponse.data.classwork || []) as Classwork[]);
      setSubmissions((submissionsResponse.data.submissions || submissionsResponse.data || []) as Submission[]);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to load this class.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [classId, user?.role]);
  useEffect(() => {
    if (activeTab !== 'grades' || !isTeacher || !classId) return;
    let cancelled = false;
    setGradebookLoading(true);
    setGradebookSubmissions([]);
    setGradebookGrades([]);
    const refreshGradebook = async () => {
      try {
        const classworkResponse = await classworkApi.getAll({ classId, includeSubmitted: 'true' });
        const currentClassworks = (classworkResponse.data.classwork || []) as Classwork[];
        if (cancelled) return;
        setClassworks(currentClassworks);
        const gradedWork = currentClassworks.filter((item) => !isMaterialType(item.type) && item.status !== 'draft');
        const responses = await Promise.all(gradedWork.map(async (item) => {
          const [submissionResponse, gradeResponse] = await Promise.all([classworkApi.getSubmissions(item._id), classworkApi.getGrades(item._id)]);
          return { submissions: submissionResponse.data.submissions || [], grades: gradeResponse.data.grades || [] };
        }));
        if (cancelled) return;
        setGradebookSubmissions(responses.flatMap((response) => response.submissions) as ClassworkSubmission[]);
        setGradebookGrades(responses.flatMap((response) => response.grades) as ClassworkGrade[]);
        setSelectedGradeClasswork((current) => gradedWork.some((item) => item._id === current) ? current : gradedWork[0]?._id || '');
      } catch {
        if (!cancelled) toast.error('Unable to load class grades.');
      } finally {
        if (!cancelled) setGradebookLoading(false);
      }
    };
    void refreshGradebook();
    return () => { cancelled = true; };
  }, [activeTab, isTeacher, classId, gradebookReloadKey]);
  useEffect(() => {
    const socket = io(import.meta.env.VITE_REALTIME_URL || window.location.origin, { withCredentials: true, transports: ['websocket', 'polling'] });
    const refresh = (event: { classId?: string }) => {
      if (!event.classId || event.classId === classId) {
        void load();
        setGradebookReloadKey((current) => current + 1);
      }
    };
    socket.on('academic:update', refresh);
    return () => { socket.off('academic:update', refresh); socket.disconnect(); };
  }, [classId, user?.role]);
  useEffect(() => {
    if (!isTeacher) {
      setCalendarChecking(false);
      return;
    }
    googleApi.getStatus()
      .then((response) => setCalendarConnected(Boolean(response.data.connected)))
      .catch(() => setCalendarConnected(false))
      .finally(() => setCalendarChecking(false));
  }, [isTeacher]);
  useEffect(() => { const timer = window.setInterval(() => setClassMeet(current => current ? { ...current } : null), 30000); return () => window.clearInterval(timer); }, []);

  const createClassMeet = async () => {
    if (!isTeacher) return;
    if (!calendarConnected) {
      toast.error('Connect your Google Calendar before creating a Meet.');
      googleApi.connectCalendar(classId);
      return;
    }
    setCreatingMeet(true);
    try {
      const response = await meetingsApi.createClassMeet(classId!);
      const meetLink = response.data.meeting?.meetLink;
      if (!meetLink) throw new Error('Google did not return a Meet link.');
      toast.success('Google Meet created.');
      setMeetModalOpen(false);
      window.location.assign(meetLink);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to create Google Meet.');
    } finally {
      setCreatingMeet(false);
    }
  };

  const endClassMeet = async () => {
    if (!window.confirm('End this Google Meet for the class?')) return;
    try {
      await meetingsApi.endClassMeet(classId!);
      toast.success('Google Meet ended.');
      await load();
    } catch (error: any) { toast.error(error.response?.data?.message || 'Unable to end Google Meet.'); }
  };

  const removeStudent = async () => {
    if (!removeTarget || !classId) return;
    setRemovingStudent(true);
    try {
      await classesApi.removeStudent(classId, removeTarget._id);
      toast.success(`${removeTarget.name} was removed from this class.`);
      setRemoveTarget(null);
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to remove this student.');
    } finally {
      setRemovingStudent(false);
    }
  };

  const openCoTeacherPicker = async () => {
    setCoTeacherModalOpen(true);
    try {
      const response = await usersApi.getAll({ role: 'teacher', limit: 200 });
      setTeacherCandidates(response.data.users || []);
    } catch {
      toast.error('Unable to load teachers.');
    }
  };

  const addCoTeacher = async (teacherId: string) => {
    if (!classId) return;
    setSavingCoTeacher(true);
    try {
      await classesApi.addCoTeacher(classId, teacherId);
      toast.success('Co-teacher added to this class.');
      setCoTeacherModalOpen(false);
      setCoTeacherSearch('');
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to add co-teacher.');
    } finally {
      setSavingCoTeacher(false);
    }
  };

  const removeCoTeacher = async (teacher: User) => {
    if (!classId || !window.confirm(`Remove ${teacher.name} from this teaching team?`)) return;
    try {
      await classesApi.removeCoTeacher(classId, teacher._id);
      toast.success('Co-teacher removed.');
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to remove co-teacher.');
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      toast.error('Title and content are required.');
      return;
    }

    setPostingAnnouncement(true);
    try {
      await announcementsApi.create({
        title: announcementForm.title.trim(),
        content: announcementForm.content.trim(),
        targetClass: classId,
        targetRole: 'student',
        isPinned: announcementForm.isPinned,
        isActive: true,
      });
      toast.success('Announcement posted to this class.');
      setAnnouncementForm(INITIAL_ANNOUNCEMENT_FORM);
      setAnnouncementComposerOpen(false);
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to post announcement.');
    } finally {
      setPostingAnnouncement(false);
    }
  };

  const handleCreateClasswork = async () => {
    const subject = primarySubject;
    if (!subject || !classworkForm.title.trim() || !classworkForm.description.trim() || (!isMaterialType(classworkForm.type) && !classworkForm.dueDate)) {
      toast.error('A class subject, title, description, and due date for work requiring submission are required.');
      return;
    }
    if (classworkForm.type === 'assessment' && (classworkQuestions.length === 0 || classworkQuestions.some((question) => !question.question.trim() || (question.type !== 'essay' && !question.correctAnswer.trim())))) {
      toast.error('Add and complete at least one assessment question.');
      return;
    }

    setSavingClasswork(true);
    try {
      const formData = new FormData();
      formData.append('classId', classId || '');
      formData.append('subjectId', subject._id);
      formData.append('title', classworkForm.title.trim());
      formData.append('description', classworkForm.description.trim());
      formData.append('type', classworkForm.type);
      formData.append('submissionMode', classworkForm.type === 'assessment' ? 'response' : classworkForm.submissionMode);
      if (classworkForm.dueDate) formData.append('dueDate', classworkForm.dueDate);
      formData.append('dueTime', classworkForm.dueTime);
      formData.append('points', String(Number(classworkForm.points) || 0));
      formData.append('instructions', classworkForm.instructions.trim());
      formData.append('allowLateSubmission', String(classworkForm.allowLateSubmission));
      if (classworkForm.rubricId) formData.append('rubricId', classworkForm.rubricId);
      formData.append('questions', JSON.stringify(classworkForm.type === 'assessment' ? classworkQuestions : []));
      formData.append('resourceLinks', JSON.stringify(classworkLinks));
      classworkFiles.forEach((file) => formData.append('attachments', file));
      await classworkApi.create(formData);
      toast.success('Classwork saved as draft.');
      setClassworkForm(INITIAL_CLASSWORK_FORM);
      setClassworkQuestions([]);
      setClassworkFiles([]);
      setClassworkLinks([]);
      setClassworkLinkTitle('');
      setClassworkLinkUrl('');
      setMaterialLinkMode(null);
      setClassworkComposerOpen(false);
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to create classwork.');
    } finally {
      setSavingClasswork(false);
    }
  };

  const publishClasswork = async (classwork: Classwork) => {
    try {
      await classworkApi.publish(classwork._id);
      const publishType = classwork.type === 'asynchronous' ? 'Assignment' : classworkTypeLabel(classwork.type);
      toast.success(`${publishType} published.`);
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.response?.data?.message || 'Unable to publish classwork.');
    }
  };

  const deleteClasswork = async (classwork: Classwork) => {
    if (!window.confirm(`Delete "${classwork.title}" and its associated grades and submissions?`)) return;
    const subjectId = typeof classwork.subject === 'object' ? classwork.subject._id : classwork.subject;
    const createdById = typeof classwork.createdBy === 'object' ? classwork.createdBy._id : classwork.createdBy;
    const linkedExam = classwork.type === 'assessment' ? exams.find((exam) => {
      const examClassId = typeof exam.class === 'object' ? exam.class._id : exam.class;
      const examSubjectId = typeof exam.subject === 'object' ? exam.subject._id : exam.subject;
      const examCreatorId = typeof exam.createdBy === 'object' ? exam.createdBy._id : exam.createdBy;
      return exam.title === classwork.title && examClassId === classId && examSubjectId === subjectId && examCreatorId === createdById;
    }) : undefined;
    try {
      if (linkedExam) await examsApi.delete(linkedExam._id);
      else await classworkApi.delete(classwork._id);
      toast.success('Classwork deleted.');
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to delete classwork.');
    }
  };

  const openClassworkComposer = (type: Classwork['type']) => {
    setCreateMenuOpen(false);
    setClassworkForm({ ...INITIAL_CLASSWORK_FORM, type, dueDate: '', points: isMaterialType(type) ? '0' : INITIAL_CLASSWORK_FORM.points, submissionMode: 'response' });
    void rubricsApi.getAll().then((response) => setRubricOptions(response.data.rubrics || [])).catch(() => toast.error('Unable to load saved rubrics.'));
    setClassworkQuestions([]);
    setClassworkFiles([]);
    setClassworkLinks([]);
    setClassworkLinkTitle('');
    setClassworkLinkUrl('');
    setMaterialLinkMode(null);
    setClassworkComposerOpen(true);
  };

  const selectRubric = (rubricId: string) => {
    const rubric = rubricOptions.find((item) => item._id === rubricId);
    const totalPoints = rubric?.criteria.reduce((sum, criterion) => sum + criterion.maxPoints, 0);
    setClassworkForm((current) => ({ ...current, rubricId, ...(rubric ? { points: String(totalPoints) } : {}) }));
  };

  const openRubricModal = (mode: 'create' | 'reuse' | 'import') => {
    setRubricMenuOpen(false);
    setRubricModalMode(mode);
    if (mode !== 'reuse') {
      setRubricName('');
      setRubricCriteria([{ title: '', description: '', maxPoints: 5 }]);
    }
  };

  const saveRubric = async () => {
    if (!rubricName.trim() || rubricCriteria.length === 0 || rubricCriteria.some((criterion) => !criterion.title.trim() || !Number.isFinite(criterion.maxPoints) || criterion.maxPoints < 0)) {
      toast.error('Add a name and complete every rubric criterion.');
      return;
    }
    setSavingRubric(true);
    try {
      const response = await rubricsApi.create({
        name: rubricName.trim(),
        criteria: rubricCriteria.map((criterion) => ({ ...criterion, title: criterion.title.trim(), description: criterion.description.trim() })),
      });
      const rubric = response.data.rubric as Rubric;
      setRubricOptions((current) => [rubric, ...current]);
      setClassworkForm((current) => ({ ...current, rubricId: rubric._id, points: String(rubric.criteria.reduce((sum, criterion) => sum + criterion.maxPoints, 0)) }));
      setRubricModalMode(null);
      toast.success('Rubric saved and attached.');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to save rubric.');
    } finally {
      setSavingRubric(false);
    }
  };

  const importRubricCsv = async (file: File | undefined) => {
    if (!file) return;
    try {
      const rows = parseCsvRows(await file.text());
      if (rows.length < 2) throw new Error('The sheet needs a header row and at least one criterion.');
      const headers = rows[0].map((value) => value.toLowerCase().replace(/[^a-z0-9]/g, ''));
      const titleIndex = headers.findIndex((value) => ['criterion', 'criteria', 'title'].includes(value));
      const descriptionIndex = headers.findIndex((value) => ['description', 'details'].includes(value));
      const pointsIndex = headers.findIndex((value) => ['points', 'maxpoints', 'maximumscore', 'maxscore'].includes(value));
      if (titleIndex < 0 || pointsIndex < 0) throw new Error('Add columns named Criterion and Points to the sheet before exporting it as CSV.');
      const criteria = rows.slice(1).filter((row) => row[titleIndex]?.trim()).map((row) => ({
        title: row[titleIndex].trim(),
        description: descriptionIndex >= 0 ? row[descriptionIndex]?.trim() || '' : '',
        maxPoints: Number(row[pointsIndex]),
      }));
      if (!criteria.length || criteria.length > 20 || criteria.some((criterion) => !Number.isFinite(criterion.maxPoints) || criterion.maxPoints < 0)) {
        throw new Error('The sheet must contain 1 to 20 criteria with valid non-negative point values.');
      }
      setRubricName(file.name.replace(/\.csv$/i, ''));
      setRubricCriteria(criteria);
      toast.success(`${criteria.length} criteria imported. Review them and save the rubric.`);
    } catch (error: any) {
      toast.error(error.message || 'Unable to import this spreadsheet.');
    }
  };

  const chooseExistingRubric = (rubric: Rubric) => {
    selectRubric(rubric._id);
    setRubricModalMode(null);
    toast.success('Rubric attached.');
  };

  const chooseMaterialLinkMode = (mode: 'link' | 'drive') => {
    setMaterialLinkMode(mode);
    setClassworkLinkTitle(mode === 'drive' ? 'Google Drive material' : '');
    setClassworkLinkUrl('');
    setMaterialMenuOpen(false);
  };

  const addClassworkLink = () => {
    const enteredUrl = classworkLinkUrl.trim();
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(enteredUrl);
    } catch {
      toast.error('Enter a valid lesson URL, including https://.');
      return;
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      toast.error('Lesson links must start with http:// or https://.');
      return;
    }
    if (materialLinkMode === 'drive' && !['drive.google.com', 'docs.google.com', 'forms.google.com'].includes(parsedUrl.hostname.toLowerCase())) {
      toast.error('Enter a Google Drive, Docs, Sheets, Slides, or Forms share link.');
      return;
    }
    if (classworkLinks.length >= 10) {
      toast.error('You can add up to 10 lesson links.');
      return;
    }
    setClassworkLinks([...classworkLinks, { title: classworkLinkTitle.trim() || parsedUrl.hostname, url: parsedUrl.href }]);
    setClassworkLinkTitle('');
    setClassworkLinkUrl('');
    setMaterialLinkMode(null);
  };

  const addClassworkFiles = (selected: FileList | null) => {
    if (!selected) return;
    const next = [...classworkFiles, ...Array.from(selected)];
    if (next.length > MAX_ATTACHMENT_COUNT) { toast.error(`You can attach up to ${MAX_ATTACHMENT_COUNT} files.`); return; }
    if (next.some((file) => file.size > MAX_ATTACHMENT_SIZE_BYTES)) { toast.error('Each file must be 50 MB or smaller.'); return; }
    setClassworkFiles(next);
  };

  const primarySubject = useMemo(() => {
    if (!classDoc?.subjects?.length) return null;
    return (classDoc.subjects as Subject[]).find((subject) => subject && typeof subject === 'object') || null;
  }, [classDoc]);

  const teacherName = useMemo(() => {
    if (primarySubject && typeof primarySubject.teacher === 'object' && primarySubject.teacher) return primarySubject.teacher.name;
    if (classDoc && typeof classDoc.adviser === 'object' && classDoc.adviser) return classDoc.adviser.name;
    return 'Teacher';
  }, [primarySubject, classDoc]);

  const teacherUser = primarySubject && typeof primarySubject.teacher === 'object' && primarySubject.teacher
    ? primarySubject.teacher
    : classDoc && typeof classDoc.adviser === 'object' && classDoc.adviser ? classDoc.adviser : null;
  const adviserId = classDoc?.adviser && typeof classDoc.adviser === 'object' ? classDoc.adviser._id : classDoc?.adviser;
  const canManageTeachingTeam = isTeacher && adviserId === user?._id;

  const tabs: { key: TabKey; label: string; icon: JSX.Element }[] = [
    { key: 'stream', label: 'Stream', icon: <MessageSquare size={15} /> },
    { key: 'classwork', label: 'Classwork', icon: <BookOpen size={15} /> },
    ...(isTeacher ? [{ key: 'grades' as const, label: 'Grades', icon: <ClipboardList size={15} /> }] : []),
    { key: 'people', label: 'People', icon: <Users size={15} /> },
  ];

  const gradebookWork = classworks.filter((item) => !isMaterialType(item.type) && item.status !== 'draft');
  const getClassworkSubmission = (studentId: string, classworkId: string) => gradebookSubmissions.find((item) => {
    const submissionStudentId = typeof item.student === 'object' ? item.student._id : item.student;
    const submissionClassworkId = typeof item.classwork === 'object' ? item.classwork._id : item.classwork;
    return submissionStudentId === studentId && submissionClassworkId === classworkId;
  });
  const getManualGrade = (studentId: string, classworkId: string) => gradebookGrades.find((item) => {
    const gradeStudentId = typeof item.student === 'object' ? item.student._id : item.student;
    const gradeClassworkId = typeof item.classwork === 'object' ? item.classwork._id : item.classwork;
    return gradeStudentId === studentId && gradeClassworkId === classworkId;
  });
  const openGradeEditor = (student: User, work: Classwork) => {
    const submission = getClassworkSubmission(student._id, work._id);
    const manualGrade = getManualGrade(student._id, work._id);
    const score = submission?.status === 'graded' ? submission.score : manualGrade?.score;
    const rubric = typeof work.rubric === 'object' ? work.rubric : null;
    const savedRubricScores = submission?.rubricScores || manualGrade?.rubricScores || [];
    setEditingGrade({
      studentId: student._id,
      studentName: student.name,
      classworkId: work._id,
      classworkTitle: work.title,
      score: score === undefined ? '' : String(score),
      feedback: submission?.status === 'graded' ? submission.feedback || '' : manualGrade?.feedback || '',
      rubricScores: (rubric?.criteria || []).map((criterion) => ({
        ...criterion,
        scoreInput: String(savedRubricScores.find((entry) => entry.criterionId === criterion.id)?.score ?? ''),
      })),
    });
  };
  const saveGradeEntry = async () => {
    if (!editingGrade) return;
    const work = gradebookWork.find((item) => item._id === editingGrade.classworkId);
    if (!work) return;
    const rubric = typeof work.rubric === 'object' ? work.rubric : null;
    let score = Number(editingGrade.score);
    let rubricScores: RubricScore[] | undefined;
    if (rubric) {
      if (editingGrade.rubricScores.some((criterion) => criterion.scoreInput.trim() === '')) return toast.error('Enter a score for every rubric criterion.');
      rubricScores = editingGrade.rubricScores.map((criterion) => ({ criterionId: criterion.id, score: Number(criterion.scoreInput) }));
      if (rubricScores.some((entry, index) => !Number.isFinite(entry.score) || entry.score < 0 || entry.score > rubric.criteria[index].maxPoints)) return toast.error('Each criterion score must be within its allowed range.');
      score = rubricScores.reduce((sum, entry) => sum + entry.score, 0);
    } else if (editingGrade.score.trim() === '') {
      return toast.error('Enter a score before saving.');
    }
    const submission = getClassworkSubmission(editingGrade.studentId, editingGrade.classworkId);
    const maximumScore = submission?.totalPoints ?? work.points;
    if (!Number.isFinite(score) || score < 0 || score > maximumScore) return toast.error(`Score must be between 0 and ${maximumScore}.`);

    setSavingGrade(true);
    try {
      const gradeData = { score, feedback: editingGrade.feedback, ...(rubricScores ? { rubricScores } : {}) };
      if (submission) {
        const response = await classworkApi.gradeSubmission(submission._id, gradeData);
        const savedSubmission = response.data.submission as ClassworkSubmission;
        setGradebookSubmissions((current) => current.map((item) => item._id === savedSubmission._id ? savedSubmission : item));
      } else {
        const response = await classworkApi.saveGrade(editingGrade.classworkId, editingGrade.studentId, gradeData);
        const savedGrade = response.data.grade as ClassworkGrade;
        setGradebookGrades((current) => [...current.filter((item) => {
          const studentId = typeof item.student === 'object' ? item.student._id : item.student;
          const classworkId = typeof item.classwork === 'object' ? item.classwork._id : item.classwork;
          return studentId !== editingGrade.studentId || classworkId !== editingGrade.classworkId;
        }), savedGrade]);
      }
      toast.success('Grade saved.');
      setEditingGrade(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to save grade.');
    } finally {
      setSavingGrade(false);
    }
  };
  const editingGradeWork = gradebookWork.find((item) => item._id === editingGrade?.classworkId);
  const editingRubric = editingGradeWork && typeof editingGradeWork.rubric === 'object' ? editingGradeWork.rubric : null;
  const renderGrades = () => {
    const classAverage = (work: Classwork) => {
      const scores = (classDoc?.students || []).map((student) => {
        const submission = getClassworkSubmission(student._id, work._id);
        return submission?.status === 'graded' ? submission.score : getManualGrade(student._id, work._id)?.score;
      }).filter((score): score is number => typeof score === 'number');
      return scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2) : '—';
    };
    const chosenWork = gradebookWork.find((item) => item._id === selectedGradeClasswork);
    const selectedSubmissions = gradebookSubmissions.filter((item) => {
      const submissionClassworkId = typeof item.classwork === 'object' ? item.classwork._id : item.classwork;
      return submissionClassworkId === selectedGradeClasswork;
    });

    return <Card title="Grades" subtitle={`${classDoc?.students?.length || 0} students · ${gradebookWork.length} classwork items`}>
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #E5E7EB', marginBottom: 16 }}>
        {(['overview', 'submission'] as const).map((view) => <button key={view} type="button" onClick={() => setGradebookView(view)} style={{ padding: '10px 12px', border: 0, borderBottom: `2px solid ${gradebookView === view ? '#7a1010' : 'transparent'}`, background: 'transparent', color: gradebookView === view ? '#7a1010' : '#64748B', fontWeight: 600, cursor: 'pointer' }}>{view === 'overview' ? 'Overview' : 'Submission'}</button>)}
      </div>
      {gradebookLoading ? <p style={{ margin: 0, color: '#64748B' }}>Loading grades...</p> : gradebookView === 'overview' ? (
        gradebookWork.length === 0 ? <p style={{ margin: 0, color: '#64748B' }}>No published classwork to grade yet.</p> : <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead><tr><th style={{ padding: '12px 10px', borderBottom: '1px solid #D1D5DB', minWidth: 190 }}>Student</th>{gradebookWork.map((work) => <th key={work._id} style={{ padding: '12px 10px', borderBottom: '1px solid #D1D5DB', minWidth: 130, verticalAlign: 'top' }}><span style={{ display: 'block', fontSize: '0.78rem', color: '#334155' }}>{work.title}</span><small style={{ color: '#64748B' }}>out of {work.points}</small></th>)}</tr></thead>
            <tbody>
              <tr style={{ background: '#F8FAFC', fontWeight: 600 }}><td style={{ padding: '12px 10px', borderBottom: '1px solid #E5E7EB' }}>Class average</td>{gradebookWork.map((work) => <td key={work._id} style={{ padding: '12px 10px', borderBottom: '1px solid #E5E7EB' }}>{classAverage(work)}</td>)}</tr>
              {(classDoc?.students || []).map((student) => <tr key={student._id}><td style={{ padding: '12px 10px', borderBottom: '1px solid #E5E7EB', fontWeight: 600 }}>{student.name}</td>{gradebookWork.map((work) => {
                const submission = getClassworkSubmission(student._id, work._id);
                const manualGrade = getManualGrade(student._id, work._id);
                const score = submission?.status === 'graded' ? submission.score : manualGrade?.score;
                const totalPoints = submission?.status === 'graded' ? submission.totalPoints : manualGrade?.totalPoints ?? work.points;
                const missing = !submission && Boolean(work.dueDate && new Date(work.dueDate).getTime() < Date.now());
                return <td key={work._id} style={{ padding: '8px 10px', borderBottom: '1px solid #E5E7EB' }}><button type="button" onClick={() => openGradeEditor(student, work)} aria-label={`Enter grade for ${student.name}, ${work.title}`} title="Enter or edit grade" style={{ width: '100%', minHeight: 36, padding: '6px 8px', border: '1px solid transparent', borderRadius: 5, background: 'transparent', color: score !== undefined ? '#166534' : missing ? '#B91C1C' : '#475569', textAlign: 'left', cursor: 'pointer' }} onMouseEnter={(event) => { event.currentTarget.style.borderColor = '#D1D5DB'; }} onMouseLeave={(event) => { event.currentTarget.style.borderColor = 'transparent'; }}>{score !== undefined ? `${score}/${totalPoints}` : submission?.status === 'submitted' || submission?.status === 'late' ? 'Submitted' : missing ? 'Missing' : '—'}</button></td>;
              })}</tr>)}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6, maxWidth: 420, color: '#475569', fontSize: '0.82rem' }}>Classwork<select value={selectedGradeClasswork} onChange={(event) => setSelectedGradeClasswork(event.target.value)} style={{ padding: '9px 12px', border: '1px solid #D8DEE8', borderRadius: 8, background: '#fff' }}>{gradebookWork.map((work) => <option key={work._id} value={work._id}>{work.title}</option>)}</select></label>
          {!chosenWork ? <p style={{ margin: 0, color: '#64748B' }}>No published classwork available.</p> : selectedSubmissions.length === 0 ? <p style={{ margin: 0, color: '#64748B' }}>No student submissions for this classwork yet.</p> : <div style={{ display: 'grid', gap: 8 }}>{selectedSubmissions.map((submission) => {
            const student = typeof submission.student === 'object' ? submission.student : null;
            return <div key={submission._id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 0', borderBottom: '1px solid #E5E7EB' }}><div style={{ flex: 1, minWidth: 180 }}><strong style={{ display: 'block', color: '#111827' }}>{student?.name || 'Student'}</strong><small style={{ color: '#64748B' }}>{student?.email || ''} · {format(new Date(submission.submittedAt), 'MMM d, yyyy')}</small></div><span style={{ color: submission.status === 'graded' ? '#166534' : '#64748B', fontSize: '0.84rem' }}>{submission.status === 'graded' ? `${submission.score ?? 0}/${submission.totalPoints}` : submission.status}</span><Button size="sm" variant="outline" onClick={() => navigate(`/teacher/classes/${classId}/classwork/${chosenWork._id}`)}>Review</Button></div>;
          })}</div>}
        </div>
      )}
    </Card>;
  };

  const renderStream = () => (
    <div style={{ display: 'grid', gap: 18 }}>
      {isTeacher && (
        <Card>
          <button
            type="button"
            onClick={() => setAnnouncementComposerOpen(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              border: '1px solid #E5E7EB',
              borderRadius: 12,
              background: '#fff',
              color: '#475569',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#FEE2E2', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Megaphone size={16} color="#7a1010" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.96rem', fontWeight: 600, color: '#111827' }}>Announce something to your class</div>
              {announcements[0] ? (
                <div style={{ marginTop: 4, fontSize: '0.78rem', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Latest: {announcements[0].title}
                </div>
              ) : (
                <div style={{ marginTop: 4, fontSize: '0.78rem', color: '#64748B' }}>Share class updates, reminders, or information.</div>
              )}
            </div>
          </button>
        </Card>
      )}

      <Modal
        open={announcementComposerOpen}
        onClose={() => {
          setAnnouncementComposerOpen(false);
          setAnnouncementForm(INITIAL_ANNOUNCEMENT_FORM);
        }}
        title="New announcement"
        footer={
          <>
            <Button variant="secondary" onClick={() => {
              setAnnouncementComposerOpen(false);
              setAnnouncementForm(INITIAL_ANNOUNCEMENT_FORM);
            }}>Cancel</Button>
            <Button loading={postingAnnouncement} onClick={handleCreateAnnouncement}>Post</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 500, color: 'var(--gray-700)' }}>Title</label>
            <input
              value={announcementForm.title}
              onChange={(event) => setAnnouncementForm({ ...announcementForm, title: event.target.value })}
              placeholder="Announcement title"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1.5px solid #E5E7EB',
                borderRadius: 9,
                fontSize: '0.875rem',
                outline: 'none',
                color: '#111827',
                background: '#fff',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 500, color: 'var(--gray-700)' }}>Message</label>
            <textarea
              value={announcementForm.content}
              onChange={(event) => setAnnouncementForm({ ...announcementForm, content: event.target.value })}
              rows={5}
              placeholder="Announce something to your class..."
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1.5px solid #E5E7EB',
                borderRadius: 9,
                fontSize: '0.875rem',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'var(--font-body)',
                lineHeight: 1.6,
                color: '#111827',
                background: '#fff',
              }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: '#374151', cursor: 'pointer' }}>
            <input type="checkbox" checked={announcementForm.isPinned} onChange={(event) => setAnnouncementForm({ ...announcementForm, isPinned: event.target.checked })} />
            Pin this announcement
          </label>
        </div>
      </Modal>

      <Card title="Google Meet" action={isTeacher && (!classMeet || statusFor(classMeet) === 'Finished') ? <Button size="sm" icon={<Plus size={15} />} onClick={() => setMeetModalOpen(true)}>Create Meet</Button> : undefined}>
        {!classMeet ? (
          <p style={{ color: '#64748B', margin: 0 }}>{isTeacher ? 'Create a Google Meet for this class.' : 'No active Google Meet for this class.'}</p>
        ) : statusFor(classMeet) === 'Finished' ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><p style={{ color: '#64748B', margin: 0 }}>This Google Meet has ended.</p>{isTeacher && <Button size="sm" onClick={() => setMeetModalOpen(true)}>Create New Meet</Button>}</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><Video size={20} color="#059669" /><div style={{ flex: 1, minWidth: 180 }}><strong>{classMeet.meetingTitle}</strong><div style={{ color: '#64748B', fontSize: '.8rem', marginTop: 4 }}>This class is currently using Google Meet.</div></div><Badge label="Live" color="green" /><Button size="sm" icon={<ExternalLink size={14} />} onClick={() => window.open(classMeet.meetLink, '_blank', 'noopener,noreferrer')}>Join Meet</Button>{isTeacher && <Button size="sm" variant="danger" onClick={endClassMeet}>End Meet</Button>}</div>
        )}
      </Card>

      <Card title="Stream" subtitle="Announcements and recent class activity">
        {streamItems.length === 0 ? (
          <p style={{ color: '#64748B', margin: 0 }}>No class updates yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {streamItems.map((streamItem) => {
              if (streamItem.kind === 'announcement') {
                return <AnnouncementCard key={`announcement-${streamItem.item._id}`} ann={streamItem.item} targetColor={() => 'gray'} readOnly={user?.role === 'admin'} />;
              }
              const classwork = streamItem.item;
                const author = typeof classwork.createdBy === 'object' ? classwork.createdBy.name : 'Teacher';
                const postedDate = classwork.publishedAt || classwork.createdAt;
                return <article key={`classwork-${classwork._id}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, border: '1px solid #E5E7EB', borderRadius: 10, background: '#F8FAFC' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: '#E8F0FE', color: '#1967D2' }}><ClipboardList size={18} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#475569', fontSize: '0.8rem' }}><strong>{author}</strong> posted a new {classworkTypeLabel(classwork.type).toLowerCase()}: <strong>{classwork.title}</strong></div>
                    <div style={{ marginTop: 4, color: '#64748B', fontSize: '0.74rem' }}>{format(new Date(postedDate), 'MMM d')}{user?.role !== 'student' ? ` · ${classwork.status}` : ''}</div>
                    {classwork.description && <p style={{ margin: '9px 0 0', color: '#475569', fontSize: '0.82rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{classwork.description}</p>}
                    {(classwork.attachments?.length > 0 || classwork.resourceLinks?.length > 0) && <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, color: '#64748B', fontSize: '0.74rem' }}><FileUp size={14} />{classwork.attachments.length + (classwork.resourceLinks?.length || 0)} lesson material{classwork.attachments.length + (classwork.resourceLinks?.length || 0) === 1 ? '' : 's'}</div>}
                    <Button size="sm" variant="outline" style={{ marginTop: 10 }} onClick={() => navigate(`${user?.role === 'teacher' ? '/teacher' : user?.role === 'admin' ? '/admin' : '/student'}/classes/${classId}/classwork/${classwork._id}`)}>Open classwork</Button>
                  </div>
                </article>;
            })}
          </div>
        )}
      </Card>
    </div>
  );

  const renderClasswork = () => (
    <>
    <Card
      title="Classwork"
      subtitle="Assignments, activities, and assessments for this class"
      action={isTeacher ? <div ref={createMenuRef} style={{ position: 'relative' }}>
        <Button size="sm" icon={<Plus size={14} />} aria-haspopup="menu" aria-expanded={createMenuOpen} onClick={() => setCreateMenuOpen((open) => !open)}>
          Create <ChevronDown size={14} />
        </Button>
        {createMenuOpen && <div role="menu" aria-label="Create classwork" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 30, width: 230, padding: 6, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 12px 30px rgba(15, 23, 42, .16)' }}>
          {CLASSWORK_MENU_TYPES.map((type) => <button key={type.value} type="button" role="menuitem" onClick={() => {
            setCreateMenuOpen(false);
            if (type.value === 'quiz') {
              navigate('/teacher/exams', { state: { openCreateExam: true, examType: 'quiz', classId, subjectId: primarySubject?._id } });
              return;
            }
            openClassworkComposer(type.value);
          }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 9px', border: 0, borderRadius: 7, background: '#fff', color: '#1F2937', cursor: 'pointer', textAlign: 'left' }} onMouseEnter={(event) => { event.currentTarget.style.background = '#FFF7F7'; }} onMouseLeave={(event) => { event.currentTarget.style.background = '#fff'; }}>
            <ClipboardList size={17} color="#7a1010" style={{ marginTop: 1, flexShrink: 0 }} />
            <strong style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600 }}>{type.label}</strong>
          </button>)}
        </div>}
      </div> : undefined}
    >
      {classworks.length === 0 ? (
        <p style={{ color: '#64748B', margin: 0 }}>No classwork available yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {classworks.filter((classwork) => isTeacher || (classwork.attachments?.length ?? 0) > 0 || !submissions.some((item) => {
            const submissionClassworkId = typeof (item as any).classwork === 'object' ? (item as any).classwork?._id : (item as any).classwork;
            return submissionClassworkId === classwork._id;
          })).map((classwork) => {
            const submission = submissions.find((item) => {
              const submissionClassworkId = typeof (item as any).classwork === 'object' ? (item as any).classwork?._id : (item as any).classwork;
              return submissionClassworkId === classwork._id;
            });
            const subject = typeof classwork.subject === 'object' ? classwork.subject : null;
            return (
              <div key={classwork._id} style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, background: '#F8FAFC' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a1010', fontWeight: 700 }}>{subject?.name || 'Classwork'} · {classworkTypeLabel(classwork.type)}</div>
                    <h4 style={{ margin: '6px 0 4px', fontSize: '1rem', fontWeight: 700, color: 'var(--gray-900)' }}>{classwork.title}</h4>
                    <div style={{ fontSize: '0.8rem', color: '#64748B' }}>{classwork.dueDate ? `Due ${format(new Date(classwork.dueDate), 'MMM d, yyyy')}${classwork.dueTime ? ` at ${classwork.dueTime}` : ''} · ` : ''}{isMaterialType(classwork.type) ? 'Lesson material' : `${classwork.points} points`}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Badge label={classwork.status} color={classwork.status === 'published' ? 'green' : classwork.status === 'closed' ? 'gray' : 'yellow'} />
                    {user?.role === 'student' && <Badge label={submission?.status || 'Assigned'} color={submission?.status === 'graded' ? 'blue' : submission ? 'green' : 'gray'} />}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  <Button size="sm" variant="outline" onClick={() => navigate(`${isTeacher ? '/teacher' : user?.role === 'admin' ? '/admin' : '/student'}/classes/${classId}/classwork/${classwork._id}`)}>Open</Button>
                  {isTeacher && classwork.status === 'draft' && <Button size="sm" onClick={() => publishClasswork(classwork)}>Publish</Button>}
                  {isTeacher && <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => deleteClasswork(classwork)}>Delete</Button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {isTeacher && exams.length > 0 && <p style={{ color: '#64748B', fontSize: '0.8rem', margin: '16px 0 0' }}>Exams remain available in the Exams section.</p>}
      <Modal open={classworkComposerOpen} onClose={() => setClassworkComposerOpen(false)} title={`Create ${classworkTypeLabel(classworkForm.type)}`} footer={<><Button variant="secondary" onClick={() => setClassworkComposerOpen(false)}>Cancel</Button><Button loading={savingClasswork} onClick={handleCreateClasswork}>Save draft</Button></>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <Input label="Title" value={classworkForm.title} onChange={event => setClassworkForm({ ...classworkForm, title: event.target.value })} placeholder={classworkForm.type === 'assignment' ? 'e.g. Research assignment' : classworkForm.type === 'activity' ? 'e.g. Map reading activity' : 'e.g. Chapter 1 assessment'} />
          {!isMaterialType(classworkForm.type) && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Input label="Due date" type="date" value={classworkForm.dueDate} onChange={event => setClassworkForm({ ...classworkForm, dueDate: event.target.value })} />
            <Input label="Due time" type="time" value={classworkForm.dueTime} onChange={event => setClassworkForm({ ...classworkForm, dueTime: event.target.value })} />
          </div>}
          {!isMaterialType(classworkForm.type) && <Input label="Points" type="number" min="0" value={classworkForm.points} readOnly={Boolean(classworkForm.rubricId)} onChange={event => setClassworkForm({ ...classworkForm, points: event.target.value })} />}
          {!isMaterialType(classworkForm.type) && <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Button size="sm" variant="outline" icon={<Plus size={15} />} aria-haspopup="menu" aria-expanded={rubricMenuOpen} onClick={() => setRubricMenuOpen((open) => !open)}>Rubric</Button>
                {rubricMenuOpen && <div role="menu" aria-label="Rubric options" style={{ position: 'absolute', top: 'calc(100% + 5px)', left: 0, zIndex: 40, width: 210, padding: 5, background: '#fff', border: '1px solid #D8DEE8', borderRadius: 8, boxShadow: '0 8px 20px rgba(15, 23, 42, .16)' }}>
                  {([{ mode: 'create', label: 'Create new' }, { mode: 'reuse', label: 'Reuse existing' }, { mode: 'import', label: 'Import from Sheets' }] as const).map((option) => <button key={option.mode} type="button" role="menuitem" onClick={() => openRubricModal(option.mode)} style={{ display: 'block', width: '100%', padding: '10px 9px', border: 0, borderRadius: 6, background: '#fff', textAlign: 'left', color: '#1F2937', cursor: 'pointer' }} onMouseEnter={(event) => { event.currentTarget.style.background = '#F8FAFC'; }} onMouseLeave={(event) => { event.currentTarget.style.background = '#fff'; }}>{option.label}</button>)}
                </div>}
              </div>
              {classworkForm.rubricId && <span style={{ color: '#166534', fontSize: '0.82rem', fontWeight: 600 }}>{rubricOptions.find((rubric) => rubric._id === classworkForm.rubricId)?.name || 'Rubric attached'} · {classworkForm.points} points <button type="button" onClick={() => setClassworkForm((current) => ({ ...current, rubricId: '' }))} aria-label="Remove rubric" style={{ marginLeft: 5, border: 0, background: 'transparent', color: '#64748B', cursor: 'pointer' }}><X size={14} /></button></span>}
            </div>
            {classworkForm.rubricId && <div style={{ padding: 10, border: '1px solid #E5E7EB', borderRadius: 8, background: '#F8FAFC', display: 'grid', gap: 5 }}>{rubricOptions.find((rubric) => rubric._id === classworkForm.rubricId)?.criteria.map((criterion) => <div key={criterion.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: '#475569', fontSize: '0.78rem' }}><span>{criterion.title}</span><strong>{criterion.maxPoints} pts</strong></div>)}</div>}
          </div>}
          {classworkForm.type !== 'assessment' && !isMaterialType(classworkForm.type) && <div><div style={{ marginBottom: 7, fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-700)' }}>Student response</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><button type="button" onClick={() => setClassworkForm({ ...classworkForm, submissionMode: 'response' })} style={{ padding: 9, textAlign: 'left', border: `1.5px solid ${classworkForm.submissionMode === 'response' ? '#8B1A1A' : '#E5E7EB'}`, borderRadius: 8, background: classworkForm.submissionMode === 'response' ? '#FFF7F7' : '#fff', cursor: 'pointer' }}><strong style={{ display: 'block', fontSize: '0.76rem' }}>Written response</strong><span style={{ display: 'block', marginTop: 3, fontSize: '0.68rem', color: '#64748B' }}>Students describe or submit their work.</span></button><button type="button" onClick={() => setClassworkForm({ ...classworkForm, submissionMode: 'mark_done' })} style={{ padding: 9, textAlign: 'left', border: `1.5px solid ${classworkForm.submissionMode === 'mark_done' ? '#8B1A1A' : '#E5E7EB'}`, borderRadius: 8, background: classworkForm.submissionMode === 'mark_done' ? '#FFF7F7' : '#fff', cursor: 'pointer' }}><strong style={{ display: 'block', fontSize: '0.76rem' }}>Mark as done</strong><span style={{ display: 'block', marginTop: 3, fontSize: '0.68rem', color: '#64748B' }}>Students confirm they completed it.</span></button></div></div>}
          <label style={{ display: 'grid', gap: 6, fontSize: '0.8rem', fontWeight: 500, color: 'var(--gray-700)' }}>Description<textarea rows={3} value={classworkForm.description} onChange={event => setClassworkForm({ ...classworkForm, description: event.target.value })} placeholder={CLASSWORK_TYPES.find((type) => type.value === classworkForm.type)?.prompt} style={{ padding: '9px 14px', border: '1.5px solid var(--gray-200)', borderRadius: 9, fontFamily: 'var(--font-body)', resize: 'vertical' }} /></label>
          <label style={{ display: 'grid', gap: 6, fontSize: '0.8rem', fontWeight: 500, color: 'var(--gray-700)' }}>Student instructions<textarea rows={3} value={classworkForm.instructions} onChange={event => setClassworkForm({ ...classworkForm, instructions: event.target.value })} placeholder="Explain the steps, requirements, or materials students need." style={{ padding: '9px 14px', border: '1.5px solid var(--gray-200)', borderRadius: 9, fontFamily: 'var(--font-body)', resize: 'vertical' }} /></label>
          <div style={{ display: 'grid', gap: 9 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-700)' }}>Lesson materials</div>
            <div ref={materialMenuRef} style={{ position: 'relative', width: 'fit-content', maxWidth: '100%' }}>
              <button type="button" aria-haspopup="menu" aria-expanded={materialMenuOpen} onClick={() => setMaterialMenuOpen((open) => !open)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: 190, padding: '9px 18px', border: '1px solid #AFC8F5', borderRadius: 999, background: '#E8F0FE', color: '#1967D2', fontSize: '0.86rem', fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={16} /> Add or create <ChevronDown size={14} />
              </button>
              {materialMenuOpen && <div role="menu" aria-label="Add lesson material" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 35, width: 240, padding: '5px 0', background: '#fff', border: '1px solid #D8DEE8', borderRadius: 8, boxShadow: '0 8px 20px rgba(15, 23, 42, .16)' }}>
                <button type="button" role="menuitem" onClick={() => chooseMaterialLinkMode('drive')} style={materialMenuItemStyle} onMouseEnter={(event) => { event.currentTarget.style.background = '#F1F3F4'; }} onMouseLeave={(event) => { event.currentTarget.style.background = '#fff'; }}><HardDrive size={19} color="#4285F4" /><span>Google Drive</span></button>
                <button type="button" role="menuitem" onClick={() => chooseMaterialLinkMode('link')} style={materialMenuItemStyle} onMouseEnter={(event) => { event.currentTarget.style.background = '#F1F3F4'; }} onMouseLeave={(event) => { event.currentTarget.style.background = '#fff'; }}><Link2 size={19} color="#475569" /><span>Link</span></button>
                <button type="button" role="menuitem" onClick={() => { setMaterialMenuOpen(false); setMaterialLinkMode(null); materialFileInputRef.current?.click(); }} style={materialMenuItemStyle} onMouseEnter={(event) => { event.currentTarget.style.background = '#F1F3F4'; }} onMouseLeave={(event) => { event.currentTarget.style.background = '#fff'; }}><FileUp size={19} color="#475569" /><span>File</span></button>
              </div>}
              <input ref={materialFileInputRef} type="file" multiple accept={SUPPORTED_ATTACHMENT_ACCEPT} onChange={(event) => { addClassworkFiles(event.target.files); event.currentTarget.value = ''; }} style={{ display: 'none' }} />
            </div>
            {materialLinkMode && <div style={{ display: 'grid', gap: 8, padding: 12, border: '1px solid #E5E7EB', borderRadius: 8, background: '#F8FAFC' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>{materialLinkMode === 'drive' ? 'Add a Google Drive link' : 'Add a lesson link'}</div>
              {materialLinkMode === 'drive' && <p style={{ margin: 0, color: '#64748B', fontSize: '0.75rem', lineHeight: 1.45 }}>Paste a shareable Google Drive, Docs, Sheets, Slides, or Forms URL. Set its sharing permission so your students can open it.</p>}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr) auto', gap: 8, alignItems: 'end' }}>
                <Input label="Link title" value={classworkLinkTitle} onChange={(event) => setClassworkLinkTitle(event.target.value)} placeholder="Reading or lesson" />
                <Input label="URL" type="url" value={classworkLinkUrl} onChange={(event) => setClassworkLinkUrl(event.target.value)} placeholder={materialLinkMode === 'drive' ? 'https://drive.google.com/...' : 'https://example.com/lesson'} />
                <Button variant="outline" icon={<Plus size={15} />} onClick={addClassworkLink}>Add</Button>
              </div>
              <button type="button" onClick={() => setMaterialLinkMode(null)} style={{ justifySelf: 'start', padding: 0, border: 0, background: 'transparent', color: '#64748B', fontSize: '0.76rem', cursor: 'pointer' }}>Cancel</button>
            </div>}
            {classworkLinks.length > 0 && <div style={{ display: 'grid', gap: 6 }}>{classworkLinks.map((link, index) => <div key={`${link.url}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', background: '#F1F5F9', borderRadius: 7, fontSize: '0.8rem' }}><Link2 size={15} color="#2563EB" /><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.title}</span><span style={{ color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.url}</span><button type="button" aria-label={`Remove ${link.title}`} onClick={() => setClassworkLinks(classworkLinks.filter((_, linkIndex) => linkIndex !== index))} style={{ border: 0, background: 'transparent', color: '#64748B', cursor: 'pointer' }}><X size={15} /></button></div>)}</div>}
            {classworkFiles.length > 0 && <div style={{ display: 'grid', gap: 6 }}>{classworkFiles.map((file, index) => <div key={`${file.name}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', background: '#F1F5F9', borderRadius: 7, fontSize: '0.8rem' }}><FileText size={15} color="#64748B" /><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span><span style={{ color: '#64748B', whiteSpace: 'nowrap' }}>{(file.size / (1024 * 1024)).toFixed(1)} MB</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setClassworkFiles(classworkFiles.filter((_, fileIndex) => fileIndex !== index))} style={{ border: 0, background: 'transparent', color: '#64748B', cursor: 'pointer' }}><X size={15} /></button></div>)}</div>}
            {(classworkFiles.length > 0 || classworkLinks.length > 0) && <p style={{ margin: 0, color: '#64748B', fontSize: '0.74rem' }}>{classworkFiles.length + classworkLinks.length} material{classworkFiles.length + classworkLinks.length === 1 ? '' : 's'} added</p>}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: '#374151' }}><input type="checkbox" checked={classworkForm.allowLateSubmission} onChange={event => setClassworkForm({ ...classworkForm, allowLateSubmission: event.target.checked })} /> Allow late submission</label>
          {classworkForm.type === 'assessment' && <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 12 }}><QuestionBuilder questions={classworkQuestions} onChange={setClassworkQuestions} /></div>}
          <p style={{ margin: 0, color: '#64748B', fontSize: '0.76rem' }}>Subject: {primarySubject?.name || 'No subject assigned to this class'}</p>
        </div>
      </Modal>
      <Modal open={rubricModalMode !== null} onClose={() => !savingRubric && setRubricModalMode(null)} title={rubricModalMode === 'create' ? 'Create rubric' : rubricModalMode === 'reuse' ? 'Reuse rubric' : 'Import from Sheets'} width="680px" footer={rubricModalMode === 'reuse' ? <Button variant="secondary" onClick={() => setRubricModalMode(null)}>Close</Button> : <><Button variant="secondary" disabled={savingRubric} onClick={() => setRubricModalMode(null)}>Cancel</Button><Button loading={savingRubric} onClick={saveRubric}>Save and attach</Button></>}>
        {rubricModalMode === 'reuse' ? (
          rubricOptions.length === 0 ? <p style={{ margin: 0, color: '#64748B' }}>No saved rubrics yet. Create one or import a sheet.</p> : <div style={{ maxHeight: 420, overflowY: 'auto', display: 'grid', gap: 8 }}>{rubricOptions.map((rubric) => <button key={rubric._id} type="button" onClick={() => chooseExistingRubric(rubric)} style={{ padding: 12, border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', textAlign: 'left', cursor: 'pointer' }}><strong style={{ color: '#111827' }}>{rubric.name}</strong><div style={{ marginTop: 5, color: '#64748B', fontSize: '0.78rem' }}>{rubric.criteria.length} criteria · {rubric.criteria.reduce((sum, criterion) => sum + criterion.maxPoints, 0)} points</div></button>)}</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {rubricModalMode === 'import' && <label style={{ display: 'grid', gap: 5, padding: 12, border: '1px dashed #94A3B8', borderRadius: 8, color: '#475569', fontSize: '0.82rem' }}>CSV exported from Google Sheets<input type="file" accept=".csv,text/csv" onChange={(event) => { void importRubricCsv(event.target.files?.[0]); event.currentTarget.value = ''; }} /><small style={{ color: '#64748B' }}>Required columns: Criterion and Points. Description is optional.</small></label>}
            <Input label="Rubric name" value={rubricName} onChange={(event) => setRubricName(event.target.value)} placeholder="e.g. Written response rubric" />
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><strong style={{ color: '#334155', fontSize: '0.84rem' }}>Criteria</strong><Button size="sm" variant="outline" icon={<Plus size={14} />} disabled={rubricCriteria.length >= 20} onClick={() => setRubricCriteria((current) => [...current, { title: '', description: '', maxPoints: 5 }])}>Add criterion</Button></div>
              {rubricCriteria.map((criterion, index) => <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px 34px', gap: 8, alignItems: 'start', padding: 10, border: '1px solid #E5E7EB', borderRadius: 8 }}>
                <div style={{ display: 'grid', gap: 7 }}><Input label={`Criterion ${index + 1}`} value={criterion.title} onChange={(event) => setRubricCriteria((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} placeholder="Criterion name" /><textarea aria-label={`Description for criterion ${index + 1}`} value={criterion.description} onChange={(event) => setRubricCriteria((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} placeholder="Describe what is evaluated" rows={2} style={{ padding: '8px 10px', border: '1px solid #D8DEE8', borderRadius: 7, font: 'inherit', resize: 'vertical' }} /></div>
                <Input label="Max points" type="number" min="0" value={String(criterion.maxPoints)} onChange={(event) => setRubricCriteria((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, maxPoints: Number(event.target.value) } : item))} />
                <button type="button" disabled={rubricCriteria.length <= 1} aria-label={`Remove criterion ${index + 1}`} onClick={() => setRubricCriteria((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={{ marginTop: 25, border: 0, background: 'transparent', color: rubricCriteria.length <= 1 ? '#CBD5E1' : '#DC2626', cursor: rubricCriteria.length <= 1 ? 'default' : 'pointer' }}><Trash2 size={16} /></button>
              </div>)}
            </div>
            <div style={{ padding: 10, background: '#F8FAFC', borderRadius: 8, color: '#475569', fontSize: '0.82rem' }}>Total points: <strong>{rubricCriteria.reduce((sum, criterion) => sum + (Number(criterion.maxPoints) || 0), 0)}</strong></div>
          </div>
        )}
      </Modal>
    </Card>
    {user?.role === 'admin' && exams.length > 0 && <Card title="Exams" subtitle="Read-only exam information for this classroom">
      <div style={{ display: 'grid', gap: 8 }}>
        {exams.map((exam) => <div key={exam._id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: 'block', color: '#111827', fontSize: '0.86rem' }}>{exam.title}</strong>
            <span style={{ display: 'block', marginTop: 4, color: '#64748B', fontSize: '0.76rem' }}>{examTypeLabel(exam.examType)} · {exam.questions.length} questions · {exam.duration} min · {format(new Date(exam.startDate), 'MMM d, yyyy')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Badge label={examStatusLabel(exam.status)} color={exam.status === 'published' ? 'green' : exam.status === 'pending_approval' ? 'blue' : 'yellow'} />
            <Button size="sm" variant="outline" onClick={() => navigate('/admin/exams', { state: { reviewExamId: exam._id } })}>View exam</Button>
          </div>
        </div>)}
      </div>
    </Card>}
    </>
  );

  const renderPeople = () => (
    <div style={{ display: 'grid', gap: 18 }}>
      <Card title="Teacher">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#FEE2E2', display: 'grid', placeItems: 'center', color: '#7a1010', fontWeight: 700 }}>{teacherName.slice(0, 1).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{teacherName}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748B' }}>{primarySubject?.name || classDoc?.name || 'Class Teacher'}</div>
          </div>
          {teacherUser && teacherUser._id !== user?._id && <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('lms:open-messenger', { detail: { participant: teacherUser } }))} aria-label={`Message ${teacherName}`} title={`Message ${teacherName}`} style={{ border: 0, background: '#FFF7F7', color: '#7a1010', borderRadius: 8, padding: 8, cursor: 'pointer' }}><MessageSquare size={16} /></button>}
        </div>
      </Card>

      {user?.role !== 'student' && (
        <Card title="Team teachers" subtitle="Teachers who can manage this class" action={canManageTeachingTeam ? <Button size="sm" icon={<Plus size={14} />} onClick={openCoTeacherPicker}>Invite co-teacher</Button> : undefined}>
          {(classDoc.coTeachers || []).length === 0 ? <p style={{ margin: 0, color: '#64748B' }}>No co-teachers yet.</p> : <div style={{ display: 'grid', gap: 8 }}>{(classDoc.coTeachers || []).map((teacher) => <div key={teacher._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}><div style={{ width: 34, height: 34, borderRadius: '50%', background: '#E8F0FE', color: '#1967D2', display: 'grid', placeItems: 'center', fontWeight: 700 }}>{teacher.name.slice(0, 1).toUpperCase()}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{teacher.name}</div><div style={{ color: '#64748B', fontSize: '0.76rem' }}>{teacher.email}</div></div>{canManageTeachingTeam && <button type="button" onClick={() => removeCoTeacher(teacher)} title={`Remove ${teacher.name}`} aria-label={`Remove ${teacher.name}`} style={{ border: 0, background: '#FEF2F2', color: '#DC2626', borderRadius: 8, padding: 8, cursor: 'pointer' }}><UserMinus size={15} /></button>}</div>)}</div>}
        </Card>
      )}

      <Card title="Classmates" subtitle={`${(classDoc?.students || []).length} enrolled students`}>
        <div style={{ position: 'relative', marginBottom: 12 }}><Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} /><input value={classmateSearch} onChange={(event) => setClassmateSearch(event.target.value)} placeholder="Search classmates by name, email, or LRN" aria-label="Search classmates by name, email, or LRN" style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid #D8DEE8', borderRadius: 8, fontSize: '0.84rem' }} /></div>
        {(classDoc?.students || []).length === 0 ? (
          <p style={{ color: '#64748B', margin: 0 }}>No students enrolled in this class yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {(classDoc?.students || []).filter((student) => `${student.name} ${student.email} ${(student as User).lrn || ''}`.toLowerCase().includes(classmateSearch.trim().toLowerCase())).map((student) => (
              <div key={(student as User)._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#E0F2FE', color: '#1D4ED8', display: 'grid', placeItems: 'center', fontWeight: 700 }}>{(student as User).name?.slice(0, 1).toUpperCase() || 'S'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{(student as User).name}</div>
                  <div style={{ fontSize: '0.76rem', color: '#64748B' }}>{(student as User).email}</div>
                </div>
                {(student as User)._id !== user?._id && <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                  <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('lms:open-messenger', { detail: { participant: student } }))} aria-label={`Message ${(student as User).name}`} title={`Message ${(student as User).name}`} style={{ border: 0, background: '#EFF6FF', color: '#1D4ED8', borderRadius: 8, padding: 8, cursor: 'pointer' }}><MessageSquare size={16} /></button>
                  {isTeacher && <button type="button" onClick={() => setRemoveTarget(student as User)} aria-label={`Remove ${(student as User).name} from this class`} title="Remove from class" style={{ border: 0, background: '#FEF2F2', color: '#DC2626', borderRadius: 8, padding: 8, cursor: 'pointer' }}><UserMinus size={16} /></button>}
                </div>}
              </div>
            ))}
            {(classDoc?.students || []).filter((student) => `${student.name} ${student.email}`.toLowerCase().includes(classmateSearch.trim().toLowerCase())).length === 0 && <p style={{ margin: 0, color: '#64748B', fontSize: '0.84rem' }}>No classmates match that search.</p>}
          </div>
        )}
      </Card>
      <Modal open={Boolean(removeTarget)} onClose={() => !removingStudent && setRemoveTarget(null)} title="Remove student from class" footer={<><Button variant="secondary" disabled={removingStudent} onClick={() => setRemoveTarget(null)}>Cancel</Button><Button loading={removingStudent} onClick={removeStudent}>Remove student</Button></>}>
        <p style={{ margin: 0, color: '#475569', lineHeight: 1.55 }}>Remove <strong>{removeTarget?.name}</strong> from <strong>{classDoc?.name} · {classDoc?.section}</strong>?</p>
        <p style={{ margin: '10px 0 0', color: '#64748B', fontSize: '0.82rem' }}>They will no longer appear as a classmate or receive this class's work.</p>
      </Modal>
      <Modal open={coTeacherModalOpen} onClose={() => !savingCoTeacher && setCoTeacherModalOpen(false)} title="Invite a co-teacher">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ position: 'relative' }}><Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} /><input value={coTeacherSearch} onChange={(event) => setCoTeacherSearch(event.target.value)} placeholder="Search teachers" aria-label="Search teachers" style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid #D8DEE8', borderRadius: 8, fontSize: '0.84rem' }} /></div>
          <div style={{ maxHeight: 300, overflowY: 'auto', display: 'grid', gap: 4 }}>
            {teacherCandidates.filter((teacher) => teacher._id !== adviserId && !(classDoc.coTeachers || []).some((existing) => existing._id === teacher._id) && `${teacher.name} ${teacher.email}`.toLowerCase().includes(coTeacherSearch.trim().toLowerCase())).map((teacher) => <button key={teacher._id} type="button" disabled={savingCoTeacher} onClick={() => addCoTeacher(teacher._id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 8px', border: 0, borderBottom: '1px solid #F1F5F9', background: '#fff', textAlign: 'left', cursor: 'pointer' }}><span><strong style={{ display: 'block', color: '#111827' }}>{teacher.name}</strong><small style={{ color: '#64748B' }}>{teacher.email}</small></span><Plus size={16} color="#1967D2" /></button>)}
          </div>
        </div>
      </Modal>
    </div>
  );

  if (loading) return <Card padding="48px"><p style={{ textAlign: 'center', margin: 0 }}>Loading class workspace...</p></Card>;
  if (!classDoc) return <Card><EmptyState title="Class unavailable" description="This class does not exist or you do not have access." /></Card>;

  const subjectName = primarySubject?.name || classDoc.name;
  const headerTitle = classDoc.name === subjectName ? classDoc.section : `${classDoc.name} • ${classDoc.section}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <button onClick={() => navigate(user?.role === 'admin' ? '/admin/classes' : isTeacher ? '/teacher/classes' : '/student/classes')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, background: 'none', color: '#7a1010', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
        <ArrowLeft size={16} /> {user?.role === 'admin' ? 'Back to Classes' : 'Back to My Classes'}
      </button>

      {user?.role === 'admin' && <div role="status" style={{ padding: '10px 14px', border: '1px solid #BFDBFE', borderRadius: 8, background: '#EFF6FF', color: '#1E40AF', fontSize: '0.84rem', fontWeight: 600 }}>Read-only classroom monitoring</div>}

      <section style={{ background: 'linear-gradient(135deg, #7a1010 0%, #9d2a2a 100%)', color: '#fff', borderRadius: 18, padding: '26px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.84, fontWeight: 700 }}>{subjectName}</div>
            <h1 style={{ margin: '8px 0 0', fontSize: 'clamp(1.7rem, 2vw, 2.3rem)', lineHeight: 1.1 }}>{headerTitle}</h1>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, padding: '10px 14px' }}>
            <div style={{ fontSize: '0.75rem', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Teacher</div>
            <div style={{ fontWeight: 700 }}>{teacherName}</div>
          </div>
        </div>
      </section>

      <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? '3px solid #7a1010' : '3px solid transparent',
              color: activeTab === tab.key ? '#7a1010' : '#64748B',
              fontWeight: activeTab === tab.key ? 700 : 600,
              padding: '12px 8px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontSize: '0.92rem',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'stream' && renderStream()}
      {activeTab === 'classwork' && renderClasswork()}
      {activeTab === 'grades' && isTeacher && renderGrades()}
      {activeTab === 'people' && renderPeople()}

      <Modal open={meetModalOpen && isTeacher} onClose={() => setMeetModalOpen(false)} title="Create Google Meet" footer={<><Button variant="secondary" onClick={() => setMeetModalOpen(false)}>Cancel</Button>{isTeacher && !calendarConnected ? <Button loading={calendarChecking} onClick={() => googleApi.connectCalendar(classId)}>Connect Google Calendar</Button> : isTeacher ? <Button loading={creatingMeet} onClick={createClassMeet}>Create Google Meet</Button> : null}</>}>
        <div style={{ display: 'grid', gap: 8 }}><span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Class</span><strong style={{ color: 'var(--gray-900)' }}>{classDoc ? `${classDoc.name} - ${classDoc.section}` : 'Current class'}</strong><p style={{ margin: '8px 0 0', color: '#64748B', fontSize: '0.85rem' }}>{isTeacher && !calendarConnected ? 'Connect your Google Calendar first. The Meet will be created as a Calendar event after authorization.' : 'A Google Meet will be created for this class using your connected Google account.'}</p></div>
      </Modal>
      <Modal open={Boolean(editingGrade)} onClose={() => !savingGrade && setEditingGrade(null)} title="Enter grade" footer={<><Button variant="secondary" disabled={savingGrade} onClick={() => setEditingGrade(null)}>Cancel</Button><Button loading={savingGrade} onClick={saveGradeEntry}>Save grade</Button></>}>
        {editingGrade && <div style={{ display: 'grid', gap: 14 }}>
          <div><strong style={{ display: 'block', color: '#111827' }}>{editingGrade.studentName}</strong><span style={{ color: '#64748B', fontSize: '0.82rem' }}>{editingGrade.classworkTitle}</span></div>
          {editingRubric ? <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#7a1010' }}>{editingRubric.name}</div>
            {editingGrade.rubricScores.map((criterion, index) => <div key={criterion.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px', gap: 10, alignItems: 'end', padding: 10, border: '1px solid #E5E7EB', borderRadius: 8 }}>
              <div><strong style={{ display: 'block', color: '#334155', fontSize: '0.82rem' }}>{criterion.title} · {criterion.maxPoints} pts</strong>{criterion.description && <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '0.76rem' }}>{criterion.description}</p>}</div>
              <Input label="Score" type="number" min="0" max={criterion.maxPoints} value={criterion.scoreInput} onChange={(event) => setEditingGrade({ ...editingGrade, rubricScores: editingGrade.rubricScores.map((item, itemIndex) => itemIndex === index ? { ...item, scoreInput: event.target.value } : item) })} />
            </div>)}
            <div style={{ textAlign: 'right', color: '#334155', fontSize: '0.84rem' }}>Total: <strong>{editingGrade.rubricScores.reduce((sum, criterion) => sum + (Number(criterion.scoreInput) || 0), 0)} / {editingRubric.criteria.reduce((sum, criterion) => sum + criterion.maxPoints, 0)}</strong></div>
          </div> : <Input label={`Score (out of ${getClassworkSubmission(editingGrade.studentId, editingGrade.classworkId)?.totalPoints ?? gradebookWork.find((item) => item._id === editingGrade.classworkId)?.points ?? 0})`} type="number" min="0" max={getClassworkSubmission(editingGrade.studentId, editingGrade.classworkId)?.totalPoints ?? gradebookWork.find((item) => item._id === editingGrade.classworkId)?.points ?? 0} value={editingGrade.score} onChange={(event) => setEditingGrade({ ...editingGrade, score: event.target.value })} />}
          <label style={{ display: 'grid', gap: 6, color: '#475569', fontSize: '0.82rem' }}>Feedback<textarea rows={3} value={editingGrade.feedback} onChange={(event) => setEditingGrade({ ...editingGrade, feedback: event.target.value })} style={{ padding: '9px 12px', border: '1px solid #D8DEE8', borderRadius: 8, font: 'inherit', resize: 'vertical' }} /></label>
        </div>}
      </Modal>
    </div>
  );
}