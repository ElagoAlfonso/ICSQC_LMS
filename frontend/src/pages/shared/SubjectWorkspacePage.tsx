import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Download, FileText, MessageSquare, Paperclip, Plus, Send, Users, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Badge, Button, Card, EmptyState, Input, Modal } from '../../components/ui';
import { subjectsApi } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import type { Announcement, Attachment, SubjectWorkspace, User } from '../../types';

type Tab = 'stream' | 'classwork' | 'people';
const ATTACHMENT_ACCEPT = '.pdf,.docx,.doc,.xlsx,.xls,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.bmp,.mp3,.wav,.mp4,.mov,.zip,.rar,.7z';
const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;

const formatBytes = (size: number) => size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
const attachmentKind = (attachment: Attachment | File) => {
  const mimeType = 'type' in attachment ? attachment.type : attachment.mimeType;
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'file';
};

export default function SubjectWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [workspace, setWorkspace] = useState<SubjectWorkspace | null>(null);
  const [tab, setTab] = useState<Tab>('stream');
  const [loading, setLoading] = useState(true);
  const [postOpen, setPostOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', content: '' });
  const [files, setFiles] = useState<File[]>([]);

  const load = async () => {
    try {
      const response = await subjectsApi.getWorkspace(id!);
      setWorkspace(response.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to load this subject');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const createPost = async () => {
    if (!form.title.trim() || !form.content.trim()) { toast.error('Title and message are required'); return; }
    setSaving(true);
    try {
      const data = new FormData();
      data.append('title', form.title.trim());
      data.append('content', form.content.trim());
      files.forEach((file) => data.append('attachments', file));
      await subjectsApi.createPost(id!, data);
      toast.success('Post published');
      setForm({ title: '', content: '' });
      setFiles([]);
      setPostOpen(false);
      await load();
    } catch (error: any) { toast.error(error.response?.data?.message || 'Unable to publish post'); }
    finally { setSaving(false); }
  };

  const addFiles = (selected: FileList | null) => {
    if (!selected) return;
    const next = [...files];
    for (const file of Array.from(selected)) {
      const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
      if (!ATTACHMENT_ACCEPT.split(',').includes(extension)) { toast.error(`Unsupported file type: ${extension}`); continue; }
      if (file.size > MAX_ATTACHMENT_SIZE) { toast.error(`${file.name} exceeds the 50 MB upload limit.`); continue; }
      if (next.length >= 10) { toast.error('You can attach up to 10 files per post.'); break; }
      next.push(file);
    }
    setFiles(next);
  };

  const attachmentUrl = (postId: string, attachmentId: string) => `/api/posts/${postId}/attachments/${attachmentId}`;

  if (loading) return <Card padding="48px"><p style={{ textAlign: 'center', color: '#6B7280' }}>Loading subject workspace...</p></Card>;
  if (!workspace) return <Card><EmptyState icon={<BookOpen size={28} />} title="Subject unavailable" description="This subject does not exist or you do not have access." /></Card>;

  const { subject, posts, students, exams } = workspace;
  const teacher = typeof subject.teacher === 'object' ? subject.teacher as User : null;
  const academicYear = typeof subject.academicYear === 'object' ? subject.academicYear.name : 'Academic year unavailable';
  const canPost = user?.role === 'teacher';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <button onClick={() => navigate('/student/subjects')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, background: 'none', color: '#7a1010', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
        <ArrowLeft size={16} /> Back to My Subjects
      </button>

      <section style={{ background: 'linear-gradient(135deg, #8f1116 0%, #a91c20 100%)', color: '#fff', borderRadius: 16, padding: '32px 28px 30px', minHeight: 198, boxSizing: 'border-box' }}>
        <p style={{ opacity: .82, fontSize: '.78rem', fontWeight: 800, margin: 0, letterSpacing: '.03em' }}>{subject.code}</p>
        <h1 style={{ fontSize: '1.9rem', lineHeight: 1.15, margin: '14px 0 16px', fontWeight: 800 }}>{subject.name}</h1>
        <p style={{ color: 'rgba(255,255,255,.86)', margin: 0, fontSize: '.95rem' }}>{subject.description || `${subject.gradeLevel} · Academic Year ${academicYear}`}</p>
        {teacher && <p style={{ color: 'rgba(255,255,255,.86)', fontSize: '.82rem', margin: '17px 0 0' }}>Teacher: {teacher.name}</p>}
      </section>

      <div style={{ display: 'flex', gap: 20, borderBottom: '1px solid #E5E7EB', paddingLeft: 4 }}>
        {([['stream', MessageSquare, 'Stream'], ['classwork', FileText, 'Classwork'], ['people', Users, 'People']] as const).map(([key, Icon, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 12px 13px', border: 0, borderBottom: tab === key ? '3px solid #8f1116' : '3px solid transparent', background: 'none', color: tab === key ? '#8f1116' : '#64748B', cursor: 'pointer', fontWeight: tab === key ? 700 : 500 }}><Icon size={16} />{label}</button>
        ))}
      </div>

      {tab === 'stream' && <>
        {canPost && <button onClick={() => setPostOpen(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', border: '1px solid #E5E7EB', background: '#fff', borderRadius: 12, color: '#6B7280', cursor: 'pointer', textAlign: 'left' }}><Plus size={17} color="#7a1010" /> Announce something to your class...</button>}
        {posts.length === 0 ? <Card><EmptyState icon={<MessageSquare size={28} />} title="No posts yet" description={canPost ? "Create your first announcement or update for this class." : "Your teacher hasn't posted anything for this subject yet."} /></Card> : posts.map((post: Announcement) => {
          const author = typeof post.author === 'object' ? post.author as User : null;
          return <Card key={post._id} padding="26px 24px">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}><div><strong style={{ color: '#0F172A', fontSize: '.9rem' }}>{author?.name || 'Teacher'}</strong><div style={{ color: '#94A3B8', fontSize: '.75rem', marginTop: 6 }}>{format(new Date(post.createdAt), 'MMMM d, yyyy · h:mm a')}</div></div>{post.isPinned && <Badge label="Pinned" color="red" />}</div>
            <h3 style={{ margin: '0 0 10px', color: '#0F172A', fontSize: '1.05rem' }}>{post.title}</h3><p style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#475569', lineHeight: 1.6, fontSize: '.92rem' }}>{post.content}</p>
            {!!post.attachments?.length && <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 18 }}>{post.attachments.map((attachment) => {
              const kind = attachmentKind(attachment);
              const url = attachmentUrl(post._id, attachment._id);
              return <div key={attachment._id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                {kind === 'image' && <img src={url} alt={attachment.originalName} style={{ display: 'block', width: '100%', maxHeight: 240, objectFit: 'contain', background: '#F8FAFC' }} />}
                {kind === 'audio' && <audio controls src={url} style={{ width: '100%', margin: '10px 12px 0', maxWidth: 'calc(100% - 24px)' }} />}
                {kind === 'video' && <video controls src={url} style={{ display: 'block', width: '100%', maxHeight: 280, background: '#0F172A' }} />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}><FileText size={18} color="#8f1116" /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: '.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.originalName}</div><div style={{ fontSize: '.72rem', color: '#94A3B8' }}>{attachment.extension.toUpperCase().slice(1)} · {formatBytes(attachment.size)}</div></div><div style={{ display: 'flex', gap: 10 }}><a href={url} target="_blank" rel="noreferrer" style={{ color: '#8f1116', fontSize: '.76rem', fontWeight: 700, textDecoration: 'none' }}>Open</a><a href={`${url}?download=1`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#8f1116', fontSize: '.76rem', fontWeight: 700, textDecoration: 'none' }}><Download size={15} /> Download</a></div></div>
              </div>;
            })}</div>}
          </Card>;
        })}
      </>}
      {tab === 'classwork' && <Card title={`Classwork · ${exams.length} item${exams.length === 1 ? '' : 's'}`}>
        {exams.length === 0 ? <EmptyState icon={<FileText size={28} />} title="No classwork yet" description="Assignments, activities, and exams for this subject will appear here." /> : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{exams.map((exam) => <div key={exam._id} style={{ padding: 14, border: '1px solid #F3F4F6', borderRadius: 10 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><strong>{exam.title}</strong><Badge label={exam.examType} color="blue" /></div><p style={{ margin: '6px 0 0', color: '#6B7280', fontSize: '.8rem' }}>{exam.description || `${exam.totalPoints} points · ${format(new Date(exam.startDate), 'MMM d, yyyy')}`}</p></div>)}</div>}
      </Card>}
      {tab === 'people' && <Card title={`People · ${students.length} students`}><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{students.length === 0 ? <p style={{ color: '#9CA3AF' }}>No students enrolled yet.</p> : students.map((student) => <div key={student._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #F3F4F6' }}><div style={{ width: 32, height: 32, borderRadius: '50%', background: '#FEE2E2', color: '#7a1010', display: 'grid', placeItems: 'center', fontWeight: 700 }}>{student.name.charAt(0)}</div><div><strong style={{ fontSize: '.875rem' }}>{student.name}</strong><div style={{ color: '#9CA3AF', fontSize: '.75rem' }}>{student.email}</div></div></div>)}</div></Card>}

      <Modal open={postOpen} onClose={() => setPostOpen(false)} title="Create subject post" footer={<><Button variant="secondary" onClick={() => setPostOpen(false)}>Cancel</Button><Button loading={saving} icon={<Send size={15} />} onClick={createPost}>Publish</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}><Input label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Announcement title" /><label style={{ display: 'flex', flexDirection: 'column', gap: 5, color: '#374151', fontSize: '.8rem', fontWeight: 500 }}>Message<textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} rows={6} placeholder="Share an update, reminder, or learning material" style={{ resize: 'vertical', border: '1.5px solid #E5E7EB', borderRadius: 9, padding: '10px 12px', font: 'inherit' }} /></label><label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, width: 'fit-content', color: '#8f1116', fontSize: '.82rem', fontWeight: 700, cursor: 'pointer' }}><Paperclip size={16} /> Add Attachment<input type="file" multiple accept={ATTACHMENT_ACCEPT} onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} style={{ display: 'none' }} /></label>{files.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}><strong style={{ fontSize: '.8rem', color: '#374151' }}>Attachments</strong>{files.map((file, index) => <div key={`${file.name}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8 }}><span style={{ flex: 1, minWidth: 0, fontSize: '.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}<small style={{ display: 'block', color: '#94A3B8' }}>{file.type || 'File'} · {formatBytes(file.size)}</small></span><button type="button" onClick={() => setFiles(files.filter((_, fileIndex) => fileIndex !== index))} aria-label={`Remove ${file.name}`} style={{ border: 0, background: 'none', color: '#64748B', cursor: 'pointer' }}><X size={15} /></button></div>)}</div>}</div>
      </Modal>
    </div>
  );
}