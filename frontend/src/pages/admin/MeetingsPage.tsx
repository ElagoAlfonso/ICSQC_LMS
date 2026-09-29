import { useEffect, useState } from 'react';
import { Trash2, Video } from 'lucide-react';
import { Badge, Button, Card, Input, Modal } from '../../components/ui';
import { meetingsApi } from '../../utils/api';
import type { Meeting, Subject, Class, User } from '../../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [editValues, setEditValues] = useState({ meetingTitle: '', startDateTime: '', endDateTime: '' });

  const load = async () => {
    setLoading(true);
    try { const response = await meetingsApi.getAdmin(date ? { date } : undefined); setMeetings(response.data.meetings || []); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Unable to load meetings.'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [date]);

  const remove = async (id: string) => {
    if (!window.confirm('Delete this meeting and its Google Calendar event?')) return;
    try { await meetingsApi.delete(id); toast.success('Meeting deleted.'); load(); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Unable to delete meeting.'); }
  };

  const edit = (item: Meeting) => {
    setEditing(item);
    setEditValues({ meetingTitle: item.meetingTitle, startDateTime: item.startDateTime.slice(0, 16), endDateTime: item.endDateTime.slice(0, 16) });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try { await meetingsApi.update(editing._id, editValues); toast.success('Meeting schedule updated.'); setEditing(null); load(); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Unable to update meeting.'); }
  };

  return <Card title="Google Meet sessions" subtitle={`${meetings.length} scheduled sessions`} action={<Input type="date" value={date} onChange={e => setDate(e.target.value)} />}>
    {loading ? <p>Loading meetings...</p> : meetings.length === 0 ? <p style={{ color: '#6B7280' }}>No meetings match the selected date.</p> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}><thead><tr>{['Meeting', 'Subject', 'Class', 'Teacher', 'Schedule', 'Status', ''].map(label => <th key={label} style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #E5E7EB', color: '#64748B' }}>{label}</th>)}</tr></thead><tbody>{meetings.map(item => { const subject = typeof item.subjectId === 'object' ? item.subjectId as Subject : null; const classDoc = typeof item.classId === 'object' ? item.classId as Class : null; const teacher = typeof item.teacherId === 'object' ? item.teacherId as User : null; return <tr key={item._id}><td style={{ padding: 10 }}><Video size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />{item.meetingTitle}</td><td>{subject?.name || '-'}</td><td>{classDoc ? `${classDoc.name} - ${classDoc.section}` : '-'}</td><td>{teacher?.name || '-'}</td><td>{format(new Date(item.startDateTime), 'MMM d, yyyy h:mm a')} - {format(new Date(item.endDateTime), 'h:mm a')}</td><td><Badge label={item.status} color={item.status === 'Scheduled' ? 'blue' : item.status === 'Live' ? 'green' : 'gray'} /></td><td style={{ display: 'flex', gap: 4 }}><Button variant="ghost" size="sm" onClick={() => edit(item)}>Edit</Button><Button variant="ghost" size="sm" icon={<Trash2 size={15} />} onClick={() => remove(item._id)} aria-label="Delete meeting" /></td></tr>; })}</tbody></table></div>}
    <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit Google Meet" footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={saveEdit}>Save changes</Button></>}>
      <div style={{ display: 'grid', gap: 12 }}><Input label="Meeting title" value={editValues.meetingTitle} onChange={e => setEditValues({ ...editValues, meetingTitle: e.target.value })} /><Input label="Start" type="datetime-local" value={editValues.startDateTime} onChange={e => setEditValues({ ...editValues, startDateTime: e.target.value })} /><Input label="End" type="datetime-local" value={editValues.endDateTime} onChange={e => setEditValues({ ...editValues, endDateTime: e.target.value })} /></div>
    </Modal>
  </Card>;
}