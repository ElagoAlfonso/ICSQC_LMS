import React, { useEffect, useState } from 'react';
import {
  Users, GraduationCap, BookOpen, ClipboardList,
  TrendingUp, Activity, Award, Calendar,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { StatCard, Card, Badge } from '../../components/ui';
import { dashboardApi, logsApi, academicYearsApi } from '../../utils/api';
import { format } from 'date-fns';
import type { ActivityLog } from '../../types';

const COLORS = ['#8B1A1A', '#C9A84C', '#1A2744', '#059669', '#2563EB'];

const enrollmentData = [
  { month: 'Aug', students: 420 },
  { month: 'Sep', students: 445 },
  { month: 'Oct', students: 461 },
  { month: 'Nov', students: 455 },
  { month: 'Dec', students: 430 },
  { month: 'Jan', students: 470 },
  { month: 'Feb', students: 482 },
  { month: 'Mar', students: 490 },
];

const gradeDistribution = [
  { grade: 'Grade 7', count: 85 },
  { grade: 'Grade 8', count: 78 },
  { grade: 'Grade 9', count: 72 },
  { grade: 'Grade 10', count: 68 },
  { grade: 'Grade 11', count: 95 },
  { grade: 'Grade 12', count: 92 },
];

const performanceData = [
  { name: 'Excellent\n(90-100)', value: 35 },
  { name: 'Good\n(80-89)', value: 40 },
  { name: 'Satisfactory\n(70-79)', value: 18 },
  { name: 'Needs Work\n(<70)', value: 7 },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0, totalTeachers: 0,
    totalClasses: 0, totalSubjects: 0,
    activeExams: 0, pendingSubmissions: 0,
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

  const statCards = [
    { label: 'Total Students', value: stats.totalStudents, icon: <Users size={22} />, color: '#8B1A1A', bg: '#FEE2E2', change: '+12 this month', changeType: 'up' as const },
    { label: 'Total Teachers', value: stats.totalTeachers, icon: <GraduationCap size={22} />, color: '#1A2744', bg: '#EFF6FF', change: '2 new this year', changeType: 'up' as const },
    { label: 'Active Classes', value: stats.totalClasses, icon: <BookOpen size={22} />, color: '#059669', bg: '#D1FAE5', change: 'All sections active', changeType: 'neutral' as const },
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
        <Card title="Student Enrollment Trend" subtitle="Monthly enrollment this academic year">
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
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {logs.map((log, i) => (
                <div key={log._id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  padding: '12px 0',
                  borderBottom: i < logs.length - 1 ? '1px solid var(--gray-50)' : 'none',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: '#FEE2E2',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Activity size={14} color="#8B1A1A" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '2px' }}>
                      {log.action}
                    </p>
                    <p style={{
                      fontSize: '0.75rem', color: '#9CA3AF',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {log.details}
                    </p>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {format(new Date(log.createdAt), 'MMM d, h:mm a')}
                  </span>
                </div>
              ))}
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
                dataKey="value"
              >
                {performanceData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '0.78rem' }}
                formatter={(v: any) => [`${v}%`, 'Students']}
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
                  {item.value}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
