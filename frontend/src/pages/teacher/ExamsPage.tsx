import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Edit2, Trash2, ClipboardList, Eye, Send, Lock, ArrowLeft, ArrowRight, Users } from 'lucide-react';
import { Card, Button, Badge, DataTable, Pagination, Modal, Input, Select, EmptyState } from '../../components/ui';
import { examsApi, subjectsApi, classesApi, academicYearsApi, submissionsApi } from '../../utils/api';
import type { Exam, Subject, Class, AcademicYear, Pagination as PaginationType, Question } from '../../types';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import QuestionBuilder from '../../components/QuestionBuilder';
import { getExamValidationErrors, hasExamValidationErrors } from '../../utils/examValidation';
import { useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

const EXAM_TYPES = [
  { value: 'prelim', label: 'Prelim Exam' },
  { value: 'midterm', label: 'Midterm Exam' },
  { value: 'summative', label: 'Summative Exam' },
  { value: 'final', label: 'Final Exam' },
  { value: 'periodical', label: 'Periodical' },
  { value: 'midterm', label: 'Midterm' },
  { value: 'finals', label: 'Finals' },
  { value: 'formative', label: 'Formative Assessment' },
];

const INITIAL_FORM = {
  title: '', description: '', subject: '', class: '', academicYear: '',
  examType: 'prelim', duration: '60', passingScore: '75',
  startDate: '', startTime: '08:00', endDate: '', endTime: '17:00', status: 'draft', randomizeQuestions: false,
};

const examTypeLabel = (examType: string) => ({
  prelim: 'Prelim Exam', periodical: 'Periodical Exam', midterm: 'Midterm Exam',
  summative: 'Summative Exam', final: 'Final Exam', finals: 'Final Exam',
  quiz: 'Quiz', assignment: 'Assignment', formative: 'Formative Assessment',
} as Record<string, string>)[examType] || 'Exam';
const examStatusLabel = (status: Exam['status']) => status === 'pending_approval' ? 'Pending Admin Approval' : status.charAt(0).toUpperCase() + status.slice(1);

const toDateInputValue = (value?: string | Date | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatSafeDate = (value?: string | Date | null, pattern = 'MMM d') => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, pattern);
};

const toTimeInputValue = (value?: string | Date | null, fallback = '') => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toTimeString().slice(0, 5);
};

const toLocalDateTime = (date: string, time: string) => new Date(`${date}T${time}`).toISOString();

