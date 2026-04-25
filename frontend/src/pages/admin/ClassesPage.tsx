import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, GraduationCap, Users } from 'lucide-react';
import { Card, Button, Badge, DataTable, Pagination, Modal, Input, Select, EmptyState } from '../../components/ui';
import { classesApi, academicYearsApi, usersApi } from '../../utils/api';
import type { Class, AcademicYear, User, Pagination as PaginationType } from '../../types';
import toast from 'react-hot-toast';

const GRADE_LEVELS = ['Kinder', 'Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'].map(g => ({ value: g, label: g }));

const INITIAL_FORM = { name: '', section: '', gradeLevel: 'Grade 7', academicYear: '', adviser: '', isActive: true };

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [pagination, setPagination] = useState<PaginationType>({ total: 0, page: 1, pages: 1, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Class | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Class | null>(null);
  const [ayFilter, setAyFilter] = useState('');

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const res = await classesApi.getAll({ page, limit: 10, search, academicYear: ayFilter });
      setClasses(res.data.classes);
      setPagination(res.data.pagination);
    } catch { toast.error('Failed to load classes'); }
    setLoading(false);
  };

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

  useEffect(() => { fetchClasses(); }, [page, search, ayFilter]);

  const ayOptions = [{ value: '', label: 'All Years' }, ...academicYears.map(ay => ({ value: ay._id, label: ay.name }))];
  const teacherOptions = [{ value: '', label: 'No Adviser' }, ...teachers.map(t => ({ value: t._id, label: t.name }))];

  const openCreate = () => {
    setEditItem(null);
    const currentAy = academicYears.find(ay => ay.isCurrent);
    setForm({ ...INITIAL_FORM, academicYear: currentAy?._id || '' });
    setModalOpen(true);
  };

  const openEdit = (cls: Class) => {
    setEditItem(cls);
    setForm({
      name: cls.name,
      section: cls.section,
      gradeLevel: cls.gradeLevel,
      academicYear: typeof cls.academicYear === 'object' ? (cls.academicYear as AcademicYear)._id : cls.academicYear,
      adviser: cls.adviser ? (typeof cls.adviser === 'object' ? (cls.adviser as User)._id : cls.adviser) : '',
      isActive: cls.isActive,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.section || !form.academicYear) {
      toast.error('Name, section and academic year are required');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, adviser: form.adviser || null };
      if (editItem) {
        await classesApi.update(editItem._id, payload);
        toast.success('Class updated');
      } else {
        await classesApi.create(payload);
        toast.success('Class created');
      }
      setModalOpen(false);
      fetchClasses();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await classesApi.delete(deleteTarget._id);
      toast.success('Class deleted');
      setDeleteTarget(null);
      fetchClasses();
    } catch { toast.error('Delete failed'); }
  };

  const columns = [
    {
      key: 'name', label: 'Class', render: (c: Class) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 38, height: 38, borderRadius: '10px',
            background: '#FEE2E2',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <GraduationCap size={18} color="#8B1A1A" />
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--gray-900)', fontSize: '0.875rem' }}>
              {c.name} — {c.section}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{c.gradeLevel}</div>
          </div>
        </div>
      )
    },
    {
      key: 'academicYear', label: 'Academic Year', render: (c: Class) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>
          {typeof c.academicYear === 'object' ? (c.academicYear as AcademicYear).name : '—'}
        </span>
      )
    },
    {
      key: 'adviser', label: 'Adviser', render: (c: Class) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>
          {c.adviser && typeof c.adviser === 'object' ? (c.adviser as User).name : 'Not assigned'}
        </span>
      )
    },
    {
      key: 'students', label: 'Students', render: (c: Class) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Users size={13} color="#6B7280" />
          <span style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>
            {c.students?.length || 0}
          </span>
        </div>
      )
    },
    {
      key: 'isActive', label: 'Status', render: (c: Class) => (
        <Badge label={c.isActive ? 'Active' : 'Inactive'} color={c.isActive ? 'green' : 'gray'} />
      )
    },
    {
      key: 'actions', label: '', render: (c: Class) => (
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
          <button onClick={(e) => { e.stopPropagation(); openEdit(c); }} style={{ padding: '5px 10px', background: '#EFF6FF', border: 'none', borderRadius: '6px', color: '#2563EB', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-body)' }}>
            <Edit2 size={12} /> Edit
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }} style={{ padding: '5px 10px', background: '#FEE2E2', border: 'none', borderRadius: '6px', color: '#DC2626', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-body)' }}>
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
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gray-900)', fontFamily: 'var(--font-display)' }}>Classes</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginTop: '2px' }}>Manage class sections and assignments</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openCreate}>Add Class</Button>
      </div>

      <Card padding="16px">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input placeholder="Search classes..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ width: '100%', padding: '9px 14px 9px 36px', border: '1.5px solid var(--gray-200)', borderRadius: '9px', fontSize: '0.875rem', outline: 'none', fontFamily: 'var(--font-body)' }} />
          </div>
          <select value={ayFilter} onChange={(e) => { setAyFilter(e.target.value); setPage(1); }}
            style={{ padding: '9px 14px', border: '1.5px solid var(--gray-200)', borderRadius: '9px', fontSize: '0.875rem', outline: 'none', fontFamily: 'var(--font-body)', background: '#fff', cursor: 'pointer', minWidth: '160px' }}>
            {ayOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </Card>

      <Card>
        <DataTable columns={columns} data={classes} loading={loading} emptyMessage="No classes found" />
        <Pagination {...pagination} onChange={setPage} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Class' : 'Create Class'}
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleSave}>{editItem ? 'Save' : 'Create'}</Button></>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input label="Class Name *" placeholder="e.g. Rizal" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Section *" placeholder="e.g. A" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
          </div>
          <Select label="Grade Level *" value={form.gradeLevel} onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })} options={GRADE_LEVELS} />
          <Select label="Academic Year *" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} options={ayOptions.filter(o => o.value)} />
          <Select label="Adviser" value={form.adviser} onChange={(e) => setForm({ ...form, adviser: e.target.value })} options={teacherOptions} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="checkbox" id="classActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            <label htmlFor="classActive" style={{ fontSize: '0.875rem', color: 'var(--gray-700)', cursor: 'pointer' }}>Active class</label>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirm Delete" width="400px"
        footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="danger" onClick={handleDelete}>Delete</Button></>}
      >
        <p style={{ color: 'var(--gray-600)', lineHeight: 1.6 }}>
          Delete class <strong>{deleteTarget?.name} — {deleteTarget?.section}</strong>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
