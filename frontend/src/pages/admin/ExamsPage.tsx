import React, { useEffect, useState } from 'react';
import {
  Plus, Search, Edit2, Trash2, ClipboardList, Send, Lock,
  ChevronDown, ChevronUp, X, Check, HelpCircle
} from 'lucide-react';
import {
  Card, Button, Badge, DataTable, Pagination,
  Modal, Input, Select, EmptyState
} from '../../components/ui';
import { examsApi, subjectsApi, classesApi, academicYearsApi } from '../../utils/api';
import type {
  Exam, Subject, Class, AcademicYear,
  Question, Pagination as PaginationType
} from '../../types';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

/* ─────────────── constants ─────────────── */
const EXAM_TYPES = [
  { value: 'quiz',        label: 'Quiz'        },
  { value: 'periodical',  label: 'Periodical'  },
  { value: 'midterm',     label: 'Midterm'     },
  { value: 'finals',      label: 'Finals'      },
  { value: 'assignment',  label: 'Assignment'  },
];
const Q_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_false',      label: 'True / False'    },
  { value: 'short_answer',    label: 'Short Answer'    },
  { value: 'essay',           label: 'Essay'           },
];
const BLANK_EXAM = {
  title: '', description: '', subject: '', class: '',
  academicYear: '', examType: 'quiz', duration: '60',
  passingScore: '75', startDate: '', endDate: '',
};
const BLANK_Q: Question = {
  question: '', type: 'multiple_choice',
  choices: ['', '', '', ''], correctAnswer: '', points: 1,
};

