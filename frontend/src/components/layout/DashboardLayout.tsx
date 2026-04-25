import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuthStore } from '../../store/authStore';

interface DashboardLayoutProps {
  requiredRole?: string | string[];
  title?: string;
  subtitle?: string;
}

export default function DashboardLayout({ requiredRole, title, subtitle }: DashboardLayoutProps) {
  const { user, isAuthenticated, fetchProfile } = useAuthStore();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (!isAuthenticated) {
        await fetchProfile();
      }
      setChecking(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!checking) {
      if (!isAuthenticated || !user) {
        navigate('/login');
        return;
      }
      if (requiredRole) {
        const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
        if (!roles.includes(user.role)) {
          navigate(`/${user.role}/dashboard`);
        }
      }
    }
  }, [checking, isAuthenticated, user, requiredRole]);

  if (checking) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: '#F9FAFB',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40,
            border: '3px solid #E5E7EB',
            borderTopColor: '#8B1A1A',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px',
          }} />
          <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Loading...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F9FAFB' }}>
      <Sidebar />
      <div style={{
        flex: 1,
        marginLeft: 'var(--sidebar-width, 260px)',
        display: 'flex', flexDirection: 'column',
        minWidth: 0,
        transition: 'margin-left 0.3s',
      }}>
        <Topbar title={title} subtitle={subtitle} />
        <main style={{
          flex: 1,
          padding: '28px',
          overflowY: 'auto',
          animation: 'fadeIn 0.3s ease',
        }}>
          <Outlet />
        </main>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
