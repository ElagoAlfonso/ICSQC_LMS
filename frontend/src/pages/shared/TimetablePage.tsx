import React, { useEffect, useState } from 'react';
import { Clock, Plus } from 'lucide-react';
import { Card } from '../../components/ui';
import { timetableApi, classesApi } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import type { Class, Subject } from '../../types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const GRID_START_MINUTES = 7 * 60;
const GRID_END_MINUTES = 17 * 60;
const INTERVAL_MINUTES = 15;

const formatTime = (minutes: number) => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const timeOptions = Array.from(
  { length: (GRID_END_MINUTES - GRID_START_MINUTES) / INTERVAL_MINUTES + 1 },
  (_, index) => formatTime(GRID_START_MINUTES + index * INTERVAL_MINUTES),
);

const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const formatInterval = (startTime: string, endTime: string) => `${startTime}–${endTime}`;

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

export default function TimetablePage() {
  const { user } = useAuthStore();
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [slotForm, setSlotForm] = useState({ subject: '', dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00', room: '' });
  const [savingSlot, setSavingSlot] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await classesApi.getAll({ limit: 100 });
        const availableClasses = (response.data.classes || []) as Class[];
        setClasses(availableClasses);
        setSelectedClassId((current) => current || availableClasses[0]?._id || '');
        const timetableResponses = await Promise.allSettled(
          availableClasses.map((classDoc) => timetableApi.getByClass(classDoc._id)),
        );
        const loadedSlots = timetableResponses
          .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
          .flatMap((result) => result.value.data.timeSlots || [])
          .filter((slot: TimeSlot) => user?.role !== 'teacher' || (typeof slot.teacher === 'object' && slot.teacher?._id === user._id)) as TimeSlot[];
        setTimeSlots(loadedSlots);
      } catch {
        setTimeSlots([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?._id, user?.role]);

  const selectedClass = classes.find((classDoc) => classDoc._id === selectedClassId);
  const classSubjects = (selectedClass?.subjects || []).filter((subject): subject is Subject => typeof subject === 'object');

  const saveSlot = async () => {
    if (!selectedClass || !slotForm.subject || !user?._id) return;
    if (timeToMinutes(slotForm.endTime) <= timeToMinutes(slotForm.startTime)) {
      window.alert('End time must be later than start time.');
      return;
    }
    setSavingSlot(true);
    try {
      const currentResponse = await timetableApi.getByClass(selectedClass._id);
      const existingSlots = currentResponse.data.timeSlots || [];
      const newSlot = { ...slotForm, subject: slotForm.subject, teacher: user._id };
      await timetableApi.create({
        class: selectedClass._id,
        academicYear: typeof selectedClass.academicYear === 'object' ? selectedClass.academicYear._id : selectedClass.academicYear,
        timeSlots: [...existingSlots.map((slot: TimeSlot) => ({ dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime, subject: typeof slot.subject === 'object' ? slot.subject._id : slot.subject, teacher: typeof slot.teacher === 'object' ? slot.teacher._id : slot.teacher, room: slot.room })), newSlot],
      });
      setTimeSlots((current) => [...current, { ...newSlot, subject: classSubjects.find((subject) => subject._id === newSlot.subject), teacher: user }]);
      setSlotForm((current) => ({ ...current, room: '' }));
    } catch (error: any) {
      window.alert(error.response?.data?.message || 'Unable to save this timetable slot.');
    } finally {
      setSavingSlot(false);
    }
  };

  const gridRows = Array.from(
    { length: (GRID_END_MINUTES - GRID_START_MINUTES) / INTERVAL_MINUTES },
    (_, index) => {
      const startMinutes = GRID_START_MINUTES + index * INTERVAL_MINUTES;
      return { startTime: formatTime(startMinutes), endTime: formatTime(startMinutes + INTERVAL_MINUTES) };
    },
  );

  // Build grid: day → start time → slot. Existing schedules keep their exact duration.
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
            View weekly class schedules
          </p>
        </div>
      </div>

      {user?.role !== 'student' && <Card title="Add class schedule" subtitle="Choose a class and subject, then add its weekly time slot.">
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 5, fontSize: '0.75rem', color: '#475569' }}>Class<select value={selectedClassId} onChange={(event) => { setSelectedClassId(event.target.value); setSlotForm((current) => ({ ...current, subject: '' })); }} style={{ padding: '9px 10px', border: '1px solid #CBD5E1', borderRadius: 7, background: '#fff' }}>{classes.map((classDoc) => <option key={classDoc._id} value={classDoc._id}>{classDoc.name} · {classDoc.section} ({classDoc.gradeLevel})</option>)}</select></label>
          <label style={{ display: 'grid', gap: 5, fontSize: '0.75rem', color: '#475569' }}>Subject<select value={slotForm.subject} onChange={(event) => setSlotForm({ ...slotForm, subject: event.target.value })} style={{ padding: '9px 10px', border: '1px solid #CBD5E1', borderRadius: 7, background: '#fff' }}><option value="">Select subject</option>{classSubjects.map((subject) => <option key={subject._id} value={subject._id}>{subject.name}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 5, fontSize: '0.75rem', color: '#475569' }}>Day<select value={slotForm.dayOfWeek} onChange={(event) => setSlotForm({ ...slotForm, dayOfWeek: event.target.value })} style={{ padding: '9px 10px', border: '1px solid #CBD5E1', borderRadius: 7, background: '#fff' }}>{DAYS.map((day) => <option key={day}>{day}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 5, fontSize: '0.75rem', color: '#475569' }}>Start<select value={slotForm.startTime} onChange={(event) => setSlotForm({ ...slotForm, startTime: event.target.value })} style={{ padding: '9px 10px', border: '1px solid #CBD5E1', borderRadius: 7, background: '#fff' }}>{timeOptions.slice(0, -1).map((time) => <option key={time} value={time}>{time}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 5, fontSize: '0.75rem', color: '#475569' }}>End<select value={slotForm.endTime} onChange={(event) => setSlotForm({ ...slotForm, endTime: event.target.value })} style={{ padding: '9px 10px', border: '1px solid #CBD5E1', borderRadius: 7, background: '#fff' }}>{timeOptions.slice(1).map((time) => <option key={time} value={time}>{time}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 5, fontSize: '0.75rem', color: '#475569' }}>Room<input value={slotForm.room} onChange={(event) => setSlotForm({ ...slotForm, room: event.target.value })} placeholder="Optional" style={{ padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: 7 }} /></label>
          <button type="button" onClick={saveSlot} disabled={savingSlot || !selectedClass || !slotForm.subject} title="Add schedule" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '9px 12px', border: 0, borderRadius: 7, background: '#8B1A1A', color: '#fff', cursor: savingSlot ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}><Plus size={15} /> {savingSlot ? 'Saving' : 'Add'}</button>
        </div>
      </Card>}

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
                {gridRows.map((row) => {
                  const { startTime, endTime } = row;
                  return (
                    <tr key={startTime} style={{ borderBottom: '1px solid var(--gray-50)' }}>
                      <td style={{ padding: '8px 14px', fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 500, whiteSpace: 'nowrap', verticalAlign: 'top', paddingTop: '12px' }}>
                        {formatInterval(startTime, endTime)}
                      </td>
                      {DAYS.map(day => {
                        const slot = grid[day]?.[startTime];
                        const precedingSlot = timeSlots.find((candidate) => candidate.dayOfWeek === day && timeToMinutes(candidate.startTime) < timeToMinutes(startTime) && timeToMinutes(candidate.endTime) > timeToMinutes(startTime));
                        if (precedingSlot) return null;
                        const rowSpan = slot
                          ? Math.max(1, Math.ceil((timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime)) / INTERVAL_MINUTES))
                          : 1;
                        return (
                          <td key={day} rowSpan={rowSpan} style={{ padding: '6px 8px', verticalAlign: 'top', height: '24px' }}>
                            {slot ? (
                              <div style={{
                                background: DAY_COLORS[day],
                                borderLeft: `3px solid ${DAY_TEXT[day]}`,
                                borderRadius: '8px',
                                padding: '8px 10px',
                                minHeight: `${Math.max(1, rowSpan) * 24 - 12}px`,
                                boxSizing: 'border-box',
                                position: 'relative',
                                cursor: 'default',
                              }}
                              >
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: DAY_TEXT[day], marginBottom: '2px', lineHeight: 1.2 }}>
                                  {typeof slot.subject === 'object' ? slot.subject?.name || '—' : '—'}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--gray-500)' }}>
                                  {slot.startTime}–{slot.endTime}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--gray-500)' }}>
                                  {typeof slot.teacher === 'object' ? slot.teacher?.name || '—' : '—'}
                                </div>
                                {slot.room && (
                                  <div style={{ fontSize: '0.65rem', color: 'var(--gray-400)', marginTop: '2px' }}>📍 {slot.room}</div>
                                )}
                              </div>
                            ) : (
                              null
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
              No classes are scheduled.
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
