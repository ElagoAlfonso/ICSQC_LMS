import React, { useEffect, useState } from 'react';
import { Search, CheckCircle2, Clock, Award, Eye, Edit2, FileText } from 'lucide-react';
import { Card, Button, Badge, DataTable, Pagination, Modal, Input } from '../../components/ui';
import { submissionsApi, examsApi } from '../../utils/api';
import type { Submission, Exam, Pagination as PaginationType } from '../../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [examFilter, setExamFilter] = useState('');
  const [viewModal, setViewModal] = useState<Submission | null>(null);
  const [gradeModal, setGradeModal] = useState<Submission | null>(null);
  const [gradeForm, setGradeForm] = useState({ score: 0, feedback: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subRes, examRes] = await Promise.allSettled([
        submissionsApi.getAll({ exam: examFilter }),
        examsApi.getAll({ limit: 100 }),
      ]);
      if (subRes.status === 'fulfilled') setSubmissions(subRes.value.data.submissions || []);
      if (examRes.status === 'fulfilled') setExams(examRes.value.data.exams || []);
    } catch { toast.error('Failed to load submissions'); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [examFilter]);

  const filtered = submissions.filter(s => {
    if (!search) return true;
    const studentName = typeof s.student === 'object' ? (s.student as any).name || '' : '';
    return studentName.toLowerCase().includes(search.toLowerCase());
  });

  const openGrade = (sub: Submission) => {
    setGradeModal(sub);
    setGradeForm({ score: sub.score, feedback: sub.feedback || '' });
  };

  const handleGrade = async () => {
    if (!gradeModal) return;
    setSaving(true);
    try {
      await submissionsApi.grade(gradeModal._id, gradeForm);
      toast.success('Submission graded');
      setGradeModal(null);
      fetchData();
    } catch { toast.error('Failed to grade submission'); }
    setSaving(false);
  };

  const examOptions = [{ value: '', label: 'All Exams' }, ...exams.map(e => ({ value: e._id, label: e.title }))];

  const columns = [
    {
      key: 'student', label: 'Student', render: (s: Submission) => {
        const name = typeof s.student === 'object' ? (s.student as any).name : 'Unknown';
        const email = typeof s.student === 'object' ? (s.student as any).email : '';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#059669', flexShrink: 0 }}>
              {name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--gray-900)' }}>{name}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>{email}</div>
            </div>
          </div>
        );
      }
    },
    {
      key: 'exam', label: 'Exam', render: (s: Submission) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--gray-700)', fontWeight: 500 }}>
          {typeof s.exam === 'object' ? (s.exam as any).title : '—'}
        </span>
      )
    },
    {
      key: 'score', label: 'Score', render: (s: Submission) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: s.isPassed ? '#059669' : '#DC2626' }}>
            {s.score}/{s.totalPoints}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>({s.percentage}%)</span>
        </div>
      )
    },
    {
      key: 'isPassed', label: 'Result', render: (s: Submission) => (
        <Badge label={s.isPassed ? 'Passed' : 'Failed'} color={s.isPassed ? 'green' : 'red'} />
      )
    },
    {
      key: 'status', label: 'Status', render: (s: Submission) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          {s.status === 'graded'
            ? <><CheckCircle2 size={14} color="#059669" /><span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 500 }}>Graded</span></>
            : <><Clock size={14} color="#D97706" /><span style={{ fontSize: '0.78rem', color: '#D97706', fontWeight: 500 }}>Pending</span></>
          }
        </div>
      )
    },
    {
      key: 'submittedAt', label: 'Submitted', render: (s: Submission) => (
        <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>
          {format(new Date(s.submittedAt), 'MMM d, h:mm a')}
        </span>
      )
    },
    {
      key: 'actions', label: '', render: (s: Submission) => (
        <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
          <button onClick={e => { e.stopPropagation(); setViewModal(s); }} style={{ padding: '5px 9px', background: '#F3F4F6', border: 'none', borderRadius: '6px', color: '#6B7280', cursor: 'pointer', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'var(--font-body)' }}>
            <Eye size={11} /> View
          </button>
          <button onClick={e => { e.stopPropagation(); openGrade(s); }} style={{ padding: '5px 9px', background: '#EFF6FF', border: 'none', borderRadius: '6px', color: '#2563EB', cursor: 'pointer', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'var(--font-body)' }}>
            <Edit2 size={11} /> Grade
          </button>
        </div>
      )
    },
  ];

  const passed = submissions.filter(s => s.isPassed).length;
  const failed = submissions.filter(s => !s.isPassed && s.status === 'graded').length;
  const avgScore = submissions.length ? Math.round(submissions.reduce((a, s) => a + s.percentage, 0) / submissions.length) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gray-900)', fontFamily: 'var(--font-display)' }}>Submissions</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginTop: '2px' }}>Review and grade student exam submissions</p>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {[
          { label: 'Total', value: submissions.length, color: '#1A2744', bg: '#EFF6FF' },
          { label: 'Passed', value: passed, color: '#059669', bg: '#D1FAE5' },
          { label: 'Failed', value: failed, color: '#DC2626', bg: '#FEE2E2' },
          { label: 'Avg Score', value: `${avgScore}%`, color: '#D97706', bg: '#FEF3C7' },
        ].map(stat => (
          <div key={stat.label} style={{ background: '#fff', borderRadius: '12px', padding: '16px 20px', border: '1px solid var(--gray-100)', boxShadow: 'var(--shadow-card)' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 500, marginBottom: '4px' }}>{stat.label}</p>
            <p style={{ fontSize: '1.6rem', fontWeight: 700, color: stat.color, fontFamily: 'var(--font-display)' }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <Card padding="16px">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input placeholder="Search by student name..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '9px 14px 9px 36px', border: '1.5px solid var(--gray-200)', borderRadius: '9px', fontSize: '0.875rem', outline: 'none', fontFamily: 'var(--font-body)' }} />
          </div>
          <select value={examFilter} onChange={e => setExamFilter(e.target.value)}
            style={{ padding: '9px 14px', border: '1.5px solid var(--gray-200)', borderRadius: '9px', fontSize: '0.875rem', outline: 'none', fontFamily: 'var(--font-body)', background: '#fff', cursor: 'pointer', minWidth: '200px' }}>
            {examOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </Card>

      <Card>
        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No submissions found" />
      </Card>

      {/* View Modal */}
      <Modal open={!!viewModal} onClose={() => setViewModal(null)} title="Submission Details" width="640px">
        {viewModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { label: 'Student', value: typeof viewModal.student === 'object' ? (viewModal.student as any).name : '—' },
                { label: 'Score', value: `${viewModal.score}/${viewModal.totalPoints} (${viewModal.percentage}%)` },
                { label: 'Result', value: viewModal.isPassed ? '✅ Passed' : '❌ Failed' },
                { label: 'Status', value: viewModal.status },
                { label: 'Submitted', value: format(new Date(viewModal.submittedAt), 'MMM d, yyyy h:mm a') },
                { label: 'Time Spent', value: (viewModal as any).timeSpent ? `${Math.round((viewModal as any).timeSpent / 60)} min` : '—' },
              ].map(item => (
                <div key={item.label} style={{ padding: '12px', background: 'var(--gray-50)', borderRadius: '8px' }}>
                  <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{item.label}</p>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--gray-800)' }}>{item.value}</p>
                </div>
              ))}
            </div>
            {viewModal.feedback && (
              <div style={{ padding: '14px', background: '#DBEAFE', borderRadius: '10px' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1E40AF', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Teacher Feedback</p>
                <p style={{ fontSize: '0.875rem', color: '#1E40AF', lineHeight: 1.6 }}>{viewModal.feedback}</p>
              </div>
            )}
            <div>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Answers ({viewModal.answers.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                {viewModal.answers.map((ans, i) => (
                  <div key={i} style={{
                    padding: '10px 14px', borderRadius: '8px',
                    background: ans.isCorrect === true ? '#D1FAE5' : ans.isCorrect === false ? '#FEE2E2' : '#F3F4F6',
                    border: `1px solid ${ans.isCorrect === true ? '#A7F3D0' : ans.isCorrect === false ? '#FECACA' : '#E5E7EB'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                  }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 600 }}>Q{ans.questionIndex + 1}: </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--gray-700)' }}>{ans.answer}</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: ans.isCorrect === true ? '#059669' : ans.isCorrect === false ? '#DC2626' : '#9CA3AF', flexShrink: 0 }}>
                      {ans.isCorrect === true ? `+${ans.pointsEarned}` : ans.isCorrect === false ? '0' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Grade Modal */}
      <Modal open={!!gradeModal} onClose={() => setGradeModal(null)} title="Grade Submission" width="440px"
        footer={<><Button variant="secondary" onClick={() => setGradeModal(null)}>Cancel</Button><Button loading={saving} icon={<Award size={14} />} onClick={handleGrade}>Save Grade</Button></>}
      >
        {gradeModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '12px', background: 'var(--gray-50)', borderRadius: '10px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                Student: <strong>{typeof gradeModal.student === 'object' ? (gradeModal.student as any).name : '—'}</strong>
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '4px' }}>
                Current: <strong>{gradeModal.score}/{gradeModal.totalPoints}</strong>
              </p>
            </div>
            <Input label={`Score (out of ${gradeModal.totalPoints})`} type="number" min="0" max={gradeModal.totalPoints}
              value={gradeForm.score} onChange={e => setGradeForm({ ...gradeForm, score: parseInt(e.target.value) || 0 })} />
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--gray-700)', display: 'block', marginBottom: '5px' }}>Feedback (optional)</label>
              <textarea value={gradeForm.feedback} onChange={e => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                placeholder="Add comments or feedback for the student..."
                rows={3}
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--gray-200)', borderRadius: '9px', fontSize: '0.875rem', outline: 'none', resize: 'vertical', fontFamily: 'var(--font-body)' }}
                onFocus={e => { e.target.style.borderColor = '#8B1A1A'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--gray-200)'; }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
