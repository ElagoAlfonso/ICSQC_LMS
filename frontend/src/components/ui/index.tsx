import React from 'react';

// ── StatCard ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
  bg?: string;
  change?: string;
  changeType?: 'up' | 'down' | 'neutral';
}

export function StatCard({ label, value, icon, color = '#8B1A1A', bg = '#FEE2E2', change, changeType }: StatCardProps) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '14px',
      padding: '24px',
      boxShadow: 'var(--shadow-card)',
      border: '1px solid var(--gray-100)',
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: 'default',
    }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', fontWeight: 500, marginBottom: '6px' }}>
            {label}
          </p>
          <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--gray-900)', lineHeight: 1.1, fontFamily: 'var(--font-display)' }}>
            {value}
          </p>
          {change && (
            <p style={{
              fontSize: '0.75rem', marginTop: '6px',
              color: changeType === 'up' ? '#059669' : changeType === 'down' ? '#DC2626' : '#6B7280',
              fontWeight: 500,
            }}>
              {changeType === 'up' ? '↑' : changeType === 'down' ? '↓' : '•'} {change}
            </p>
          )}
        </div>
        <div style={{
          width: 48, height: 48, borderRadius: '12px',
          background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: color, flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  padding?: string;
  style?: React.CSSProperties;
}

export function Card({ children, title, subtitle, action, padding = '24px', style }: CardProps) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '14px',
      boxShadow: 'var(--shadow-card)',
      border: '1px solid var(--gray-100)',
      overflow: 'hidden',
      ...style,
    }}>
      {(title || action) && (
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--gray-100)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            {title && (
              <h3 style={{
                fontSize: '0.9375rem', fontWeight: 700,
                color: 'var(--gray-900)',
                fontFamily: 'var(--font-display)',
              }}>{title}</h3>
            )}
            {subtitle && (
              <p style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginTop: '2px' }}>{subtitle}</p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div style={{ padding }}>{children}</div>
    </div>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────────
interface BadgeProps {
  label: string;
  color?: 'red' | 'green' | 'blue' | 'yellow' | 'gray' | 'purple';
}

const badgeColors: Record<string, { bg: string; text: string }> = {
  red:    { bg: '#FEE2E2', text: '#DC2626' },
  green:  { bg: '#D1FAE5', text: '#059669' },
  blue:   { bg: '#DBEAFE', text: '#2563EB' },
  yellow: { bg: '#FEF3C7', text: '#D97706' },
  gray:   { bg: '#F3F4F6', text: '#6B7280' },
  purple: { bg: '#EDE9FE', text: '#7C3AED' },
};

export function Badge({ label, color = 'gray' }: BadgeProps) {
  const { bg, text } = badgeColors[color];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 10px',
      background: bg, color: text,
      borderRadius: '20px', fontSize: '0.72rem',
      fontWeight: 600, letterSpacing: '0.3px',
      textTransform: 'capitalize',
    }}>
      {label}
    </span>
  );
}

// ── Button ───────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
}

const btnStyles: Record<string, React.CSSProperties> = {
  primary: { background: 'linear-gradient(135deg, #8B1A1A, #A52828)', color: '#fff', border: 'none', boxShadow: '0 2px 8px rgba(139,26,26,0.3)' },
  secondary: { background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' },
  danger: { background: '#DC2626', color: '#fff', border: 'none' },
  ghost: { background: 'transparent', color: '#6B7280', border: 'none' },
  outline: { background: 'transparent', color: '#8B1A1A', border: '1.5px solid #8B1A1A' },
};

const btnSizes: Record<string, React.CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: '0.78rem', borderRadius: '7px' },
  md: { padding: '9px 18px', fontSize: '0.875rem', borderRadius: '9px' },
  lg: { padding: '12px 24px', fontSize: '0.9375rem', borderRadius: '10px' },
};

export function Button({ variant = 'primary', size = 'md', icon, loading, children, style, disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '7px',
        fontWeight: 600, cursor: disabled || loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s', fontFamily: 'var(--font-body)',
        opacity: disabled ? 0.6 : 1,
        ...btnStyles[variant],
        ...btnSizes[size],
        ...style,
      }}
    >
      {loading ? (
        <span style={{
          width: 14, height: 14,
          border: '2px solid rgba(255,255,255,0.3)',
          borderTopColor: 'currentColor',
          borderRadius: '50%',
          display: 'inline-block',
          animation: 'spin 0.7s linear infinite',
        }} />
      ) : icon}
      {children}
    </button>
  );
}

// ── Input ────────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, icon, style, ...props }: InputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {label && (
        <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--gray-700)' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {icon && (
          <span style={{
            position: 'absolute', left: '12px', top: '50%',
            transform: 'translateY(-50%)', color: 'var(--gray-400)',
          }}>
            {icon}
          </span>
        )}
        <input
          {...props}
          style={{
            width: '100%',
            padding: icon ? '9px 14px 9px 38px' : '9px 14px',
            border: `1.5px solid ${error ? '#DC2626' : 'var(--gray-200)'}`,
            borderRadius: '9px',
            fontSize: '0.875rem',
            color: 'var(--gray-900)',
            background: '#fff',
            outline: 'none',
            transition: 'border-color 0.2s',
            fontFamily: 'var(--font-body)',
            ...style,
          }}
          onFocus={(e) => { e.target.style.borderColor = '#8B1A1A'; }}
          onBlur={(e) => { e.target.style.borderColor = error ? '#DC2626' : 'var(--gray-200)'; }}
        />
      </div>
      {error && <p style={{ fontSize: '0.75rem', color: '#DC2626' }}>{error}</p>}
    </div>
  );
}

