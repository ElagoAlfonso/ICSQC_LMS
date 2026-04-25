import React, { useEffect, useState } from 'react';
import { Bell, Plus, Edit2, Trash2, Pin, Megaphone } from 'lucide-react';
import { Card, Button, Badge, Modal, Input, EmptyState } from '../../components/ui';
import { announcementsApi } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import type { Announcement } from '../../types';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const TARGET_OPTIONS = [
  { value: 'all', label: 'Everyone' },
  { value: 'student', label: 'Students Only' },
  { value: 'teacher', label: 'Teachers Only' },
  { value: 'admin', label: 'Admin Only' },
];

const INITIAL_FORM = { title: '', content: '', targetRole: 'all', isPinned: false, isActive: true };

export default function AnnouncementsPage() {
  const { user } = useAuthStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Announcement | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const canManage = user?.role === 'admin' || user?.role === 'teacher';

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await announcementsApi.getAll({ limit: 50 });
      setAnnouncements(res.data.announcements || []);
    } catch { toast.error('Failed to load announcements'); }
    setLoading(false);
  };

  useEffect(() => { fetchAnnouncements(); }, []);

  const openCreate = () => { setEditItem(null); setForm(INITIAL_FORM); setModalOpen(true); };
  const openEdit = (ann: Announcement) => {
    setEditItem(ann);
    setForm({ title: ann.title, content: ann.content, targetRole: ann.targetRole, isPinned: ann.isPinned, isActive: ann.isActive });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.content) { toast.error('Title and content are required'); return; }
    setSaving(true);
    try {
      if (editItem) {
        await announcementsApi.update(editItem._id, form);
        toast.success('Announcement updated');
      } else {
        await announcementsApi.create(form);
        toast.success('Announcement posted');
      }
      setModalOpen(false);
      fetchAnnouncements();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await announcementsApi.delete(deleteTarget._id);
      toast.success('Announcement deleted');
      setDeleteTarget(null);
      fetchAnnouncements();
    } catch { toast.error('Delete failed'); }
  };

  const targetColor = (role: string) => {
    switch (role) {
      case 'student': return 'green';
      case 'teacher': return 'blue';
      case 'admin': return 'red';
      default: return 'gray';
    }
  };

  const pinned = announcements.filter(a => a.isPinned);
  const regular = announcements.filter(a => !a.isPinned);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gray-900)', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Megaphone size={22} color="#8B1A1A" /> Announcements
          </h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginTop: '2px' }}>
            School-wide news, reminders, and updates
          </p>
        </div>
        {canManage && (
          <Button icon={<Plus size={16} />} onClick={openCreate}>Post Announcement</Button>
        )}
      </div>

      {loading ? (
        <Card padding="48px">
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #E5E7EB', borderTopColor: '#8B1A1A', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </Card>
      ) : announcements.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bell size={28} />}
            title="No announcements yet"
            description={canManage ? "Post your first announcement to keep everyone informed" : "Check back later for updates"}
            action={canManage ? <Button icon={<Plus size={15} />} onClick={openCreate}>Post Announcement</Button> : undefined}
          />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Pinned */}
          {pinned.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Pin size={12} /> Pinned
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pinned.map(ann => <AnnouncementCard key={ann._id} ann={ann} canManage={canManage} onEdit={openEdit} onDelete={setDeleteTarget} targetColor={targetColor} />)}
              </div>
            </div>
          )}

          {/* Regular */}
          {regular.length > 0 && (
            <div>
              {pinned.length > 0 && (
                <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px', marginTop: '8px' }}>
                  Recent
                </h3>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {regular.map(ann => <AnnouncementCard key={ann._id} ann={ann} canManage={canManage} onEdit={openEdit} onDelete={setDeleteTarget} targetColor={targetColor} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Announcement' : 'Post Announcement'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSave}>{editItem ? 'Save Changes' : 'Post'}</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Input label="Title *" placeholder="e.g. Important Exam Schedule Update" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--gray-700)', display: 'block', marginBottom: '5px' }}>Content *</label>
            <textarea
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              placeholder="Write the announcement content here..."
              rows={5}
              style={{
                width: '100%', padding: '10px 14px',
                border: '1.5px solid var(--gray-200)', borderRadius: '9px',
                fontSize: '0.875rem', outline: 'none', resize: 'vertical',
                fontFamily: 'var(--font-body)', lineHeight: 1.6,
                color: 'var(--gray-900)',
              }}
              onFocus={e => { e.target.style.borderColor = '#8B1A1A'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--gray-200)'; }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--gray-700)', display: 'block', marginBottom: '5px' }}>Audience</label>
            <select value={form.targetRole} onChange={e => setForm({ ...form, targetRole: e.target.value })}
              style={{ width: '100%', padding: '9px 14px', border: '1.5px solid var(--gray-200)', borderRadius: '9px', fontSize: '0.875rem', fontFamily: 'var(--font-body)', background: '#fff', cursor: 'pointer', outline: 'none' }}>
              {TARGET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--gray-700)' }}>
              <input type="checkbox" checked={form.isPinned} onChange={e => setForm({ ...form, isPinned: e.target.checked })} style={{ width: 16, height: 16 }} />
              Pin this announcement
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--gray-700)' }}>
              <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} style={{ width: 16, height: 16 }} />
              Active
            </label>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Announcement" width="400px"
        footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="danger" onClick={handleDelete}>Delete</Button></>}
      >
        <p style={{ color: 'var(--gray-600)', lineHeight: 1.6 }}>
          Delete <strong>"{deleteTarget?.title}"</strong>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

