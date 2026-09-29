import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Check, BookOpen, FileText, Users, AlertCircle, User, Video, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { notificationsApi } from '../../utils/api';

interface TopbarProps {
  title?: string;
  subtitle?: string;
}

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  relatedClass?: string;
}

function NotifIcon({ type }: { type: string }) {
  const map: Record<string, { bg: string; icon: React.ReactNode }> = {
    exam:     { bg: '#FEE2E2', icon: <FileText size={14} color="#8B1A1A" /> },
    submit:   { bg: '#D1FAE5', icon: <Check size={14} color="#059669" /> },
    submission: { bg: '#D1FAE5', icon: <Check size={14} color="#059669" /> },
    announce: { bg: '#DBEAFE', icon: <AlertCircle size={14} color="#2563EB" /> },
    user:     { bg: '#EDE9FE', icon: <Users size={14} color="#7C3AED" /> },
    meeting:  { bg: '#D1FAE5', icon: <Video size={14} color="#059669" /> },
    message:  { bg: '#FEE2E2', icon: <MessageCircle size={14} color="#8B1A1A" /> },
  };
  const { bg, icon } = map[type] || map['announce'];
  return <div style={{ width: 32, height: 32, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>;
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  const { user, logout, setUser } = useAuthStore();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [expandedNotificationId, setExpandedNotificationId] = useState<string | null>(null);
  const [editAccountOpen, setEditAccountOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editPhoto, setEditPhoto] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.isRead).length;
  const initials = user?.name?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || 'U';
  const roleLabel = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '';

  const getNotificationPath = (target: string) => {
    if (!user?.role) return '/';
    const rolePrefix = user.role === 'admin' ? 'admin' : user.role === 'teacher' ? 'teacher' : 'student';
    switch (target) {
      case 'announcements': return `/${rolePrefix}/announcements`;
      case 'exams': return `/${rolePrefix}/exams`;
      case 'submissions': return user.role === 'teacher' ? '/teacher/submissions' : `/${rolePrefix}/exams`;
      case 'classes': return user.role === 'teacher' ? '/teacher/classes' : '/admin/classes';
      default: return `/${rolePrefix}/dashboard`;
    }
  };

  function handleViewNotification(notification: Notification) {
    void markRead(notification._id);
    setSelectedNotification(notification);
  }

  function handleNavigateFromNotification(notification: Notification) {
    if (notification.type === 'message') {
      setSelectedNotification(null);
      setNotifOpen(false);
      window.dispatchEvent(new CustomEvent('lms:open-messenger'));
      return;
    }
    if (notification.type === 'meeting' && notification.relatedClass) {
      setSelectedNotification(null);
      setNotifOpen(false);
      navigate(`/${user?.role === 'teacher' ? 'teacher' : 'student'}/classes/${notification.relatedClass}`);
      return;
    }
    const target = notification.type === 'announcement' ? 'announcements' : notification.type === 'submission' ? 'submissions' : notification.type === 'exam' ? 'exams' : 'dashboard';
    const path = getNotificationPath(target);
    setSelectedNotification(null);
    setNotifOpen(false);
    navigate(path);
  }

  const toggleNotificationExpanded = (id: string) => {
    setExpandedNotificationId((current) => current === id ? null : id);
  };

  // Close dropdown when clicking outside while keeping clicks inside the notification center active.
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) {
        setNotifOpen(false);
      }
      if (accountRef.current && !accountRef.current.contains(target)) {
        setAccountOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifOpen(false);
        setExpandedNotificationId(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const loadNotifications = async () => {
    if (!user) return;
    setNotificationsLoading(true);
    try {
      const response = await notificationsApi.getAll();
      setNotifications(response.data.notifications);
    } catch {
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const markAllRead = async () => {
    await notificationsApi.markAllRead();
    setNotifications((previous) => previous.map((notification) => ({ ...notification, isRead: true })));
  };

  const markRead = async (id: string) => {
    await notificationsApi.markRead(id);
    setNotifications((previous) => previous.map((notification) => notification._id === id ? { ...notification, isRead: true } : notification));
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    void loadNotifications();
    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, 15000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadNotifications();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?._id]);

  const notificationTime = (createdAt: string) => {
    const elapsed = Math.max(0, Date.now() - new Date(createdAt).getTime());
    const minutes = Math.floor(elapsed / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    if (!user) return;
    setEditName(user.name || '');
    setEditEmail(user.email || '');
    setEditActive(user.isActive ?? true);
    setEditPhoto(user.profileImage || null);
  }, [user, accountOpen]);

  const handleSaveAccount = () => {
    if (!user) return;
    const updatedUser = { ...user, name: editName, email: editEmail, isActive: editActive, profileImage: editPhoto };
    setUser(updatedUser);
    toast.success('Account updated successfully', { duration: 3000 });
    setEditAccountOpen(false);
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setEditPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // show greeting as a toast once per session load
  useEffect(() => {
    if (title) return; // skip if a page title is shown
    try {
      const key = 'greeting_shown';
      if (sessionStorage.getItem(key)) return;
      const first = user?.name?.split(' ')[0] || 'User';
      toast.custom(() => (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', borderRadius: 12, background: 'var(--surface)', borderLeft: '4px solid var(--accent)', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', color: 'var(--text-primary)', minWidth: 220 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700 }}>{first.charAt(0).toUpperCase()}</div>
          <div>
            <div style={{ fontWeight: 700 }}>{getGreeting()}, <span style={{ color: 'var(--accent)', fontWeight: 800 }}>{first}</span>!</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Welcome back to ICSQC LMS</div>
          </div>
        </div>
      ), { duration: 3800 });
      sessionStorage.setItem(key, '1');
    } catch (e) {
      // ignore storage errors
    }
  }, [user, title]);

  return (
    <header style={{ height: '64px', background: 'linear-gradient(90deg, #7B1E2B 0%, #9B3140 100%)', borderBottom: '1px solid #5A1620', display: 'flex', alignItems: 'center', padding: '0 24px', gap: '12px', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
      {/* Title */}
      <div style={{ flex: 1 }}>
        {title ? (
          <>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.2 }}>{title}</h1>
            {subtitle && <p style={{ fontSize: '0.78rem', color: '#F1F5F9', marginTop: 1 }}>{subtitle}</p>}
          </>
        ) : (
          <div />
        )}
      </div>

      {/* Notifications */}
      <div style={{ position: 'relative' }}>
        <div ref={notifRef} style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setNotifOpen((current) => !current);
              setAccountOpen(false);
            }}
            style={{ position: 'relative', background: notifOpen ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '8px', cursor: 'pointer', color: '#F1F5F9', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}>
            <Bell size={17} />
            {unread > 0 && (
              <span style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, background: '#7a1010', borderRadius: '50%', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#fff' }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <button type="button" onClick={() => { setAccountOpen(!accountOpen); setNotifOpen(false); }} style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#F1F5F9', overflow: 'hidden' }}>
            {user?.profileImage ? (
              <img src={user.profileImage} alt={user?.name || 'User'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{initials}</span>
            )}
          </button>

          {notifOpen && (
            <div onClick={(event) => event.stopPropagation()} style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 340, background: '#fff', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', border: '1px solid #F3F4F6', zIndex: 200, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111' }}>Notifications</span>
                  {unread > 0 && <span style={{ marginLeft: 8, padding: '2px 8px', background: '#FEE2E2', color: '#7a1010', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700 }}>{unread} new</span>}
                </div>
                {unread > 0 && (
                  <button type="button" onClick={(event) => { event.stopPropagation(); markAllRead(); }} style={{ background: 'none', border: 'none', color: 'var(--crimson)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}>
                    Mark all read
                  </button>
                )}
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {notificationsLoading ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.85rem' }}>Loading notifications…</div>
                ) : notifications.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.85rem' }}>No notifications</div>
                ) : notifications.map((n) => {
                  const isExpanded = expandedNotificationId === n._id;

                  return (
                    <div
                      key={n._id}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleNotificationExpanded(n._id);
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        padding: '12px 16px',
                        background: n.isRead ? '#fff' : '#FFF8F8',
                        borderBottom: '1px solid #F9FAFB',
                        transition: 'background 0.15s ease',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <NotifIcon type={n.type} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '0.82rem', fontWeight: n.isRead ? 400 : 600, color: '#111', marginBottom: 2 }}>{n.title}</p>
                          <p style={{ fontSize: '0.75rem', color: '#6B7280', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                          <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>{notificationTime(n.createdAt)}</span>
                          {!n.isRead && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#7a1010' }} />}
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 8,
                          overflow: 'hidden',
                          maxHeight: isExpanded ? 88 : 0,
                          opacity: isExpanded ? 1 : 0,
                          transform: isExpanded ? 'translateY(0)' : 'translateY(-4px)',
                          transition: 'max-height 0.25s ease, opacity 0.2s ease, transform 0.25s ease',
                          pointerEvents: isExpanded ? 'auto' : 'none'
                        }}
                      >
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleViewNotification(n);
                          }}
                          style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '7px 12px', color: 'var(--crimson)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                        >
                          View
                        </button>
                        {!n.isRead && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void markRead(n._id);
                            }}
                            style={{ background: '#D1FAE5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '7px 12px', color: '#059669', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Mark as Read
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: '10px 16px', borderTop: '1px solid #F3F4F6', textAlign: 'center' }}>
                <button type="button" onClick={() => { setNotifOpen(false); navigate(`/${user?.role === 'admin' ? 'admin' : user?.role === 'teacher' ? 'teacher' : 'student'}/announcements`); }} style={{ background: 'none', border: 'none', color: '#7a1010', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 500 }}>View all notifications</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {accountOpen && (
        <div ref={accountRef} style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 24, width: 340, background: '#FFFFFF', borderRadius: 18, boxShadow: '0 20px 60px rgba(15, 23, 42, 0.12)', border: '1px solid #E5E7EB', zIndex: 210, overflow: 'hidden' }}>
          <div style={{ padding: '20px', display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#F3F4F6', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                {user?.profileImage ? (
                  <img src={user.profileImage} alt={user?.name || 'User'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontWeight: 700, color: '#111827' }}>{initials}</span>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{user?.name || 'User'}</p>
                <p style={{ margin: '6px 0 0', fontSize: '0.92rem', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email || 'No email'}</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <span style={{ padding: '7px 12px', borderRadius: 999, background: '#FEE2E2', color: '#B91C1C', fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase' }}>{roleLabel || 'User'}</span>
              <span style={{ padding: '7px 12px', borderRadius: 999, background: user?.isActive ? '#DCFCE7' : '#FEE2E2', color: user?.isActive ? '#166534' : '#B91C1C', fontSize: '0.76rem', fontWeight: 700 }}>{user?.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <button onClick={() => setEditAccountOpen(true)} style={{ width: '100%', padding: '12px 14px', borderRadius: 14, border: '1px solid #E5E7EB', background: '#fff', color: '#111827', fontWeight: 700, cursor: 'pointer' }}>Edit account</button>
              <button onClick={async () => { await logout(); navigate('/login'); }} style={{ width: '100%', padding: '12px 14px', borderRadius: 14, border: 'none', background: '#991B1B', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Sign out</button>
            </div>
          </div>
        </div>
      )}

      {editAccountOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(15, 23, 42, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: 'min(520px, 100%)', background: '#FFFFFF', borderRadius: 24, boxShadow: '0 30px 90px rgba(15, 23, 42, 0.18)', overflow: 'hidden' }}>
            <div style={{ padding: '26px 28px 20px' }}>
              <div style={{ fontSize: '0.75rem', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700, color: '#6B7280', marginBottom: 12 }}>Account personalization</div>
              <h2 style={{ margin: 0, fontSize: '1.6rem', lineHeight: 1.15, color: '#111827' }}>Edit your account details</h2>
              <p style={{ margin: '10px 0 0', color: '#475569', fontSize: '0.96rem', lineHeight: 1.7 }}>Update your display name, email address, and account status from this popup.</p>

              <div style={{ display: 'grid', gap: 16, marginTop: 22 }}>
                <label style={{ display: 'grid', gap: 8, fontSize: '0.9rem', color: '#374151' }}>
                  Name
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: 14, border: '1px solid #E5E7EB', background: '#F8FAFC', color: '#111827', outline: 'none' }} />
                </label>
                <label style={{ display: 'grid', gap: 8, fontSize: '0.9rem', color: '#374151' }}>
                  Email
                  <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: 14, border: '1px solid #E5E7EB', background: '#F8FAFC', color: '#111827', outline: 'none' }} />
                </label>
                <label style={{ display: 'grid', gap: 8, fontSize: '0.9rem', color: '#374151' }}>
                  Profile photo
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '16px', background: '#F8FAFC', borderRadius: 16 }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#E5E7EB', overflow: 'hidden', display: 'grid', placeItems: 'center', border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                      {editPhoto && (
                        <img src={editPhoto} alt="Avatar preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                    </div>
                    <div style={{ display: 'grid', gap: 8, width: '100%' }}>
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px', borderRadius: 12, border: '1.5px solid #D1D5DB', background: '#fff', color: '#111827', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                        {editPhoto ? 'Change photo' : 'Choose photo'}
                        <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                      </label>
                      {editPhoto && (
                        <button type="button" onClick={() => setEditPhoto(null)} style={{ padding: '10px 16px', borderRadius: 12, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', transition: 'all 0.2s' }}>Remove photo</button>
                      )}
                    </div>
                  </div>
                </label>
                <div style={{ display: 'grid', gap: 8 }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#374151' }}>Account status</span>
                  <button onClick={() => setEditActive((prev) => !prev)} type="button" style={{ width: 'fit-content', padding: '10px 16px', borderRadius: 999, border: '1px solid #E5E7EB', background: editActive ? '#DCFCE7' : '#FEE2E2', color: editActive ? '#166534' : '#B91C1C', fontWeight: 700, cursor: 'pointer' }}>
                    {editActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
                <div style={{ display: 'grid', gap: 10, marginTop: 4 }}>
                  <span style={{ fontSize: '0.85rem', color: '#6B7280' }}>Role: {roleLabel || 'User'}</span>
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 28px 24px', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button onClick={() => setEditAccountOpen(false)} style={{ padding: '12px 18px', borderRadius: 14, border: '1px solid #E5E7EB', background: '#fff', color: '#111827', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
              <button onClick={handleSaveAccount} style={{ padding: '12px 18px', borderRadius: 14, border: 'none', background: '#991B1B', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Save changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(15, 23, 42, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: 'min(520px, 100%)', background: '#FFFFFF', borderRadius: 24, boxShadow: '0 30px 90px rgba(15, 23, 42, 0.18)', overflow: 'hidden' }}>
            <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <NotifIcon type={selectedNotification.type} />
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>{selectedNotification.title}</h2>
                  <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: '#6B7280' }}>{notificationTime(selectedNotification.createdAt)}</p>
                </div>
              </div>
              <div style={{ padding: '14px 16px', background: '#F8FAFC', borderRadius: 12, borderLeft: '3px solid #991B1B' }}>
                <p style={{ margin: 0, fontSize: '0.95rem', color: '#374151', lineHeight: 1.6 }}>{selectedNotification.message}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setSelectedNotification(null)} style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem' }}>Close</button>
                <button onClick={() => handleNavigateFromNotification(selectedNotification)} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: '#991B1B', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem' }}>{selectedNotification.type === 'meeting' ? 'View Class' : 'View Details'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
