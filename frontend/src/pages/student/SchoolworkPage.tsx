import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Clock, CheckCircle2 } from 'lucide-react';
import { format, isWithinInterval, startOfWeek, addDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Badge, Card, EmptyState } from '../../components/ui';
import { classworkApi } from '../../utils/api';
import type { Classwork, ClassworkSubmission } from '../../types';
import { io } from 'socket.io-client';

type WorkTab = 'assigned' | 'missing' | 'done';
type WorkItem = Classwork & { submission?: ClassworkSubmission };

const getId = (value: unknown) => typeof value === 'object' && value !== null ? (value as { _id?: string })._id : value as string;

export default function SchoolworkPage() {
  const navigate = useNavigate();
  const [classwork, setClasswork] = useState<Classwork[]>([]);
  const [submissions, setSubmissions] = useState<ClassworkSubmission[]>([]);
  const [tab, setTab] = useState<WorkTab>('assigned');
  const [classFilter, setClassFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [classworkResponse, submissionsResponse] = await Promise.all([classworkApi.getAll({ includeSubmitted: 'true' }), classworkApi.getMySubmissions()]);
      setClasswork(classworkResponse.data.classwork || []);
      setSubmissions(submissionsResponse.data.submissions || []);
    } catch {
      setClasswork([]);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const socket = io(import.meta.env.VITE_REALTIME_URL || window.location.origin, { withCredentials: true, transports: ['websocket', 'polling'] });
    const refresh = () => { void load(); };
    socket.on('academic:update', refresh);
    return () => { socket.off('academic:update', refresh); socket.disconnect(); };
  }, []);

  const submissionByClasswork = useMemo(() => new Map(
    submissions.map((submission) => [getId(submission.classwork), submission]),
  ), [submissions]);

  const classes = useMemo(() => {
    const values = new Map<string, string>();
    classwork.forEach((item) => {
      const classItem = typeof item.class === 'object' ? item.class : null;
      const id = getId(item.class);
      if (id) values.set(id, classItem?.section || classItem?.name || 'Class');
    });
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [classwork]);

  const workItems = useMemo<WorkItem[]>(() => classwork.map((item) => ({
    ...item,
    submission: submissionByClasswork.get(item._id),
  })), [classwork, submissionByClasswork]);

  const getStudentWorkStatus = (item: WorkItem) => {
    const dueDate = item.dueDate ? new Date(item.dueDate) : null;
    const now = new Date();

    if (item.submission) {
      if (item.submission.status === 'graded') {
        return {
          label: 'Graded',
          color: 'green',
        } as const;
      }

      const submittedAt = item.submission.submittedAt ? new Date(item.submission.submittedAt) : null;
      const isLate = Boolean(dueDate && submittedAt && submittedAt.getTime() > dueDate.getTime());
      return {
        label: isLate ? 'Done Late' : 'Done',
        color: isLate ? 'yellow' : 'green',
      } as const;
    }

    if (dueDate && now.getTime() > dueDate.getTime()) {
      if (item.allowLateSubmission) {
        return {
          label: 'Past due',
          color: 'yellow',
        } as const;
      }

      return {
        label: 'Missing',
        color: 'red',
      } as const;
    }

    return {
      label: 'Assigned',
      color: 'blue',
    } as const;
  };

  const visibleItems = useMemo(() => {
    return workItems
      .filter((item) => classFilter === 'all' || getId(item.class) === classFilter)
      .filter((item) => {
        const dueDate = item.dueDate ? new Date(item.dueDate) : null;
        const isPastDue = Boolean(dueDate && Date.now() > dueDate.getTime());

        if (tab === 'done') return Boolean(item.submission);
        if (tab === 'missing') return Boolean(item.dueDate && !item.submission && isPastDue && !item.allowLateSubmission);
        return !item.submission && (!item.dueDate || !isPastDue || item.allowLateSubmission);
      })
      .sort((a, b) => {
        const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      });
  }, [classFilter, tab, workItems]);

  const groups = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const nextWeekStart = addDays(weekStart, 7);
    const labels = ['No due date', 'This week', 'Next week', 'Later'];
    const grouped = new Map(labels.map((label) => [label, [] as WorkItem[]]));
    visibleItems.forEach((item) => {
      const dueDate = item.dueDate ? new Date(item.dueDate) : null;
      const label = dueDate && isWithinInterval(dueDate, { start: weekStart, end: addDays(weekStart, 6) })
        ? 'This week'
        : dueDate && isWithinInterval(dueDate, { start: nextWeekStart, end: addDays(nextWeekStart, 6) })
          ? 'Next week'
          : dueDate?.getTime() ? dueDate > addDays(nextWeekStart, 6) ? 'Later' : 'This week' : 'No due date';
      grouped.get(label)?.push(item);
    });
    return [...grouped.entries()].filter(([, items]) => items.length > 0);
  }, [visibleItems]);

  const tabItems = [
    ['assigned', 'Assigned'],
    ['missing', 'Missing'],
    ['done', 'Done'],
  ] as const;

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--gray-900)', fontFamily: 'var(--font-display)' }}>To-Do</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginTop: '2px' }}>Assignments, activities, and assessments waiting for you.</p>
      </div>
      <Card padding="0">
        <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', gap: 26, padding: '0 20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 24 }}>
            {tabItems.map(([value, label]) => (
              <button key={value} type="button" onClick={() => setTab(value)} style={{ padding: '14px 0', border: 0, borderBottom: tab === value ? '3px solid #2563EB' : '3px solid transparent', background: 'none', color: tab === value ? '#1D4ED8' : '#1F2937', fontWeight: tab === value ? 700 : 500, cursor: 'pointer' }}>{label}</button>
            ))}
          </div>
          <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} aria-label="Filter by class" style={{ marginLeft: 'auto', minWidth: 180, padding: '9px 12px', border: '1px solid #CBD5E1', borderRadius: 7, background: '#fff', color: '#1F2937' }}>
            <option value="all">All classes</option>
            {classes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
        <div style={{ padding: 20 }}>
          {loading ? <p style={{ color: '#64748B' }}>Loading to-do items...</p> : groups.length === 0 ? <EmptyState icon={<CheckCircle2 size={28} />} title={`No ${tab} items`} description="Published assignments, activities, and assessments will appear here." /> : groups.map(([label, items]) => (
            <section key={label} style={{ marginBottom: 22 }}>
              <h2 style={{ margin: '0 0 10px', fontSize: '1.05rem', fontWeight: 600, color: '#1F2937' }}>{label}<span style={{ float: 'right', color: '#2563EB', fontSize: '0.85rem' }}>{items.length}</span></h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {items.map((item) => {
                  const classItem = typeof item.class === 'object' ? item.class : null;
                  const subject = typeof item.subject === 'object' ? item.subject : null;
                  const status = getStudentWorkStatus(item);
                  const pastDue = item.dueDate ? Date.now() > new Date(item.dueDate).getTime() : false;
                  const dueLabel = item.dueDate ? `${pastDue ? 'Past due • ' : ''}Due ${format(new Date(item.dueDate), 'MMM d, yyyy')}${item.dueTime ? ` at ${item.dueTime}` : ''}` : 'No due date';
                  return <button key={item._id} type="button" onClick={() => navigate(`/student/classes/${getId(item.class)}/classwork/${item._id}`)} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%', padding: 12, textAlign: 'left', border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer' }}>
                    <span style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: '50%', background: '#DBEAFE', color: '#2563EB', flexShrink: 0 }}><ClipboardList size={17} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', color: '#111827' }}>{item.title}</strong><span style={{ display: 'block', marginTop: 3, color: '#64748B', fontSize: '0.78rem' }}>{classItem?.section || classItem?.name || 'Class'}{subject?.name ? ` · ${subject.name}` : ''}</span>{tab !== 'done' && <span style={{ display: 'block', marginTop: 5, color: tab === 'missing' || pastDue ? '#DC2626' : '#64748B', fontSize: '0.78rem' }}><Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{dueLabel}</span>}</span>
                    <Badge label={tab === 'done' ? status.label : tab === 'missing' ? 'Missing' : status.label === 'Past due' ? 'Past due' : item.type} color={status.color} />
                  </button>;
                })}
              </div>
            </section>
          ))}
        </div>
      </Card>
    </div>
  );
}
