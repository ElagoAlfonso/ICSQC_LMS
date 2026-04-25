import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, RefreshCw, BookOpen, ClipboardList, Calendar } from 'lucide-react';
import { Card, Button } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import type { ChatMessage } from '../../types';

const SUGGESTED_PROMPTS_TEACHER = [
  { icon: <ClipboardList size={14} />, text: 'Create a 10-question quiz on photosynthesis for Grade 8', label: 'Exam Maker' },
  { icon: <BookOpen size={14} />, text: 'Give me a lesson plan for teaching quadratic equations', label: 'Lesson Plan' },
  { icon: <Calendar size={14} />, text: 'Remind me of key academic year deadlines and milestones', label: 'Reminders' },
  { icon: <Sparkles size={14} />, text: 'Generate grading rubric for an essay on Philippine history', label: 'Rubric' },
];

const SUGGESTED_PROMPTS_STUDENT = [
  { icon: <BookOpen size={14} />, text: 'Explain the concept of photosynthesis in simple terms', label: 'Review' },
  { icon: <ClipboardList size={14} />, text: 'Help me review for my Mathematics exam on algebra', label: 'Study Help' },
  { icon: <Calendar size={14} />, text: 'What should I study for my upcoming Science quiz?', label: 'Exam Prep' },
  { icon: <Sparkles size={14} />, text: 'Summarize the key events of the Philippine Revolution', label: 'Summary' },
];

function formatMessage(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('**') && line.endsWith('**')) {
      return <strong key={i} style={{ display: 'block', marginBottom: '4px' }}>{line.slice(2, -2)}</strong>;
    }
    if (line.startsWith('# ')) return <h3 key={i} style={{ fontSize: '1rem', fontWeight: 700, margin: '8px 0 4px', color: 'var(--gray-900)' }}>{line.slice(2)}</h3>;
    if (line.startsWith('## ')) return <h4 key={i} style={{ fontSize: '0.9rem', fontWeight: 600, margin: '6px 0 2px' }}>{line.slice(3)}</h4>;
    if (line.startsWith('- ') || line.startsWith('• ')) return <li key={i} style={{ marginLeft: '16px', marginBottom: '2px', fontSize: '0.875rem' }}>{line.slice(2)}</li>;
    if (line.match(/^\d+\. /)) return <li key={i} style={{ marginLeft: '16px', marginBottom: '2px', fontSize: '0.875rem', listStyle: 'decimal' }}>{line.replace(/^\d+\. /, '')}</li>;
    if (line === '') return <br key={i} />;
    return <p key={i} style={{ margin: '2px 0', fontSize: '0.875rem', lineHeight: 1.7 }}>{line}</p>;
  });
}

