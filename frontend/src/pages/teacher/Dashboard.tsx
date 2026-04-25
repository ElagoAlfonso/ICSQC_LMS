import React, { useEffect, useState } from 'react';
import { BookOpen, ClipboardList, Users, FileText, Clock } from 'lucide-react';
import { StatCard, Card, Badge } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { subjectsApi, examsApi, submissionsApi, academicYearsApi } from '../../utils/api';
import { format } from 'date-fns';
import type { Exam, Subject } from '../../types';

export default function TeacherDashboard() {
  const { user } = useAuthStore();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [currentYear, setCurrentYear] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [subjRes, examRes, ayRes] = await Promise.allSettled([
          subjectsApi.getAll({ limit: 20 }),
          examsApi.getAll({ limit: 6 }),
          academicYearsApi.getAll(),
        ]);
        if (subjRes.status === 'fulfilled') setSubjects(subjRes.value.data.subjects || []);
        if (examRes.status === 'fulfilled') setExams(examRes.value.data.exams || []);
        if (ayRes.status === 'fulfilled') {
          const current = ayRes.value.data.find((ay: any) => ay.isCurrent);
          if (current) setCurrentYear(current.name);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const activeExams = exams.filter(e => e.status === 'published');
  const draftExams = exams.filter(e => e.status === 'draft');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1A2744 0%, #243260 60%, #2563EB 100%)',
        borderRadius: '16px', padding: '28px 32px', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontWeight: 700, fontSize: '1.4rem', marginBottom: '4px' }}>
            Welcome, {user?.name?.split(' ')[0]}!
          </h2>
          <p style={{ opacity: 0.7, fontSize: '0.875rem' }}>Teacher Portal · {currentYear || 'Loading...'}</p>
        </div>
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: '1rem', fontWeight: 600 }}>{format(new Date(), 'EEEE')}</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.65 }}>{format(new Date(), 'MMMM d, yyyy')}</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <StatCard label="My Subjects" value={subjects.length} icon={<BookOpen size={22} />} color="#2563EB" bg="#DBEAFE" />
        <StatCard label="Active Exams" value={activeExams.length} icon={<ClipboardList size={22} />} color="#8B1A1A" bg="#FEE2E2" />
        <StatCard label="Draft Exams" value={draftExams.length} icon={<FileText size={22} />} color="#D97706" bg="#FEF3C7" />
        <StatCard label="Total Exams" value={exams.length} icon={<FileText size={22} />} color="#059669" bg="#D1FAE5" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* My Subjects */}
        <Card title="My Subjects" subtitle={`${subjects.length} subjects assigned`}>
          {subjects.length === 0 ? (
            <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem', padding: '20px 0', textAlign: 'center' }}>No subjects assigned yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {subjects.slice(0, 6).map((s, i) => {
                const colors = ['#FEE2E2','#DBEAFE','#D1FAE5','#FEF3C7','#EDE9FE','#FCE7F3'];
                const texts = ['#8B1A1A','#2563EB','#059669','#D97706','#7C3AED','#BE185D'];
                return (
                  <div key={s._id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px', borderRadius: '10px', background: 'var(--gray-50)',
                  }}>
                    <div style={{ width: 36, height: 36, borderRadius: '9px', background: colors[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: texts[i % 6] }}>{s.code.slice(0, 3)}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>{s.gradeLevel} · {s.units} unit{s.units !== 1 ? 's' : ''}</div>
                    </div>
                    <Badge label={s.isActive ? 'Active' : 'Inactive'} color={s.isActive ? 'green' : 'gray'} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Exams overview */}
        <Card title="Recent Exams">
          {exams.length === 0 ? (
            <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem', padding: '20px 0', textAlign: 'center' }}>No exams created yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {exams.slice(0, 5).map((exam) => (
                <div key={exam._id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px', borderRadius: '10px', background: 'var(--gray-50)',
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: '9px', background: exam.status === 'published' ? '#D1FAE5' : exam.status === 'draft' ? '#FEF3C7' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ClipboardList size={16} color={exam.status === 'published' ? '#059669' : exam.status === 'draft' ? '#D97706' : '#6B7280'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exam.title}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>
                      {exam.examType} · {exam.questions?.length || 0} questions · {exam.totalPoints} pts
                    </div>
                  </div>
                  <Badge
                    label={exam.status}
                    color={exam.status === 'published' ? 'green' : exam.status === 'draft' ? 'yellow' : 'gray'}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
