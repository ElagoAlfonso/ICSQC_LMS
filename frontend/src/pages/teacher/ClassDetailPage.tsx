import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, BookOpen, Mail, Search, GraduationCap, ChevronRight } from 'lucide-react';
import { Card, Badge, EmptyState } from '../../components/ui';
import { classesApi } from '../../utils/api';
import type { Class, AcademicYear, User } from '../../types';
import toast from 'react-hot-toast';

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cls, setCls]       = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [tab, setTab]         = useState<'students' | 'subjects'>('students');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await classesApi.getById(id!);
        setCls(res.data.class || res.data);
      } catch { toast.error('Failed to load class details'); }
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #E5E7EB', borderTopColor: '#7a1010', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Loading class details…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  if (!cls) return (
    <Card><EmptyState icon={<GraduationCap size={28}/>} title="Class not found" description="This class doesn't exist or you don't have access." action={{ label: 'Back to Classes', onClick: () => navigate('/teacher/classes') }} /></Card>
  );

  const ay = typeof cls.academicYear === 'object' ? (cls.academicYear as AcademicYear).name : '—';
  const students = (cls.students || []) as any[];
  const subjects = (cls.subjects || []) as any[];

  const filteredStudents = students.filter((s: any) => {
    const name = s.name || s.email || '';
    return !search || name.toLowerCase().includes(search.toLowerCase());
  });

  const AVATAR_COLORS = ['#7a1010','#2563EB','#059669','#7C3AED','#D97706','#BE185D','#0891B2'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Back button */}
      <button onClick={() => navigate('/teacher/classes')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#7a1010', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, padding: 0 }}>
        <ArrowLeft size={16}/> Back to My Classes
      </button>

      {/* Class header – Google Classroom-style banner */}
      <div style={{ background: 'linear-gradient(135deg, #7a1010 0%, #a02020 100%)', borderRadius: 16, padding: '32px 28px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', bottom: -20, right: 40, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 4 }}>{cls.name} – {cls.section}</h1>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.95rem', marginBottom: 20 }}>{cls.gradeLevel} · Academic Year {ay}</p>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 18px', backdropFilter: 'blur(8px)' }}>
                  <p style={{ fontSize: '1.4rem', fontWeight: 700 }}>{students.length}</p>
                  <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Students</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 18px', backdropFilter: 'blur(8px)' }}>
                  <p style={{ fontSize: '1.4rem', fontWeight: 700 }}>{subjects.length}</p>
                  <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Subjects</p>
                </div>
              </div>
            </div>
            <Badge label={cls.isActive ? 'Active' : 'Inactive'} color={cls.isActive ? 'green' : 'gray'} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
        {(['students', 'subjects'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.15s', background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#7a1010' : '#6B7280', boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', textTransform: 'capitalize' }}>
            {t === 'students' ? `Students (${students.length})` : `Subjects (${subjects.length})`}
          </button>
        ))}
      </div>

      {/* Students Tab */}
      {tab === 'students' && (
        <>
          <Card padding="14px">
            <div style={{ position: 'relative', maxWidth: 400 }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
              <input placeholder="Search students…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '9px 14px 9px 36px', border: '1.5px solid #E5E7EB', borderRadius: 9, fontSize: '0.875rem', outline: 'none' }} />
            </div>
          </Card>

          {filteredStudents.length === 0 ? (
            <Card><EmptyState icon={<Users size={26}/>} title="No students found" description={students.length === 0 ? "No students have been enrolled in this class yet." : "No students match your search."} /></Card>
          ) : (
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {filteredStudents.map((s: any, i: number) => {
                  const name  = s.name  || 'Unknown Student';
                  const email = s.email || '—';
                  const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                  const storedAvatar = localStorage.getItem(`avatar_${s._id}`);
                  return (
                    <div key={s._id || i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 4px', borderBottom: i < filteredStudents.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: storedAvatar ? 'transparent' : color + '22', border: `2px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                        {storedAvatar
                          ? <img src={storedAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: '0.875rem', fontWeight: 700, color }}>{name.charAt(0).toUpperCase()}</span>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111', marginBottom: 2 }}>{name}</p>
                        <p style={{ fontSize: '0.75rem', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={11}/>{email}</p>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#9CA3AF', fontWeight: 500 }}>#{i + 1}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Subjects Tab */}
      {tab === 'subjects' && (
        subjects.length === 0 ? (
          <Card><EmptyState icon={<BookOpen size={26}/>} title="No subjects" description="No subjects have been assigned to this class yet." /></Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {subjects.map((sub: any, i: number) => {
              const name = sub.name || sub;
              return (
                <div key={sub._id || i} style={{ background: '#fff', borderRadius: 12, padding: '18px', border: '1.5px solid #F3F4F6', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <BookOpen size={18} color="#7a1010" />
                  </div>
                  <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111', marginBottom: 4 }}>{name}</p>
                  {sub.teacher && <p style={{ fontSize: '0.75rem', color: '#6B7280' }}>Teacher: {typeof sub.teacher === 'object' ? (sub.teacher as User).name : sub.teacher}</p>}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
