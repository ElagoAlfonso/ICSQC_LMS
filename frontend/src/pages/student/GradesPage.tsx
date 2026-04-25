import React, { useEffect, useState } from 'react';
import { Award, TrendingUp, BookOpen, CheckCircle2 } from 'lucide-react';
import { Card, Badge } from '../../components/ui';
import { submissionsApi, reportCardsApi, academicYearsApi } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import type { Submission } from '../../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function StudentGradesPage() {
  const { user } = useAuthStore();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [reportCards, setReportCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [subRes, rcRes] = await Promise.allSettled([
          submissionsApi.getMySubmissions(),
          user?._id ? reportCardsApi.getByStudent(user._id) : Promise.resolve({ data: { reportCards: [] } }),
        ]);
        if (subRes.status === 'fulfilled') setSubmissions(subRes.value.data.submissions || []);
        if (rcRes.status === 'fulfilled') setReportCards(rcRes.value.data.reportCards || []);
      } catch { toast.error('Failed to load grades'); }
      setLoading(false);
    };
    load();
  }, []);

  // Group submissions by subject
  const bySubject: Record<string, { name: string; scores: number[]; submissions: Submission[] }> = {};
  submissions.forEach(sub => {
    const exam = sub.exam as any;
    if (!exam?.subject) return;
    const subjectId = typeof exam.subject === 'object' ? exam.subject._id : exam.subject;
    const subjectName = typeof exam.subject === 'object' ? exam.subject.name : 'Unknown';
    if (!bySubject[subjectId]) bySubject[subjectId] = { name: subjectName, scores: [], submissions: [] };
    bySubject[subjectId].scores.push(sub.percentage);
    bySubject[subjectId].submissions.push(sub);
  });

  const subjectStats = Object.entries(bySubject).map(([id, data]) => {
    const avg = Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length);
    const passed = data.submissions.filter(s => s.isPassed).length;
    return { id, name: data.name, avg, passed, total: data.submissions.length, scores: data.scores };
  });

  const overallAvg = subjectStats.length
    ? Math.round(subjectStats.reduce((a, s) => a + s.avg, 0) / subjectStats.length)
    : 0;

  const getGradeLabel = (score: number) => {
    if (score >= 90) return { label: 'Excellent', color: 'green' as const };
    if (score >= 80) return { label: 'Good', color: 'blue' as const };
    if (score >= 75) return { label: 'Satisfactory', color: 'yellow' as const };
    return { label: 'Needs Improvement', color: 'red' as const };
  };

  const getScoreBar = (score: number) => {
    const color = score >= 75 ? '#059669' : '#DC2626';
    return (
      <div style={{ flex: 1, height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gray-900)', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Award size={22} color="#C9A84C" /> My Grades
        </h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginTop: '2px' }}>Track your academic performance across all subjects</p>
      </div>

      {loading ? (
        <Card padding="48px">
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #E5E7EB', borderTopColor: '#8B1A1A', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            {[
              { label: 'Overall Average', value: `${overallAvg}%`, icon: <TrendingUp size={20} />, color: '#8B1A1A', bg: '#FEE2E2' },
              { label: 'Total Exams', value: submissions.length, icon: <BookOpen size={20} />, color: '#2563EB', bg: '#DBEAFE' },
              { label: 'Passed', value: submissions.filter(s => s.isPassed).length, icon: <CheckCircle2 size={20} />, color: '#059669', bg: '#D1FAE5' },
              { label: 'Subjects', value: subjectStats.length, icon: <Award size={20} />, color: '#D97706', bg: '#FEF3C7' },
            ].map(stat => (
              <div key={stat.label} style={{ background: '#fff', borderRadius: '12px', padding: '18px 20px', border: '1px solid var(--gray-100)', boxShadow: 'var(--shadow-card)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: 44, height: 44, borderRadius: '12px', background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color, flexShrink: 0 }}>
                  {stat.icon}
                </div>
                <div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--gray-500)', fontWeight: 500 }}>{stat.label}</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--gray-900)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Subject performance */}
          {subjectStats.length > 0 && (
            <Card title="Performance by Subject" subtitle="Average scores across all exams">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {subjectStats.map(sub => {
                  const { label, color } = getGradeLabel(sub.avg);
                  return (
                    <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 0', borderBottom: '1px solid var(--gray-50)' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '9px', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <BookOpen size={16} color="#8B1A1A" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                            {sub.name}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>
                              {sub.passed}/{sub.total} passed
                            </span>
                            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: sub.avg >= 75 ? '#059669' : '#DC2626' }}>
                              {sub.avg}%
                            </span>
                            <Badge label={label} color={color} />
                          </div>
                        </div>
                        {getScoreBar(sub.avg)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Recent exam results */}
          {submissions.length > 0 && (
            <Card title="Recent Exam Results">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {submissions.slice(0, 10).map(sub => {
                  const examTitle = typeof sub.exam === 'object' ? (sub.exam as any).title : 'Exam';
                  const subjectName = typeof sub.exam === 'object' && typeof (sub.exam as any).subject === 'object'
                    ? (sub.exam as any).subject?.name : '';
                  return (
                    <div key={sub._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '10px', background: 'var(--gray-50)' }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                        background: sub.isPassed ? '#D1FAE5' : '#FEE2E2',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: sub.isPassed ? '#059669' : '#DC2626' }}>
                          {sub.percentage}%
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {examTitle}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>
                          {subjectName && `${subjectName} · `}
                          Score: {sub.score}/{sub.totalPoints} · {format(new Date(sub.submittedAt), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <Badge label={sub.isPassed ? 'Passed' : 'Failed'} color={sub.isPassed ? 'green' : 'red'} />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Report Cards */}
          {reportCards.length > 0 && (
            <Card title="Report Cards" subtitle="Official academic records">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                {reportCards.map(rc => (
                  <div key={rc._id} style={{ border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '16px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onClick={() => setSelectedCard(rc)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#8B1A1A'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(139,26,26,0.1)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gray-200)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--gray-800)' }}>
                        {typeof rc.academicYear === 'object' ? rc.academicYear.name : 'AY'} — {rc.period}
                      </h4>
                      <Badge label={rc.overallRemarks} color={rc.overallRemarks === 'Promoted' ? 'green' : 'red'} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: rc.generalAverage >= 75 ? '#059669' : '#DC2626', fontFamily: 'var(--font-display)' }}>
                      {rc.generalAverage}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: '4px' }}>
                      General Average · {rc.subjectGrades?.length || 0} subjects
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {submissions.length === 0 && reportCards.length === 0 && (
            <Card>
              <div style={{ padding: '48px', textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.875rem' }}>
                No grades yet. Take some exams to see your performance here.
              </div>
            </Card>
          )}
        </>
      )}

      {/* Report Card Detail Modal */}
      {selectedCard && (
        <div onClick={() => setSelectedCard(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #1A2744, #8B1A1A)', borderRadius: '16px 16px 0 0' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-display)' }}>
                  Official Report Card
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>
                  {typeof selectedCard.academicYear === 'object' ? selectedCard.academicYear.name : ''} · {selectedCard.period}
                </p>
              </div>
              <button onClick={() => setSelectedCard(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', padding: '16px', background: '#F9FAFB', borderRadius: '12px' }}>
                <div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginBottom: '4px' }}>GENERAL AVERAGE</p>
                  <p style={{ fontSize: '2.5rem', fontWeight: 700, color: selectedCard.generalAverage >= 75 ? '#059669' : '#DC2626', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                    {selectedCard.generalAverage}%
                  </p>
                </div>
                <Badge label={selectedCard.overallRemarks} color={selectedCard.overallRemarks === 'Promoted' ? 'green' : 'red'} />
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--gray-100)' }}>
                    {['Subject', 'Q1', 'Q2', 'Q3', 'Q4', 'Final', 'Remarks'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Subject' ? 'left' : 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedCard.subjectGrades?.map((sg: any) => (
                    <tr key={sg.subject} style={{ borderBottom: '1px solid var(--gray-50)' }}>
                      <td style={{ padding: '10px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-800)' }}>{sg.subjectName}</td>
                      {[sg.q1, sg.q2, sg.q3, sg.q4, sg.finalGrade].map((v, i) => (
                        <td key={i} style={{ padding: '10px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--gray-600)' }}>{v || '—'}</td>
                      ))}
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <Badge label={sg.remarks} color={sg.remarks === 'Passed' ? 'green' : 'red'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
