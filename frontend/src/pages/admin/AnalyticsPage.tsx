import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import { Card, StatCard } from '../../components/ui';
import { analyticsApi } from '../../utils/api';
import { TrendingUp, Users, ClipboardList, Award, BarChart3, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const COLORS = ['#7a1010', '#C9A84C', '#1A2744', '#059669', '#2563EB', '#7C3AED'];

type Period = 'month' | 'quarter' | 'year';

const TT = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '0.8rem' }}>
      <p style={{ fontWeight: 700, color: '#374151', marginBottom: 6 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color, margin: '2px 0' }}>{p.name}: <strong>{typeof p.value === 'number' ? (p.value % 1 === 0 ? p.value : p.value.toFixed(1)) : p.value}</strong></p>
      ))}
    </div>
  );
};

const PERIOD_LABELS: Record<Period, string> = {
  month: 'This Month', quarter: 'This Quarter', year: 'This Year',
};

export default function AnalyticsPage() {
  const [period, setPeriod]   = useState<Period>('year');
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const res = await analyticsApi.get(p);
      setData(res.data);
    } catch (err: any) {
      toast.error('Failed to load analytics data');
      // Provide empty fallback so page doesn't crash
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(period); }, [period]);

  const handlePeriod = (p: Period) => {
    if (p !== period) setPeriod(p);
  };

  const summary   = data?.summary   || {};
  const monthly   = data?.monthlyActivity   || [];
  const examTypes = data?.examTypeDist      || [];
  const scoreDist = data?.scoreDist         || [];
  const subjects  = data?.subjectPerf       || [];
  const byGrade   = data?.studentsByGrade   || [];
  const enroll    = data?.enrollTrend       || [];

  const Skeleton = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #E5E7EB', borderTopColor: '#7a1010', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
        <p style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>Loading…</p>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart3 size={22} color="#7a1010" /> Analytics & Reports
          </h1>
          <p style={{ color: '#6B7280', fontSize: '0.875rem', marginTop: 2 }}>
            Academic performance overview · <span style={{ color: '#7a1010', fontWeight: 500 }}>{PERIOD_LABELS[period]}</span>
            {!loading && data && <span style={{ color: '#9CA3AF', marginLeft: 6 }}>— Live data from your database</span>}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Period toggle */}
          <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 10, padding: 3, gap: 2 }}>
            {(['month', 'quarter', 'year'] as Period[]).map((p) => (
              <button key={p} onClick={() => handlePeriod(p)}
                style={{
                  padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s',
                  background: period === p ? '#7a1010' : 'transparent',
                  color: period === p ? '#fff' : '#6B7280',
                  boxShadow: period === p ? '0 1px 4px rgba(122,16,16,0.3)' : 'none',
                }}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <button onClick={() => loadData(period)} disabled={loading}
            style={{ background: '#F3F4F6', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6B7280' }}
            title="Refresh">
            <RefreshCw size={15} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* Live data notice */}
      {!loading && !data && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 10, padding: '12px 16px', fontSize: '0.85rem', color: '#92400E' }}>
          ⚠️ Could not load analytics data. Make sure the backend is running and you are signed in as an admin.
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <StatCard label="Enrolled Students" value={loading ? '—' : (summary.totalStudents ?? 0)} icon={<Users size={22}/>} color="#7a1010" bg="#FEE2E2" />
        <StatCard label="Total Exams" value={loading ? '—' : (summary.totalExams ?? 0)} icon={<ClipboardList size={22}/>} color="#2563EB" bg="#DBEAFE" change={`${summary.gradedSubmissions ?? 0} graded submissions`} changeType="neutral" />
        <StatCard label="Overall Pass Rate" value={loading ? '—' : `${summary.passRate ?? 0}%`} icon={<Award size={22}/>} color="#059669" bg="#D1FAE5" />
        <StatCard label="Avg. Score" value={loading ? '—' : `${summary.avgScore ?? 0}%`} icon={<TrendingUp size={22}/>} color="#C9A84C" bg="#FEF3C7" />
      </div>

      {/* Monthly Activity + Exam Type Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20 }}>
        <Card title="Monthly Exam Activity" subtitle="Submissions vs passed students">
          {loading ? <Skeleton /> : monthly.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF', fontSize: '0.875rem' }}>No submission data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthly} margin={{ top: 5, right: 10, bottom: 5, left: -15 }}>
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7a1010" stopOpacity={0.15}/><stop offset="95%" stopColor="#7a1010" stopOpacity={0}/></linearGradient>
                  <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#059669" stopOpacity={0.15}/><stop offset="95%" stopColor="#059669" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6"/>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }}/>
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }}/>
                <Tooltip content={<TT/>}/>
                <Legend wrapperStyle={{ fontSize: '0.75rem' }}/>
                <Area type="monotone" dataKey="submissions" name="Submissions" stroke="#7a1010" fill="url(#sg)" strokeWidth={2}/>
                <Area type="monotone" dataKey="passed"      name="Passed"      stroke="#059669" fill="url(#pg)" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Exam Type Distribution" subtitle="Breakdown by assessment type">
          {loading ? <Skeleton /> : examTypes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF', fontSize: '0.875rem' }}>No exams for this period</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={examTypes} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                    {examTypes.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                  </Pie>
                  <Tooltip content={<TT/>}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {examTypes.map((e: any, i: number) => {
                  const total = examTypes.reduce((s: number, x: any) => s + x.value, 0);
                  const pct   = total > 0 ? Math.round((e.value / total) * 100) : 0;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], display: 'inline-block' }}/>
                        <span style={{ fontSize: '0.78rem', color: '#374151' }}>{e.name}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280' }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Score Distribution + Subject Performance */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Card title="Score Distribution" subtitle="Students by score range">
          {loading ? <Skeleton /> : scoreDist.every((s: any) => s.count === 0) ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF', fontSize: '0.875rem' }}>No graded submissions yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={scoreDist} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false}/>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }}/>
                <YAxis dataKey="range" type="category" tick={{ fontSize: 11, fill: '#6B7280' }} width={50}/>
                <Tooltip content={<TT/>}/>
                <Bar dataKey="count" name="Students" radius={[0, 4, 4, 0]}>
                  {scoreDist.map((_: any, i: number) => <Cell key={i} fill={i < 2 ? '#059669' : i < 4 ? '#C9A84C' : '#7a1010'}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Subject Performance" subtitle="Avg score & pass rate per subject">
          {loading ? <Skeleton /> : subjects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF', fontSize: '0.875rem' }}>No subject data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={subjects} margin={{ top: 5, right: 10, bottom: 30, left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6"/>
                <XAxis dataKey="subject" tick={{ fontSize: 10, fill: '#9CA3AF' }} angle={-30} textAnchor="end" interval={0}/>
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} domain={[0, 100]}/>
                <Tooltip content={<TT/>}/>
                <Legend wrapperStyle={{ fontSize: '0.75rem' }}/>
                <Bar dataKey="avg"    name="Avg Score" fill="#7a1010" radius={[4,4,0,0]}/>
                <Bar dataKey="passed" name="Pass Rate" fill="#C9A84C" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Enrollment Trend + Students by Grade */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Card title="Student Enrollment Trend" subtitle="Monthly enrollment this academic year">
          {loading ? <Skeleton /> : enroll.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF', fontSize: '0.875rem' }}>No enrollment data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={enroll} margin={{ top: 5, right: 10, bottom: 5, left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6"/>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }}/>
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }}/>
                <Tooltip content={<TT/>}/>
                <Line type="monotone" dataKey="students" name="New Students" stroke="#7a1010" strokeWidth={2} dot={{ fill: '#7a1010', r: 4 }}/>
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Students by Grade Level" subtitle="Current enrollment per grade">
          {loading ? <Skeleton /> : byGrade.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF', fontSize: '0.875rem' }}>No class data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byGrade} margin={{ top: 5, right: 10, bottom: 20, left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6"/>
                <XAxis dataKey="grade" tick={{ fontSize: 10, fill: '#9CA3AF' }} angle={-30} textAnchor="end" interval={0}/>
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }}/>
                <Tooltip content={<TT/>}/>
                <Bar dataKey="students" name="Students" radius={[4,4,0,0]}>
                  {byGrade.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}