export default function ExamsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [exams, setExams] = useState<Exam[]>([]);
  const [submissionCounts, setSubmissionCounts] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState<PaginationType>({ total: 0, page: 1, pages: 1, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Exam | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qTab, setQTab] = useState<'info' | 'questions' | 'settings' | 'preview'>('info');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Exam | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const validationErrors = useMemo(() => {
    const step = qTab === 'info' ? 'overview' : qTab === 'questions' ? 'questions' : qTab === 'settings' ? 'settings' : 'publish';
    return getExamValidationErrors({ form, questions, stage: step });
  }, [form, questions, qTab]);
  const hasValidation = hasExamValidationErrors(validationErrors);
  const readOnlyExam = Boolean(editItem && editItem.status !== 'draft');

  useEffect(() => {
    const loadMeta = async () => {
      const [subjRes, classRes, ayRes] = await Promise.allSettled([
        subjectsApi.getAll({ limit: 100 }),
        classesApi.getAll({ limit: 100 }),
        academicYearsApi.getAll(),
      ]);
      const loadedSubjects = subjRes.status === 'fulfilled' ? (subjRes.value.data.subjects || []) : [];
      setSubjects(loadedSubjects);

      if (classRes.status === 'fulfilled') {
        const allClasses = classRes.value.data.classes || [];
        const teacherSubjectIds = loadedSubjects
          .filter((subject: Subject) => {
            const teacherId = typeof subject.teacher === 'object' ? (subject.teacher as any)?._id : subject.teacher;
            return teacherId === user?._id;
          })
          .map((subject: Subject) => subject._id);

        const teacherClasses = allClasses.filter((cls: Class) => {
          const adviserId = typeof cls.adviser === 'object' ? (cls.adviser as any)?._id : cls.adviser;
          if (adviserId === user?._id) return true;

          const classSubjectIds = (((cls as any)?.subjects || []) as Array<Subject | string>).map((subject: Subject | string) =>
            typeof subject === 'object' ? (subject as Subject)._id : subject
          );

          return classSubjectIds.some((subjectId) => teacherSubjectIds.includes(subjectId));
        });

        setClasses(teacherClasses);
      }
      if (ayRes.status === 'fulfilled') {
        setAcademicYears(ayRes.value.data);
        const current = ayRes.value.data.find((ay: AcademicYear) => ay.isCurrent);
        if (current) setForm(f => ({ ...f, academicYear: current._id }));
      }
    };
    loadMeta();
  }, [user?._id]);

  const fetchExams = async () => {
    setLoading(true);
    const [examResult, submissionResult] = await Promise.allSettled([
      examsApi.getAll({ page, limit: 10, search, status: statusFilter }),
      submissionsApi.getAll(),
    ]);
    if (examResult.status === 'fulfilled') {
      const res = examResult.value;
      setExams(res.data.exams || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } else {
      toast.error('Failed to load exams');
    }
    if (submissionResult.status === 'fulfilled') {
      const counts: Record<string, number> = {};
      for (const submission of submissionResult.value.data.submissions || []) {
        const examId = typeof submission.exam === 'object' ? submission.exam?._id : submission.exam;
        if (examId) counts[examId] = (counts[examId] || 0) + 1;
      }
      setSubmissionCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => { fetchExams(); }, [page, search, statusFilter]);
  useEffect(() => {
    const launch = location.state as { openCreateExam?: boolean; examType?: string; classId?: string; subjectId?: string } | null;
    if (!launch?.openCreateExam) return;
    setEditItem(null);
    setForm({ ...INITIAL_FORM, examType: launch.examType || 'quiz', class: launch.classId || '', subject: launch.subjectId || '' });
    setQuestions([]);
    setQTab('info');
    setModalOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.key, location.pathname, location.state, navigate]);
  useEffect(() => {
    const socket = io(import.meta.env.VITE_REALTIME_URL || window.location.origin, { withCredentials: true, transports: ['websocket', 'polling'] });
    const refresh = () => { void fetchExams(); };
    socket.on('academic:update', refresh);
    return () => { socket.off('academic:update', refresh); socket.disconnect(); };
  }, [page, search, statusFilter]);

  const selectedClass = classes.find((c) => c._id === form.class) as Class | undefined;
  const selectedClassSubjects = ((selectedClass as any)?.subjects || []) as Array<Subject | string>;
  const classSubjectIds = selectedClassSubjects.map((subject: Subject | string) => typeof subject === 'object' ? subject._id : subject);
  const teacherSubjectIds = subjects
    .filter((subject) => {
      const teacherId = typeof subject.teacher === 'object' ? (subject.teacher as any)?._id : subject.teacher;
      return teacherId === user?._id;
    })
    .map((subject) => subject._id);
  const allowedSubjectIds = classSubjectIds.length ? classSubjectIds : teacherSubjectIds;
  const availableSubjects = subjects.filter((subject) => {
    if (!form.class) return false;
    return allowedSubjectIds.includes(subject._id);
  });
  const getClassDisplay = (cls?: Partial<Class> | null) => cls?.section || cls?.name || 'Class';
  const subjectOptions = [
    {
      value: '',
      label: !form.class
        ? 'Select a class first'
        : availableSubjects.length
          ? 'Select Subject'
          : teacherSubjectIds.length
            ? 'No subjects assigned to this class. Choose one of your assigned subjects.'
            : 'No subjects assigned to this class or your account.',
    },
    ...availableSubjects.map((subject) => ({ value: subject._id, label: `${subject.name} (${subject.code})` })),
  ];
  const classOptions = [{ value: '', label: 'Select Class / Section' }, ...classes.map(c => ({ value: c._id, label: `${getClassDisplay(c)}${c.gradeLevel ? ` (${c.gradeLevel})` : ''}` }))];
  const ayOptions = [{ value: '', label: 'Select Year' }, ...academicYears.map(ay => ({ value: ay._id, label: ay.name }))];
  const statusOptions = [{ value: '', label: 'All Status' }, { value: 'draft', label: 'Draft' }, { value: 'pending_approval', label: 'Pending Admin Approval' }, { value: 'published', label: 'Published' }, { value: 'closed', label: 'Closed' }];

  const handleClassChange = (nextClassId: string) => {
    const nextClass = classes.find((c) => c._id === nextClassId) as Class | undefined;
    const nextClassSubjects = ((nextClass as any)?.subjects || []) as Array<Subject | string>;
    const classLinkedSubject = nextClassSubjects.length
      ? (typeof nextClassSubjects[0] === 'object' ? (nextClassSubjects[0] as Subject)._id : nextClassSubjects[0])
      : '';
    const fallbackTeacherSubject = teacherSubjectIds[0] || '';
    setForm((prev) => ({
      ...prev,
      class: nextClassId,
      subject: classLinkedSubject || fallbackTeacherSubject || prev.subject,
    }));
  };

  const openCreate = () => { setEditItem(null); setForm(INITIAL_FORM); setQuestions([]); setQTab('info'); setModalOpen(true); };

  const openEdit = (exam: Exam) => {
    setEditItem(exam);
    setForm({
      title: exam.title, description: exam.description || '',
      subject: typeof exam.subject === 'object' ? (exam.subject as Subject)._id : exam.subject,
      class: typeof exam.class === 'object' ? (exam.class as Class)._id : exam.class,
      academicYear: typeof exam.academicYear === 'object' ? (exam.academicYear as AcademicYear)._id : exam.academicYear,
      examType: exam.examType, duration: String(exam.duration ?? 60),
      passingScore: String(exam.passingScore ?? 75),
      startDate: toDateInputValue(exam.startDate),
      startTime: toTimeInputValue(exam.startDate, '08:00'),
      endDate: toDateInputValue(exam.endDate),
      endTime: toTimeInputValue(exam.endDate, '17:00'),
      status: exam.status,
      randomizeQuestions: Boolean(exam.randomizeQuestions),
    });
    setQuestions(exam.questions || []);
    setQTab('info');
    setModalOpen(true);
  };

  const validateExamInfo = (stage: 'overview' | 'questions' | 'settings' | 'publish' = 'overview') => {
    const nextErrors = getExamValidationErrors({ form, questions, stage });
    if (hasExamValidationErrors(nextErrors)) {
      const missingList = Object.values(nextErrors).slice(0, 3).join(' ');
      toast.error(missingList || 'Required exam information.');
      return false;
    }

    if (stage === 'settings' || stage === 'publish') {
      if (form.startDate && form.startTime && form.endDate && form.endTime && new Date(`${form.endDate}T${form.endTime}`) < new Date(`${form.startDate}T${form.startTime}`)) {
        toast.error('End date must be on or after the start date.');
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateExamInfo('publish')) {
      setQTab('settings');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, startDate: toLocalDateTime(form.startDate, form.startTime), endDate: toLocalDateTime(form.endDate, form.endTime), duration: parseInt(form.duration), passingScore: parseInt(form.passingScore), questions, createdBy: user?._id };
      if (editItem) {
        await examsApi.update(editItem._id, payload);
        toast.success('Exam draft updated.');
      } else {
        await examsApi.create(payload);
        toast.success('Exam saved as draft.');
      }
      setModalOpen(false);
      fetchExams();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const continueToQuestions = () => {
    if (validateExamInfo('overview')) setQTab('questions');
  };

  const continueToSettings = () => {
    if (!validateExamInfo('questions')) {
      setQTab('questions');
      return;
    }
    setQTab('settings');
  };

  const continueToPreview = () => {
    if (validateExamInfo('settings')) setQTab('preview');
  };

  const wizardSteps = [
    { key: 'info', label: 'Overview' },
    { key: 'questions', label: 'Questions' },
    { key: 'settings', label: 'Schedule' },
    { key: 'preview', label: 'Review' },
  ] as const;

  const handleRequestApproval = async (exam: Exam) => {
    try {
      await examsApi.requestApproval(exam._id);
      toast.success(`${examTypeLabel(exam.examType)} submitted for Admin approval.`);
      fetchExams();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Unable to request exam approval.');
    }
  };

  const handleClose = async (id: string) => {
    try {
      await examsApi.close(id);
      toast.success('Exam closed');
      fetchExams();
    } catch { toast.error('Failed to close exam'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await examsApi.delete(deleteTarget._id);
      toast.success('Exam deleted');
      setDeleteTarget(null);
      fetchExams();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const columns = [
    {
      key: 'title', label: 'Exam', render: (e: Exam) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 36, height: 36, borderRadius: '9px', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ClipboardList size={17} color="#8B1A1A" />
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--gray-900)', fontSize: '0.875rem' }}>{e.title}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>
              {e.questions?.length || 0} questions · {e.totalPoints} pts · {e.duration}min
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'examType', label: 'Type', render: (e: Exam) => (
        <Badge label={examTypeLabel(e.examType)} color={e.examType === 'final' || e.examType === 'finals' ? 'red' : e.examType === 'midterm' ? 'yellow' : 'blue'} />
      )
    },
    {
      key: 'subject', label: 'Subject', render: (e: Exam) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>
          {typeof e.subject === 'object' ? (e.subject as Subject).name : '—'}
        </span>
      )
    },
    {
      key: 'gradeLevel', label: 'Year Level', render: (e: Exam) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>
          {typeof e.class === 'object' ? (e.class as Class).gradeLevel : '—'}
        </span>
      )
    },
    {
      key: 'dates', label: 'Schedule', render: (e: Exam) => (
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--gray-600)' }}>{formatSafeDate(e.startDate, 'MMM d')}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>→ {formatSafeDate(e.endDate, 'MMM d, yyyy')}</div>
        </div>
      )
    },
    {
      key: 'status', label: 'Status', render: (e: Exam) => (
        <Badge label={examStatusLabel(e.status)} color={e.status === 'published' ? 'green' : e.status === 'draft' ? 'yellow' : e.status === 'pending_approval' ? 'blue' : 'gray'} />
      )
    },
    {
      key: 'submissions', label: 'Answered', render: (e: Exam) => {
        const count = submissionCounts[e._id] || 0;
        return count > 0 ? (
          <button
            onClick={(event) => { event.stopPropagation(); navigate(`/teacher/submissions?exam=${encodeURIComponent(e._id)}`); }}
            title="View students who answered"
            style={{ padding: '5px 9px', background: '#EFF6FF', border: 'none', borderRadius: '6px', color: '#2563EB', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-body)' }}
          >
            <Users size={12} /> {count}
          </button>
        ) : <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>0</span>;
      }
    },
    {
      key: 'actions', label: '', render: (e: Exam) => (
        <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={(ev) => { ev.stopPropagation(); openEdit(e); }} style={{ padding: '5px 9px', background: '#EFF6FF', border: 'none', borderRadius: '6px', color: '#2563EB', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'var(--font-body)' }}>
            <Edit2 size={11} /> {e.status === 'draft' ? 'Edit' : 'View'}
          </button>
          {e.status === 'draft' && (
            <button onClick={(ev) => { ev.stopPropagation(); handleRequestApproval(e); }} style={{ padding: '5px 9px', background: '#DBEAFE', border: 'none', borderRadius: '6px', color: '#1D4ED8', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'var(--font-body)' }}>
              <Send size={11} /> Request Approval
            </button>
          )}
          {e.status === 'published' && (
            <button onClick={(ev) => { ev.stopPropagation(); handleClose(e._id); }} style={{ padding: '5px 9px', background: '#F3F4F6', border: 'none', borderRadius: '6px', color: '#6B7280', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'var(--font-body)' }}>
              <Lock size={11} /> Close
            </button>
          )}
          {e.status === 'draft' && <button onClick={(ev) => { ev.stopPropagation(); setDeleteTarget(e); }} style={{ padding: '5px 9px', background: '#FEE2E2', border: 'none', borderRadius: '6px', color: '#DC2626', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'var(--font-body)' }}>
            <Trash2 size={11} /> Delete
          </button>}
        </div>
      )
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gray-900)', fontFamily: 'var(--font-display)' }}>Exams & Quizzes</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginTop: '2px' }}>Create and manage assessments for your classes</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openCreate}>Create Exam</Button>
      </div>

      <Card padding="16px">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input placeholder="Search exams..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ width: '100%', padding: '9px 14px 9px 36px', border: '1.5px solid var(--gray-200)', borderRadius: '9px', fontSize: '0.875rem', outline: 'none', fontFamily: 'var(--font-body)' }} />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ padding: '9px 14px', border: '1.5px solid var(--gray-200)', borderRadius: '9px', fontSize: '0.875rem', outline: 'none', fontFamily: 'var(--font-body)', background: '#fff', cursor: 'pointer' }}>
            {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </Card>

      <Card>
        <DataTable columns={columns} data={exams} loading={loading} emptyMessage="No exams found" />
        <Pagination {...pagination} onChange={setPage} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={readOnlyExam ? `View ${examTypeLabel(editItem!.examType)}` : editItem ? 'Edit Exam' : `Create ${examTypeLabel(form.examType)}`} width="600px"
        footer={readOnlyExam ? <><Button variant="secondary" onClick={() => setModalOpen(false)}>Close</Button>{qTab !== 'info' && <Button variant="outline" onClick={() => setQTab(qTab === 'preview' ? 'settings' : qTab === 'settings' ? 'questions' : 'info')} icon={<ArrowLeft size={14} />}>Back</Button>}{qTab !== 'preview' && <Button onClick={() => setQTab(qTab === 'info' ? 'questions' : qTab === 'questions' ? 'settings' : 'preview')} icon={<ArrowRight size={14} />}>Continue</Button>}</> : qTab === 'info'
          ? <><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={continueToQuestions} icon={<ArrowRight size={14} />}>Continue to questions</Button></>
          : qTab === 'questions'
            ? <><Button variant="secondary" onClick={() => setQTab('info')} icon={<ArrowLeft size={14} />}>Back</Button><Button onClick={continueToSettings}>Continue to settings</Button></>
            : qTab === 'settings'
              ? <><Button variant="secondary" onClick={() => setQTab('questions')} icon={<ArrowLeft size={14} />}>Back</Button><Button onClick={continueToPreview}>Preview exam</Button></>
              : <><Button variant="secondary" onClick={() => setQTab('settings')} icon={<ArrowLeft size={14} />}>Back</Button><Button loading={saving} onClick={handleSave}>{editItem ? 'Save changes' : 'Save draft'}</Button></>}
      >
        {readOnlyExam && <p style={{ margin: '0 0 12px', padding: '9px 12px', borderRadius: 8, background: editItem?.status === 'pending_approval' ? '#EFF6FF' : '#F0FDF4', color: editItem?.status === 'pending_approval' ? '#1D4ED8' : '#166534', fontSize: '0.8rem', fontWeight: 600 }}>{examStatusLabel(editItem!.status)}</p>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--gray-200)', marginBottom: 18, paddingBottom: 10 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', flex: 1, alignItems: 'center' }}>
            {wizardSteps.map((step) => (
              <div
                key={step.key}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderBottom: `2px solid ${qTab === step.key ? '#8B1A1A' : 'transparent'}`,
                  color: qTab === step.key ? '#8B1A1A' : '#64748B',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  textAlign: 'center',
                }}
              >
                {step.label}
              </div>
            ))}
          </div>
        </div>
        {qTab === 'info' && <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#F8FAFC', border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '14px 16px' }}>
            <Input label="Exam Title *" placeholder="e.g. Q1 Science Quiz" value={form.title} error={validationErrors.title} disabled={readOnlyExam} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div style={{ background: '#F8FAFC', border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '14px 16px' }}>
            <Input label="Description" placeholder="Optional description or instructions" value={form.description} disabled={readOnlyExam} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ background: '#F8FAFC', border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '14px 16px' }}>
              <Select label="Class / Section *" value={form.class} error={validationErrors.class} disabled={readOnlyExam} onChange={(e) => handleClassChange(e.target.value)} options={classOptions} />
            </div>
            <div style={{ background: '#F8FAFC', border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '14px 16px' }}>
              <Select label="Subject *" value={form.subject} error={validationErrors.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} options={subjectOptions} disabled={readOnlyExam || !form.class || !subjectOptions.some((s) => s.value && s.value !== '')} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ background: '#F8FAFC', border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '14px 16px' }}>
              <Select label="Exam Type" value={form.examType} disabled={readOnlyExam} onChange={(e) => setForm({ ...form, examType: e.target.value })} options={EXAM_TYPES} />
            </div>
            <div style={{ background: '#F8FAFC', border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '14px 16px' }}>
              <Select label="Academic Year *" value={form.academicYear} error={validationErrors.academicYear} disabled={readOnlyExam} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} options={ayOptions} />
            </div>
          </div>
        </div>}
        {qTab === 'questions' && <div style={{ maxHeight: 500, overflowY: 'auto' }}>
          {validationErrors.questions && <div style={{ marginBottom: 12, background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 10px', fontSize: '0.75rem' }}>{validationErrors.questions}</div>}
          <QuestionBuilder questions={questions} validationErrors={validationErrors} onChange={setQuestions} readOnly={editItem?.status !== 'draft' && !!editItem} />
        </div>}
        {qTab === 'settings' && <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input label="Duration (minutes) *" type="number" value={form.duration} error={validationErrors.duration} disabled={readOnlyExam} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
            <Input label="Passing Score (%) *" type="number" min="0" max="100" value={form.passingScore} error={validationErrors.passingScore} disabled={readOnlyExam} onChange={(e) => setForm({ ...form, passingScore: e.target.value })} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, background: '#F8FAFC', border: '1px solid var(--gray-200)', color: 'var(--gray-700)', fontSize: '0.85rem', fontWeight: 600 }}>
            <input type="checkbox" checked={form.randomizeQuestions} disabled={readOnlyExam} onChange={(e) => setForm({ ...form, randomizeQuestions: e.target.checked })} />
            Randomize Questions
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input label="Start Date *" type="date" value={form.startDate} error={validationErrors.startDate} disabled={readOnlyExam} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="Start Time *" type="time" value={form.startTime} error={validationErrors.startTime} disabled={readOnlyExam} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            <Input label="End Date *" type="date" value={form.endDate} error={validationErrors.endDate || validationErrors.dateRange} disabled={readOnlyExam} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            <Input label="End Time *" type="time" value={form.endTime} error={validationErrors.endTime || validationErrors.dateRange} disabled={readOnlyExam} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: '#F8FAFC', border: '1px solid var(--gray-200)' }}>
            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-700)' }}>Exam rules</p>
            <ul style={{ margin: '8px 0 0 18px', padding: 0, color: 'var(--gray-600)', fontSize: '0.76rem', lineHeight: 1.8 }}>
              <li>Students can only access the exam after the scheduled availability.</li>
              <li>Time limit and passing score remain enforced in the LMS.</li>
              <li>Draft exams remain editable until the teacher requests Admin approval.</li>
              <li>An Admin must approve an exam before students can access it.</li>
            </ul>
          </div>
        </div>}
        {qTab === 'preview' && <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ background: '#F8FAFC', border: '1px solid var(--gray-200)', borderRadius: 12, padding: '14px 16px' }}>
            <p style={{ margin: 0, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8B1A1A', fontWeight: 700 }}>Preview</p>
            <h3 style={{ margin: '8px 0 6px', fontSize: '1.25rem', fontWeight: 700 }}>{form.title || 'Untitled exam'}</h3>
            <p style={{ margin: 0, color: 'var(--gray-600)', fontSize: '0.8rem' }}>{form.description || 'No instructions provided.'}</p>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {questions.length === 0 ? <EmptyState title="No questions yet" description="Add at least one question before previewing." /> : questions.map((question, index) => (
              <div key={`${index}-${question.question}`} style={{ border: '1px solid var(--gray-200)', borderRadius: 10, background: '#fff', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--gray-700)' }}>Question {index + 1}</strong>
                  <Badge label={`${question.points} pts`} color="blue" />
                </div>
                <p style={{ margin: '0 0 10px', fontSize: '0.9rem', lineHeight: 1.5 }}>{question.question || 'Untitled question'}</p>
                {question.type === 'multiple_choice' && <div style={{ display: 'grid', gap: 8 }}>
                  {(question.choices || []).map((choice, choiceIndex) => (
                    <div key={choiceIndex} style={{ padding: '8px 10px', border: '1px solid var(--gray-200)', borderRadius: 8, background: '#FAFAFA', fontSize: '0.8rem' }}>{String.fromCharCode(65 + choiceIndex)}. {choice || 'Empty option'}</div>
                  ))}
                </div>}
                {question.type === 'true_false' && <div style={{ display: 'flex', gap: 8 }}><div style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--gray-200)' }}>True</div><div style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--gray-200)' }}>False</div></div>}
                {question.type === 'short_answer' && <div style={{ padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, background: '#FAFAFA', color: 'var(--gray-400)' }}>Short answer response</div>}
                {question.type === 'essay' && <div style={{ padding: '12px', border: '1px solid var(--gray-200)', borderRadius: 8, background: '#FAFAFA', color: 'var(--gray-400)' }}>Essay response</div>}
              </div>
            ))}
          </div>
        </div>}
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirm Delete" width="400px"
        footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="danger" onClick={handleDelete}>Delete</Button></>}
      >
        <p style={{ color: 'var(--gray-600)', lineHeight: 1.6 }}>Delete exam <strong>{deleteTarget?.title}</strong>? All submissions will also be deleted.</p>
      </Modal>
    </div>
  );
}
