import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, ClipboardList, Eye, Send, Lock } from 'lucide-react';
import { Card, Button, Badge, DataTable, Pagination, Modal, Input, Select, EmptyState } from '../../components/ui';
import { examsApi, subjectsApi, classesApi, academicYearsApi } from '../../utils/api';
import type { Exam, Subject, Class, AcademicYear, Pagination as PaginationType } from '../../types';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const EXAM_TYPES = [
  { value: 'quiz', label: 'Quiz' },
  { value: 'periodical', label: 'Periodical' },
  { value: 'midterm', label: 'Midterm' },
  { value: 'finals', label: 'Finals' },
  { value: 'assignment', label: 'Assignment' },
];

const INITIAL_FORM = {
  title: '', description: '', subject: '', class: '', academicYear: '',
  examType: 'quiz', duration: '60', passingScore: '75',
  startDate: '', endDate: '', status: 'draft',
};

export default function ExamsPage() {
  const { user } = useAuthStore();
  const [exams, setExams] = useState<Exam[]>([]);
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
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Exam | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const loadMeta = async () => {
      const [subjRes, classRes, ayRes] = await Promise.allSettled([
        subjectsApi.getAll({ limit: 100 }),
        classesApi.getAll({ limit: 100 }),
        academicYearsApi.getAll(),
      ]);
      if (subjRes.status === 'fulfilled') setSubjects(subjRes.value.data.subjects || []);
      if (classRes.status === 'fulfilled') setClasses(classRes.value.data.classes || []);
      if (ayRes.status === 'fulfilled') {
        setAcademicYears(ayRes.value.data);
        const current = ayRes.value.data.find((ay: AcademicYear) => ay.isCurrent);
        if (current) setForm(f => ({ ...f, academicYear: current._id }));
      }
    };
    loadMeta();
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

  const subjectOptions = [{ value: '', label: 'Select Subject' }, ...subjects.map(s => ({ value: s._id, label: `${s.name} (${s.code})` }))];
  const classOptions = [{ value: '', label: 'Select Class' }, ...classes.map(c => ({ value: c._id, label: `${c.name} - ${c.section}` }))];
  const ayOptions = [{ value: '', label: 'Select Year' }, ...academicYears.map(ay => ({ value: ay._id, label: ay.name }))];
  const statusOptions = [{ value: '', label: 'All Status' }, { value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }, { value: 'closed', label: 'Closed' }];

  const openCreate = () => { setEditItem(null); setForm(INITIAL_FORM); setModalOpen(true); };

  const openEdit = (exam: Exam) => {
    setEditItem(exam);
    setForm({
      title: exam.title, description: exam.description || '',
      subject: typeof exam.subject === 'object' ? (exam.subject as Subject)._id : exam.subject,
      class: typeof exam.class === 'object' ? (exam.class as Class)._id : exam.class,
      academicYear: typeof exam.academicYear === 'object' ? (exam.academicYear as AcademicYear)._id : exam.academicYear,
      examType: exam.examType, duration: String(exam.duration),
      passingScore: String(exam.passingScore),
      startDate: exam.startDate.split('T')[0],
      endDate: exam.endDate.split('T')[0],
      status: exam.status,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.subject || !form.class || !form.startDate || !form.endDate) {
      toast.error('Please fill all required fields');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, duration: parseInt(form.duration), passingScore: parseInt(form.passingScore), createdBy: user?._id };
      if (editItem) {
        await examsApi.update(editItem._id, payload);
        toast.success('Exam updated');
      } else {
        await examsApi.create(payload);
        toast.success('Exam created');
      }
      setModalOpen(false);
      fetchExams();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    }
    setSaving(false);
  };

  const handlePublish = async (id: string) => {
    try {
      await examsApi.publish(id);
      toast.success('Exam published');
      fetchExams();
    } catch { toast.error('Failed to publish exam'); }
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
    } catch { toast.error('Delete failed'); }
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
        <Badge label={e.examType} color={e.examType === 'finals' ? 'red' : e.examType === 'midterm' ? 'yellow' : 'blue'} />
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
      key: 'dates', label: 'Schedule', render: (e: Exam) => (
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--gray-600)' }}>{format(new Date(e.startDate), 'MMM d')}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>→ {format(new Date(e.endDate), 'MMM d, yyyy')}</div>
        </div>
      )
    },
    {
      key: 'status', label: 'Status', render: (e: Exam) => (
        <Badge label={e.status} color={e.status === 'published' ? 'green' : e.status === 'draft' ? 'yellow' : 'gray'} />
      )
    },
    {
      key: 'actions', label: '', render: (e: Exam) => (
        <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={(ev) => { ev.stopPropagation(); openEdit(e); }} style={{ padding: '5px 9px', background: '#EFF6FF', border: 'none', borderRadius: '6px', color: '#2563EB', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'var(--font-body)' }}>
            <Edit2 size={11} /> Edit
          </button>
          {e.status === 'draft' && (
            <button onClick={(ev) => { ev.stopPropagation(); handlePublish(e._id); }} style={{ padding: '5px 9px', background: '#D1FAE5', border: 'none', borderRadius: '6px', color: '#059669', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'var(--font-body)' }}>
              <Send size={11} /> Publish
            </button>
          )}
          {e.status === 'published' && (
            <button onClick={(ev) => { ev.stopPropagation(); handleClose(e._id); }} style={{ padding: '5px 9px', background: '#F3F4F6', border: 'none', borderRadius: '6px', color: '#6B7280', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'var(--font-body)' }}>
              <Lock size={11} /> Close
            </button>
          )}
          <button onClick={(ev) => { ev.stopPropagation(); setDeleteTarget(e); }} style={{ padding: '5px 9px', background: '#FEE2E2', border: 'none', borderRadius: '6px', color: '#DC2626', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'var(--font-body)' }}>
            <Trash2 size={11} /> Delete
          </button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Exam' : 'Create Exam'} width="600px"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleSave}>{editItem ? 'Save' : 'Create'}</Button></>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Input label="Exam Title *" placeholder="e.g. Q1 Science Quiz" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input label="Description" placeholder="Optional description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Select label="Subject *" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} options={subjectOptions} />
            <Select label="Class *" value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} options={classOptions} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Select label="Exam Type *" value={form.examType} onChange={(e) => setForm({ ...form, examType: e.target.value })} options={EXAM_TYPES} />
            <Select label="Academic Year *" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} options={ayOptions} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input label="Duration (minutes)" type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
            <Input label="Passing Score (%)" type="number" min="0" max="100" value={form.passingScore} onChange={(e) => setForm({ ...form, passingScore: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input label="Start Date *" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="End Date *" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
          <div style={{ padding: '12px', background: '#FEF3C7', borderRadius: '10px', border: '1px solid #FDE68A' }}>
            <p style={{ fontSize: '0.78rem', color: '#92400E', margin: 0 }}>
              💡 After creating the exam, you can add questions from the exam detail view. Use the AI Assistant to help generate questions!
            </p>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirm Delete" width="400px"
        footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="danger" onClick={handleDelete}>Delete</Button></>}
      >
        <p style={{ color: 'var(--gray-600)', lineHeight: 1.6 }}>Delete exam <strong>{deleteTarget?.title}</strong>? All submissions will also be deleted.</p>
      </Modal>
    </div>
  );
}
