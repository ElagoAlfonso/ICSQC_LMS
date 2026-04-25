import React, { useEffect, useState } from 'react';
import { Clock, Plus, Save, Trash2 } from 'lucide-react';
import { Card, Button, Select, Modal, Input, Badge } from '../../components/ui';
import { timetableApi, classesApi, subjectsApi, usersApi } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import type { Class, Subject, User } from '../../types';
import toast from 'react-hot-toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = [
  '07:00–08:00', '08:00–09:00', '09:00–10:00', '10:00–11:00',
  '11:00–12:00', '12:00–13:00', '13:00–14:00', '14:00–15:00',
  '15:00–16:00', '16:00–17:00',
];

const DAY_COLORS: Record<string, string> = {
  Monday: '#FEE2E2', Tuesday: '#DBEAFE', Wednesday: '#D1FAE5',
  Thursday: '#FEF3C7', Friday: '#EDE9FE', Saturday: '#FCE7F3',
};
const DAY_TEXT: Record<string, string> = {
  Monday: '#8B1A1A', Tuesday: '#2563EB', Wednesday: '#059669',
  Thursday: '#D97706', Friday: '#7C3AED', Saturday: '#BE185D',
};

interface TimeSlot {
  _id?: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  subject: any;
  teacher: any;
  room?: string;
}

const INITIAL_SLOT = { dayOfWeek: 'Monday', startTime: '07:00', endTime: '08:00', subject: '', teacher: '', room: '' };

