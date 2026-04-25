import React, { useEffect, useState } from 'react';
import { BookMarked, ClipboardList, Award, Clock, Bell, CheckCircle2 } from 'lucide-react';
import { StatCard, Card, Badge } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { examsApi, submissionsApi, academicYearsApi, announcementsApi } from '../../utils/api';
import { format, isPast } from 'date-fns';
import type { Exam, Submission, Announcement } from '../../types';

export default function StudentDashboard() {
  const { user } = useAuthStore();
  const [upcomingExams, setUpcomingExams] = useState<Exam[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentYear, setCurrentYear] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [examRes, subRes, annRes, ayRes] = await Promise.allSettled([
          examsApi.getAll({ status: 'published', limit: 10 }),
          submissionsApi.getMySubmissions(),
          announcementsApi.getAll({ limit: 5 }),
          academicYearsApi.getAll(),
        ]);
        if (examRes.status === 'fulfilled') setUpcomingExams(examRes.value.data.exams || []);
        if (subRes.status === 'fulfilled') setSubmissions(subRes.value.data.submissions || subRes.value.data || []);
        if (annRes.status === 'fulfilled') setAnnouncements(annRes.value.data.announcements || annRes.value.data || []);
        if (ayRes.status === 'fulfilled') {
          const current = ayRes.value.data.find((ay: any) => ay.isCurrent);
          if (current) setCurrentYear(current.name);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const passedCount = submissions.filter(s => s.isPassed).length;
  const avgScore = submissions.length
    ? Math.round(submissions.reduce((a, s) => a + s.percentage, 0) / submissions.length)
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #059669 0%, #065F46 60%, #1A2744 100%)',
        borderRadius: '16px', padding: '28px 32px', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontWeight: 700, fontSize: '1.4rem', marginBottom: '4px' }}>
            Hello, {user?.name?.split(' ')[0]}!
          </h2>
          <p style={{ opacity: 0.7, fontSize: '0.875rem' }}>Student Portal · {currentYear || 'Current Year'}</p>
        </div>
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: '1rem', fontWeight: 600 }}>{format(new Date(), 'EEEE')}</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.65 }}>{format(new Date(), 'MMMM d, yyyy')}</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <StatCard label="Upcoming Exams" value={upcomingExams.length} icon={<ClipboardList size={22} />} color="#8B1A1A" bg="#FEE2E2" />
        <StatCard label="Submitted" value={submissions.length} icon={<CheckCircle2 size={22} />} color="#059669" bg="#D1FAE5" />
        <StatCard label="Passed" value={passedCount} icon={<Award size={22} />} color="#C9A84C" bg="#FEF3C7" />
        <StatCard label="Avg. Score" value={`${avgScore}%`} icon={<BookMarked size={22} />} color="#2563EB" bg="#DBEAFE" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Upcoming Exams */}
        <Card title="Upcoming Exams" subtitle="Published and open for you">
          {upcomingExams.length === 0 ? (
            <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem', padding: '24px 0', textAlign: 'center' }}>No upcoming exams right now</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {upcomingExams.slice(0, 5).map((exam) => {
                const isExpiring = isPast(new Date(exam.endDate));
                return (
                  <div key={exam._id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                    padding: '12px', borderRadius: '10px',
                    background: isExpiring ? '#FFF7ED' : 'var(--gray-50)',
                    border: isExpiring ? '1px solid #FED7AA' : '1px solid transparent',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '9px', flexShrink: 0,
                      background: isExpiring ? '#FEF3C7' : '#DBEAFE',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <ClipboardList size={16} color={isExpiring ? '#D97706' : '#2563EB'} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {exam.title}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: '2px' }}>
                        <Clock size={11} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
                        Due: {format(new Date(exam.endDate), 'MMM d, h:mm a')}
                      </div>
                    </div>
                    <div>
                      <Badge label={exam.examType} color="blue" />
                      <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)', textAlign: 'right', marginTop: '4px' }}>
                        {exam.totalPoints} pts
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Announcements */}
        <Card title="Announcements" subtitle="Latest news and updates">
          {announcements.length === 0 ? (
            <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem', padding: '24px 0', textAlign: 'center' }}>No announcements yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {announcements.map((ann) => (
                <div key={ann._id} style={{
                  padding: '12px', borderRadius: '10px',
                  background: ann.isPinned ? '#FFF9EC' : 'var(--gray-50)',
                  border: ann.isPinned ? '1px solid #FDE68A' : '1px solid transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <Bell size={14} color={ann.isPinned ? '#D97706' : '#9CA3AF'} style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-800)' }}>{ann.title}</div>
                      <p style={{
                        fontSize: '0.78rem', color: 'var(--gray-500)', marginTop: '3px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {ann.content}
                      </p>
                      <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)', marginTop: '4px' }}>
                        {format(new Date(ann.createdAt), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Submissions */}
      {submissions.length > 0 && (
        <Card title="My Recent Submissions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {submissions.slice(0, 5).map((sub) => (
              <div key={sub._id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px', borderRadius: '10px', background: 'var(--gray-50)',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: sub.isPassed ? '#D1FAE5' : '#FEE2E2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: sub.isPassed ? '#059669' : '#DC2626' }}>
                    {sub.percentage}%
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {typeof sub.exam === 'object' ? (sub.exam as any).title : 'Exam'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>
                    Score: {sub.score}/{sub.totalPoints} · {format(new Date(sub.submittedAt), 'MMM d, yyyy')}
                  </div>
                </div>
                <Badge label={sub.isPassed ? 'Passed' : 'Failed'} color={sub.isPassed ? 'green' : 'red'} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
