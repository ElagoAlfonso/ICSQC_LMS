import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, BookOpen } from 'lucide-react';
import { Card, Button, Badge, DataTable, Pagination, Modal, Input, Select, EmptyState } from '../../components/ui';
import { subjectsApi, academicYearsApi, usersApi } from '../../utils/api';
import type { Subject, AcademicYear, User, Pagination as PaginationType } from '../../types';
import toast from 'react-hot-toast';

const GRADE_LEVELS = ['Kinder','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'].map(g => ({ value: g, label: g }));
const INITIAL_FORM = { name: '', code: '', description: '', teacher: '', gradeLevel: 'Grade 7', academicYear: '', units: '1', isActive: true };

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [pagination, setPagination] = useState<PaginationType>({ total: 0, page: 1, pages: 1, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Subject | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [ayFilter, setAyFilter] = useState('');

  useEffect(() => {
    const loadMeta = async () => {
      const [ayRes, teachersRes] = await Promise.allSettled([
        academicYearsApi.getAll(),
        usersApi.getAll({ role: 'teacher', limit: 100 }),
      ]);
      if (ayRes.status === 'fulfilled') {
        setAcademicYears(ayRes.value.data);
        const current = ayRes.value.data.find((ay: AcademicYear) => ay.isCurrent);
        if (current) { setAyFilter(current._id); setForm(f => ({ ...f, academicYear: current._id })); }
      }
      if (teachersRes.status === 'fulfilled') setTeachers(teachersRes.value.data.users);
    };
    loadMeta();
  }, []);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const res = await subjectsApi.getAll({ page, limit: 10, search, academicYear: ayFilter });
      setSubjects(res.data.subjects);
      setPagination(res.data.pagination);
    } catch { toast.error('Failed to load subjects'); }
    setLoading(false);
  };

  useEffect(() => { fetchSubjects(); }, [page, search, ayFilter]);

  const ayOptions = [{ value: '', label: 'All Years' }, ...academicYears.map(ay => ({ value: ay._id, label: ay.name }))];
  const teacherOptions = [{ value: '', label: 'Unassigned' }, ...teachers.map(t => ({ value: t._id, label: t.name }))];

  const openCreate = () => {
    setEditItem(null);
    const currentAy = academicYears.find(ay => ay.isCurrent);
    setForm({ ...INITIAL_FORM, academicYear: currentAy?._id || '' });
    setModalOpen(true);
  };

  const openEdit = (s: Subject) => {
    setEditItem(s);
    setForm({
      name: s.name, code: s.code, description: s.description || '',
      teacher: s.teacher ? (typeof s.teacher === 'object' ? (s.teacher as User)._id : s.teacher) : '',
      gradeLevel: s.gradeLevel,
      academicYear: typeof s.academicYear === 'object' ? (s.academicYear as AcademicYear)._id : s.academicYear,
      units: String(s.units), isActive: s.isActive,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.code || !form.academicYear) {
      toast.error('Name, code and academic year are required');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, teacher: form.teacher || null, units: parseInt(form.units) };
      if (editItem) {
        await subjectsApi.update(editItem._id, payload);
        toast.success('Subject updated');
      } else {
        await subjectsApi.create(payload);
        toast.success('Subject created');
      }
      setModalOpen(false);
      fetchSubjects();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await subjectsApi.delete(deleteTarget._id);
      toast.success('Subject deleted');
      setDeleteTarget(null);
      fetchSubjects();
    } catch { toast.error('Delete failed'); }
  };

  const SUBJECT_COLORS = ['#FEE2E2','#DBEAFE','#D1FAE5','#FEF3C7','#EDE9FE','#FCE7F3'];
  const SUBJECT_TEXT = ['#8B1A1A','#2563EB','#059669','#D97706','#7C3AED','#BE185D'];

  const columns = [
    {
      key: 'name', label: 'Subject', render: (s: Subject, i: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 36, height: 36, borderRadius: '9px', background: SUBJECT_COLORS[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: SUBJECT_TEXT[i % 6] }}>{s.code.slice(0, 3)}</span>
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--gray-900)', fontSize: '0.875rem' }}>{s.name}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>Code: {s.code} · {s.units} unit{s.units !== 1 ? 's' : ''}</div>
          </div>
        </div>
      )
    },
    { key: 'gradeLevel', label: 'Grade Level', render: (s: Subject) => <Badge label={s.gradeLevel} color="blue" /> },
    {
      key: 'teacher', label: 'Teacher', render: (s: Subject) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>
          {s.teacher && typeof s.teacher === 'object' ? (s.teacher as User).name : 'Unassigned'}
        </span>
      )
    },
    {
      key: 'academicYear', label: 'Academic Year', render: (s: Subject) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
          {typeof s.academicYear === 'object' ? (s.academicYear as AcademicYear).name : '—'}
        </span>
      )
    },
    { key: 'isActive', label: 'Status', render: (s: Subject) => <Badge label={s.isActive ? 'Active' : 'Inactive'} color={s.isActive ? 'green' : 'gray'} /> },
    {
      key: 'actions', label: '', render: (s: Subject) => (
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
          <button onClick={(e) => { e.stopPropagation(); openEdit(s); }} style={{ padding: '5px 10px', background: '#EFF6FF', border: 'none', borderRadius: '6px', color: '#2563EB', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-body)' }}>
            <Edit2 size={12} /> Edit
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }} style={{ padding: '5px 10px', background: '#FEE2E2', border: 'none', borderRadius: '6px', color: '#DC2626', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-body)' }}>
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gray-900)', fontFamily: 'var(--font-display)' }}>Subjects</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginTop: '2px' }}>Manage subjects, teachers, and assignments</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openCreate}>Add Subject</Button>
      </div>

      <Card padding="16px">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input placeholder="Search subjects..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ width: '100%', padding: '9px 14px 9px 36px', border: '1.5px solid var(--gray-200)', borderRadius: '9px', fontSize: '0.875rem', outline: 'none', fontFamily: 'var(--font-body)' }} />
          </div>
          <select value={ayFilter} onChange={(e) => { setAyFilter(e.target.value); setPage(1); }}
            style={{ padding: '9px 14px', border: '1.5px solid var(--gray-200)', borderRadius: '9px', fontSize: '0.875rem', outline: 'none', fontFamily: 'var(--font-body)', background: '#fff', cursor: 'pointer', minWidth: '160px' }}>
            {ayOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </Card>

      <Card>
        <DataTable columns={columns} data={subjects} loading={loading} emptyMessage="No subjects found" />
        <Pagination {...pagination} onChange={setPage} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Subject' : 'Create Subject'}
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleSave}>{editItem ? 'Save' : 'Create'}</Button></>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input label="Subject Name *" placeholder="e.g. Mathematics" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Subject Code *" placeholder="e.g. MATH101" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <Input label="Description" placeholder="Brief description..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Select label="Grade Level *" value={form.gradeLevel} onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })} options={GRADE_LEVELS} />
            <Input label="Units" type="number" min="1" max="6" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} />
          </div>
          <Select label="Academic Year *" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} options={ayOptions.filter(o => o.value)} />
          <Select label="Assigned Teacher" value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} options={teacherOptions} />
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirm Delete" width="400px"
        footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="danger" onClick={handleDelete}>Delete</Button></>}
      >
        <p style={{ color: 'var(--gray-600)', lineHeight: 1.6 }}>Delete subject <strong>{deleteTarget?.name}</strong>? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
