import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, RefreshCw, BookOpen, ClipboardList, Calendar } from 'lucide-react';
import { Card, Button } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { aiApi, subjectsApi } from '../../utils/api';
import toast from 'react-hot-toast';
import type { ChatMessage } from '../../types';

const getTeacherSuggestions = (subjectName = 'your subject') => [
  { icon: <ClipboardList size={14} />, text: `Create a 10-question quiz for ${subjectName}`, label: 'Exam Maker' },
  { icon: <BookOpen size={14} />, text: `Give me a lesson plan for ${subjectName}`, label: 'Lesson Plan' },
  { icon: <Calendar size={14} />, text: `Suggest key academic milestones for ${subjectName}`, label: 'Reminders' },
  { icon: <Sparkles size={14} />, text: `Generate a grading rubric for a ${subjectName} essay`, label: 'Rubric' },
];

const SUGGESTED_PROMPTS_STUDENT = [
  { icon: <BookOpen size={14} />, text: 'Explain the concept of photosynthesis in simple terms', label: 'Review' },
  { icon: <ClipboardList size={14} />, text: 'Help me review for my Mathematics exam on algebra', label: 'Study Help' },
  { icon: <Calendar size={14} />, text: 'What should I study for my upcoming Science quiz?', label: 'Exam Prep' },
  { icon: <Sparkles size={14} />, text: 'Summarize the key events of the Philippine Revolution', label: 'Summary' },
];

