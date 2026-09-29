import React, { useEffect, useState } from 'react';
import {
  Users, GraduationCap, BookOpen, ClipboardList,
  Clock, Tag,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { StatCard, Card, Badge } from '../../components/ui';
import { dashboardApi, logsApi, academicYearsApi } from '../../utils/api';
import { format } from 'date-fns';
import type { ActivityLog } from '../../types';
import { ACTIVITY_AVATAR_COLORS, ACTIVITY_COLOR_MAP, cosmetifyDetails, formatLogAction, getActionColor, getLogUserInitial, getLogUserName } from '../../utils/activityLogs';

const COLORS = ['#8B1A1A', '#C9A84C', '#1A2744', '#059669', '#2563EB'];

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0, totalTeachers: 0,
    totalClasses: 0, totalSubjects: 0,
    activeExams: 0, pendingSubmissions: 0,
    enrollmentTrend: [] as { month: string; students: number }[],
    studentsByGrade: [] as { grade: string; count: number }[],
    performanceDistribution: [] as { name: string; count: number; percentage: number }[],
  });
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [currentYear, setCurrentYear] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, logsRes, ayRes] = await Promise.allSettled([
          dashboardApi.getStats(),
          logsApi.getAll({ limit: 8 }),
          academicYearsApi.getAll(),
        ]);
        if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
        if (logsRes.status === 'fulfilled') setLogs(logsRes.value.data.logs || []);
        if (ayRes.status === 'fulfilled') {
          const current = ayRes.value.data.find((ay: any) => ay.isCurrent);
          if (current) setCurrentYear(current.name);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const enrollmentData = stats.enrollmentTrend;
  const gradeDistribution = stats.studentsByGrade;
  const performanceData = stats.performanceDistribution;

  const statCards = [
    { label: 'Total Students', value: stats.totalStudents, icon: <Users size={22} />, color: '#8B1A1A', bg: '#FEE2E2', change: 'Active student accounts', changeType: 'neutral' as const },
    { label: 'Total Teachers', value: stats.totalTeachers, icon: <GraduationCap size={22} />, color: '#1A2744', bg: '#EFF6FF', change: 'Active teacher accounts', changeType: 'neutral' as const },
    { label: 'Active Classes', value: stats.totalClasses, icon: <BookOpen size={22} />, color: '#059669', bg: '#D1FAE5', change: 'Current academic year', changeType: 'neutral' as const },
    { label: 'Active Exams', value: stats.activeExams, icon: <ClipboardList size={22} />, color: '#C9A84C', bg: '#FEF3C7', change: `${stats.pendingSubmissions} pending`, changeType: 'neutral' as const },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1A2744 0%, #8B1A1A 60%, #C9A84C 100%)',
        borderRadius: '16px',
        padding: '28px 32px',
        color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        overflow: 'hidden', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 200, height: 200, borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, right: 80,
          width: 160, height: 160, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontWeight: 700, fontSize: '1.5rem',
            marginBottom: '6px',
          }}>
            Admin Control Panel
          </h2>
          <p style={{ opacity: 0.75, fontSize: '0.875rem' }}>
            International Christian School of Quezon City, Inc.
            {currentYear && ` — A.Y. ${currentYear}`}
          </p>
        </div>
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', opacity: 0.65, marginBottom: '4px' }}>Today</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
            {format(new Date(), 'MMMM d, yyyy')}
          </div>
          <div style={{ fontSize: '0.8rem', opacity: 0.65 }}>
            {format(new Date(), 'EEEE')}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {statCards.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <Card title="Student Enrollment Trend" subtitle="Cumulative active student accounts this academic year">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={enrollmentData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '0.8rem' }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Line type="monotone" dataKey="students" stroke="#8B1A1A" strokeWidth={2.5} dot={{ fill: '#8B1A1A', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Students by Grade Level" subtitle="Current enrollment per grade">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={gradeDistribution} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="grade" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '0.8rem' }} />
              <Bar dataKey="count" fill="#8B1A1A" radius={[4, 4, 0, 0]}>
                {gradeDistribution.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
        {/* Recent Activity */}
        <Card title="Recent Activity" subtitle="Latest system actions">
          {logs.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.875rem' }}>
              No recent activity
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 620 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1.15fr) minmax(130px, 1.3fr) minmax(180px, 2fr) minmax(115px, 1.1fr)', gap: 10, padding: '8px 0 10px', borderBottom: '2px solid #F3F4F6' }}>
                  {['Action', 'User', 'Details', 'Timestamp'].map((heading) => <span key={heading} style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>{heading}</span>)}
                </div>
                {logs.map((log, index) => {
                  const actionColors = ACTIVITY_COLOR_MAP[getActionColor(log.action)];
                  const userName = getLogUserName(log);
                  const avatarColor = ACTIVITY_AVATAR_COLORS[userName.charCodeAt(0) % ACTIVITY_AVATAR_COLORS.length];
                  const hasTimestamp = log.createdAt && !Number.isNaN(new Date(log.createdAt).getTime());
                  const details = cosmetifyDetails(log.details);
                  return <div key={log._id} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1.15fr) minmax(130px, 1.3fr) minmax(180px, 2fr) minmax(115px, 1.1fr)', gap: 10, padding: '10px 0', borderBottom: index < logs.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'center' }}>
                    <span title={formatLogAction(log.action)} style={{ padding: '3px 8px', background: actionColors.bg, color: actionColors.text, borderRadius: 20, fontSize: '0.68rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, width: 'fit-content', maxWidth: '100%' }}><Tag size={10} />{formatLogAction(log.action)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                      <div style={{ width: 27, height: 27, borderRadius: '50%', background: `${avatarColor}22`, border: `2px solid ${avatarColor}44`, display: 'grid', placeItems: 'center', fontSize: '0.68rem', fontWeight: 700, color: avatarColor, flexShrink: 0 }}>{getLogUserInitial(log)}</div>
                      <div style={{ minWidth: 0 }}><p style={{ margin: 0, fontSize: '0.76rem', fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</p>{typeof log.user === 'object' && log.user?.role && <p style={{ margin: 0, fontSize: '0.66rem', color: '#9CA3AF', textTransform: 'capitalize' }}>{log.user.role}</p>}</div>
                    </div>
                    <span title={details} style={{ fontSize: '0.76rem', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{details}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#9CA3AF' }}><Clock size={12} /><div><p style={{ margin: 0, fontSize: '0.72rem', color: '#4B5563', fontWeight: 500 }}>{hasTimestamp ? format(new Date(log.createdAt), 'MMM d, yyyy') : '—'}</p><p style={{ margin: 0, fontSize: '0.66rem' }}>{hasTimestamp ? format(new Date(log.createdAt), 'h:mm:ss a') : ''}</p></div></div>
                  </div>;
                })}
              </div>
            </div>
          )}
        </Card>

        {/* Performance Distribution */}
        <Card title="Academic Performance" subtitle="Grade distribution overview">
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <PieChart width={200} height={180}>
              <Pie
                data={performanceData}
                cx={100} cy={90}
                innerRadius={55} outerRadius={85}
                paddingAngle={3}
                dataKey="count"
              >
                {performanceData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '0.78rem' }}
                formatter={(v: any) => [v, 'Graded submissions']}
              />
            </PieChart>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            {performanceData.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: COLORS[i % COLORS.length],
                }} />
                <span style={{ fontSize: '0.75rem', color: '#6B7280', flex: 1 }}>
                  {item.name.split('\n')[0]}
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>
                  {item.percentage}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
