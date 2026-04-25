import React, { useEffect, useState, useCallback } from 'react';
import { Activity, Search, User, Clock, Tag } from 'lucide-react';
import { Card, Pagination, Badge } from '../../components/ui';
import { logsApi } from '../../utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const ACTION_COLORS: Record<string, 'red' | 'green' | 'blue' | 'yellow' | 'gray'> = {
  CREATE: 'green', UPDATE: 'blue', DELETE: 'red',
  LOGIN: 'gray', REGISTER: 'green', LOGOUT: 'gray',
};

function getActionColor(action: string): 'red' | 'green' | 'blue' | 'yellow' | 'gray' {
  for (const [key, val] of Object.entries(ACTION_COLORS)) {
    if (action.toUpperCase().includes(key)) return val;
  }
  return 'gray';
}

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  green:  { bg: '#D1FAE5', text: '#059669' },
  blue:   { bg: '#DBEAFE', text: '#2563EB' },
  red:    { bg: '#FEE2E2', text: '#DC2626' },
  yellow: { bg: '#FEF3C7', text: '#D97706' },
  gray:   { bg: '#F3F4F6', text: '#6B7280' },
};

export default function ActivityLogsPage() {
  const [logs, setLogs]         = useState<any[]>([]);
  const [total, setTotal]       = useState(0);
  const [pages, setPages]       = useState(1);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await logsApi.getAll({ page, limit: 15, search: search || undefined });
      const d   = res.data;
      // Handle both response shapes: { logs, pagination } or flat array
      if (Array.isArray(d)) {
        setLogs(d);
        setTotal(d.length);
        setPages(1);
      } else {
        setLogs(d.logs || []);
        setTotal(d.pagination?.total || 0);
        setPages(d.pagination?.pages || 1);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to load activity logs';
      setError(msg);
      toast.error(msg);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Debounce search
  useEffect(() => { setPage(1); }, [search]);

  const getUserName = (log: any) => {
    if (!log.user) return 'System';
    if (typeof log.user === 'object') return log.user.name || log.user.email || 'Unknown';
    return String(log.user);
  };
  const getUserInitial = (log: any) => getUserName(log).charAt(0).toUpperCase();

  const AVATAR_COLORS = ['#7a1010','#2563EB','#059669','#7C3AED','#D97706'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity size={22} color="#7a1010" /> Activity Logs
          </h1>
          <p style={{ color: '#6B7280', fontSize: '0.875rem', marginTop: 2 }}>Full audit trail of all system actions</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#FEF3C7', borderRadius: 8 }}>
          <Activity size={14} color="#D97706" />
          <span style={{ fontSize: '0.8rem', color: '#D97706', fontWeight: 600 }}>{total} total events</span>
        </div>
      </div>

      {/* Search */}
      <Card padding="14px">
        <div style={{ position: 'relative', maxWidth: 400 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input
            placeholder="Search by action, user, or details…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 14px 9px 36px', border: '1.5px solid #E5E7EB', borderRadius: 9, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor='#7a1010'}
            onBlur={e  => e.target.style.borderColor='#E5E7EB'}
          />
        </div>
      </Card>

      {/* Error state */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '16px 20px', color: '#DC2626', fontSize: '0.875rem' }}>
          ⚠️ {error} — Check that the backend is running and you are authenticated as an admin.
        </div>
      )}

      {/* Logs table */}
      <Card>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 32, height: 32, border: '3px solid #E5E7EB', borderTopColor: '#7a1010', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
              <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Loading logs…</p>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Activity size={36} color="#D1D5DB" style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ color: '#9CA3AF', fontSize: '0.9rem', fontWeight: 500 }}>No activity logs found</p>
            <p style={{ color: '#D1D5DB', fontSize: '0.8rem', marginTop: 4 }}>{search ? 'Try a different search term' : 'Actions will appear here as users interact with the system'}</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '140px 180px 1fr 160px', gap: 12, padding: '10px 20px', borderBottom: '2px solid #F3F4F6' }}>
              {['Action', 'User', 'Details', 'Timestamp'].map(h => (
                <span key={h} style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            {logs.map((log, i) => {
              const color  = getActionColor(log.action);
              const colors = COLOR_MAP[color];
              const name   = getUserName(log);
              const avatarColor = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
              const hasTs  = log.createdAt && !isNaN(new Date(log.createdAt).getTime());
              return (
                <div key={log._id || i}
                  style={{ display: 'grid', gridTemplateColumns: '140px 180px 1fr 160px', gap: 12, padding: '12px 20px', borderBottom: '1px solid #F9FAFB', alignItems: 'center', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='#FAFAFA'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
                  {/* Action */}
                  <span style={{ padding: '3px 10px', background: colors.bg, color: colors.text, borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>
                    <Tag size={10}/>{log.action}
                  </span>

                  {/* User */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor + '22', border: `2px solid ${avatarColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: avatarColor, flexShrink: 0 }}>
                      {getUserInitial(log)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                      {typeof log.user === 'object' && log.user?.role && (
                        <p style={{ fontSize: '0.68rem', color: '#9CA3AF', textTransform: 'capitalize' }}>{log.user.role}</p>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <span style={{ fontSize: '0.8rem', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={log.details}>
                    {log.details || <span style={{ color: '#D1D5DB', fontStyle: 'italic' }}>No details</span>}
                  </span>

                  {/* Timestamp */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={12} color="#9CA3AF"/>
                    <div>
                      <p style={{ fontSize: '0.78rem', color: '#4B5563', fontWeight: 500 }}>
                        {hasTs ? format(new Date(log.createdAt), 'MMM d, yyyy') : '—'}
                      </p>
                      <p style={{ fontSize: '0.68rem', color: '#9CA3AF' }}>
                        {hasTs ? format(new Date(log.createdAt), 'h:mm:ss a') : ''}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #F3F4F6' }}>
              <Pagination page={page} pages={pages} total={total} limit={15} onChange={setPage} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
