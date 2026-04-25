import React, { useState, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, GraduationCap,
  CalendarDays, FileText, ClipboardList, Bell,
  LogOut, ChevronLeft, ChevronRight,
  Shield, BookMarked, BarChart3, Clock, Award,
  MessageSquare, Camera,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

interface NavItem { label: string; path: string; icon: React.ReactNode; roles: string[]; }

const NAV_ITEMS: NavItem[] = [
  // Admin
  { label: 'Dashboard',      path: '/admin/dashboard',      icon: <LayoutDashboard size={18}/>, roles: ['admin'] },
  { label: 'Users',          path: '/admin/users',           icon: <Users size={18}/>,           roles: ['admin'] },
  { label: 'Academic Years', path: '/admin/academic-years',  icon: <CalendarDays size={18}/>,    roles: ['admin'] },
  { label: 'Classes',        path: '/admin/classes',         icon: <GraduationCap size={18}/>,   roles: ['admin'] },
  { label: 'Subjects',       path: '/admin/subjects',        icon: <BookOpen size={18}/>,        roles: ['admin'] },
  { label: 'Exams',          path: '/admin/exams',           icon: <ClipboardList size={18}/>,   roles: ['admin'] },
  { label: 'Report Cards',   path: '/admin/report-cards',    icon: <Award size={18}/>,           roles: ['admin'] },
  { label: 'Timetable',      path: '/admin/timetable',       icon: <Clock size={18}/>,           roles: ['admin'] },
  { label: 'Announcements',  path: '/admin/announcements',   icon: <Bell size={18}/>,            roles: ['admin'] },
  { label: 'Analytics',      path: '/admin/analytics',       icon: <BarChart3 size={18}/>,       roles: ['admin'] },
  { label: 'Activity Logs',  path: '/admin/logs',            icon: <FileText size={18}/>,        roles: ['admin'] },

  // Teacher – NOTE: "My Subjects" removed; subjects live inside each class
  { label: 'Dashboard',      path: '/teacher/dashboard',     icon: <LayoutDashboard size={18}/>, roles: ['teacher'] },
  { label: 'My Classes',     path: '/teacher/classes',       icon: <GraduationCap size={18}/>,   roles: ['teacher'] },
  { label: 'Exams',          path: '/teacher/exams',         icon: <ClipboardList size={18}/>,   roles: ['teacher'] },
  { label: 'Submissions',    path: '/teacher/submissions',   icon: <FileText size={18}/>,        roles: ['teacher'] },
  { label: 'Report Cards',   path: '/teacher/report-cards',  icon: <Award size={18}/>,           roles: ['teacher'] },
  { label: 'Timetable',      path: '/teacher/timetable',     icon: <Clock size={18}/>,           roles: ['teacher'] },
  { label: 'AI Assistant',   path: '/teacher/ai-assistant',  icon: <MessageSquare size={18}/>,   roles: ['teacher'] },
  { label: 'Announcements',  path: '/teacher/announcements', icon: <Bell size={18}/>,            roles: ['teacher'] },

  // Student
  { label: 'Dashboard',      path: '/student/dashboard',     icon: <LayoutDashboard size={18}/>, roles: ['student'] },
  { label: 'My Subjects',    path: '/student/subjects',      icon: <BookMarked size={18}/>,      roles: ['student'] },
  { label: 'Exams',          path: '/student/exams',         icon: <ClipboardList size={18}/>,   roles: ['student'] },
  { label: 'My Grades',      path: '/student/grades',        icon: <Award size={18}/>,           roles: ['student'] },
  { label: 'Timetable',      path: '/student/timetable',     icon: <Clock size={18}/>,           roles: ['student'] },
  { label: 'AI Reviewer',    path: '/student/ai-reviewer',   icon: <MessageSquare size={18}/>,   roles: ['student'] },
  { label: 'Announcements',  path: '/student/announcements', icon: <Bell size={18}/>,            roles: ['student'] },
];

export default function Sidebar() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const userNavItems = NAV_ITEMS.filter(item => item.roles.includes(user?.role || ''));

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  // Profile image upload (stored as base64 in localStorage for now)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      // Store in localStorage keyed by user id
      localStorage.setItem(`avatar_${user?._id}`, base64);
      // Update user state to trigger re-render
      if (user) setUser({ ...user, profileImage: base64 } as any);
      toast.success('Profile photo updated!');
    };
    reader.readAsDataURL(file);
  };

  // Get profile image
  const getAvatar = () => {
    if ((user as any)?.profileImage) return (user as any).profileImage;
    const stored = localStorage.getItem(`avatar_${user?._id}`);
    return stored || null;
  };

  const roleColor = user?.role === 'admin' ? '#C9A84C' : user?.role === 'teacher' ? '#60A5FA' : '#34D399';
  const roleBg    = user?.role === 'admin' ? 'rgba(201,168,76,0.15)' : user?.role === 'teacher' ? 'rgba(96,165,250,0.15)' : 'rgba(52,211,153,0.15)';
  const avatarSrc = getAvatar();

  return (
    <aside style={{
      width: collapsed ? '68px' : '240px',
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #1e0a0a 0%, #2d0d0d 40%, #1a0505 100%)',
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
      flexShrink: 0,
      position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100,
      borderRight: '1px solid rgba(255,255,255,0.06)',
      overflowX: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: collapsed ? '18px 0' : '18px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', minHeight: '68px' }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            <div style={{ width: 34, height: 34, flexShrink: 0, background: 'linear-gradient(135deg, #8B1A1A, #b03030)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={16} color="#fff" />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e87070', letterSpacing: '0.8px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>ICSQC-LMS</div>
              <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>Learning Portal</div>
            </div>
          </div>
        )}
        {collapsed && <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#8B1A1A,#b03030)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={16} color="#fff"/></div>}
        <button onClick={() => setCollapsed(!collapsed)} style={{ width: 26, height: 26, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', flexShrink: 0, marginLeft: collapsed ? 0 : 'auto' }}>
          {collapsed ? <ChevronRight size={13}/> : <ChevronLeft size={13}/>}
        </button>
      </div>

      {/* User card with avatar upload */}
      {!collapsed && (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Clickable avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }} onClick={() => fileRef.current?.click()} title="Change profile photo">
              <div style={{ width: 38, height: 38, borderRadius: '50%', border: `2px solid ${roleColor}66`, overflow: 'hidden', cursor: 'pointer', background: avatarSrc ? 'transparent' : `linear-gradient(135deg, ${roleColor}33, ${roleColor}55)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {avatarSrc
                  ? <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: '0.85rem', fontWeight: 600, color: roleColor }}>{user?.name?.charAt(0).toUpperCase() || 'U'}</span>
                }
              </div>
              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, background: '#7a1010', borderRadius: '50%', border: '2px solid #1e0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Camera size={8} color="#fff" />
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
              <div style={{ display: 'inline-flex', padding: '1px 7px', background: roleBg, borderRadius: 20, fontSize: '0.6rem', fontWeight: 600, color: roleColor, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2 }}>{user?.role}</div>
            </div>
          </div>
        </div>
      )}
      {collapsed && (
        <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'center' }} onClick={() => fileRef.current?.click()} title="Change profile photo">
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${roleColor}55`, overflow: 'hidden', cursor: 'pointer', background: `linear-gradient(135deg, ${roleColor}33, ${roleColor}55)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {getAvatar()
              ? <img src={getAvatar()!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: '0.82rem', fontWeight: 600, color: roleColor }}>{user?.name?.charAt(0).toUpperCase() || 'U'}</span>
            }
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
        {userNavItems.map((item) => (
          <NavLink key={item.path} to={item.path} title={collapsed ? item.label : undefined}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: collapsed ? '10px' : '9px 16px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              margin: '1px 6px', borderRadius: 8,
              color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
              background: isActive ? 'rgba(122,16,16,0.55)' : 'transparent',
              borderLeft: isActive ? '3px solid #e87070' : '3px solid transparent',
              transition: 'all 0.15s', textDecoration: 'none',
              fontSize: '0.83rem', fontWeight: isActive ? 600 : 400,
              whiteSpace: 'nowrap',
            })}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; if (!el.style.background.includes('rgba(122')) { el.style.background='rgba(255,255,255,0.04)'; el.style.color='rgba(255,255,255,0.85)'; }}}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; if (!el.style.background.includes('rgba(122')) { el.style.background='transparent'; el.style.color='rgba(255,255,255,0.5)'; }}}
          >
            <span style={{ flexShrink: 0 }}>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 6px' }}>
        <button onClick={handleLogout} title={collapsed ? 'Logout' : undefined}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'none', border: 'none', color: 'rgba(255,100,100,0.65)', borderRadius: 8, cursor: 'pointer', fontSize: '0.83rem', width: '100%', justifyContent: collapsed ? 'center' : 'flex-start', transition: 'all 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='rgba(220,38,38,0.1)'; (e.currentTarget as HTMLElement).style.color='#FCA5A5'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='none'; (e.currentTarget as HTMLElement).style.color='rgba(255,100,100,0.65)'; }}>
          <LogOut size={17} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