function AnnouncementCard({ ann, canManage, onEdit, onDelete, targetColor }: any) {
  const authorName = typeof ann.author === 'object' ? ann.author?.name || 'Unknown' : 'Unknown';
  return (
    <div style={{
      background: '#fff',
      borderRadius: '14px',
      border: ann.isPinned ? '1px solid #FDE68A' : '1px solid var(--gray-100)',
      padding: '20px 24px',
      boxShadow: ann.isPinned ? '0 2px 12px rgba(201,168,76,0.1)' : 'var(--shadow-card)',
      position: 'relative',
    }}>
      {ann.isPinned && (
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <Pin size={14} color="#C9A84C" fill="#C9A84C" />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        <div style={{
          width: 42, height: 42, borderRadius: '12px', flexShrink: 0,
          background: ann.isPinned ? '#FEF3C7' : '#FEE2E2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Bell size={20} color={ann.isPinned ? '#D97706' : '#8B1A1A'} />
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingRight: canManage ? '60px' : '0' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: '6px' }}>
            {ann.title}
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)', lineHeight: 1.7, marginBottom: '12px' }}>
            {ann.content}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
              By <strong style={{ color: 'var(--gray-600)' }}>{authorName}</strong>
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
              {formatDistanceToNow(new Date(ann.createdAt), { addSuffix: true })}
            </span>
            <Badge label={ann.targetRole === 'all' ? 'Everyone' : ann.targetRole} color={targetColor(ann.targetRole)} />
          </div>
        </div>
      </div>

      {canManage && (
        <div style={{ position: 'absolute', top: 16, right: ann.isPinned ? 40 : 16, display: 'flex', gap: '6px' }}>
          <button onClick={() => onEdit(ann)} style={{ padding: '5px 10px', background: '#EFF6FF', border: 'none', borderRadius: '6px', color: '#2563EB', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-body)' }}>
            <Edit2 size={11} /> Edit
          </button>
          <button onClick={() => onDelete(ann)} style={{ padding: '5px 10px', background: '#FEE2E2', border: 'none', borderRadius: '6px', color: '#DC2626', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-body)' }}>
            <Trash2 size={11} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
