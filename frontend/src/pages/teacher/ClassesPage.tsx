import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Users, BookOpen, Search, ChevronRight } from 'lucide-react';
import { Card, Badge, EmptyState } from '../../components/ui';
import { classesApi } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import type { Class, AcademicYear, User } from '../../types';
import toast from 'react-hot-toast';

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Kinder':   { bg:'#FEF2F2', text:'#7a1010', border:'#FCA5A5' },
  'Grade 1':  { bg:'#FEF3C7', text:'#D97706', border:'#FCD34D' },
  'Grade 2':  { bg:'#FEF3C7', text:'#D97706', border:'#FCD34D' },
  'Grade 3':  { bg:'#D1FAE5', text:'#059669', border:'#6EE7B7' },
  'Grade 4':  { bg:'#D1FAE5', text:'#059669', border:'#6EE7B7' },
  'Grade 5':  { bg:'#DBEAFE', text:'#2563EB', border:'#93C5FD' },
  'Grade 6':  { bg:'#DBEAFE', text:'#2563EB', border:'#93C5FD' },
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await classesApi.getAll({ limit: 50 });
        const myClasses = (res.data.classes || []).filter((c: Class) => {
          if (!c.adviser) return false;
          const adviserId = typeof c.adviser === 'object' ? (c.adviser as User)._id : c.adviser;
          return adviserId === user?._id;
        });
        setClasses(myClasses);
      } catch { toast.error('Failed to load classes'); }
      setLoading(false);
    };
    load();
  }, [user]);

  const filtered = classes.filter(c =>
    !search || `${c.name} ${c.section} ${c.gradeLevel}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111' }}>My Classes</h1>
          <p style={{ color: '#6B7280', fontSize: '0.875rem', marginTop: 2 }}>Classes where you are the class adviser</p>
        </div>
        <span style={{ padding: '6px 14px', background: '#F3F4F6', borderRadius: 10, fontSize: '0.8rem', color: '#4B5563', fontWeight: 500 }}>
          {classes.length} class{classes.length !== 1 ? 'es' : ''}
        </span>
      </div>

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
            return (
              <div
                key={cls._id}
                onClick={() => navigate(`/teacher/classes/${cls._id}`)}
                style={{
                  background: '#fff', borderRadius: 14, padding: '20px',
                  border: `1.5px solid ${colors.border}40`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  cursor: 'pointer', transition: 'all 0.18s',
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
                {/* Color accent bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: colors.text, borderRadius: '14px 14px 0 0' }} />

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, marginTop: 6 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <GraduationCap size={20} color={colors.text} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111', marginBottom: 2 }}>{cls.name} – {cls.section}</h3>
                    <p style={{ fontSize: '0.78rem', color: '#6B7280' }}>{cls.gradeLevel} · A.Y. {ay}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Badge label={cls.isActive ? 'Active' : 'Inactive'} color={cls.isActive ? 'green' : 'gray'} />
                    <ChevronRight size={14} color="#9CA3AF" />
                  </div>
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

                <p style={{ fontSize: '0.72rem', color: '#9CA3AF', marginTop: 12, textAlign: 'center' }}>Click to view class details →</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