// ── Select ───────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, style, ...props }: SelectProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {label && (
        <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--gray-700)' }}>
          {label}
        </label>
      )}
      <select
        {...props}
        style={{
          width: '100%',
          padding: '9px 14px',
          border: `1.5px solid ${error ? '#DC2626' : 'var(--gray-200)'}`,
          borderRadius: '9px',
          fontSize: '0.875rem',
          color: 'var(--gray-900)',
          background: '#fff',
          outline: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
          ...style,
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p style={{ fontSize: '0.75rem', color: '#DC2626' }}>{error}</p>}
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
  footer?: React.ReactNode;
}

export function Modal({ open, onClose, title, children, width = '520px', footer }: ModalProps) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '16px',
          width: '100%', maxWidth: width,
          maxHeight: '90vh', overflow: 'auto',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          animation: 'slideUp 0.2s ease',
        }}
      >
        {title && (
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--gray-100)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <h3 style={{
              fontSize: '1rem', fontWeight: 700,
              color: 'var(--gray-900)',
              fontFamily: 'var(--font-display)',
            }}>{title}</h3>
            <button
              onClick={onClose}
              style={{
                background: 'var(--gray-100)', border: 'none',
                borderRadius: '50%', width: 30, height: 30,
                cursor: 'pointer', color: 'var(--gray-500)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.1rem', fontWeight: 400,
              }}
            >×</button>
          </div>
        )}
        <div style={{ padding: '24px' }}>{children}</div>
        {footer && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--gray-100)',
            display: 'flex', justifyContent: 'flex-end', gap: '10px',
          }}>
            {footer}
          </div>
        )}
      </div>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── DataTable ─────────────────────────────────────────────────────────────────
interface Column<T> {
  key: string;
  label: string;
  render?: (row: T, index?: number) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends { _id?: string }>({
  columns, data, loading, emptyMessage = 'No records found', onRowClick,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div style={{
          width: 32, height: 32,
          border: '3px solid #E5E7EB',
          borderTopColor: '#8B1A1A',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 12px',
        }} />
        <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Loading data...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--gray-100)' }}>
            {columns.map((col) => (
              <th key={col.key} style={{
                padding: '10px 16px', textAlign: 'left',
                fontSize: '0.75rem', fontWeight: 600,
                color: 'var(--gray-500)', textTransform: 'uppercase',
                letterSpacing: '0.6px', whiteSpace: 'nowrap',
                width: col.width,
              }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{
                padding: '48px', textAlign: 'center',
                color: 'var(--gray-400)', fontSize: '0.875rem',
              }}>
                {emptyMessage}
              </td>
            </tr>
          ) : data.map((row, i) => (
            <tr
              key={row._id || i}
              onClick={() => onRowClick?.(row)}
              style={{
                borderBottom: '1px solid var(--gray-100)',
                transition: 'background 0.1s',
                cursor: onRowClick ? 'pointer' : 'default',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--gray-50)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {columns.map((col) => (
                <td key={col.key} style={{
                  padding: '12px 16px',
                  fontSize: '0.875rem', color: 'var(--gray-700)',
                  verticalAlign: 'middle',
                }}>
                  {col.render ? col.render(row, i) : (row as any)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Pagination ─────────────────────────────────────────────────────────────
interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pages, total, limit, onChange }: PaginationProps) {
  if (pages <= 1) return null;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px', borderTop: '1px solid var(--gray-100)',
    }}>
      <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
        Showing {start}–{end} of {total} records
      </p>
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          onClick={() => onChange(page - 1)} disabled={page <= 1}
          style={{
            padding: '6px 12px', border: '1px solid var(--gray-200)',
            borderRadius: '7px', background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer',
            fontSize: '0.8rem', color: page <= 1 ? '#D1D5DB' : '#374151',
            fontFamily: 'var(--font-body)',
          }}
        >
          ← Prev
        </button>
        {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
          const p = i + 1;
          return (
            <button
              key={p} onClick={() => onChange(p)}
              style={{
                padding: '6px 10px', border: '1px solid',
                borderColor: p === page ? '#8B1A1A' : 'var(--gray-200)',
                borderRadius: '7px',
                background: p === page ? '#8B1A1A' : '#fff',
                color: p === page ? '#fff' : '#374151',
                cursor: 'pointer', fontSize: '0.8rem', fontWeight: p === page ? 600 : 400,
                fontFamily: 'var(--font-body)',
              }}
            >{p}</button>
          );
        })}
        <button
          onClick={() => onChange(page + 1)} disabled={page >= pages}
          style={{
            padding: '6px 12px', border: '1px solid var(--gray-200)',
            borderRadius: '7px', background: '#fff', cursor: page >= pages ? 'not-allowed' : 'pointer',
            fontSize: '0.8rem', color: page >= pages ? '#D1D5DB' : '#374151',
            fontFamily: 'var(--font-body)',
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      padding: '60px 24px', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
    }}>
      {icon && (
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'var(--gray-100)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--gray-400)',
        }}>{icon}</div>
      )}
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--gray-700)' }}>{title}</h3>
      {description && <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', maxWidth: '360px' }}>{description}</p>}
      {action && <div style={{ marginTop: '8px' }}>{action}</div>}
    </div>
  );
}
