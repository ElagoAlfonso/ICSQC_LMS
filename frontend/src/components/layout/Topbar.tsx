import React, { useState, useRef, useEffect } from 'react';
import { Bell, Search, X, Check, BookOpen, FileText, Users, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface TopbarProps {
  title?: string;
  subtitle?: string;
}

// Sample notifications – replace with real API data when available
const SAMPLE_NOTIFICATIONS = [
  { id: '1', icon: 'exam', title: 'New exam published', body: 'Math Quiz – Chapter 4 is now available', time: '2m ago', read: false },
  { id: '2', icon: 'submit', title: 'Submission graded', body: 'Your Science assignment was graded: 92/100', time: '1h ago', read: false },
  { id: '3', icon: 'announce', title: 'New announcement', body: 'Flag Ceremony is cancelled tomorrow', time: '3h ago', read: true },
  { id: '4', icon: 'user', title: 'Class roster updated', body: '2 students were added to Rizal – 102', time: '1d ago', read: true },
];

function NotifIcon({ type }: { type: string }) {
  const map: Record<string, { bg: string; icon: React.ReactNode }> = {
    exam:     { bg: '#FEE2E2', icon: <FileText size={14} color="#8B1A1A" /> },
    submit:   { bg: '#D1FAE5', icon: <Check size={14} color="#059669" /> },
    announce: { bg: '#DBEAFE', icon: <AlertCircle size={14} color="#2563EB" /> },
    user:     { bg: '#EDE9FE', icon: <Users size={14} color="#7C3AED" /> },
  };
  const { bg, icon } = map[type] || map['announce'];
  return <div style={{ width: 32, height: 32, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>;
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  const { user } = useAuthStore();
  const [searchOpen, setSearchOpen]     = useState(false);
  const [notifOpen, setNotifOpen]       = useState(false);
  const [notifications, setNotifications] = useState(SAMPLE_NOTIFICATIONS);
  const notifRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.read).length;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  const markRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <header style={{ height: '64px', background: '#fff', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', padding: '0 24px', gap: '12px', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 0 rgba(0,0,0,0.05)' }}>
      {/* Title */}
      <div style={{ flex: 1 }}>
        {title ? (
          <>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>{title}</h1>
            {subtitle && <p style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: 1 }}>{subtitle}</p>}
          </>
        ) : (
          <p style={{ fontSize: '0.9rem', color: '#4B5563', fontWeight: 400 }}>
            {getGreeting()}, <span style={{ color: '#7a1010', fontWeight: 600 }}>{user?.name?.split(' ')[0] || 'User'}</span>!
          </p>
        )}
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        {searchOpen && (
          <input autoFocus type="text" placeholder="Search anything…" onBlur={() => setSearchOpen(false)}
            style={{ padding: '8px 36px 8px 16px', border: '1.5px solid #7a1010', borderRadius: 8, fontSize: '0.85rem', outline: 'none', width: 200, background: '#FAFAFA', color: '#111' }} />
        )}
        <button onClick={() => setSearchOpen(!searchOpen)}
          style={{ position: searchOpen ? 'absolute' : 'relative', right: searchOpen ? '10px' : 'auto', top: searchOpen ? '50%' : 'auto', transform: searchOpen ? 'translateY(-50%)' : 'none', background: searchOpen ? 'none' : '#F3F4F6', border: 'none', borderRadius: 8, padding: searchOpen ? 0 : '8px', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Search size={16} />
        </button>
      </div>

      {/* Notifications */}
      <div ref={notifRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setNotifOpen(!notifOpen)}
          style={{ position: 'relative', background: notifOpen ? '#FEE2E2' : '#F3F4F6', border: 'none', borderRadius: 8, padding: '8px', cursor: 'pointer', color: notifOpen ? '#7a1010' : '#6B7280', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}>
          <Bell size={17} />
          {unread > 0 && (
            <span style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, background: '#7a1010', borderRadius: '50%', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#fff' }}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {/* Notifications Dropdown */}
        {notifOpen && (
          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 340, background: '#fff', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', border: '1px solid #F3F4F6', zIndex: 200, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111' }}>Notifications</span>
                {unread > 0 && <span style={{ marginLeft: 8, padding: '2px 8px', background: '#FEE2E2', color: '#7a1010', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700 }}>{unread} new</span>}
              </div>
              {unread > 0 && (
                <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: '#7a1010', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}>
                  Mark all read
                </button>
              )}
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.85rem' }}>No notifications</div>
              ) : notifications.map(n => (
                <div key={n.id} onClick={() => markRead(n.id)}
                  style={{ display: 'flex', gap: 12, padding: '12px 16px', cursor: 'pointer', background: n.read ? '#fff' : '#FFF8F8', borderBottom: '1px solid #F9FAFB', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='#F9FAFB'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background=n.read ? '#fff' : '#FFF8F8'}>
                  <NotifIcon type={n.icon} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.82rem', fontWeight: n.read ? 400 : 600, color: '#111', marginBottom: 2 }}>{n.title}</p>
                    <p style={{ fontSize: '0.75rem', color: '#6B7280', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>{n.time}</span>
                    {!n.read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#7a1010' }} />}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid #F3F4F6', textAlign: 'center' }}>
              <button style={{ background: 'none', border: 'none', color: '#7a1010', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 500 }}>View all notifications</button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
