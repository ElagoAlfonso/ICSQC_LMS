import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Users, BookOpen, Search, ChevronRight, Plus, Copy, Check } from 'lucide-react';
import { Card, Badge, EmptyState, Button, Modal, Input, Select } from '../../components/ui';
import { classesApi, subjectsApi, academicYearsApi } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import type { Class, AcademicYear, User, Subject, ClassRequest } from '../../types';
import toast from 'react-hot-toast';

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Grade 7':  { bg:'#EDE9FE', text:'#7C3AED', border:'#C4B5FD' },
  'Grade 8':  { bg:'#EDE9FE', text:'#7C3AED', border:'#C4B5FD' },
  'Grade 9':  { bg:'#FCE7F3', text:'#BE185D', border:'#F9A8D4' },
  'Grade 10': { bg:'#FCE7F3', text:'#BE185D', border:'#F9A8D4' },
  'Grade 11': { bg:'#FEE2E2', text:'#7a1010', border:'#FCA5A5' },
  'Grade 12': { bg:'#FEE2E2', text:'#7a1010', border:'#FCA5A5' },
};

export default function TeacherClassesPage() {
  const { user } = useAuthStore();
  const navigate  = useNavigate();
  const [classes, setClasses] = useState<Class[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [requests, setRequests] = useState<ClassRequest[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({
    name: '',
    section: '',
    gradeLevel: 'Grade 7',
    academicYear: '',
    subject: '',
  });
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const loadData = async () => {
    try {
      const [classesRes, requestsRes, subjectsRes, yearsRes] = await Promise.allSettled([
        classesApi.getAll({ limit: 50 }),
        classesApi.getRequests(),
        subjectsApi.getAll({ limit: 100 }),
        academicYearsApi.getAll(),
      ]);

      if (classesRes.status === 'fulfilled' && subjectsRes.status === 'fulfilled') {
        const allClasses = classesRes.value.data.classes || [];
        const teacherSubjects = (subjectsRes.value.data.subjects || []).filter((subject: Subject) => {
          const teacherId = typeof subject.teacher === 'object' ? (subject.teacher as User)._id : subject.teacher;
          return teacherId === user?._id;
        });
        const teacherSubjectIds = teacherSubjects.map((subject: Subject) => subject._id);

        const myClasses = allClasses.filter((c: Class) => {
          const adviserId = typeof c.adviser === 'object' ? (c.adviser as User)._id : c.adviser;
          if (adviserId === user?._id) return true;

          const classSubjectIds = (((c as any)?.subjects || []) as Array<Subject | string>).map((subject: Subject | string) =>
            typeof subject === 'object' ? (subject as Subject)._id : subject
          );

          return classSubjectIds.some((subjectId) => teacherSubjectIds.includes(subjectId));
        });

        setClasses(myClasses);
      }

      if (requestsRes.status === 'fulfilled') {
        setRequests((requestsRes.value.data.requests || []).filter((request: ClassRequest) => {
          const teacherId = typeof request.teacher === 'object' ? (request.teacher as User)._id : request.teacher;
          return teacherId === user?._id;
        }));
      }

      if (subjectsRes.status === 'fulfilled') setSubjects(subjectsRes.value.data.subjects || []);
      if (yearsRes.status === 'fulfilled') setAcademicYears(yearsRes.value.data || []);
    } catch { toast.error('Failed to load class data'); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const getClassDisplay = (cls: Partial<Class>) => cls.section || cls.name || 'Class';

  const filtered = classes.filter(c =>
    !search || `${getClassDisplay(c)} ${c.gradeLevel}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleCopyInviteCode = async (classId: string, inviteCode?: string) => {
    if (!inviteCode) {
      toast.error('This class does not have an invite code yet.');
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopiedId(classId);
      toast.success('Invite code copied.');
      window.setTimeout(() => setCopiedId((current) => current === classId ? null : current), 1500);
    } catch {
      toast.error('Unable to copy invite code.');
    }
  };

  const handleRequestClass = async () => {
    if (!requestForm.name || !requestForm.section || !requestForm.academicYear || !requestForm.subject) {
      toast.error('Please complete all required fields.');
      return;
    }

    setSubmittingRequest(true);
    try {
      await classesApi.requestClass(requestForm);
      toast.success('Class request submitted for admin approval.');
      setRequestModalOpen(false);
      setRequestForm({ name: '', section: '', gradeLevel: 'Grade 7', academicYear: '', subject: '' });
      await loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit class request');
    }
    setSubmittingRequest(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111' }}>My Classes</h1>
          <p style={{ color: '#6B7280', fontSize: '0.875rem', marginTop: 2 }}>Classes where you are the class adviser</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ padding: '6px 14px', background: '#F3F4F6', borderRadius: 10, fontSize: '0.8rem', color: '#4B5563', fontWeight: 500 }}>
            {classes.length} class{classes.length !== 1 ? 'es' : ''}
          </span>
          <Button icon={<Plus size={16} />} onClick={() => setRequestModalOpen(true)}>Request Class</Button>
        </div>
      </div>

      {requests.length > 0 && (
        <Card title="Pending Requests" subtitle="Awaiting administrator review">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {requests.map((request) => (
              <div key={request._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#F9FAFB', borderRadius: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#111' }}>{request.section || request.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{request.gradeLevel} · {typeof request.subject === 'object' ? (request.subject as Subject).name : 'Subject'} · {typeof request.academicYear === 'object' ? (request.academicYear as AcademicYear).name : 'Year'}</div>
                </div>
                <Badge label={request.status} color={request.status === 'approved' ? 'green' : request.status === 'rejected' ? 'red' : 'yellow'} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card padding="14px">
        <div style={{ position: 'relative', maxWidth: 400 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input placeholder="Search classes…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 14px 9px 36px', border: '1.5px solid #E5E7EB', borderRadius: 9, fontSize: '0.875rem', outline: 'none' }} />
        </div>
      </Card>

      {loading ? (
        <Card padding="48px">
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #E5E7EB', borderTopColor: '#7a1010', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
            <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Loading classes…</p>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </Card>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={<GraduationCap size={28}/>} title="No classes assigned" description="You have not been assigned as adviser to any class yet. Contact your admin." /></Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map(cls => {
            const colors = GRADE_COLORS[cls.gradeLevel] || { bg:'#F3F4F6', text:'#6B7280', border:'#E5E7EB' };
            const ay = typeof cls.academicYear === 'object' ? (cls.academicYear as AcademicYear).name : '—';
            const primarySubject = cls.subjects?.[0];
            return (
              <div
                key={cls._id}
                onClick={() => {
                  navigate(`/teacher/classes/${cls._id}`);
                }}
                style={{
                  background: '#fff', borderRadius: 14, padding: '20px',
                  border: `1.5px solid ${colors.border}40`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  transition: 'all 0.18s',
                  cursor: 'pointer',
                  position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = 'translateY(-2px)';
                  el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                  el.style.borderColor = `${colors.border}`;
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = 'translateY(0)';
                  el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)';
                  el.style.borderColor = `${colors.border}40`;
                }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: colors.text, borderRadius: '14px 14px 0 0' }} />

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, marginTop: 6 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <GraduationCap size={20} color={colors.text} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111', marginBottom: 2 }}>{getClassDisplay(cls)}</h3>
                    <p style={{ fontSize: '0.78rem', color: '#6B7280' }}>{cls.gradeLevel} · A.Y. {ay}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Badge label={cls.isActive ? 'Active' : 'Inactive'} color={cls.isActive ? 'green' : 'gray'} />
                    <ChevronRight size={14} color="#9CA3AF" />
                  </div>
                </div>

                <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '8px 10px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: '0.64rem', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Invite Code</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111' }}>{cls.inviteCode || 'Not available'}</div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyInviteCode(cls._id, cls.inviteCode);
                    }}
                    style={{
                      border: '1px solid #D1D5DB',
                      background: copiedId === cls._id ? '#DCFCE7' : '#fff',
                      color: '#111827',
                      borderRadius: 8,
                      padding: '6px 8px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    aria-label="Copy invite code"
                  >
                    {copiedId === cls._id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ padding: '9px 12px', background: '#F9FAFB', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={13} color="#7a1010" />
                    <div>
                      <p style={{ fontSize: '0.65rem', color: '#9CA3AF', fontWeight: 500 }}>Students</p>
                      <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111' }}>{cls.students?.length || 0}</p>
                    </div>
                  </div>
                  <div style={{ padding: '9px 12px', background: '#F9FAFB', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BookOpen size={13} color="#2563EB" />
                    <div>
                      <p style={{ fontSize: '0.65rem', color: '#9CA3AF', fontWeight: 500 }}>Subjects</p>
                      <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111' }}>{cls.subjects?.length || 0}</p>
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      <Modal open={requestModalOpen} onClose={() => setRequestModalOpen(false)} title="Request New Class" width="520px"
        footer={<><Button variant="secondary" onClick={() => setRequestModalOpen(false)}>Cancel</Button><Button loading={submittingRequest} onClick={handleRequestClass}>Submit Request</Button></>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Class Name *" value={requestForm.name} onChange={(e) => setRequestForm({ ...requestForm, name: e.target.value })} placeholder="e.g. Rizal" />
          <Input label="Section *" value={requestForm.section} onChange={(e) => setRequestForm({ ...requestForm, section: e.target.value })} placeholder="e.g. 202" />
          <Select label="Grade Level *" value={requestForm.gradeLevel} onChange={(e) => setRequestForm({ ...requestForm, gradeLevel: e.target.value })} options={[{ value: 'Grade 7', label: 'Grade 7' }, { value: 'Grade 8', label: 'Grade 8' }, { value: 'Grade 9', label: 'Grade 9' }, { value: 'Grade 10', label: 'Grade 10' }, { value: 'Grade 11', label: 'Grade 11' }, { value: 'Grade 12', label: 'Grade 12' }]} />
          <Select label="Subject *" value={requestForm.subject} onChange={(e) => setRequestForm({ ...requestForm, subject: e.target.value })} options={[{ value: '', label: 'Select a subject' }, ...subjects.map((subject) => ({ value: subject._id, label: `${subject.name} (${subject.code})` }))]} />
          <Select label="Academic Year *" value={requestForm.academicYear} onChange={(e) => setRequestForm({ ...requestForm, academicYear: e.target.value })} options={[{ value: '', label: 'Select academic year' }, ...academicYears.map((year) => ({ value: year._id, label: year.name }))]} />
        </div>
      </Modal>
    </div>
  );
}