export default function TimetablePage() {
  const { user } = useAuthStore();
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [timetableId, setTimetableId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [slotForm, setSlotForm] = useState(INITIAL_SLOT);
  const [editSlotIdx, setEditSlotIdx] = useState<number | null>(null);

  const canEdit = user?.role === 'admin' || user?.role === 'teacher';

  useEffect(() => {
    const load = async () => {
      const [classRes, subjRes, teachRes] = await Promise.allSettled([
        classesApi.getAll({ limit: 100 }),
        subjectsApi.getAll({ limit: 100 }),
        usersApi.getAll({ role: 'teacher', limit: 100 }),
      ]);
      if (classRes.status === 'fulfilled') {
        const cls = classRes.value.data.classes || [];
        setClasses(cls);
        if (cls.length > 0) setSelectedClass(cls[0]._id);
      }
      if (subjRes.status === 'fulfilled') setSubjects(subjRes.value.data.subjects || []);
      if (teachRes.status === 'fulfilled') setTeachers(teachRes.value.data.users || []);
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await timetableApi.getByClass(selectedClass);
        setTimeSlots(res.data.timeSlots || []);
        setTimetableId(res.data._id || null);
      } catch {
        setTimeSlots([]);
      }
      setLoading(false);
    };
    fetch();
  }, [selectedClass]);

  const openAdd = () => {
    setEditSlotIdx(null);
    setSlotForm(INITIAL_SLOT);
    setModalOpen(true);
  };

  const openEdit = (slot: TimeSlot, idx: number) => {
    setEditSlotIdx(idx);
    setSlotForm({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      subject: typeof slot.subject === 'object' ? slot.subject?._id || '' : slot.subject || '',
      teacher: typeof slot.teacher === 'object' ? slot.teacher?._id || '' : slot.teacher || '',
      room: slot.room || '',
    });
    setModalOpen(true);
  };

  const handleSaveSlot = () => {
    if (!slotForm.subject || !slotForm.dayOfWeek) {
      toast.error('Day and subject are required');
      return;
    }
    const subjectObj = subjects.find(s => s._id === slotForm.subject);
    const teacherObj = teachers.find(t => t._id === slotForm.teacher);
    const newSlot: TimeSlot = {
      ...slotForm,
      subject: subjectObj || slotForm.subject,
      teacher: teacherObj || slotForm.teacher,
    };
    if (editSlotIdx !== null) {
      const updated = [...timeSlots];
      updated[editSlotIdx] = newSlot;
      setTimeSlots(updated);
    } else {
      setTimeSlots(prev => [...prev, newSlot]);
    }
    setModalOpen(false);
  };

  const handleDeleteSlot = (idx: number) => {
    setTimeSlots(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveTimetable = async () => {
    if (!selectedClass) { toast.error('Select a class first'); return; }
    setSaving(true);
    try {
      const payload = {
        class: selectedClass,
        timeSlots: timeSlots.map(s => ({
          ...s,
          subject: typeof s.subject === 'object' ? s.subject._id : s.subject,
          teacher: typeof s.teacher === 'object' ? s.teacher._id : s.teacher,
        })),
      };
      if (timetableId) {
        await timetableApi.update(timetableId, payload);
      } else {
        const res = await timetableApi.create(payload);
        setTimetableId(res.data._id);
      }
      toast.success('Timetable saved successfully');
    } catch { toast.error('Failed to save timetable'); }
    setSaving(false);
  };

  const classOptions = [{ value: '', label: 'Select a class...' }, ...classes.map(c => ({ value: c._id, label: `${c.name} — ${c.section} (${c.gradeLevel})` }))];
  const subjectOptions = [{ value: '', label: 'Select subject' }, ...subjects.map(s => ({ value: s._id, label: `${s.name} (${s.code})` }))];
  const teacherOptions = [{ value: '', label: 'Select teacher' }, ...teachers.map(t => ({ value: t._id, label: t.name }))];

  // Build grid: day → time → slot
  const grid: Record<string, Record<string, TimeSlot>> = {};
  DAYS.forEach(d => { grid[d] = {}; });
  timeSlots.forEach(slot => {
    grid[slot.dayOfWeek][slot.startTime] = slot;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gray-900)', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={22} color="#8B1A1A" /> Class Timetable
          </h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginTop: '2px' }}>
            View and manage weekly class schedules
          </p>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button variant="secondary" icon={<Plus size={15} />} onClick={openAdd}>Add Period</Button>
            <Button icon={<Save size={15} />} loading={saving} onClick={handleSaveTimetable}>Save Timetable</Button>
          </div>
        )}
      </div>

      {/* Class Selector */}
      <Card padding="16px">
        <div style={{ maxWidth: '360px' }}>
          <Select
            label="Select Class"
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            options={classOptions}
          />
        </div>
      </Card>

      {/* Timetable Grid */}
      {loading ? (
        <Card padding="48px">
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #E5E7EB', borderTopColor: '#8B1A1A', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Loading timetable...</p>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </Card>
      ) : (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--gray-100)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.6px', width: '90px' }}>
                    Time
                  </th>
                  {DAYS.map(day => (
                    <th key={day} style={{
                      padding: '10px 14px', textAlign: 'center',
                      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.4px',
                      color: DAY_TEXT[day],
                      background: DAY_COLORS[day] + '66',
                    }}>
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((period, pi) => {
                  const [start] = period.split('–');
                  return (
                    <tr key={period} style={{ borderBottom: '1px solid var(--gray-50)' }}>
                      <td style={{ padding: '8px 14px', fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 500, whiteSpace: 'nowrap', verticalAlign: 'top', paddingTop: '12px' }}>
                        {period}
                      </td>
                      {DAYS.map(day => {
                        const slot = grid[day]?.[start];
                        return (
                          <td key={day} style={{ padding: '6px 8px', verticalAlign: 'top', minHeight: '60px' }}>
                            {slot ? (
                              <div style={{
                                background: DAY_COLORS[day],
                                borderLeft: `3px solid ${DAY_TEXT[day]}`,
                                borderRadius: '8px',
                                padding: '8px 10px',
                                position: 'relative',
                                cursor: canEdit ? 'pointer' : 'default',
                              }}
                                onClick={() => {
                                  if (canEdit) {
                                    const idx = timeSlots.findIndex(s => s.dayOfWeek === day && s.startTime === start);
                                    if (idx >= 0) openEdit(slot, idx);
                                  }
                                }}
                              >
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: DAY_TEXT[day], marginBottom: '2px', lineHeight: 1.2 }}>
                                  {typeof slot.subject === 'object' ? slot.subject?.name || '—' : '—'}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--gray-500)' }}>
                                  {typeof slot.teacher === 'object' ? slot.teacher?.name?.split(' ').pop() || '—' : '—'}
                                </div>
                                {slot.room && (
                                  <div style={{ fontSize: '0.65rem', color: 'var(--gray-400)', marginTop: '2px' }}>📍 {slot.room}</div>
                                )}
                                {canEdit && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const idx = timeSlots.findIndex(s => s.dayOfWeek === day && s.startTime === start);
                                      if (idx >= 0) handleDeleteSlot(idx);
                                    }}
                                    style={{
                                      position: 'absolute', top: 4, right: 4,
                                      background: 'rgba(220,38,38,0.1)', border: 'none',
                                      borderRadius: '4px', padding: '2px 4px',
                                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                                    }}
                                  >
                                    <Trash2 size={10} color="#DC2626" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              canEdit && (
                                <button
                                  onClick={() => {
                                    setSlotForm({ ...INITIAL_SLOT, dayOfWeek: day, startTime: start, endTime: PERIODS[pi]?.split('–')[1] || start });
                                    setEditSlotIdx(null);
                                    setModalOpen(true);
                                  }}
                                  style={{
                                    width: '100%', height: '48px',
                                    background: 'transparent', border: '1.5px dashed var(--gray-200)',
                                    borderRadius: '8px', cursor: 'pointer', color: 'var(--gray-300)',
                                    fontSize: '1.2rem', transition: 'all 0.15s',
                                    fontFamily: 'var(--font-body)',
                                  }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#8B1A1A'; (e.currentTarget as HTMLElement).style.color = '#8B1A1A'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gray-200)'; (e.currentTarget as HTMLElement).style.color = 'var(--gray-300)'; }}
                                >+</button>
                              )
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {timeSlots.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--gray-400)', fontSize: '0.875rem' }}>
              {canEdit ? 'Click the + buttons to add periods to the timetable' : 'No timetable set for this class yet'}
            </div>
          )}
        </Card>
      )}

      {/* Add/Edit Slot Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editSlotIdx !== null ? 'Edit Period' : 'Add Period'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSlot}>
              {editSlotIdx !== null ? 'Update Period' : 'Add Period'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Select label="Day *" value={slotForm.dayOfWeek} onChange={e => setSlotForm({ ...slotForm, dayOfWeek: e.target.value })}
            options={DAYS.map(d => ({ value: d, label: d }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input label="Start Time" type="time" value={slotForm.startTime} onChange={e => setSlotForm({ ...slotForm, startTime: e.target.value })} />
            <Input label="End Time" type="time" value={slotForm.endTime} onChange={e => setSlotForm({ ...slotForm, endTime: e.target.value })} />
          </div>
          <Select label="Subject *" value={slotForm.subject} onChange={e => setSlotForm({ ...slotForm, subject: e.target.value })} options={subjectOptions} />
          <Select label="Teacher" value={slotForm.teacher} onChange={e => setSlotForm({ ...slotForm, teacher: e.target.value })} options={teacherOptions} />
          <Input label="Room / Location" placeholder="e.g. Room 201" value={slotForm.room} onChange={e => setSlotForm({ ...slotForm, room: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
