import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import MessagesPage from '../../pages/shared/MessagesPage';
import { notificationsApi } from '../../utils/api';
import type { Message, User } from '../../types';

const FOCUSED_ACTIVITY_PATHS = [
  '/student/exams',
  '/teacher/exams',
  '/classwork/',
  '/assignment',
  '/activity',
  '/assessment',
  '/quiz',
  '/test',
];

const isFocusedActivity = (pathname: string) =>
  FOCUSED_ACTIVITY_PATHS.some((path) => pathname.includes(path));

export default function FloatingMessenger() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingParticipant, setPendingParticipant] = useState<User | null>(null);
  const focusedActivity = isFocusedActivity(location.pathname);

  useEffect(() => {
    if (focusedActivity) setOpen(false);
  }, [focusedActivity]);

  useEffect(() => {
    const openMessenger = (event: Event) => {
      if (!focusedActivity) {
        const participant = (event as CustomEvent<{ participant?: User }>).detail?.participant;
        if (participant) setPendingParticipant(participant);
        setOpen(true);
        setUnreadCount(0);
      }
    };
    window.addEventListener('lms:open-messenger', openMessenger);
    return () => window.removeEventListener('lms:open-messenger', openMessenger);
  }, [focusedActivity]);

  useEffect(() => {
    const loadUnreadMessages = async () => {
      try {
        const response = await notificationsApi.getAll();
        const messageUnread = (response.data.notifications || []).filter((notification: any) => notification.type === 'message' && !notification.isRead).length;
        setUnreadCount(messageUnread);
      } catch {
        // The live socket path still updates the badge when notifications are unavailable.
      }
    };
    loadUnreadMessages();
    const timer = window.setInterval(loadUnreadMessages, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const handleIncomingMessage = useCallback((message: Message) => {
    if (!open || focusedActivity) setUnreadCount((count) => count + 1);
  }, [focusedActivity, open]);

  const toggle = () => {
    setOpen((value) => !value);
    if (!open) {
      setUnreadCount(0);
      notificationsApi.getAll().then((response) => {
        const unreadMessages = (response.data.notifications || []).filter((notification: any) => notification.type === 'message' && !notification.isRead);
        return Promise.all(unreadMessages.map((notification: any) => notificationsApi.markRead(notification._id)));
      }).catch(() => undefined);
    }
  };

  return (
    <>
      <div style={{ display: focusedActivity ? 'none' : 'block' }}>
        <div
          style={{
            display: open ? 'block' : 'none',
            position: 'fixed',
            right: 24,
            bottom: 88,
            width: 'min(680px, calc(100vw - 24px))',
            height: 'min(560px, calc(100vh - 112px))',
            zIndex: 1000,
            borderRadius: 16,
            overflow: 'hidden',
            minHeight: 0,
            boxShadow: '0 18px 50px rgba(15, 23, 42, 0.24)',
          }}
        >
          <MessagesPage compact onIncomingMessage={handleIncomingMessage} initialParticipant={pendingParticipant} onParticipantOpened={() => setPendingParticipant(null)} />
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={open ? 'Close messages' : 'Open messages'}
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            width: 54,
            height: 54,
            zIndex: 1001,
            border: 0,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: '#8B1A1A',
            color: '#fff',
            cursor: 'pointer',
            boxShadow: '0 8px 22px rgba(139, 26, 26, 0.35)',
          }}
        >
          {open ? <X size={22} /> : <MessageCircle size={23} />}
          {!open && unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                minWidth: 20,
                height: 20,
                padding: '0 5px',
                borderRadius: 10,
                display: 'grid',
                placeItems: 'center',
                background: '#DC2626',
                color: '#fff',
                fontSize: '0.68rem',
                fontWeight: 700,
                border: '2px solid #F1F5F9',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