/* ─────────────── Question Builder ─────────────── */
function QuestionBuilder({
  questions, onChange,
}: { questions: Question[]; onChange: (q: Question[]) => void }) {
  const [open, setOpen] = useState<number | null>(null);

  const add = () => {
    const next = [...questions, { ...BLANK_Q, choices: ['', '', '', ''] }];
    onChange(next);
    setOpen(next.length - 1);
  };

  const remove = (i: number) => {
    onChange(questions.filter((_, idx) => idx !== i));
    setOpen(null);
  };

  const update = (i: number, patch: Partial<Question>) => {
    const next = questions.map((q, idx) => idx === i ? { ...q, ...patch } : q);
    onChange(next);
  };

  const updateChoice = (qi: number, ci: number, val: string) => {
    const choices = [...(questions[qi].choices || ['', '', '', ''])];
    choices[ci] = val;
    update(qi, { choices });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Questions ({questions.length})
        </span>
        <Button size="sm" variant="outline" icon={<Plus size={13} />} onClick={add}>
          Add Question
        </Button>
      </div>

      {questions.length === 0 && (
        <div style={{ padding: '28px', textAlign: 'center', background: 'var(--gray-50)', borderRadius: '10px', border: '2px dashed var(--gray-200)' }}>
          <HelpCircle size={28} color="#D1D5DB" style={{ margin: '0 auto 8px' }} />
          <p style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>No questions yet — click "Add Question" to begin</p>
        </div>
      )}

      {questions.map((q, qi) => (
        <div key={qi} style={{ border: '1.5px solid', borderColor: open === qi ? '#8B1A1A' : 'var(--gray-200)', borderRadius: '10px', overflow: 'hidden' }}>
          {/* header row */}
          <div
            onClick={() => setOpen(open === qi ? null : qi)}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: open === qi ? '#FFF5F5' : '#fff', cursor: 'pointer' }}
          >
            <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#8B1A1A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>{qi + 1}</span>
            <span style={{ flex: 1, fontSize: '0.825rem', color: q.question ? 'var(--gray-800)' : 'var(--gray-400)', fontStyle: q.question ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {q.question || 'Untitled question…'}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)', flexShrink: 0 }}>{q.points} pt{q.points !== 1 ? 's' : ''}</span>
            <Badge label={q.type.replace('_', ' ')} color="blue" />
            <button onClick={e => { e.stopPropagation(); remove(qi); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: '2px', display: 'flex', alignItems: 'center' }}><X size={14} /></button>
            {open === qi ? <ChevronUp size={14} color="#9CA3AF" /> : <ChevronDown size={14} color="#9CA3AF" />}
          </div>

          {/* expanded editor */}
          {open === qi && (
            <div style={{ padding: '14px 16px', borderTop: '1px solid var(--gray-100)', display: 'flex', flexDirection: 'column', gap: '12px', background: '#FAFAFA' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '10px', alignItems: 'end' }}>
                <Input label="Question *" placeholder="Enter your question…" value={q.question} onChange={e => update(qi, { question: e.target.value })} />
                <Select label="Type" value={q.type} onChange={e => update(qi, { type: e.target.value as Question['type'], choices: e.target.value === 'multiple_choice' ? ['', '', '', ''] : undefined, correctAnswer: '' })} options={Q_TYPES} style={{ width: '160px' }} />
                <Input label="Points" type="number" min="1" value={q.points} onChange={e => update(qi, { points: parseInt(e.target.value) || 1 })} style={{ width: '80px' }} />
              </div>

              {q.type === 'multiple_choice' && (
                <div>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-600)', marginBottom: '6px' }}>Choices (click ✓ to mark correct)</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(q.choices || ['', '', '', '']).map((ch, ci) => (
                      <div key={ci} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8B1A1A', width: 16, flexShrink: 0 }}>{String.fromCharCode(65 + ci)}</span>
                        <input
                          value={ch}
                          onChange={e => updateChoice(qi, ci, e.target.value)}
                          placeholder={`Choice ${String.fromCharCode(65 + ci)}`}
                          style={{ flex: 1, padding: '7px 10px', border: `1.5px solid ${q.correctAnswer === ch && ch ? '#059669' : 'var(--gray-200)'}`, borderRadius: '7px', fontSize: '0.8rem', outline: 'none', background: q.correctAnswer === ch && ch ? '#F0FDF4' : '#fff', fontFamily: 'var(--font-body)' }}
                          onFocus={e => { e.target.style.borderColor = '#8B1A1A'; }}
                          onBlur={e => { e.target.style.borderColor = q.correctAnswer === e.target.value && e.target.value ? '#059669' : 'var(--gray-200)'; }}
                        />
                        <button
                          onClick={() => update(qi, { correctAnswer: ch })}
                          title="Mark as correct"
                          style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', background: q.correctAnswer === ch && ch ? '#059669' : '#E5E7EB', color: q.correctAnswer === ch && ch ? '#fff' : '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}
                        ><Check size={13} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {q.type === 'true_false' && (
                <div>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-600)', marginBottom: '6px' }}>Correct Answer</p>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {['True', 'False'].map(opt => (
                      <button key={opt} onClick={() => update(qi, { correctAnswer: opt })} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `2px solid ${q.correctAnswer === opt ? '#059669' : 'var(--gray-200)'}`, background: q.correctAnswer === opt ? '#F0FDF4' : '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', color: q.correctAnswer === opt ? '#059669' : 'var(--gray-500)', fontFamily: 'var(--font-body)', transition: 'all 0.15s' }}>{opt}</button>
                    ))}
                  </div>
                </div>
              )}

              {(q.type === 'short_answer') && (
                <Input label="Correct Answer (for auto-grading)" placeholder="Expected answer…" value={q.correctAnswer} onChange={e => update(qi, { correctAnswer: e.target.value })} />
              )}

              {q.type === 'essay' && (
                <div style={{ padding: '10px 12px', background: '#FEF3C7', borderRadius: '8px', border: '1px solid #FDE68A' }}>
                  <p style={{ fontSize: '0.78rem', color: '#92400E' }}>📝 Essay questions require manual grading from the Submissions page.</p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─────────────── Main Page ─────────────── */
export default function AdminExamsPage() {
  const { user } = useAuthStore();
  const [exams, setExams] = useState<Exam[]>([]);
  const [pagination, setPagination] = useState<PaginationType>({ total: 0, page: 1, pages: 1, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const [subjects, setSubjects]         = useState<Subject[]>([]);
  const [classes, setClasses]           = useState<Class[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);

  const [examModal, setExamModal]     = useState(false);
  const [editExam, setEditExam]       = useState<Exam | null>(null);
  const [form, setForm]               = useState(BLANK_EXAM);
  const [questions, setQuestions]     = useState<Question[]>([]);
  const [saving, setSaving]           = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Exam | null>(null);
  const [qTab, setQTab]               = useState<'info' | 'questions'>('info');

  /* load meta */
  useEffect(() => {
    Promise.allSettled([
      subjectsApi.getAll({ limit: 200 }),
      classesApi.getAll({ limit: 200 }),
      academicYearsApi.getAll(),
    ]).then(([sr, cr, ar]) => {
      if (sr.status === 'fulfilled') setSubjects(sr.value.data.subjects || []);
      if (cr.status === 'fulfilled') setClasses(cr.value.data.classes  || []);
      if (ar.status === 'fulfilled') {
        setAcademicYears(ar.value.data);
        const cur = ar.value.data.find((a: AcademicYear) => a.isCurrent);
        if (cur) setForm(f => ({ ...f, academicYear: cur._id }));
      }
    });
  }, []);

  const fetchExams = async () => {
    setLoading(true);
    try {
      const res = await examsApi.getAll({ page, limit: 10, search, status: statusFilter });
      setExams(res.data.exams || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch { toast.error('Failed to load exams'); }
    setLoading(false);
  };
  useEffect(() => { fetchExams(); }, [page, search, statusFilter]);

  /* helpers */
  const subjectOpts   = [{ value: '', label: 'Select Subject…' },  ...subjects.map(s => ({ value: s._id, label: `${s.name} (${s.code})` }))];
  const classOpts     = [{ value: '', label: 'Select Class…' },     ...classes.map(c => ({ value: c._id, label: `${c.name} – ${c.section}` }))];
  const ayOpts        = [{ value: '', label: 'Select Year…' },      ...academicYears.map(a => ({ value: a._id, label: a.name }))];
  const statusOpts    = [{ value: '', label: 'All Status' }, { value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }, { value: 'closed', label: 'Closed' }];

  const openCreate = () => {
    setEditExam(null);
    const cur = academicYears.find(a => a.isCurrent);
    setForm({ ...BLANK_EXAM, academicYear: cur?._id || '' });
    setQuestions([]);
    setQTab('info');
    setExamModal(true);
  };

  const openEdit = async (exam: Exam) => {
    setEditExam(exam);
    try {
      const res = await examsApi.getById(exam._id);
      const e = res.data;
      setForm({
        title: e.title, description: e.description || '',
        subject:      typeof e.subject      === 'object' ? (e.subject as Subject)._id       : e.subject,
        class:        typeof e.class        === 'object' ? (e.class   as Class  )._id       : e.class,
        academicYear: typeof e.academicYear === 'object' ? (e.academicYear as AcademicYear)._id : e.academicYear,
        examType: e.examType, duration: String(e.duration),
        passingScore: String(e.passingScore),
        startDate: e.startDate?.split('T')[0] || '',
        endDate:   e.endDate  ?.split('T')[0] || '',
      });
      setQuestions(e.questions || []);
    } catch { toast.error('Failed to load exam details'); return; }
    setQTab('info');
    setExamModal(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.subject || !form.class || !form.startDate || !form.endDate) {
      toast.error('Fill all required fields'); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        duration: parseInt(form.duration),
        passingScore: parseInt(form.passingScore),
        createdBy: user?._id,
        questions,
      };
      if (editExam) {
        await examsApi.update(editExam._id, payload);
        toast.success('Exam updated');
      } else {
        await examsApi.create(payload);
        toast.success('Exam created');
      }
      setExamModal(false);
      fetchExams();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
    setSaving(false);
  };

  const handlePublish = async (id: string) => {
    try { await examsApi.publish(id); toast.success('Published'); fetchExams(); }
    catch { toast.error('Publish failed'); }
  };
  const handleClose = async (id: string) => {
    try { await examsApi.close(id); toast.success('Closed'); fetchExams(); }
    catch { toast.error('Close failed'); }
  };
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await examsApi.delete(deleteTarget._id); toast.success('Deleted'); setDeleteTarget(null); fetchExams(); }
    catch { toast.error('Delete failed'); }
  };

  /* table columns */
  const columns = [
    {
      key: 'title', label: 'Exam',
      render: (e: Exam) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 36, height: 36, borderRadius: '9px', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ClipboardList size={17} color="#8B1A1A" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--gray-900)' }}>{e.title}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>
              {e.questions?.length ?? 0} questions · {e.totalPoints} pts · {e.duration}min
            </div>
          </div>
        </div>
      )
    },
    { key: 'examType', label: 'Type', render: (e: Exam) => <Badge label={e.examType} color={e.examType === 'finals' ? 'red' : e.examType === 'midterm' ? 'yellow' : 'blue'} /> },
    { key: 'subject',  label: 'Subject',  render: (e: Exam) => <span style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>{typeof e.subject === 'object' ? (e.subject as Subject).name : '—'}</span> },
    { key: 'class',    label: 'Class',    render: (e: Exam) => <span style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>{typeof e.class === 'object' ? `${(e.class as Class).name} – ${(e.class as Class).section}` : '—'}</span> },
    {
      key: 'dates', label: 'Schedule',
      render: (e: Exam) => (
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--gray-700)', fontWeight: 500 }}>{format(new Date(e.startDate), 'MMM d')}</div>
          <div style={{ fontSize: '0.7rem',  color: 'var(--gray-400)' }}>→ {format(new Date(e.endDate), 'MMM d, yyyy')}</div>
        </div>
      )
    },
    { key: 'status', label: 'Status', render: (e: Exam) => <Badge label={e.status} color={e.status === 'published' ? 'green' : e.status === 'draft' ? 'yellow' : 'gray'} /> },
    {
      key: 'actions', label: '',
      render: (e: Exam) => (
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={ev => { ev.stopPropagation(); openEdit(e); }} style={{ padding: '5px 9px', background: '#EFF6FF', border: 'none', borderRadius: '6px', color: '#2563EB', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'var(--font-body)' }}><Edit2 size={11} /> Edit</button>
          {e.status === 'draft'     && <button onClick={ev => { ev.stopPropagation(); handlePublish(e._id); }} style={{ padding: '5px 9px', background: '#D1FAE5', border: 'none', borderRadius: '6px', color: '#059669', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'var(--font-body)' }}><Send size={11} /> Publish</button>}
          {e.status === 'published' && <button onClick={ev => { ev.stopPropagation(); handleClose(e._id); }}   style={{ padding: '5px 9px', background: '#F3F4F6', border: 'none', borderRadius: '6px', color: '#6B7280', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'var(--font-body)' }}><Lock size={11} /> Close</button>}
          <button onClick={ev => { ev.stopPropagation(); setDeleteTarget(e); }} style={{ padding: '5px 9px', background: '#FEE2E2', border: 'none', borderRadius: '6px', color: '#DC2626', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'var(--font-body)' }}><Trash2 size={11} /> Delete</button>
        </div>
      )
    },
  ];

  const totalPts = questions.reduce((s, q) => s + (q.points || 1), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gray-900)', fontFamily: 'var(--font-display)' }}>Exams &amp; Assessments</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginTop: '2px' }}>Create, manage and publish all exams across all classes</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openCreate}>Create Exam</Button>
      </div>

      {/* Filters */}
      <Card padding="14px">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input placeholder="Search exams…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ width: '100%', padding: '9px 14px 9px 36px', border: '1.5px solid var(--gray-200)', borderRadius: '9px', fontSize: '0.875rem', outline: 'none', fontFamily: 'var(--font-body)' }} />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ padding: '9px 14px', border: '1.5px solid var(--gray-200)', borderRadius: '9px', fontSize: '0.875rem', outline: 'none', fontFamily: 'var(--font-body)', background: '#fff', cursor: 'pointer', minWidth: '140px' }}>
            {statusOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <DataTable columns={columns} data={exams} loading={loading} emptyMessage="No exams found" />
        <Pagination {...pagination} onChange={setPage} />
      </Card>

      {/* Create / Edit Modal */}
      <Modal open={examModal} onClose={() => setExamModal(false)} title={editExam ? 'Edit Exam' : 'Create Exam'} width="680px"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setExamModal(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSave} icon={<Check size={14} />}>
              {editExam ? 'Save Changes' : 'Create Exam'}
            </Button>
          </>
        )}
      >
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', marginBottom: '20px', gap: '2px' }}>
          {[
            { key: 'info',      label: 'Exam Info'   },
            { key: 'questions', label: `Questions (${questions.length})${totalPts ? ` · ${totalPts} pts` : ''}` },
          ].map(tab => (
            <button key={tab.key} onClick={() => setQTab(tab.key as 'info' | 'questions')}
              style={{ padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: qTab === tab.key ? 700 : 400, color: qTab === tab.key ? '#8B1A1A' : 'var(--gray-500)', borderBottom: `2px solid ${qTab === tab.key ? '#8B1A1A' : 'transparent'}`, marginBottom: '-1px', transition: 'all 0.15s' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {qTab === 'info' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Input label="Exam Title *" placeholder="e.g. Q1 Science Quiz" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <Input label="Description" placeholder="Optional brief description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Select label="Subject *"       value={form.subject}       onChange={e => setForm({ ...form, subject: e.target.value })}       options={subjectOpts} />
              <Select label="Class *"         value={form.class}         onChange={e => setForm({ ...form, class: e.target.value })}         options={classOpts} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Select label="Exam Type *"     value={form.examType}      onChange={e => setForm({ ...form, examType: e.target.value })}      options={EXAM_TYPES} />
              <Select label="Academic Year *" value={form.academicYear}  onChange={e => setForm({ ...form, academicYear: e.target.value })}  options={ayOpts} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input label="Duration (minutes)" type="number" value={form.duration}     onChange={e => setForm({ ...form, duration: e.target.value })} />
              <Input label="Passing Score (%)"  type="number" value={form.passingScore} onChange={e => setForm({ ...form, passingScore: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input label="Start Date *" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
              <Input label="End Date *"   type="date" value={form.endDate}   onChange={e => setForm({ ...form, endDate:   e.target.value })} />
            </div>
          </div>
        )}

        {qTab === 'questions' && (
          <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '4px' }}>
            <QuestionBuilder questions={questions} onChange={setQuestions} />
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirm Delete" width="400px"
        footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="danger" onClick={handleDelete}>Delete</Button></>}
      >
        <p style={{ color: 'var(--gray-600)', lineHeight: 1.6 }}>
          Delete <strong>{deleteTarget?.title}</strong>? All submissions will also be removed.
        </p>
      </Modal>
    </div>
  );
}