const getChatStorageKey = (userId: string, kind: 'messages' | 'draft') => `icsqc-ai-${kind}-${userId}`;

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
  const userId = user?._id || 'anonymous';
  const welcomeMessage: ChatMessage = {
    id: '0',
    role: 'assistant',
    content: isTeacher
      ? `Hello, ${user?.name?.split(' ')[0]}! 👋 I'm Ezra, your ICSQC teaching companion. I can help you:\n\n- **Create exams and quizzes** — generate questions for any subject\n- **Build lesson plans** — structured content for your classes\n- **Assignment reminders** — keep track of deadlines\n- **Academic year planning** — semester milestones and scheduling\n\nWhat would you like help with today?`
      : `Hi! I'm Ezra 👋 Your AI study buddy for ICSQC. Ask me about your subjects, lessons, assignments, or anything you need help reviewing.`,
    timestamp: new Date(),
  };
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(getChatStorageKey(userId, 'messages'));
      if (saved) {
        const parsed = JSON.parse(saved) as Array<Omit<ChatMessage, 'timestamp'> & { timestamp: string }>;
        return parsed.map(message => ({ ...message, timestamp: new Date(message.timestamp) }));
      }
    } catch {
      localStorage.removeItem(getChatStorageKey(userId, 'messages'));
    }
    return [welcomeMessage];
  });
  const [input, setInput] = useState(() => localStorage.getItem(getChatStorageKey(userId, 'draft')) || '');
  const [loading, setLoading] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessMessage, setAccessMessage] = useState('The AI Reviewer cannot be used while you are taking an exam or completing schoolwork.');
  const [teacherSubject, setTeacherSubject] = useState('your subject');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(getChatStorageKey(userId, 'messages'), JSON.stringify(messages));
  }, [messages, userId]);

  useEffect(() => {
    if (input) localStorage.setItem(getChatStorageKey(userId, 'draft'), input);
    else localStorage.removeItem(getChatStorageKey(userId, 'draft'));
  }, [input, userId]);

  useEffect(() => {
    let mounted = true;
    let latestCheck = 0;
    const refreshAccess = () => {
      const checkId = ++latestCheck;
      aiApi.getAccess()
        .then(response => {
          if (!mounted || checkId !== latestCheck) return;
          const denied = response.data?.allowed === false;
          setAccessDenied(denied);
          if (denied && response.data?.message) setAccessMessage(response.data.message);
        })
        .catch(error => {
          if (!mounted || checkId !== latestCheck) return;
          const denied = error.response?.status === 403 || error.response?.status === 503;
          setAccessDenied(denied);
          if (denied && error.response?.data?.message) setAccessMessage(error.response.data.message);
        })
        .finally(() => {
          if (mounted && checkId === latestCheck) setAccessLoading(false);
        });
    };
    refreshAccess();
    const interval = window.setInterval(refreshAccess, 2000);
    window.addEventListener('focus', refreshAccess);
    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshAccess);
    };
  }, [userId]);

  useEffect(() => {
    if (!isTeacher) return;
    subjectsApi.getAll({ limit: 100 })
      .then(response => {
        const subjectNames = (response.data?.subjects || [])
          .map((subject: { name?: string }) => subject.name)
          .filter(Boolean);
        if (subjectNames.length > 0) setTeacherSubject(subjectNames.join(', '));
      })
      .catch(() => undefined);
  }, [isTeacher]);

  const sendMessage = async (text?: string) => {
    if (accessLoading || accessDenied) return;
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
      // Get conversation history (last 10 messages excluding system message)
      const history = messages
        .slice(-10)
        .filter(m => m.id !== '0')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      // Call backend AI API
      const response = await aiApi.chat(messageText, history);
      const latestAccess = await aiApi.getAccess();
      if (latestAccess.data?.allowed === false) {
        setAccessDenied(true);
        setAccessMessage(latestAccess.data.message || 'The AI Reviewer cannot be used while you are taking an exam or completing schoolwork.');
        return;
      }
      const assistantText = response.data?.message || 'Sorry, I could not generate a response. Please try again.';

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('AI API Error:', err);
      const errorMessage = err.response?.data?.message;
      if (err.response?.status === 403) {
        setAccessDenied(true);
        setAccessMessage(errorMessage || 'The AI Reviewer cannot be used while you are taking an exam or completing schoolwork.');
        return;
      }
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMessage || 'Unable to connect to the AI service. Please check your connection and try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
      toast.error(errorMessage || 'Failed to get AI response');
    } finally {
      setLoading(false);
    }
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
    setInput('');
  };

  if (accessLoading) {
    return <Card padding="48px"><p style={{ margin: 0, textAlign: 'center', color: 'var(--gray-500)' }}>Checking AI access...</p></Card>;
  }

  const suggestions = isTeacher ? getTeacherSuggestions(teacherSubject) : SUGGESTED_PROMPTS_STUDENT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: 'calc(100vh - 128px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gray-900)', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={22} color="#C9A84C" />
            Ezra
          </h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginTop: '2px' }}>
            {isTeacher ? 'Create exams, lessons, and manage your teaching schedule' : 'Review lessons, prepare for exams, and get study help'}
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={clearChat} disabled={accessDenied}>Clear Chat</Button>
      </div>

      {accessDenied && (
        <div role="status" style={{ padding: '16px 20px', border: '1px solid #FECACA', borderLeft: '4px solid #B91C1C', borderRadius: 8, background: '#FEF2F2' }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '1rem', color: '#991B1B' }}>Not Available</h2>
          <p style={{ margin: 0, color: '#7F1D1D', fontSize: '0.875rem', lineHeight: 1.5 }}>{accessMessage}</p>
        </div>
      )}

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
          {!accessDenied && messages.length <= 1 && (
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
            disabled={accessDenied || accessLoading}
            placeholder={accessDenied ? 'AI Reviewer is not available right now' : isTeacher ? 'Ask me to create an exam, lesson plan, or anything teaching-related...' : 'Ask me to explain a topic, help you study, or review for your exam...'}
            rows={1}
            style={{
              flex: 1, padding: '11px 14px',
              border: '1.5px solid var(--gray-200)',
              borderRadius: '12px', fontSize: '0.875rem',
              outline: 'none', resize: 'none',
              maxHeight: '120px', overflowY: 'auto',
              fontFamily: 'var(--font-body)',
              lineHeight: 1.5, color: 'var(--gray-900)',
              background: accessDenied ? 'var(--gray-100)' : '#fff',
              cursor: accessDenied ? 'not-allowed' : 'text',
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
            disabled={!input.trim() || loading || accessDenied || accessLoading}
            style={{
              width: 42, height: 42, borderRadius: '12px', flexShrink: 0,
              background: !input.trim() || loading || accessDenied || accessLoading ? '#E5E7EB' : 'linear-gradient(135deg, #8B1A1A, #A52828)',
              border: 'none', cursor: !input.trim() || loading || accessDenied || accessLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: !input.trim() || loading || accessDenied || accessLoading ? '#9CA3AF' : '#fff',
              transition: 'all 0.15s',
              boxShadow: !input.trim() || loading || accessDenied || accessLoading ? 'none' : '0 2px 8px rgba(139,26,26,0.3)',
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
