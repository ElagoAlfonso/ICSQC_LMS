import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

const SCHOOL_BG = 'https://lh3.googleusercontent.com/p/AF1QipN0BjxHj2kHJDHOX8V3-wv1D2vr8GMjZTNBaHid=s1360-w1360-h1020';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, isAuthenticated, user } = useAuthStore();
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [error, setError]         = useState('');
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) redirectByRole(user.role);
  }, [isAuthenticated, user]);

  const redirectByRole = (role: string) => {
    if (role === 'admin') navigate('/admin/dashboard');
    else if (role === 'teacher') navigate('/teacher/dashboard');
    else navigate('/student/dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    try {
      await login(email, password);
      toast.success('Welcome back!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', position: 'relative', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      {/* Background */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #5c1010 0%, #3a0a0a 100%)' }}>
        <img src={SCHOOL_BG} alt="" onLoad={() => setImgLoaded(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: imgLoaded ? 0.15 : 0, transition: 'opacity 1.2s' }} />
      </div>

      {/* Left branding */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 64px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 460 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 48 }}>
            <img src="https://icsqc.edu.ph/wp-content/uploads/2019/04/ICSQC-Logo.png" alt="ICSQC"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display='none'; }}
              style={{ width: 60, height: 60, objectFit: 'contain' }} />
            <div>
              <p style={{ color: 'rgba(255,255,255,0.95)', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3 }}>International Christian School</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem' }}>of Quezon City, Inc.</p>
            </div>
          </div>
          <h1 style={{ color: '#fff', fontSize: 'clamp(1.7rem,3.5vw,2.6rem)', fontWeight: 700, lineHeight: 1.25, marginBottom: 16, letterSpacing: '-0.02em' }}>
            Learning Management<br />System Portal
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', lineHeight: 1.7, maxWidth: 380 }}>
            Sign in to access your dashboard, classes, exams, and more.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 36, flexWrap: 'wrap' }}>
            {['K–12 Aligned', 'DepEd Accredited', 'Christian Values'].map(b => (
              <span key={b} style={{ padding: '5px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>{b}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Right – login card container */}
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', position: 'relative', zIndex: 1, background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(20px)', borderLeft: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ width: '100%', maxWidth: 370 }}>
          {/* White card */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '38px 34px', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ marginBottom: 28 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#7a1010', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z" fill="white"/><path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" fill="white"/></svg>
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#111', marginBottom: 4 }}>Sign in</h2>
              <p style={{ fontSize: '0.85rem', color: '#6B7280' }}>ICSQC Learning Portal</p>
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', marginBottom: 18 }}>
                <AlertCircle size={14} color="#DC2626" />
                <span style={{ fontSize: '0.8rem', color: '#DC2626' }}>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@icsqc.edu.ph"
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 8, border: '1.5px solid #E5E7EB', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', color: '#111', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor='#7a1010'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
              </div>

              <div style={{ marginBottom: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>Password</label>
                  <a href="#" style={{ fontSize: '0.75rem', color: '#7a1010', textDecoration: 'none' }}>Forgot password?</a>
                </div>
                <div style={{ position: 'relative' }}>
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password"
                    style={{ width: '100%', padding: '11px 42px 11px 14px', borderRadius: 8, border: '1.5px solid #E5E7EB', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', color: '#111', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor='#7a1010'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
                  <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', alignItems: 'center', padding: 2 }}>
                    {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isLoading}
                style={{ width: '100%', padding: '12px', borderRadius: 8, background: isLoading ? '#b05050' : '#7a1010', border: 'none', color: '#fff', fontWeight: 600, fontSize: '0.9rem', cursor: isLoading ? 'not-allowed' : 'pointer', boxShadow: '0 2px 10px rgba(122,16,16,0.3)', transition: 'background 0.2s' }}
                onMouseEnter={e => { if (!isLoading) (e.currentTarget as HTMLElement).style.background='#6b0e0e'; }}
                onMouseLeave={e => { if (!isLoading) (e.currentTarget as HTMLElement).style.background='#7a1010'; }}>
                {isLoading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    Signing in…
                  </span>
                ) : 'Sign In'}
              </button>
            </form>
          </div>

          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem', marginTop: 20, lineHeight: 1.6 }}>
            © 2024–2025 International Christian School of Quezon City, Inc.<br />Bago Bantay, Quezon City, Philippines
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } input::placeholder { color: #9CA3AF; }`}</style>
    </div>
  );
}
