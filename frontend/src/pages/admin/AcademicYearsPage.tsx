import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Star, CalendarDays } from 'lucide-react';
import { Card, Button, Badge, Modal, Input, EmptyState } from '../../components/ui';
import { academicYearsApi } from '../../utils/api';
import type { AcademicYear } from '../../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const INITIAL_FORM = { name: '', startDate: '', endDate: '', isCurrent: false };

export default function AcademicYearsPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<AcademicYear | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AcademicYear | null>(null);

  const fetchYears = async () => {
    setLoading(true);
    try {
      const res = await academicYearsApi.getAll();
      setYears(res.data);
    } catch { toast.error('Failed to load academic years'); }
    setLoading(false);
  };

  useEffect(() => { fetchYears(); }, []);

  const openCreate = () => { setEditItem(null); setForm(INITIAL_FORM); setModalOpen(true); };
  const openEdit = (ay: AcademicYear) => {
    setEditItem(ay);
    setForm({
      name: ay.name,
      startDate: ay.startDate.split('T')[0],
      endDate: ay.endDate.split('T')[0],
      isCurrent: ay.isCurrent,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.startDate || !form.endDate) {
      toast.error('All fields are required');
      return;
    }
    setSaving(true);
    try {
      if (editItem) {
        await academicYearsApi.update(editItem._id, form);
        toast.success('Academic year updated');
      } else {
        await academicYearsApi.create(form);
        toast.success('Academic year created');
      }
      setModalOpen(false);
      fetchYears();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    }
    setSaving(false);
  };

  const handleSetCurrent = async (id: string) => {
    try {
      await academicYearsApi.setCurrent(id);
      toast.success('Current academic year updated');
      fetchYears();
    } catch { toast.error('Failed to set current year'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await academicYearsApi.delete(deleteTarget._id);
      toast.success('Academic year deleted');
      setDeleteTarget(null);
      fetchYears();
    } catch { toast.error('Delete failed'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gray-900)', fontFamily: 'var(--font-display)' }}>
            Academic Years
          </h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginTop: '2px' }}>
            Manage school academic years and set the current active year
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openCreate}>New Academic Year</Button>
      </div>

      {loading ? (
        <Card padding="48px">
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #E5E7EB', borderTopColor: '#8B1A1A', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Loading...</p>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </Card>
      ) : years.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays size={28} />}
            title="No academic years found"
            description="Create your first academic year to get started"
            action={<Button icon={<Plus size={15} />} onClick={openCreate}>Create Academic Year</Button>}
          />
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {years.map((ay) => (
            <div key={ay._id} style={{
              background: '#fff',
              borderRadius: '14px',
              border: ay.isCurrent ? '2px solid #C9A84C' : '1px solid var(--gray-100)',
              padding: '24px',
              boxShadow: ay.isCurrent ? '0 4px 20px rgba(201,168,76,0.2)' : 'var(--shadow-card)',
              position: 'relative',
              transition: 'transform 0.2s',
            }}>
              {ay.isCurrent && (
                <div style={{
                  position: 'absolute', top: -12, right: 20,
                  background: 'linear-gradient(135deg, #C9A84C, #E8C96A)',
                  color: '#1A2744', padding: '3px 12px',
                  borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: '4px',
                  letterSpacing: '0.5px',
                }}>
                  <Star size={10} fill="currentColor" /> CURRENT
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '12px',
                  background: ay.isCurrent ? '#FEF3C7' : '#F3F4F6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: ay.isCurrent ? '#D97706' : '#6B7280',
                  flexShrink: 0,
                }}>
                  <CalendarDays size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: '4px' }}>
                    {ay.name}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                    {format(new Date(ay.startDate), 'MMM d, yyyy')} — {format(new Date(ay.endDate), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>

              {/* Duration bar */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>Duration</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>
                    {Math.ceil((new Date(ay.endDate).getTime() - new Date(ay.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30))} months
                  </span>
                </div>
                <div style={{ height: 4, background: 'var(--gray-100)', borderRadius: 2 }}>
                  {ay.isCurrent && (() => {
                    const now = new Date().getTime();
                    const start = new Date(ay.startDate).getTime();
                    const end = new Date(ay.endDate).getTime();
                    const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
                    return (
                      <div style={{
                        height: '100%', width: `${pct}%`,
                        background: 'linear-gradient(90deg, #C9A84C, #8B1A1A)',
                        borderRadius: 2,
                      }} />
                    );
                  })()}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {!ay.isCurrent && (
                  <button
                    onClick={() => handleSetCurrent(ay._id)}
                    style={{
                      flex: 1, padding: '7px 12px',
                      background: '#FEF3C7', border: '1px solid #FDE68A',
                      borderRadius: '8px', color: '#D97706',
                      fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    <Star size={12} /> Set Current
                  </button>
                )}
                <button onClick={() => openEdit(ay)} style={{
                  padding: '7px 12px', background: '#EFF6FF', border: 'none',
                  borderRadius: '8px', color: '#2563EB', cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontFamily: 'var(--font-body)',
                }}>
                  <Edit2 size={12} /> Edit
                </button>
                <button onClick={() => setDeleteTarget(ay)} style={{
                  padding: '7px 12px', background: '#FEE2E2', border: 'none',
                  borderRadius: '8px', color: '#DC2626', cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontFamily: 'var(--font-body)',
                }}>
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? 'Edit Academic Year' : 'New Academic Year'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSave}>{editItem ? 'Save Changes' : 'Create'}</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Year Name *" placeholder="e.g. 2024–2025" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Start Date *" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <Input label="End Date *" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="checkbox" id="isCurrent" checked={form.isCurrent} onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            <label htmlFor="isCurrent" style={{ fontSize: '0.875rem', color: 'var(--gray-700)', cursor: 'pointer' }}>
              Set as current academic year
            </label>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirm Delete" width="400px"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </>
        }
      >
        <p style={{ color: 'var(--gray-600)', lineHeight: 1.6 }}>
          Delete academic year <strong>{deleteTarget?.name}</strong>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
