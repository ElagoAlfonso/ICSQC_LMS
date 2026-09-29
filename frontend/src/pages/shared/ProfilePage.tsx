import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function ProfilePage() {
  const { user } = useAuthStore();

  if (!user) {
    return (
      <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', color: '#6B7280' }}>
        <p>Loading profile…</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', padding: '32px', background: '#F8FAFC' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gap: 28 }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: '0.78rem', letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 800, color: '#6B7280' }}>Account overview</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 760 }}>
            <h1 style={{ margin: 0, fontSize: '2.35rem', lineHeight: 1.05, fontWeight: 900, color: '#111827' }}>Account details are available in the top bar</h1>
            <p style={{ margin: 0, color: '#4B5563', fontSize: '1rem', lineHeight: 1.75 }}>Click the user icon in the top bar to view your profile, role, status, and sign out options.</p>
          </div>
        </header>

        <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, boxShadow: '0 20px 50px rgba(15, 23, 42, 0.08)', padding: 30 }}>
          <p style={{ margin: 0, color: '#475569', fontSize: '1rem', lineHeight: 1.8 }}>This page no longer shows account details in the body. Use the top bar user menu to access your account information and actions.</p>
        </section>
        <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: 30 }}>
          <h2 style={{ margin: '0 0 8px', color: '#111827', fontSize: '1.25rem' }}>Password security</h2>
          <p style={{ margin: '0 0 18px', color: '#64748B' }}>Request a secure password reset link sent to your registered email address.</p>
          <Link to="/forgot-password" style={{ display: 'inline-flex', padding: '11px 18px', borderRadius: 8, background: '#7a1010', color: '#fff', fontWeight: 700 }}>Reset password by email</Link>
        </section>
      </div>
    </div>
  );
}
