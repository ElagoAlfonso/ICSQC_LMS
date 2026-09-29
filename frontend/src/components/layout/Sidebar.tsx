import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, GraduationCap,
  CalendarDays, FileText, ClipboardList, Bell,
  ChevronLeft, ChevronRight,
  BookMarked, BarChart3, Clock, Award,
  MessageSquare,
  Video,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface NavItem { label: string; path: string; icon: React.ReactNode; roles: string[]; }

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',      path: '/admin/dashboard',      icon: <LayoutDashboard size={18} />, roles: ['admin'] },
  { label: 'Users',          path: '/admin/users',           icon: <Users size={18} />,          roles: ['admin'] },
  { label: 'Academic Years', path: '/admin/academic-years',  icon: <CalendarDays size={18} />,   roles: ['admin'] },
  { label: 'Classes',        path: '/admin/classes',         icon: <GraduationCap size={18} />,  roles: ['admin'] },
  { label: 'Subjects',       path: '/admin/subjects',        icon: <BookOpen size={18} />,       roles: ['admin'] },
  { label: 'Exams',          path: '/admin/exams',           icon: <ClipboardList size={18} />,  roles: ['admin'] },
  { label: 'Report Cards',   path: '/admin/report-cards',    icon: <Award size={18} />,          roles: ['admin'] },
  { label: 'Timetable',      path: '/admin/timetable',       icon: <Clock size={18} />,          roles: ['admin'] },
  { label: 'Announcements',  path: '/admin/announcements',   icon: <Bell size={18} />,           roles: ['admin'] },
  { label: 'Analytics',      path: '/admin/analytics',       icon: <BarChart3 size={18} />,      roles: ['admin'] },
  { label: 'Activity Logs',  path: '/admin/logs',            icon: <FileText size={18} />,       roles: ['admin'] },

  { label: 'Dashboard',      path: '/teacher/dashboard',     icon: <LayoutDashboard size={18} />, roles: ['teacher'] },
  { label: 'My Classes',     path: '/teacher/classes',       icon: <GraduationCap size={18} />,  roles: ['teacher'] },
  { label: 'Exams',          path: '/teacher/exams',         icon: <ClipboardList size={18} />,  roles: ['teacher'] },
  { label: 'Submissions',    path: '/teacher/submissions',   icon: <FileText size={18} />,       roles: ['teacher'] },
  { label: 'Report Cards',   path: '/teacher/report-cards',  icon: <Award size={18} />,          roles: ['teacher'] },
  { label: 'Timetable',      path: '/teacher/timetable',     icon: <Clock size={18} />,          roles: ['teacher'] },
  { label: 'AI Assistant',   path: '/teacher/ai-assistant',  icon: <MessageSquare size={18} />,  roles: ['teacher'] },
  { label: 'Announcements',  path: '/teacher/announcements', icon: <Bell size={18} />,           roles: ['teacher'] },

  { label: 'Dashboard',      path: '/student/dashboard',     icon: <LayoutDashboard size={18} />, roles: ['student'] },
  { label: 'My Classes',     path: '/student/classes',       icon: <GraduationCap size={18} />,  roles: ['student'] },
  { label: 'To-Do',          path: '/student/schoolwork',    icon: <ClipboardList size={18} />,  roles: ['student'] },
  { label: 'Exams',          path: '/student/exams',         icon: <ClipboardList size={18} />,  roles: ['student'] },
  { label: 'My Grades',      path: '/student/grades',        icon: <Award size={18} />,          roles: ['student'] },
  { label: 'Timetable',      path: '/student/timetable',     icon: <Clock size={18} />,          roles: ['student'] },
  { label: 'AI Reviewer',    path: '/student/ai-reviewer',   icon: <MessageSquare size={18} />,  roles: ['student'] },
  { label: 'Announcements',  path: '/student/announcements', icon: <Bell size={18} />,           roles: ['student'] },
];

export default function Sidebar() {
  const { user } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const userNavItems = NAV_ITEMS.filter(item => item.roles.includes(user?.role || ''));

  const getAvatar = () => {
    if ((user as any)?.profileImage) return (user as any).profileImage;
    const stored = localStorage.getItem(`avatar_${user?._id}`);
    return stored || null;
  };

  const roleColor = user?.role === 'admin' ? '#C9A84C' : user?.role === 'teacher' ? '#60A5FA' : '#34D399';
  const roleBg = user?.role === 'admin' ? 'rgba(201,168,76,0.15)' : user?.role === 'teacher' ? 'rgba(96,165,250,0.15)' : 'rgba(52,211,153,0.15)';
  const avatarSrc = !avatarError ? getAvatar() : null;
  const initials = user?.name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'U';

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', collapsed ? '74px' : '260px');
  }, [collapsed]);

  return (
    <aside className="app-sidebar" style={{
      width: collapsed ? '74px' : '260px',
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #7B1E2B 0%, #9B3140 100%)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.25s ease, min-width 0.25s ease',
      flexShrink: 0,
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      zIndex: 100,
      borderRight: '1px solid #5A1620',
      boxShadow: '2px 0 24px rgba(0,0,0,0.2)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: collapsed ? '24px 0' : '20px 18px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', position: 'relative' }}>
        <button
          className="sidebar-toggle"
          type="button"
          onClick={() => collapsed && setCollapsed(false)}
          title={collapsed ? 'Open sidebar' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: collapsed ? 0 : 12,
            border: 'none',
            background: 'transparent',
            padding: 0,
            cursor: 'pointer',
            color: '#FFFFFF',
          }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 18, background: '#FEE2E2', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
            <img src="/images/school-seal.png" alt="ICSQC" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <span className="sidebar-label" style={{
            display: 'inline-block',
            maxWidth: collapsed ? 0 : 140,
            opacity: collapsed ? 0 : 1,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            transition: 'max-width 0.3s ease, opacity 0.2s ease',
          }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#FFFFFF' }}>ICSQC LMS</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => !collapsed && setCollapsed(true)}
          style={{
            position: 'absolute',
            right: 22,
            width: 36,
            height: 36,
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.1)',
            display: 'grid',
            placeItems: 'center',
            cursor: collapsed ? 'default' : 'pointer',
            color: '#F1F5F9',
            visibility: collapsed ? 'hidden' : 'visible',
            opacity: collapsed ? 0 : 1,
            transition: 'opacity 0.2s ease',
          }}
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '18px 0' }}>
        {!collapsed && <div style={{ padding: '0 18px', marginBottom: 16, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#F1F5F9' }}>Navigation</div>}
        {userNavItems.map((item) => (
          <NavLink className="sidebar-nav-link" key={item.path} to={item.path} title={collapsed ? item.label : undefined}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: collapsed ? 0 : 14,
              padding: '14px 18px',
              margin: '4px 12px',
              borderRadius: 18,
              color: isActive ? '#FFFFFF' : '#D4B5B5',
              background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
              borderLeft: isActive ? '4px solid #F1F5F9' : '4px solid transparent',
              transition: 'background 0.2s ease, color 0.2s ease, justify-content 0.25s ease',
              textDecoration: 'none',
              fontSize: '0.95rem',
              fontWeight: isActive ? 700 : 500,
              justifyContent: collapsed ? 'center' : 'flex-start',
            })}
          >
            <span style={{ width: 22, height: 22, display: 'grid', placeItems: 'center' }}>{item.icon}</span>
            <span className="sidebar-label" style={{
              maxWidth: collapsed ? 0 : 150,
              opacity: collapsed ? 0 : 1,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              transition: 'max-width 0.25s ease, opacity 0.2s ease',
            }}>
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
