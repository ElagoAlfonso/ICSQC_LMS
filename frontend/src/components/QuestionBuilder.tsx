import { useState } from 'react';
import { ChevronDown, ChevronUp, Check, HelpCircle, Plus, Upload, X } from 'lucide-react';
import { Badge, Button, Input, Select } from './ui';
import type { Question, QuestionAttachment } from '../types';

interface QuestionBuilderProps {
  questions: Question[];
  onChange: (questions: Question[]) => void;
  readOnly?: boolean;
  validationErrors?: Record<string, string>;
}

const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'essay', label: 'Essay' },
];

const blankQuestion = (): Question => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  question: '', type: 'multiple_choice', choices: ['', '', '', ''], correctAnswer: '', points: 1,
});

export default function QuestionBuilder({ questions, onChange, readOnly = false, validationErrors = {} }: QuestionBuilderProps) {
  const [open, setOpen] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const normalizeQuestion = (question: Question, index: number): Question => ({
    ...question,
    id: question.id || `question-${index}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  });

  const update = (index: number, patch: Partial<Question>) => onChange(questions.map((question, current) => current === index ? { ...normalizeQuestion(question, current), ...patch, id: question.id || normalizeQuestion(question, current).id } : normalizeQuestion(question, current)));
  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= questions.length) return;
    const next = [...questions];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
    setOpen(nextIndex);
  };

  const normalizeFiles = (files: FileList | File[] | null | undefined) => {
    if (!files) return [];
    return Array.from(files).filter((file) => file && file.size > 0);
  };

  const handleFilesUpload = (index: number, incomingFiles: FileList | File[] | null | undefined) => {
    const files = normalizeFiles(incomingFiles);
    if (!files.length) return;

    const nextAttachments: QuestionAttachment[] = [];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const attachment: QuestionAttachment = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          url: typeof reader.result === 'string' ? reader.result : '',
          isImage: file.type.startsWith('image/'),
        };
        nextAttachments.push(attachment);
        const currentAttachments = questions[index]?.attachments || [];
        if (nextAttachments.length === files.length) {
          update(index, { attachments: [...currentAttachments, ...nextAttachments] });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  return <div style={{ display: 'grid', gap: 8 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><strong style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--gray-700)' }}>Questions ({questions.length})</strong>{!readOnly && <Button size="sm" variant="outline" icon={<Plus size={13} />} onClick={() => { const next = [...questions, blankQuestion()]; onChange(next); setOpen(next.length - 1); }}>Add question</Button>}</div>
    {questions.length === 0 && <div style={{ padding: 28, textAlign: 'center', background: 'var(--gray-50)', borderRadius: 10, border: '2px dashed var(--gray-200)' }}><HelpCircle size={28} color="#D1D5DB" /><p style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>No questions yet.</p></div>}
    {questions.map((question, index) => <div key={question.id || `question-${index}`} style={{ border: '1px solid var(--gray-200)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: open === index ? '#FFF7F7' : '#fff' }}>
        <button type="button" onClick={() => setOpen(open === index ? null : index)} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}><span style={{ width: 24, height: 24, borderRadius: '50%', background: '#8B1A1A', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '0.72rem', fontWeight: 700 }}>{index + 1}</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: question.question ? 'var(--gray-800)' : 'var(--gray-400)' }}>{question.question || 'Untitled question'}</span></button>
        <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>{question.points} pt</span><Badge label={question.type.replace('_', ' ')} color="blue" />
        {!readOnly && <><button type="button" title="Move up" disabled={index === 0} onClick={() => move(index, -1)} style={{ border: 0, background: 'transparent', cursor: index === 0 ? 'not-allowed' : 'pointer', color: '#64748B' }}><ChevronUp size={15} /></button><button type="button" title="Move down" disabled={index === questions.length - 1} onClick={() => move(index, 1)} style={{ border: 0, background: 'transparent', cursor: index === questions.length - 1 ? 'not-allowed' : 'pointer', color: '#64748B' }}><ChevronDown size={15} /></button><button type="button" title="Delete question" onClick={() => onChange(questions.filter((_, current) => current !== index))} style={{ border: 0, background: 'transparent', color: '#DC2626', cursor: 'pointer' }}><X size={14} /></button></>}
        {open === index ? <ChevronUp size={14} color="#9CA3AF" /> : <ChevronDown size={14} color="#9CA3AF" />}
      </div>
      {open === index && <div style={{ padding: 14, borderTop: '1px solid var(--gray-100)', display: 'grid', gap: 12, background: '#FAFAFA' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 80px', gap: 10, alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--gray-700)' }}>Question</label>
            <textarea
              value={question.question}
              disabled={readOnly}
              rows={4}
              onChange={(event) => update(index, { question: event.target.value })}
              style={{
                width: '100%',
                padding: '9px 12px',
                border: `1.5px solid ${validationErrors[`question_${index}_text`] ? '#DC2626' : 'var(--gray-200)'}`,
                borderRadius: '9px',
                fontSize: '0.875rem',
                color: 'var(--gray-900)',
                background: '#fff',
                outline: 'none',
                fontFamily: 'var(--font-body)',
                resize: 'vertical',
                minHeight: '96px',
              }}
            />
            {validationErrors[`question_${index}_text`] && <p style={{ fontSize: '0.75rem', color: '#DC2626' }}>{validationErrors[`question_${index}_text`]}</p>}
          </div>
          <Select label="Type" value={question.type} error={validationErrors[`question_${index}_type`]} disabled={readOnly} onChange={event => update(index, { type: event.target.value as Question['type'], choices: event.target.value === 'multiple_choice' ? ['', '', '', ''] : undefined, correctAnswer: '' })} options={QUESTION_TYPES} />
          <Input label="Points" type="number" min="1" value={question.points} error={validationErrors[`question_${index}_points`]} disabled={readOnly} onChange={event => update(index, { points: Number(event.target.value) || 1 })} />
        </div>

        {!readOnly && <div style={{ display: 'grid', gap: 8 }}>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragIndex(index);
            }}
            onDragLeave={() => setDragIndex((current) => current === index ? null : current)}
            onDrop={(event) => {
              event.preventDefault();
              setDragIndex(null);
              handleFilesUpload(index, event.dataTransfer.files);
            }}
            style={{
              display: 'grid',
              gap: 8,
              padding: '14px 12px',
              border: dragIndex === index ? '1.5px dashed #8B1A1A' : '1.5px dashed var(--gray-300)',
              borderRadius: 10,
              background: dragIndex === index ? '#FFF7F7' : '#fff',
              transition: 'all 0.2s ease',
            }}
          >
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, width: 'fit-content', padding: '8px 12px', background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 8, color: '#8B1A1A', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer' }}>
              <Upload size={14} />
              Upload files
              <input type="file" accept=".pdf,.doc,.docx,.xlsx,.xls,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.bmp,.mp3,.wav,.mp4,.mov,.zip,.rar,.7z,image/*,audio/*,video/*" multiple hidden onChange={(event) => handleFilesUpload(index, event.target.files)} />
            </label>
            <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>Drag and drop files here or browse to attach multiple files.</div>
          </div>

          {((question.attachments && question.attachments.length) || question.image) && (
            <div style={{ display: 'grid', gap: 8 }}>
              {question.attachments?.map((attachment) => (
                <div key={attachment.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 8 }}>
                  {attachment.isImage ? <img src={attachment.url} alt={attachment.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--gray-200)' }} /> : <div style={{ width: 72, height: 72, borderRadius: 8, background: '#F3F4F6', display: 'grid', placeItems: 'center', color: '#6B7280', fontSize: '0.68rem', fontWeight: 700, textAlign: 'center', padding: 4 }}>{attachment.type.includes('pdf') ? 'PDF' : attachment.type.includes('doc') ? 'DOC' : attachment.type.includes('sheet') || attachment.type.includes('excel') ? 'XLS' : attachment.type.includes('video') ? 'VID' : attachment.type.includes('audio') ? 'AUDIO' : 'FILE'}</div> }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--gray-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>{attachment.isImage ? 'Image ready to include' : `${Math.max(1, Math.round(attachment.size / 1024))} KB`}</div>
                  </div>
                  <button type="button" onClick={() => update(index, { attachments: (question.attachments || []).filter((item) => item.id !== attachment.id) })} style={{ border: 0, background: 'transparent', color: '#DC2626', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 600 }}>Remove</button>
                </div>
              ))}
              {question.image && <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 8 }}>
                <img src={question.image} alt={question.imageName || 'Question image'} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--gray-200)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--gray-700)' }}>{question.imageName || 'Question image'}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>Image ready to include</div>
                </div>
                <button type="button" onClick={() => update(index, { image: null, imageName: null })} style={{ border: 0, background: 'transparent', color: '#DC2626', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 600 }}>Remove</button>
              </div>}
            </div>
          )}
        </div>}

        {((question.attachments && question.attachments.length) || question.image) && (readOnly || open === index) && (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8B1A1A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Attached files</div>
            {question.attachments?.filter((item) => item.isImage).map((attachment) => (
              <img key={attachment.id} src={attachment.url} alt={attachment.name} style={{ display: 'block', width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--gray-200)', background: '#fff' }} />
            ))}
            {question.image && <img src={question.image} alt={question.imageName || 'Question image'} style={{ display: 'block', width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--gray-200)', background: '#fff' }} />}
          </div>
        )}
        {question.type === 'multiple_choice' && <div style={{ display: 'grid', gap: 6 }}>{(question.choices || ['', '', '', '']).map((choice, choiceIndex) => <div key={choiceIndex} style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ width: 18, color: '#8B1A1A', fontWeight: 700 }}>{String.fromCharCode(65 + choiceIndex)}</span><input value={choice} disabled={readOnly} onChange={event => { const choices = [...(question.choices || ['', '', '', ''])]; choices[choiceIndex] = event.target.value; update(index, { choices }); }} style={{ flex: 1, padding: '7px 10px', border: `1px solid ${validationErrors[`question_${index}_answer`] ? '#DC2626' : 'var(--gray-200)'}`, borderRadius: 7 }} /><button type="button" disabled={readOnly} title="Mark correct" onClick={() => update(index, { correctAnswer: choice })} style={{ width: 28, height: 28, border: 0, borderRadius: '50%', background: question.correctAnswer === choice && choice ? '#059669' : '#E5E7EB', color: question.correctAnswer === choice && choice ? '#fff' : '#94A3B8', cursor: readOnly ? 'default' : 'pointer' }}><Check size={13} /></button></div>)}</div>}
        {question.type === 'true_false' && <div style={{ display: 'flex', gap: 8 }}>{['True', 'False'].map(answer => <button key={answer} type="button" disabled={readOnly} onClick={() => update(index, { correctAnswer: answer })} style={{ flex: 1, padding: 8, border: `2px solid ${question.correctAnswer === answer ? '#059669' : 'var(--gray-200)'}`, borderRadius: 8, background: '#fff', cursor: readOnly ? 'default' : 'pointer' }}>{answer}</button>)}</div>}
        {question.type === 'short_answer' && <Input label="Correct answer" value={question.correctAnswer} error={validationErrors[`question_${index}_answer`]} disabled={readOnly} onChange={event => update(index, { correctAnswer: event.target.value })} />}
        {question.type === 'essay' && <p style={{ margin: 0, color: '#92400E', fontSize: '0.78rem' }}>Essay questions require manual grading.</p>}
      </div>}
    </div>) }
  </div>;
}
