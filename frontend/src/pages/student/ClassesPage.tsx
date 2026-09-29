import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, GraduationCap, Search, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button, Card, EmptyState, Input, Modal } from '../../components/ui';
import { classesApi } from '../../utils/api';
import type { Class, Subject, User } from '../../types';

const CARD_TONES = [
  ['#7a1010', '#9c2d2d'],
  ['#2563EB', '#3B82F6'],
  ['#059669', '#10B981'],
  ['#D97706', '#F59E0B'],
  ['#7C3AED', '#A78BFA'],
  ['#BE185D', '#EC4899'],
];

export default function StudentClassesPage() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<Class[]>([]);
  const [search, setSearch] = useState('');
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadClasses = async () => {
    setLoading(true);
    try {
      const response = await classesApi.getAll({ limit: 50 });
      setClasses(response.data.classes || []);
    } catch {
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadClasses(); }, []);

  const filteredClasses = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return classes;

    return classes.filter((item) => {
      const subjectNames = (item.subjects || [])
        .map((subject) => (typeof subject === 'object' && subject ? subject.name : ''))
        .join(' ');
      const classLabel = item.section || item.name || 'Class';
      const haystack = `${subjectNames} ${classLabel}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [classes, search]);

  const handleJoinClass = async () => {
    if (!inviteCode.trim()) {
      toast.error('Please enter an invite code.');
      return;
    }

    setJoining(true);
    try {
      await classesApi.joinByCode(inviteCode.trim());
      toast.success('You joined the class successfully.');
      setJoinModalOpen(false);
      setInviteCode('');
      await loadClasses();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Unable to join class.');
    } finally {
      setJoining(false);
    }
  };

  const getPrimarySubject = (item: Class) => {
    const subject = (item.subjects || []).find((candidate) => typeof candidate === 'object' && candidate !== null) as Subject | undefined;
    return subject || null;
  };

  const getTeacherName = (item: Class) => {
    const primarySubject = getPrimarySubject(item);
    const subjectTeacher = primarySubject && typeof primarySubject.teacher === 'object' ? (primarySubject.teacher as User)?.name : null;
    if (subjectTeacher) return subjectTeacher;
    if (typeof item.adviser === 'object' && item.adviser) return item.adviser.name;
    return 'Teacher';
  };

  const renderContent = () => {
    if (loading) {
      return <Card padding="48px"><p style={{ textAlign: 'center', color: '#64748B', margin: 0 }}>Loading your classes...</p></Card>;
    }

    if (classes.length === 0) {
      return (
        <Card>
          <EmptyState
            icon={<GraduationCap size={28} />}
            title="No classes yet"
            description="Join a class to start seeing your subjects, sessions, and updates."
            action={<Button icon={<UserPlus size={16} />} onClick={() => setJoinModalOpen(true)}>Join Class</Button>}
          />
        </Card>
      );
    }

    if (filteredClasses.length === 0) {
      return (
        <Card>
          <EmptyState
            icon={<Search size={28} />}
            title="No subjects found"
            description="Try a different subject name or class keyword to narrow your view."
            action={<Button icon={<UserPlus size={16} />} onClick={() => setJoinModalOpen(true)}>Join Class</Button>}
          />
        </Card>
      );
    }

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
        {filteredClasses.map((item, index) => {
          const primarySubject = getPrimarySubject(item);
          const subjectName = primarySubject?.name || 'Subject';
          const classLabel = item.section || item.name || 'Class';
          const tone = CARD_TONES[index % CARD_TONES.length];

          return (
            <button
              key={item._id}
              type="button"
              onClick={() => navigate(`/student/classes/${item._id}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(`/student/classes/${item._id}`);
                }
              }}
              aria-label={`Open ${classLabel} class`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                textAlign: 'left',
                border: '1px solid #E5E7EB',
                background: '#fff',
                borderRadius: 18,
                overflow: 'hidden',
                padding: 0,
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={(event) => {
                const element = event.currentTarget as HTMLButtonElement;
                element.style.transform = 'translateY(-2px)';
                element.style.boxShadow = '0 14px 28px rgba(15, 23, 42, 0.08)';
              }}
              onMouseLeave={(event) => {
                const element = event.currentTarget as HTMLButtonElement;
                element.style.transform = 'translateY(0)';
                element.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.05)';
              }}
            >
              <div style={{
                background: `linear-gradient(135deg, ${tone[0]}, ${tone[1]})`,
                color: '#fff',
                padding: '18px 18px 16px',
                minHeight: 110,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.68rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, opacity: 0.92 }}>
                    {subjectName}
                  </span>
                  <span style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', padding: '5px 8px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700 }}>
                    {(item.subjects || []).length} {((item.subjects || []).length === 1 ? 'subject' : 'subjects')}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '1.6rem', lineHeight: 1.15, letterSpacing: '-0.03em' }}>
                  {classLabel}
                </div>
              </div>

              <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                <div style={{ color: '#64748B', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Class
                </div>
                <div style={{ color: 'var(--gray-900)', fontSize: '1.08rem', fontWeight: 700 }}>
                  {subjectName}
                </div>
                <div style={{ color: '#475569', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Teacher:</span>
                  <span>{getTeacherName(item)}</span>
                </div>
                <div style={{ color: '#64748B', fontSize: '0.8rem' }}>
                  Year level: {item.gradeLevel}
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid #F1F5F9' }}>
                  <span style={{ color: '#7a1010', fontWeight: 700, fontSize: '0.83rem' }}>View Class</span>
                  <span style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 10, background: '#FEE2E2', color: '#7a1010' }}>
                    <ArrowRight size={15} />
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--gray-900)', fontFamily: 'var(--font-display)', margin: 0 }}>My Classes</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginLeft: 'auto' }}>
          <div style={{ position: 'relative', minWidth: 240, flex: 1 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input
              aria-label="Search subject"
              placeholder="Search Subject..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 38px',
                border: '1.5px solid #E5E7EB',
                borderRadius: 10,
                fontSize: '0.875rem',
                color: '#111827',
                outline: 'none',
                background: '#fff',
                fontFamily: 'var(--font-body)',
              }}
            />
          </div>
          <Button icon={<UserPlus size={16} />} onClick={() => setJoinModalOpen(true)}>Join Class</Button>
        </div>
      </div>

      {renderContent()}

      <Modal open={joinModalOpen} onClose={() => setJoinModalOpen(false)} title="Join a Class" width="420px"
        footer={<><Button variant="secondary" onClick={() => setJoinModalOpen(false)}>Cancel</Button><Button loading={joining} onClick={handleJoinClass}>Join</Button></>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input label="Invite code" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="Enter class invite code" />
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#6B7280' }}>Ask your teacher for the invite code to enroll in a class.</p>
        </div>
      </Modal>
    </div>
  );
}