export default function AIAssistantPage() {
  const { user } = useAuthStore();
  const isTeacher = user?.role === 'teacher';
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: isTeacher
        ? `Hello, ${user?.name?.split(' ')[0]}! 👋 I'm your ICSQC AI Teaching Assistant. I can help you:\n\n- **Create exams and quizzes** — generate questions for any subject\n- **Build lesson plans** — structured content for your classes\n- **Assignment reminders** — keep track of deadlines\n- **Academic year planning** — semester milestones and scheduling\n\nWhat would you like help with today?`
        : `Hi, ${user?.name?.split(' ')[0]}! 📚 I'm your ICSQC AI Study Assistant. I can help you:\n\n- **Review lessons** — explain concepts in any subject\n- **Exam preparation** — practice questions and summaries\n- **Assignment help** — guidance and explanations\n- **Study tips** — effective strategies for learning\n\nWhat subject or topic would you like to explore?`,
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const systemPrompt = isTeacher
        ? `You are an expert AI assistant for teachers at International Christian School of Quezon City (ICSQC), Philippines. You help with: creating exam questions (multiple choice, true/false, short answer, essay), lesson plans aligned with K-12 curriculum, assignment rubrics, academic year scheduling, and teaching strategies. When creating exams, format questions clearly with options labeled A-D and indicate the correct answer. Always be educational, professional, and helpful. Provide structured, detailed responses.`
        : `You are an expert AI study assistant for students at International Christian School of Quezon City (ICSQC), Philippines. You help students understand lessons, prepare for exams, review concepts from their K-12 curriculum subjects (Math, Science, English, Filipino, AP/Social Studies, Values Education, MAPEH, TLE/TVL). Explain concepts clearly with examples. Provide encouragement and effective study strategies. Be friendly, patient, and educational.`;

      const history = messages.slice(-8).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: systemPrompt,
          messages: [...history, { role: 'user', content: messageText }],
        }),
      });

      const data = await response.json();
      const assistantText = data.content?.[0]?.text || 'Sorry, I could not generate a response. Please try again.';

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '⚠️ Unable to connect to the AI service. Please check your connection and try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      id: Date.now().toString(),
      role: 'assistant',
      content: 'Chat cleared! How can I help you?',
      timestamp: new Date(),
    }]);
  };

  const suggestions = isTeacher ? SUGGESTED_PROMPTS_TEACHER : SUGGESTED_PROMPTS_STUDENT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: 'calc(100vh - 128px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gray-900)', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={22} color="#C9A84C" />
            {isTeacher ? 'AI Teaching Assistant' : 'AI Study Assistant'}
          </h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginTop: '2px' }}>
            {isTeacher ? 'Create exams, lessons, and manage your teaching schedule' : 'Review lessons, prepare for exams, and get study help'}
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={clearChat}>Clear Chat</Button>
      </div>

      {/* Chat window */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        background: '#fff', borderRadius: '16px',
        border: '1px solid var(--gray-100)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden', minHeight: 0,
      }}>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{
              display: 'flex',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              gap: '10px', alignItems: 'flex-start',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #8B1A1A, #C9A84C)'
                  : 'linear-gradient(135deg, #1A2744, #2563EB)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff',
              }}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div style={{
                maxWidth: '72%',
                padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #8B1A1A, #A52828)'
                  : 'var(--gray-50)',
                color: msg.role === 'user' ? '#fff' : 'var(--gray-800)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}>
                <div style={{ lineHeight: 1.6 }}>
                  {msg.role === 'assistant' ? formatMessage(msg.content) : (
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>{msg.content}</p>
                  )}
                </div>
                <div style={{
                  fontSize: '0.68rem', marginTop: '6px',
                  opacity: 0.6, textAlign: msg.role === 'user' ? 'right' : 'left',
                }}>
                  {msg.timestamp.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #1A2744, #2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bot size={16} color="#fff" />
              </div>
              <div style={{ padding: '14px 18px', background: 'var(--gray-50)', borderRadius: '4px 16px 16px 16px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#8B1A1A',
                    animation: 'bounce 1.2s infinite', animationDelay: `${i * 0.2}s`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div style={{ padding: '0 20px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => sendMessage(s.text)} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px',
                background: '#F9FAFB', border: '1px solid var(--gray-200)',
                borderRadius: '20px', cursor: 'pointer',
                fontSize: '0.78rem', color: 'var(--gray-600)', fontWeight: 500,
                fontFamily: 'var(--font-body)',
                transition: 'all 0.15s',
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#FEE2E2'; (e.currentTarget as HTMLElement).style.borderColor = '#8B1A1A'; (e.currentTarget as HTMLElement).style.color = '#8B1A1A'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#F9FAFB'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--gray-200)'; (e.currentTarget as HTMLElement).style.color = 'var(--gray-600)'; }}
              >
                {s.icon}
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--gray-100)',
          display: 'flex', gap: '10px', alignItems: 'flex-end',
          background: '#fff',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isTeacher ? 'Ask me to create an exam, lesson plan, or anything teaching-related...' : 'Ask me to explain a topic, help you study, or review for your exam...'}
            rows={1}
            style={{
              flex: 1, padding: '11px 14px',
              border: '1.5px solid var(--gray-200)',
              borderRadius: '12px', fontSize: '0.875rem',
              outline: 'none', resize: 'none',
              maxHeight: '120px', overflowY: 'auto',
              fontFamily: 'var(--font-body)',
              lineHeight: 1.5, color: 'var(--gray-900)',
            }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 120) + 'px';
            }}
            onFocus={(e) => { e.target.style.borderColor = '#8B1A1A'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--gray-200)'; }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            style={{
              width: 42, height: 42, borderRadius: '12px', flexShrink: 0,
              background: !input.trim() || loading ? '#E5E7EB' : 'linear-gradient(135deg, #8B1A1A, #A52828)',
              border: 'none', cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: !input.trim() || loading ? '#9CA3AF' : '#fff',
              transition: 'all 0.15s',
              boxShadow: !input.trim() || loading ? 'none' : '0 2px 8px rgba(139,26,26,0.3)',
            }}
          >
            <Send size={17} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
