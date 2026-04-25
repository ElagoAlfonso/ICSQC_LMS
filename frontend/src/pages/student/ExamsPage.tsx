import React, { useEffect, useState, useRef } from 'react';
import { Clock, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { examsApi, submissionsApi } from '../../utils/api';
import { Button, Card, Badge } from '../../components/ui';
import type { Exam, Question } from '../../types';
import { format, isPast } from 'date-fns';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function StudentExamsPage() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [examDone, setExamDone] = useState(false);
  const [result, setResult] = useState<any>(null);
  const timerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const load = async () => {
      try {
        const res = await examsApi.getAll({ status: 'published' });
        setExams(res.data.exams || []);
      } catch { toast.error('Failed to load exams'); }
      setLoading(false);
    };
    load();
  }, []);

  const startExam = async (exam: Exam) => {
    try {
      const res = await examsApi.getById(exam._id);
      setActiveExam(res.data);
      setAnswers({});
      setCurrentQ(0);
      setTimeLeft(res.data.duration * 60);
      setExamDone(false);
      setResult(null);
      startTimeRef.current = Date.now();
    } catch { toast.error('Failed to load exam'); }
  };

  useEffect(() => {
    if (!activeExam || examDone) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); handleSubmit(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [activeExam, examDone]);

  const handleSubmit = async (autoSubmit = false) => {
    if (!activeExam) return;
    if (!autoSubmit) {
      const unanswered = activeExam.questions.length - Object.keys(answers).length;
      if (unanswered > 0 && !window.confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`)) return;
    }
    clearInterval(timerRef.current);
    setSubmitting(true);
    try {
      const answerArray = activeExam.questions.map((_, idx) => ({
        questionIndex: idx,
        answer: answers[idx] || '',
      }));
      const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
      const res = await submissionsApi.submit(activeExam._id, answerArray);
      setResult(res.data);
      setExamDone(true);
      toast.success('Exam submitted!');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Submission failed';
      toast.error(msg);
      if (msg === 'Already submitted') setExamDone(true);
    }
    setSubmitting(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Exam done screen
  if (examDone && result) {
    return (
      <div style={{ maxWidth: '520px', margin: '60px auto' }}>
        <Card>
          <div style={{ textAlign: 'center', padding: '32px 24px' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: result.isPassed ? '#D1FAE5' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              {result.isPassed ? <CheckCircle2 size={40} color="#059669" /> : <AlertCircle size={40} color="#DC2626" />}
            </div>
            <h2 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontWeight: 700, fontSize: '1.5rem', marginBottom: '8px', color: 'var(--gray-900)' }}>
              {result.isPassed ? 'Congratulations!' : 'Keep Trying!'}
            </h2>
            <p style={{ color: 'var(--gray-500)', marginBottom: '24px' }}>
              Your exam has been submitted and graded.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              {[
                { label: 'Score', value: `${result.score}/${result.totalPoints}` },
                { label: 'Percentage', value: `${result.percentage}%` },
                { label: 'Status', value: result.isPassed ? '✅ Passed' : '❌ Failed' },
                { label: 'Result', value: result.status },
              ].map(item => (
                <div key={item.label} style={{ padding: '14px', background: 'var(--gray-50)', borderRadius: '10px' }}>
                  <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{item.label}</p>
                  <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gray-800)' }}>{item.value}</p>
                </div>
              ))}
            </div>
            <Button onClick={() => { setActiveExam(null); setExamDone(false); setResult(null); }}>
              Back to Exams
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Active exam screen
  if (activeExam && !examDone) {
    const q = activeExam.questions[currentQ];
    const answered = Object.keys(answers).length;
    const progress = (answered / activeExam.questions.length) * 100;
    const isLowTime = timeLeft < 120;

    return (
      <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Header bar */}
        <div style={{ background: '#fff', borderRadius: '14px', padding: '16px 20px', border: '1px solid var(--gray-100)', boxShadow: 'var(--shadow-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gray-900)', fontFamily: 'var(--font-display)' }}>{activeExam.title}</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Q{currentQ + 1} of {activeExam.questions.length} · {answered} answered</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: isLowTime ? '#FEE2E2' : '#F3F4F6', borderRadius: '10px', flexShrink: 0 }}>
            <Clock size={16} color={isLowTime ? '#DC2626' : '#6B7280'} />
            <span style={{ fontWeight: 700, fontSize: '1rem', color: isLowTime ? '#DC2626' : '#374151', fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>

        {/* Progress */}
        <div style={{ background: '#E5E7EB', borderRadius: '4px', height: '5px' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #8B1A1A, #C9A84C)', borderRadius: '4px', transition: 'width 0.3s' }} />
        </div>

        {/* Question */}
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span style={{ background: '#8B1A1A', color: '#fff', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700, flexShrink: 0 }}>
                  {currentQ + 1}
                </span>
                <Badge label={q.type.replace('_', ' ')} color="blue" />
                <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginLeft: 'auto' }}>{q.points} pt{q.points !== 1 ? 's' : ''}</span>
              </div>
              <p style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--gray-900)', lineHeight: 1.6 }}>{q.question}</p>
            </div>

            {/* Answer input */}
            {q.type === 'multiple_choice' && q.choices && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {q.choices.map((choice, ci) => {
                  const isSelected = answers[currentQ] === choice;
                  return (
                    <button key={ci} onClick={() => setAnswers({ ...answers, [currentQ]: choice })}
                      style={{
                        padding: '12px 16px', borderRadius: '10px', textAlign: 'left',
                        border: `2px solid ${isSelected ? '#8B1A1A' : 'var(--gray-200)'}`,
                        background: isSelected ? '#FEE2E2' : '#fff',
                        cursor: 'pointer', fontSize: '0.875rem', color: isSelected ? '#8B1A1A' : 'var(--gray-700)',
                        fontWeight: isSelected ? 600 : 400, transition: 'all 0.15s',
                        fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: '10px',
                      }}
                    >
                      <span style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${isSelected ? '#8B1A1A' : 'var(--gray-300)'}`, background: isSelected ? '#8B1A1A' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isSelected && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                      </span>
                      <span>{String.fromCharCode(65 + ci)}. {choice}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === 'true_false' && (
              <div style={{ display: 'flex', gap: '12px' }}>
                {['True', 'False'].map(opt => {
                  const isSelected = answers[currentQ] === opt;
                  return (
                    <button key={opt} onClick={() => setAnswers({ ...answers, [currentQ]: opt })}
                      style={{
                        flex: 1, padding: '14px', borderRadius: '10px',
                        border: `2px solid ${isSelected ? '#8B1A1A' : 'var(--gray-200)'}`,
                        background: isSelected ? '#FEE2E2' : '#fff',
                        cursor: 'pointer', fontSize: '0.9rem', fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? '#8B1A1A' : 'var(--gray-600)', transition: 'all 0.15s',
                        fontFamily: 'var(--font-body)',
                      }}
                    >{opt}</button>
                  );
                })}
              </div>
            )}

            {(q.type === 'short_answer' || q.type === 'essay') && (
              <textarea
                value={answers[currentQ] || ''}
                onChange={e => setAnswers({ ...answers, [currentQ]: e.target.value })}
                placeholder={q.type === 'essay' ? 'Write your essay answer here...' : 'Type your answer...'}
                rows={q.type === 'essay' ? 6 : 3}
                style={{ width: '100%', padding: '12px 14px', border: '1.5px solid var(--gray-200)', borderRadius: '10px', fontSize: '0.875rem', outline: 'none', resize: 'vertical', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}
                onFocus={e => { e.target.style.borderColor = '#8B1A1A'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--gray-200)'; }}
              />
            )}
          </div>
        </Card>

        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <Button variant="secondary" icon={<ChevronLeft size={16} />} disabled={currentQ === 0} onClick={() => setCurrentQ(q => q - 1)}>
            Previous
          </Button>

          {/* Question dots */}
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center', flex: 1 }}>
            {activeExam.questions.map((_, idx) => (
              <button key={idx} onClick={() => setCurrentQ(idx)}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: idx === currentQ ? '2px solid #8B1A1A' : 'none',
                  background: answers[idx] ? '#8B1A1A' : idx === currentQ ? '#FEE2E2' : '#E5E7EB',
                  color: answers[idx] ? '#fff' : idx === currentQ ? '#8B1A1A' : '#6B7280',
                  cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                }}
              >{idx + 1}</button>
            ))}
          </div>

          {currentQ < activeExam.questions.length - 1 ? (
            <Button icon={<ChevronRight size={16} />} onClick={() => setCurrentQ(q => q + 1)}>
              Next
            </Button>
          ) : (
            <Button icon={<Send size={15} />} loading={submitting} onClick={() => handleSubmit()}>
              Submit Exam
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Exam list
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gray-900)', fontFamily: 'var(--font-display)' }}>My Exams</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginTop: '2px' }}>Available exams and assessments for you</p>
      </div>

      {loading ? (
        <Card padding="48px">
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #E5E7EB', borderTopColor: '#8B1A1A', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </Card>
      ) : exams.length === 0 ? (
        <Card>
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.875rem' }}>
            No exams available right now. Check back later.
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {exams.map(exam => {
            const expired = isPast(new Date(exam.endDate));
            return (
              <div key={exam._id} style={{ background: '#fff', borderRadius: '14px', border: '1px solid var(--gray-100)', padding: '20px 24px', boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                  <div>
                    <h3 style={{ fontSize: '0.975rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: '4px' }}>{exam.title}</h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                      {typeof exam.subject === 'object' ? (exam.subject as any).name : ''}
                    </p>
                  </div>
                  <Badge label={exam.examType} color="blue" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { label: '📋 Questions', value: `${exam.questions?.length || 0} items` },
                    { label: '🏆 Points', value: `${exam.totalPoints} pts` },
                    { label: '⏱ Duration', value: `${exam.duration} min` },
                    { label: '✅ Passing', value: `${exam.passingScore}%` },
                  ].map(item => (
                    <div key={item.label} style={{ padding: '8px 10px', background: 'var(--gray-50)', borderRadius: '8px' }}>
                      <p style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>{item.label}</p>
                      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-700)' }}>{item.value}</p>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
                  <span style={{ fontSize: '0.72rem', color: expired ? '#DC2626' : 'var(--gray-400)' }}>
                    {expired ? '⏰ Expired' : `Due: ${format(new Date(exam.endDate), 'MMM d, h:mm a')}`}
                  </span>
                  <button onClick={() => startExam(exam)} disabled={expired}
                    style={{
                      padding: '8px 18px', borderRadius: '8px',
                      background: expired ? '#E5E7EB' : 'linear-gradient(135deg, #8B1A1A, #A52828)',
                      color: expired ? '#9CA3AF' : '#fff', border: 'none',
                      cursor: expired ? 'not-allowed' : 'pointer',
                      fontSize: '0.8rem', fontWeight: 600, fontFamily: 'var(--font-body)',
                      boxShadow: expired ? 'none' : '0 2px 8px rgba(139,26,26,0.3)',
                    }}
                  >
                    {expired ? 'Closed' : 'Take Exam →'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
