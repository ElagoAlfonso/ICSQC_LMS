import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CircleAlert } from 'lucide-react';
import { Button } from '../../components/ui';

export default function MeetResultPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const message = searchParams.get('message') || 'Google Meet could not be created. Please try again.';
  const role = searchParams.get('role') === 'admin' ? 'admin' : 'teacher';
  const classId = searchParams.get('classId');
  const returnPath = classId ? `/${role}/classes/${encodeURIComponent(classId)}` : `/${role}/dashboard`;

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#F9FAFB' }}>
      <section style={{ width: 'min(100%, 440px)', display: 'grid', justifyItems: 'start', gap: 16, padding: 28, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8 }}>
        <CircleAlert size={28} color="#B42318" aria-hidden="true" />
        <div>
          <h1 style={{ margin: '0 0 8px', color: '#111827', fontSize: '1.25rem' }}>Meet setup could not finish</h1>
          <p role="alert" style={{ margin: 0, color: '#4B5563', lineHeight: 1.5 }}>{message}</p>
        </div>
        <Button icon={<ArrowLeft size={16} />} onClick={() => navigate(returnPath, { replace: true })}>{classId ? 'Return to class' : 'Return to dashboard'}</Button>
      </section>
    </main>
  );
}