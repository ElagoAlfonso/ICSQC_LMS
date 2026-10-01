import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, ExternalLink, FileUp, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Badge, Button, Card, EmptyState, Input } from '../../components/ui';
import { classworkApi } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import type { Classwork, ClassworkSubmission, Rubric, RubricScore, User } from '../../types';
import { MAX_ATTACHMENT_COUNT, MAX_ATTACHMENT_SIZE_BYTES, SUPPORTED_ATTACHMENT_ACCEPT } from '../../utils/attachments';

const parseAssessmentAnswers = (value?: string): string[] | null => {
  try {
    const parsed = JSON.parse(value || '');
    return Array.isArray(parsed) ? parsed.map((answer) => String(answer ?? '')) : null;
  } catch {
    return null;
  }
};

export default function ClassworkDetailPage() {
  const { classId, classworkId } = useParams<{ classId: string; classworkId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [classwork, setClasswork] = useState<Classwork | null>(null);
  const [submission, setSubmission] = useState<ClassworkSubmission | null>(null);
  const [submissions, setSubmissions] = useState<ClassworkSubmission[]>([]);
  const [notes, setNotes] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const updateAnswer = (index: number, value: string) => setAnswers((current) => {
    const next = [...current];
    next[index] = value;
    return next;
  });

  const load = async () => {
    try {
      const detailResponse = await classworkApi.getById(classworkId!);
      const detail = detailResponse.data.classwork as Classwork;
      setClasswork(detail);

      if (user?.role === 'student') {
        const response = await classworkApi.getMySubmissions();
        const items = (response.data.submissions || []) as ClassworkSubmission[];
        const current = items.find((item) => {
          const itemClassworkId = typeof item.classwork === 'object' ? item.classwork._id : item.classwork;
          return itemClassworkId === classworkId;
        }) || null;
        setSubmission(current);
        setNotes(current?.submittedNotes || '');
        setAnswers(parseAssessmentAnswers(current?.submittedNotes) || []);
      } else {
        const response = await classworkApi.getSubmissions(classworkId!);
        setSubmissions((response.data.submissions || []) as ClassworkSubmission[]);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to load classwork.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [classworkId, user?.role]);

  const submit = async () => {
    const isAssessment = classwork?.type === 'assessment';
    if (isPastDue && !classwork.allowLateSubmission && !submission) {
      toast.error('This assignment is past due and no longer accepts submissions.');
      return;
    }
    if (isAssessment && (!classwork.questions?.length || answers.length !== classwork.questions.length || answers.some((answer) => !answer.trim()))) {
      toast.error('Answer every question before submitting.');
      return;
    }
    if (!isAssessment && classwork?.submissionMode !== 'mark_done' && !notes.trim() && files.length === 0) {
      toast.error('Add notes or attach at least one file.');
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      const submittedNotes = isAssessment ? JSON.stringify(answers) : classwork?.submissionMode === 'mark_done' ? 'Marked as done' : notes.trim();
      formData.append('submittedNotes', submittedNotes);
      formData.append('isRevision', String(Boolean(submission)));
      files.forEach((file) => formData.append('attachments', file));
      await classworkApi.submit(classworkId!, formData);
      toast.success(isAssessment ? submission ? 'Answers revised.' : 'Answers submitted.' : submission ? 'Submission revised.' : 'Classwork submitted.');
      setFiles([]);
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to submit classwork.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card padding="48px"><p style={{ textAlign: 'center', margin: 0 }}>Loading classwork...</p></Card>;
  if (!classwork) return <Card><EmptyState title="Classwork unavailable" description="This classwork does not exist or is not available to you." /></Card>;

  const teacherName = typeof classwork.createdBy === 'object' ? classwork.createdBy.name : 'Teacher';
  const subjectName = typeof classwork.subject === 'object' ? classwork.subject.name : 'Class subject';
  const dueDate = classwork.dueDate ? new Date(classwork.dueDate).toLocaleDateString(undefined, { dateStyle: 'medium' }) : null;
  const isPastDue = Boolean(classwork.dueDate && new Date(classwork.dueDate).getTime() < Date.now());
  const canSubmitNow = !isPastDue || classwork.allowLateSubmission || Boolean(submission);
  const questionCount = classwork.questionCount ?? classwork.questions?.length ?? 0;
  const questionPoints = classwork.questionPoints ?? classwork.questions?.map((question) => question.points) ?? [];
  const rubric = typeof classwork.rubric === 'object' ? classwork.rubric : null;
  const pointsLabel = questionPoints.length && questionPoints.every((points) => points === questionPoints[0])
    ? `${questionPoints[0]} point${questionPoints[0] === 1 ? '' : 's'}`
    : questionPoints.length ? questionPoints.join(', ') : `${classwork.points} points total`;
  const addFiles = (selected: FileList | null) => {
    if (!selected) return;
    const next = [...files, ...Array.from(selected)];
    if (next.length > MAX_ATTACHMENT_COUNT) { toast.error(`You can attach up to ${MAX_ATTACHMENT_COUNT} files.`); return; }
    if (next.some((file) => file.size > MAX_ATTACHMENT_SIZE_BYTES)) { toast.error('Each file must be 50 MB or smaller.'); return; }
    setFiles(next);
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <button type="button" onClick={() => navigate(`${user?.role === 'teacher' ? '/teacher' : user?.role === 'admin' ? '/admin' : '/student'}/classes/${classId}`)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, background: 'none', color: '#7a1010', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
        <ArrowLeft size={16} /> Back to Classwork
      </button>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#7a1010', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{subjectName} · {classwork.type}</div>
            <h1 style={{ margin: '8px 0 6px', fontSize: '1.7rem', color: 'var(--gray-900)' }}>{classwork.title}</h1>
            <p style={{ margin: 0, color: '#64748B' }}>Posted by {teacherName}{dueDate ? ` · Due ${dueDate}${classwork.dueTime ? ` at ${classwork.dueTime}` : ''}` : ''}</p>
            {isPastDue && (
              <p style={{ margin: '10px 0 0', color: classwork.allowLateSubmission ? '#B45309' : '#991B1B', fontWeight: 600 }}>
                {classwork.allowLateSubmission ? 'Past due' : 'Past due — this assignment is closed for new submissions.'}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><Badge label={classwork.status} color={classwork.status === 'published' ? 'green' : 'yellow'} /><Badge label={`${classwork.points} points`} color="blue" /></div>
        </div>
        <div style={{ marginTop: 22, display: 'grid', gap: 12 }}>
          <div><h3 style={{ margin: '0 0 6px' }}>Description</h3><p style={{ margin: 0, color: '#475569', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{classwork.description}</p></div>
          {classwork.instructions && <div><h3 style={{ margin: '0 0 6px' }}>Instructions</h3><p style={{ margin: 0, color: '#475569', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{classwork.instructions}</p></div>}
          {rubric && <div><h3 style={{ margin: '0 0 8px' }}>Rubric · {rubric.name}</h3><div style={{ display: 'grid', gap: 8 }}>{rubric.criteria.map((criterion) => <div key={criterion.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: 10, border: '1px solid #E5E7EB', borderRadius: 8 }}><div><strong style={{ color: '#334155', fontSize: '0.84rem' }}>{criterion.title}</strong>{criterion.description && <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '0.8rem' }}>{criterion.description}</p>}</div><strong style={{ flexShrink: 0, color: '#475569', fontSize: '0.82rem' }}>{criterion.maxPoints} pts</strong></div>)}</div></div>}
          {classwork.resourceLinks?.length ? <div><h3 style={{ margin: '0 0 8px' }}>Lesson links</h3><div style={{ display: 'grid', gap: 7 }}>{classwork.resourceLinks.map((link, index) => <a key={`${link.url}-${index}`} href={link.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, width: 'fit-content', maxWidth: '100%', color: '#2563EB', overflowWrap: 'anywhere' }}><ExternalLink size={15} />{link.title}</a>)}</div></div> : null}
          {classwork.attachments?.length > 0 && <div><h3 style={{ margin: '0 0 8px' }}>Lesson materials</h3><div style={{ display: 'grid', gap: 7 }}>{classwork.attachments.map((attachment) => <a key={attachment._id} href={classworkApi.attachmentUrl(classwork._id, attachment._id)} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, width: 'fit-content', maxWidth: '100%', color: '#2563EB', fontSize: '0.86rem', overflowWrap: 'anywhere' }}><FileUp size={15} />{attachment.originalName}<span style={{ color: '#64748B', fontSize: '0.75rem' }}>({(attachment.size / (1024 * 1024)).toFixed(1)} MB)</span></a>)}</div></div>}
          {user?.role !== 'student' && classwork.type === 'assessment' && classwork.questions?.length ? <div style={{ display: 'grid', gap: 10, paddingTop: 8 }}><h3 style={{ margin: 0 }}>Questions</h3>{classwork.questions.map((question, index) => <div key={index} style={{ padding: 12, borderRadius: 9, background: '#F1F5F9', color: '#334155', fontSize: '0.88rem' }}><strong>Question {index + 1}</strong><p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{question.question}</p>{question.choices?.length ? <div style={{ display: 'grid', gap: 4, marginTop: 8, color: '#64748B' }}>{question.choices.map((choice, choiceIndex) => <span key={choiceIndex}>{String.fromCharCode(65 + choiceIndex)}. {choice}</span>)}</div> : null}</div>)}</div> : null}
          {user?.role === 'student' && classwork.type === 'assessment' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, paddingTop: 8 }}>
            <div style={{ padding: 12, borderRadius: 9, background: '#F1F5F9' }}><div style={{ color: '#64748B', fontSize: '0.75rem' }}>Questions</div><strong>{questionCount}</strong></div>
            <div style={{ padding: 12, borderRadius: 9, background: '#F1F5F9' }}><div style={{ color: '#64748B', fontSize: '0.75rem' }}>Points per question</div><strong>{pointsLabel}</strong></div>
            <div style={{ padding: 12, borderRadius: 9, background: '#F1F5F9' }}><div style={{ color: '#64748B', fontSize: '0.75rem' }}>Your score</div><strong>{submission?.status === 'graded' ? `${submission.score} / ${submission.totalPoints}` : 'Pending'}</strong></div>
          </div>}
        </div>
      </Card>

      {user?.role === 'teacher' && (
        <Card title="Student submissions" subtitle={`${submissions.length} submission${submissions.length === 1 ? '' : 's'}`}>
          {submissions.length === 0 ? <p style={{ margin: 0, color: '#64748B' }}>No submissions yet.</p> : <div style={{ display: 'grid', gap: 12 }}>{submissions.map(item => <TeacherSubmission key={item._id} submission={item} classwork={classwork} rubric={rubric} onSaved={load} />)}</div>}
        </Card>
      )}

      {user?.role === 'admin' && (
        <Card title="Student submissions" subtitle="Read-only classroom monitoring">
          {submissions.length === 0 ? <p style={{ margin: 0, color: '#64748B' }}>No submissions yet.</p> : <div style={{ display: 'grid', gap: 12 }}>{submissions.map((item) => <ReadOnlySubmission key={item._id} submission={item} classwork={classwork} />)}</div>}
        </Card>
      )}

      {user?.role === 'student' && classwork.type !== 'syllabus' && classwork.type !== 'lesson' && (
        <Card title={classwork.type === 'assessment' ? 'Your answers' : 'Your work'} subtitle={classwork.type === 'assessment' ? 'Answer each question in the LMS. You can revise before the deadline.' : submission ? 'Submitted files and notes can be revised before the deadline.' : 'Attach your completed work and submit it to your teacher.'} padding="16px">
          {submission?.attachments?.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginBottom: 10 }}>{submission.attachments.map((attachment) => <a key={attachment._id} href={classworkApi.submissionAttachmentUrl(submission._id, attachment._id)} target="_blank" rel="noreferrer" style={{ color: '#2563EB', fontSize: '0.8rem' }}>{attachment.originalName}</a>)}</div> : null}
          {classwork.type === 'assessment' ? <div style={{ display: 'grid', gap: 14 }}>{(classwork.questions || []).map((question, index) => <fieldset key={index} style={{ margin: 0, padding: 12, border: '1px solid #E5E7EB', borderRadius: 8 }}><legend style={{ padding: '0 5px', color: '#334155', fontSize: '0.84rem', fontWeight: 700 }}>Question {index + 1} · {question.points} pts</legend><p style={{ margin: '4px 0 10px', color: '#334155', whiteSpace: 'pre-wrap' }}>{question.question}</p>{question.type === 'multiple_choice' && <div style={{ display: 'grid', gap: 7 }}>{(question.choices || []).map((choice, choiceIndex) => <label key={choiceIndex} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontSize: '0.85rem' }}><input type="radio" name={`answer-${classworkId}-${index}`} checked={answers[index] === choice} onChange={() => updateAnswer(index, choice)} />{choice}</label>)}</div>}{question.type === 'true_false' && <div style={{ display: 'flex', gap: 14 }}>{['True', 'False'].map((choice) => <label key={choice} style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#475569', fontSize: '0.85rem' }}><input type="radio" name={`answer-${classworkId}-${index}`} checked={answers[index] === choice} onChange={() => updateAnswer(index, choice)} />{choice}</label>)}</div>}{question.type === 'short_answer' && <Input label="Your answer" value={answers[index] || ''} onChange={(event) => updateAnswer(index, event.target.value)} />}{question.type === 'essay' && <textarea aria-label={`Answer to question ${index + 1}`} rows={4} value={answers[index] || ''} onChange={(event) => updateAnswer(index, event.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: 10, border: '1px solid #D8DEE8', borderRadius: 8, font: 'inherit', resize: 'vertical' }} />}</fieldset>)}</div> : classwork.submissionMode !== 'mark_done' && <Input label="Notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Describe your work or add a message for your teacher." />}
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            {classwork.type !== 'assessment' && <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 58, padding: '6px 12px', border: '1.5px dashed #94A3B8', borderRadius: 10, color: '#2563EB', cursor: 'pointer', textAlign: 'center' }}>
              <FileUp size={16} />
              <span><strong>Add or upload</strong><small style={{ display: 'block', marginTop: 3, color: '#64748B' }}>Documents, text, images, audio, video, compressed, and config files</small></span>
              <input type="file" multiple accept={SUPPORTED_ATTACHMENT_ACCEPT} onChange={event => { addFiles(event.target.files); event.currentTarget.value = ''; }} style={{ display: 'none' }} />
            </label>}
            {classwork.type !== 'assessment' && files.length > 0 && <div style={{ display: 'grid', gap: 6 }}>{files.map((file, index) => <div key={`${file.name}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', background: '#F1F5F9', borderRadius: 7, fontSize: '0.82rem' }}><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles(files.filter((_, fileIndex) => fileIndex !== index))} style={{ border: 0, background: 'transparent', color: '#64748B', cursor: 'pointer' }}><X size={15} /></button></div>)}</div>}
            <Button size="sm" style={{ width: 'fit-content', minWidth: 150 }} loading={saving} disabled={!canSubmitNow} icon={<CheckCircle2 size={16} />} onClick={submit}>{classwork.type === 'assessment' ? submission ? 'Revise answers' : 'Submit answers' : submission ? 'Revise submission' : classwork.submissionMode === 'mark_done' ? 'Mark as done' : 'Submit work'}</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function TeacherSubmission({ submission, classwork, rubric, onSaved }: { submission: ClassworkSubmission; classwork: Classwork; rubric: Rubric | null; onSaved: () => Promise<void> }) {
  const [score, setScore] = useState(submission.score?.toString() || '');
  const [feedback, setFeedback] = useState(submission.feedback || '');
  const [saving, setSaving] = useState(false);
  const [rubricScores, setRubricScores] = useState(() => (rubric?.criteria || []).map((criterion) => ({
    criterionId: criterion.id,
    score: String(submission.rubricScores?.find((entry) => entry.criterionId === criterion.id)?.score ?? ''),
  })));
  const student = typeof submission.student === 'object' ? submission.student as User : null;
  const assessmentAnswers = classwork.type === 'assessment' ? parseAssessmentAnswers(submission.submittedNotes) : null;

  const grade = async () => {
    let numericScore = Number(score);
    let scores: RubricScore[] | undefined;
    if (rubric) {
      if (rubricScores.some((entry) => entry.score.trim() === '')) {
        toast.error('Enter a score for every rubric criterion.');
        return;
      }
      scores = rubricScores.map((entry) => ({ criterionId: entry.criterionId, score: Number(entry.score) }));
      if (scores.some((entry, index) => !Number.isFinite(entry.score) || entry.score < 0 || entry.score > rubric.criteria[index].maxPoints)) {
        toast.error('Each criterion score must be within its allowed range.');
        return;
      }
      numericScore = scores.reduce((sum, entry) => sum + entry.score, 0);
    }
    if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > submission.totalPoints) {
      toast.error(`Score must be between 0 and ${submission.totalPoints}.`);
      return;
    }
    setSaving(true);
    try {
      await classworkApi.gradeSubmission(submission._id, { score: numericScore, feedback: feedback.trim(), ...(scores ? { rubricScores: scores } : {}) });
      toast.success('Submission graded.');
      await onSaved();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to grade submission.');
    } finally {
      setSaving(false);
    }
  };

  return <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><div><strong>{student?.name || 'Student'}</strong><div style={{ color: '#64748B', fontSize: '0.8rem', marginTop: 4 }}>{new Date(submission.submittedAt).toLocaleString()} · {submission.status}</div></div><Badge label={`${submission.totalPoints} points max`} color="gray" /></div>
    {submission.submittedNotes && (assessmentAnswers && classwork.questions?.length ? <div style={{ display: 'grid', gap: 8, margin: '12px 0' }}>{classwork.questions.map((question, index) => <div key={index} style={{ padding: 10, background: '#F8FAFC', borderRadius: 7 }}><strong style={{ color: '#334155', fontSize: '0.8rem' }}>Question {index + 1}: {question.question}</strong><p style={{ margin: '5px 0 0', color: '#475569', whiteSpace: 'pre-wrap', fontSize: '0.82rem' }}>{assessmentAnswers[index] || 'No answer'}</p></div>)}</div> : <p style={{ margin: '12px 0', color: '#475569', whiteSpace: 'pre-wrap' }}>{submission.submittedNotes}</p>)}
    {submission.attachments?.length ? <div style={{ display: 'grid', gap: 5, margin: '12px 0' }}>{submission.attachments.map((attachment) => <a key={attachment._id} href={classworkApi.submissionAttachmentUrl(submission._id, attachment._id)} target="_blank" rel="noreferrer" style={{ color: '#2563EB', fontSize: '0.82rem' }}>{attachment.originalName}</a>)}</div> : null}
    {rubric ? <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
      <strong style={{ color: '#7a1010', fontSize: '0.84rem' }}>{rubric.name}</strong>
      {rubric.criteria.map((criterion, index) => <div key={criterion.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px', gap: 10, alignItems: 'end', padding: 10, border: '1px solid #E5E7EB', borderRadius: 8 }}>
        <div><strong style={{ display: 'block', color: '#334155', fontSize: '0.82rem' }}>{criterion.title} · {criterion.maxPoints} pts</strong>{criterion.description && <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '0.76rem' }}>{criterion.description}</p>}</div>
        <Input label="Score" type="number" min="0" max={criterion.maxPoints} value={rubricScores[index]?.score || ''} onChange={(event) => setRubricScores((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, score: event.target.value } : entry))} />
      </div>)}
      <div style={{ display: 'flex', alignItems: 'end', gap: 10, flexWrap: 'wrap' }}><div style={{ flex: 1, minWidth: 180 }}><Input label="Feedback" value={feedback} onChange={event => setFeedback(event.target.value)} placeholder="Optional feedback" /></div><Button size="sm" loading={saving} icon={<CheckCircle2 size={14} />} onClick={grade}>Save grade · {rubricScores.reduce((sum, entry) => sum + (Number(entry.score) || 0), 0)}/{rubric.criteria.reduce((sum, criterion) => sum + criterion.maxPoints, 0)}</Button></div>
    </div> : <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr auto', gap: 10, alignItems: 'end' }}><Input label="Score" type="number" min="0" max={submission.totalPoints} value={score} onChange={event => setScore(event.target.value)} /><Input label="Feedback" value={feedback} onChange={event => setFeedback(event.target.value)} placeholder="Optional feedback" /><Button size="sm" loading={saving} icon={<CheckCircle2 size={14} />} onClick={grade}>Save grade</Button></div>}
  </div>;
}

function ReadOnlySubmission({ submission, classwork }: { submission: ClassworkSubmission; classwork: Classwork }) {
  const student = typeof submission.student === 'object' ? submission.student as User : null;
  const answers = classwork.type === 'assessment' ? parseAssessmentAnswers(submission.submittedNotes) : null;

  return <article style={{ padding: 14, border: '1px solid #E5E7EB', borderRadius: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
      <div><strong style={{ color: '#334155' }}>{student?.name || 'Student'}</strong><div style={{ color: '#64748B', fontSize: '0.76rem', marginTop: 3 }}>{new Date(submission.submittedAt).toLocaleString()} · {submission.status}</div></div>
      {submission.status === 'graded' && <Badge label={`${submission.score ?? 0} / ${submission.totalPoints}`} color="green" />}
    </div>
    {answers && classwork.questions?.length ? <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>{classwork.questions.map((question, index) => <div key={index} style={{ padding: 10, background: '#F8FAFC', borderRadius: 7 }}><strong style={{ color: '#334155', fontSize: '0.8rem' }}>Question {index + 1}: {question.question}</strong><p style={{ margin: '5px 0 0', color: '#475569', whiteSpace: 'pre-wrap', fontSize: '0.82rem' }}>{answers[index] || 'No answer'}</p></div>)}</div> : submission.submittedNotes && <p style={{ margin: '12px 0 0', color: '#475569', whiteSpace: 'pre-wrap' }}>{submission.submittedNotes}</p>}
    {submission.attachments?.length ? <div style={{ display: 'grid', gap: 5, marginTop: 10 }}>{submission.attachments.map((attachment) => <a key={attachment._id} href={classworkApi.submissionAttachmentUrl(submission._id, attachment._id)} target="_blank" rel="noreferrer" style={{ color: '#2563EB', fontSize: '0.82rem' }}>{attachment.originalName}</a>)}</div> : null}
    {submission.feedback && <p style={{ margin: '10px 0 0', color: '#64748B', fontSize: '0.82rem' }}>Feedback: {submission.feedback}</p>}
  </article>;
}
