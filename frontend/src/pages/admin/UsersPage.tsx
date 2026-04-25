import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import { Card, Button, Badge, DataTable, Pagination, Modal, Input, Select, EmptyState } from '../../components/ui';
import { usersApi } from '../../utils/api';
import type { User, Pagination as PaginationType } from '../../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const ROLE_OPTIONS = [
  { value: '', label: 'All Roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
];

const FORM_ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
];

const INITIAL_FORM = { name: '', email: '', password: '', role: 'student', isActive: true };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<PaginationType>({ total: 0, page: 1, pages: 1, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await usersApi.getAll({ page, limit: 10, search, role: roleFilter });
      setUsers(res.data.users);
      setPagination(res.data.pagination);
    } catch { toast.error('Failed to load users'); }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, [page, search, roleFilter]);

  const openCreate = () => { setEditUser(null); setForm(INITIAL_FORM); setModalOpen(true); };
  const openEdit = (u: User) => {
    setEditUser(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, isActive: u.isActive });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) { toast.error('Name and email are required'); return; }
    setSaving(true);
    try {
      if (editUser) {
        const payload: any = { name: form.name, email: form.email, role: form.role, isActive: form.isActive };
        if (form.password) payload.password = form.password;
        await usersApi.update(editUser._id, payload);
        toast.success('User updated successfully');
      } else {
        if (!form.password) { toast.error('Password is required for new users'); setSaving(false); return; }
        await usersApi.create(form);
        toast.success('User created successfully');
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await usersApi.delete(deleteTarget._id);
      toast.success('User deleted');
      setDeleteTarget(null);
      fetchUsers();
    } catch { toast.error('Delete failed'); }
  };

  const columns = [
    {
      key: 'name', label: 'User', render: (u: User) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: u.role === 'admin' ? '#FEF3C7' : u.role === 'teacher' ? '#DBEAFE' : '#D1FAE5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.8rem', fontWeight: 700,
            color: u.role === 'admin' ? '#D97706' : u.role === 'teacher' ? '#2563EB' : '#059669',
          }}>
            {u.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--gray-900)', fontSize: '0.875rem' }}>{u.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{u.email}</div>
          </div>
        </div>
      )
    },
    {
      key: 'role', label: 'Role', render: (u: User) => (
        <Badge
          label={u.role}
          color={u.role === 'admin' ? 'yellow' : u.role === 'teacher' ? 'blue' : 'green'}
        />
      )
    },
    {
      key: 'isActive', label: 'Status', render: (u: User) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {u.isActive
            ? <><UserCheck size={14} color="#059669" /><span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 500 }}>Active</span></>
            : <><UserX size={14} color="#DC2626" /><span style={{ fontSize: '0.8rem', color: '#DC2626', fontWeight: 500 }}>Inactive</span></>
          }
        </div>
      )
    },
    {
      key: 'createdAt', label: 'Joined', render: (u: User) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
          {u.createdAt ? format(new Date(u.createdAt), 'MMM d, yyyy') : '—'}
        </span>
      )
    },
    {
      key: 'actions', label: '', render: (u: User) => (
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
          <button onClick={(e) => { e.stopPropagation(); openEdit(u); }} style={{
            padding: '5px 10px', background: '#EFF6FF', border: 'none', borderRadius: '6px',
            color: '#2563EB', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: '4px',
          }}>
            <Edit2 size={12} /> Edit
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(u); }} style={{
            padding: '5px 10px', background: '#FEE2E2', border: 'none', borderRadius: '6px',
            color: '#DC2626', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: '4px',
          }}>
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
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gray-900)', fontFamily: 'var(--font-display)' }}>
            User Management
          </h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginTop: '2px' }}>
            Manage all system users — admins, teachers, and students
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openCreate}>Add User</Button>
      </div>

      {/* Filters */}
      <Card padding="16px">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{
                width: '100%', padding: '9px 14px 9px 36px',
                border: '1.5px solid var(--gray-200)', borderRadius: '9px',
                fontSize: '0.875rem', outline: 'none', fontFamily: 'var(--font-body)',
              }}
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            style={{
              padding: '9px 14px', border: '1.5px solid var(--gray-200)',
              borderRadius: '9px', fontSize: '0.875rem', outline: 'none',
              fontFamily: 'var(--font-body)', background: '#fff', cursor: 'pointer',
              minWidth: '140px',
            }}
          >
            {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '9px 16px', background: 'var(--gray-50)',
            border: '1px solid var(--gray-200)', borderRadius: '9px',
          }}>
            <Users size={14} color="#6B7280" />
            <span style={{ fontSize: '0.8rem', color: '#6B7280', fontWeight: 500 }}>
              {pagination.total} total users
            </span>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <DataTable columns={columns} data={users} loading={loading} emptyMessage="No users found" />
        <Pagination {...pagination} onChange={setPage} />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editUser ? 'Edit User' : 'Create New User'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSave}>{editUser ? 'Save Changes' : 'Create User'}</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Full Name *" placeholder="e.g. Juan dela Cruz" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Email Address *" type="email" placeholder="user@icsqc.edu.ph" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label={editUser ? 'New Password (leave blank to keep)' : 'Password *'} type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Select label="Role *" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={FORM_ROLE_OPTIONS} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            <label htmlFor="isActive" style={{ fontSize: '0.875rem', color: 'var(--gray-700)', cursor: 'pointer' }}>
              Account is active
            </label>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirm Delete" width="400px"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete User</Button>
          </>
        }
      >
        <p style={{ color: 'var(--gray-600)', lineHeight: 1.6 }}>
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
