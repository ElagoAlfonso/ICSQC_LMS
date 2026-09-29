import React, { useEffect, useState, useRef } from 'react';
import { Award, Plus, Search, Eye, Printer, X, BookOpen, Users, GraduationCap, ArrowLeft, Send } from 'lucide-react';
import { Card, Button, Badge, DataTable, Pagination, Modal, Select, EmptyState } from '../../components/ui';
import { reportCardsApi, usersApi, classesApi, academicYearsApi } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import type { AcademicYear, Class, User, Pagination as PaginationType } from '../../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const PERIODS = [
  { value: 'Q1', label: 'First Quarter (Q1)' }, { value: 'Q2', label: 'Second Quarter (Q2)' },
  { value: 'Q3', label: 'Third Quarter (Q3)' }, { value: 'Q4', label: 'Fourth Quarter (Q4)' },
  { value: 'Final', label: 'Final Report Card' },
];

interface PrintableReportCardProps {
  card: any;
  onClose: () => void;
}

function PrintableReportCard({ card, onClose }: PrintableReportCardProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const win = window.open('', '_blank');
    if (!win || !content) return;
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>Report Card – ${card.student?.name}</title>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #fff; }
        @page { size: A4; margin: 12mm; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.onload = () => { win.print(); win.close(); };
  };

  const student = card.student || {};
  const cls = card.class || {};
  const ay  = card.academicYear || {};
  const grades = card.subjectGrades || [];
  const att = card.attendance || {};

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'auto', padding: '20px' }}>
      {/* Toolbar */}
      <div style={{ width: '100%', maxWidth: '720px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0, flexWrap: 'wrap', gap: '10px' }} className="no-print">
        <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', padding: '8px 12px', fontFamily: 'inherit' }}>
          <ArrowLeft size={15} /> Return to Report Cards
        </button>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: '#8B1A1A', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit' }}>
            <Printer size={15} /> Print / Save PDF
          </button>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Exit report card" title="Exit report card">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* A4 Paper */}
      <div ref={printRef} style={{ width: '720px', background: '#fff', boxShadow: '0 8px 40px rgba(0,0,0,0.3)', flexShrink: 0 }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1A2744 0%, #8B1A1A 100%)', padding: '28px 40px', color: '#fff', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(201,168,76,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BookOpen size={28} color="#C9A84C" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.72rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#C9A84C', fontWeight: 600, marginBottom: '4px' }}>International Christian School of Quezon City, Inc.</p>
            <h1 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: '1.5rem', fontWeight: 700, marginBottom: '2px' }}>Official Report Card</h1>
            <p style={{ fontSize: '0.78rem', opacity: 0.7 }}>
              Academic Year: {ay.name || '—'} &nbsp;|&nbsp; Period: {card.period}
            </p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '2px' }}>Date Generated</p>
            <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>{format(new Date(card.generatedAt || card.createdAt || new Date()), 'MMMM d, yyyy')}</p>
          </div>
        </div>

        {/* Student Info */}
        <div style={{ padding: '20px 40px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          {[
            { label: 'Student Name', value: student.name || '—' },
            { label: 'Grade & Section', value: cls.gradeLevel ? `${cls.gradeLevel} – ${cls.name} ${cls.section}` : '—' },
            { label: 'General Average', value: `${card.generalAverage || 0}%`, highlight: true },
          ].map(item => (
            <div key={item.label}>
              <p style={{ fontSize: '0.68rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>{item.label}</p>
              <p style={{ fontSize: item.highlight ? '1.2rem' : '0.9rem', fontWeight: item.highlight ? 800 : 600, color: item.highlight ? '#8B1A1A' : '#1F2937', fontFamily: item.highlight ? 'Playfair Display, Georgia, serif' : 'inherit' }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* Grades Table */}
        <div style={{ padding: '0 40px 24px' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#8B1A1A', padding: '14px 0 10px', borderBottom: '2px solid #8B1A1A', marginBottom: '0' }}>
            Subject Grades
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Learning Area', 'Q1', 'Q2', 'Q3', 'Q4', 'Final Grade', 'Remarks'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Learning Area' ? 'left' : 'center', fontSize: '0.68rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grades.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.8rem' }}>No subject grades recorded</td></tr>
              ) : grades.map((g: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 500, color: '#374151' }}>{g.subjectName}</td>
                  {[g.q1, g.q2, g.q3, g.q4].map((q, qi) => (
                    <td key={qi} style={{ padding: '8px 10px', textAlign: 'center', color: q < 75 ? '#DC2626' : '#374151' }}>{q || '—'}</td>
                  ))}
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: g.finalGrade >= 90 ? '#059669' : g.finalGrade >= 75 ? '#374151' : '#DC2626', fontSize: '0.875rem' }}>
                    {g.finalGrade || '—'}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 600, background: g.remarks === 'Passed' ? '#D1FAE5' : '#FEE2E2', color: g.remarks === 'Passed' ? '#059669' : '#DC2626' }}>
                      {g.remarks}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#1A2744', color: '#fff' }}>
                <td style={{ padding: '10px', fontWeight: 700, fontSize: '0.82rem' }}>GENERAL AVERAGE</td>
                <td colSpan={4} />
                <td style={{ padding: '10px', textAlign: 'center', fontWeight: 800, fontSize: '1rem', fontFamily: 'Playfair Display, Georgia, serif', color: '#C9A84C' }}>
                  {card.generalAverage || 0}
                </td>
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700, background: card.generalAverage >= 75 ? '#D1FAE5' : '#FEE2E2', color: card.generalAverage >= 75 ? '#059669' : '#DC2626' }}>
                    {card.overallRemarks || (card.generalAverage >= 75 ? 'Promoted' : 'For Review')}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Attendance */}
        <div style={{ padding: '0 40px 24px' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#8B1A1A', paddingBottom: '10px', borderBottom: '1px solid #E5E7EB', marginBottom: '12px' }}>
            Attendance Summary
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              { label: 'Total Days', value: att.totalDays || 0 },
              { label: 'Present', value: att.presentDays || 0, color: '#059669' },
              { label: 'Absent', value: att.absentDays || 0, color: '#DC2626' },
              { label: 'Tardy', value: att.tardyDays || 0, color: '#D97706' },
            ].map(item => (
              <div key={item.label} style={{ background: '#F9FAFB', borderRadius: '8px', padding: '12px', textAlign: 'center', border: '1px solid #E5E7EB' }}>
                <p style={{ fontSize: '0.65rem', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{item.label}</p>
                <p style={{ fontSize: '1.3rem', fontWeight: 800, color: (item as any).color || '#374151', fontFamily: 'Playfair Display, Georgia, serif' }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Signatures */}
        <div style={{ padding: '16px 40px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', borderTop: '1px solid #E5E7EB' }}>
          {['Class Adviser', "Parent / Guardian's Signature", 'School Principal'].map(role => (
            <div key={role} style={{ textAlign: 'center' }}>
              <div style={{ borderBottom: '1px solid #374151', height: '40px', marginBottom: '6px' }} />
              <p style={{ fontSize: '0.7rem', color: '#6B7280', fontWeight: 500 }}>{role}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ background: '#1A2744', padding: '10px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)' }}>
            ICSQC-LMS · Bago Bantay, Quezon City · Generated {format(new Date(), 'MMM d, yyyy h:mm a')}
          </p>
          <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>This is a computer-generated document.</p>
        </div>
        <div className="no-print" style={{ padding: '14px 40px', display: 'flex', justifyContent: 'center', background: '#fff' }}>
          <button type="button" onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 18px', background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: '8px', color: '#374151', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit' }}>
            <ArrowLeft size={15} /> Return to Report Cards
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReportCardsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';

  const [cards, setCards] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [pagination, setPagination] = useState<PaginationType>({ total: 0, page: 1, pages: 1, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [generateModal, setGenerateModal] = useState(false);
  const [requestModal, setRequestModal] = useState(false);
  const [viewCard, setViewCard] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [genForm, setGenForm] = useState({ studentId: '', classId: '', academicYearId: '', period: 'Q1' });
  const [requestForm, setRequestForm] = useState({ studentId: '', period: 'Final' });
  const [ayFilter, setAyFilter] = useState('');

  useEffect(() => {
    Promise.allSettled([
      academicYearsApi.getAll(),
      classesApi.getAll({ limit: 100 }),
      usersApi.getAll({ role: 'student', limit: 200 }),
    ]).then(([ayRes, clsRes, studRes]) => {
      if (ayRes.status === 'fulfilled') {
        setAcademicYears(ayRes.value.data);
        const cur = ayRes.value.data.find((a: AcademicYear) => a.isCurrent);
        if (cur) { setAyFilter(cur._id); setGenForm(f => ({ ...f, academicYearId: cur._id })); }
      }
      if (clsRes.status === 'fulfilled') setClasses(clsRes.value.data.classes || []);
      if (studRes.status === 'fulfilled') setStudents(studRes.value.data.users || []);
    });
  }, []);

  const fetchCards = async () => {
    setLoading(true);
    try {
      const res = await reportCardsApi.getAll({ page, limit: 10, academicYear: ayFilter });
      setCards(res.data.reportCards || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch { toast.error('Failed to load report cards'); }
    setLoading(false);
  };

  const fetchRequests = async () => {
    try {
      const res = await reportCardsApi.getRequests();
      setRequests(res.data.requests || []);
    } catch {
      setRequests([]);
    }
  };

  useEffect(() => {
    fetchCards();
    fetchRequests();
  }, [page, ayFilter, user?.role]);

  const handleGenerate = async () => {
    if (!genForm.studentId || !genForm.classId || !genForm.academicYearId) {
      toast.error('Please fill all required fields'); return;
    }
    setSaving(true);
    try {
      const res = await reportCardsApi.generate(genForm);
      toast.success('Report card generated!');
      setGenerateModal(false);
      setViewCard(res.data);
      await fetchCards();
      await fetchRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Generation failed');
    }
    setSaving(false);
  };

  const handleRequestReportCard = async () => {
    if (!requestForm.studentId) {
      toast.error('Please select a student first.');
      return;
    }
    setRequesting(true);
    try {
      await reportCardsApi.request({
        studentId: requestForm.studentId,
        period: requestForm.period,
        classId: students.find((s) => s._id === requestForm.studentId)?.studentClass,
      });
      toast.success('Report card request sent to the admin.');
      setRequestModal(false);
      setRequestForm({ studentId: '', period: 'Final' });
      await fetchRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Unable to send request');
    } finally {
      setRequesting(false);
    }
  };

  const handleGenerateAndSend = async (request: any) => {
    const student = request.student;
    const classDoc = request.class;
    if (!student || !classDoc) {
      toast.error('Request is missing student or class details.');
      return;
    }

    setSaving(true);
    try {
      const generated = await reportCardsApi.generate({
        studentId: student._id,
        classId: classDoc._id,
        academicYearId: request.academicYear?._id || request.academicYear,
        period: request.period || 'Final',
        requestId: request._id,
      });
      const card = generated.data;
      await reportCardsApi.sendRequest(request._id, card._id);
      toast.success('Report card sent to the requesting teacher.');
      setViewCard(card);
      await fetchCards();
      await fetchRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Unable to generate and send report card');
    } finally {
      setSaving(false);
    }
  };

  const ayOptions = [{ value: '', label: 'All Years' }, ...academicYears.map(a => ({ value: a._id, label: a.name }))];
  const studentOptions = [{ value: '', label: 'Select Student' }, ...students.map(s => ({ value: s._id, label: s.name }))];
  const classOptions = [{ value: '', label: 'Select Class' }, ...classes.map(c => ({ value: c._id, label: `${c.name} – ${c.section}` }))];
  const ayGenOptions = academicYears.map(a => ({ value: a._id, label: a.name }));

  const statusColorMap: Record<string, 'green' | 'yellow' | 'blue' | 'gray'> = {
    pending: 'yellow',
    generated: 'blue',
    sent: 'green',
    received: 'green',
  };

  const columns = [
    {
      key: 'student', label: 'Student', render: (c: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#8B1A1A', flexShrink: 0 }}>
            {c.student?.name?.charAt(0) || 'S'}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--gray-900)' }}>{c.student?.name || '—'}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>{c.student?.email || ''}</div>
          </div>
        </div>
      )
    },
    { key: 'class', label: 'Class', render: (c: any) => <span style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>{c.class ? `${c.class.name} – ${c.class.section}` : '—'}</span> },
    { key: 'period', label: 'Period', render: (c: any) => <Badge label={c.period} color={c.period === 'Final' ? 'red' : 'blue'} /> },
    {
      key: 'generalAverage', label: 'General Average', render: (c: any) => (
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: c.generalAverage >= 90 ? '#059669' : c.generalAverage >= 75 ? '#1A2744' : '#DC2626' }}>
          {c.generalAverage}%
        </span>
      )
    },
    { key: 'overallRemarks', label: 'Remarks', render: (c: any) => <Badge label={c.overallRemarks || 'Pending'} color={c.overallRemarks === 'Promoted' ? 'green' : c.overallRemarks === 'For Review' ? 'yellow' : 'gray'} /> },
    { key: 'createdAt', label: 'Generated', render: (c: any) => <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>{format(new Date(c.createdAt), 'MMM d, yyyy')}</span> },
    {
      key: 'actions', label: '', render: (c: any) => (
        <button onClick={(e) => { e.stopPropagation(); setViewCard(c); }} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: '#EFF6FF', border: 'none', borderRadius: '6px', color: '#2563EB', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500, fontFamily: 'var(--font-body)' }}>
          <Eye size={12} /> View
        </button>
      )
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gray-900)', fontFamily: 'var(--font-display)' }}>Report Cards</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginTop: '2px' }}>
            {isAdmin ? 'Generate and send report cards to teachers' : isTeacher ? 'Request and view student report cards' : 'View report cards'}
          </p>
        </div>
        {isAdmin && (
          <Button icon={<Plus size={16} />} onClick={() => setGenerateModal(true)}>Generate Report Card</Button>
        )}
        {isTeacher && (
          <Button icon={<Plus size={16} />} onClick={() => setRequestModal(true)}>Request Report Card</Button>
        )}
      </div>

      {isAdmin && requests.length > 0 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1rem', color: 'var(--gray-900)' }}>Report Card Requests</h2>
            <Badge label={`${requests.length} pending`} color="yellow" />
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {requests.map((request) => (
              <div key={request._id} style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: 14, display: 'grid', gap: 8, background: '#F8FAFC' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a1010', fontWeight: 700 }}>Request</div>
                    <div style={{ fontWeight: 700, marginTop: 4 }}>{request.teacher?.name || 'Teacher'} • {request.student?.name || 'Student'}</div>
                  </div>
                  <Badge label={request.status || 'pending'} color={statusColorMap[request.status] || 'gray'} />
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                  Student: {request.student?.name || 'Unknown'} • Class: {request.class ? `${request.class.name} - ${request.class.section}` : '—'} • Period: {request.period || 'Final'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                  Requested: {request.requestedAt ? format(new Date(request.requestedAt), 'MMM d, yyyy h:mm a') : '—'}
                </div>
                {request.status !== 'sent' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button size="sm" icon={<Send size={14} />} onClick={() => handleGenerateAndSend(request)}>Generate & Send</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {isTeacher && requests.length > 0 && (
        <Card>
          <h2 style={{ margin: '0 0 12px', fontSize: '1rem', color: 'var(--gray-900)' }}>My Report Card Requests</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {requests.map((request) => (
              <div key={request._id} style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: 14, display: 'grid', gap: 8, background: '#F8FAFC' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 700 }}>{request.student?.name || 'Student'}</div>
                  <Badge label={request.status || 'pending'} color={statusColorMap[request.status] || 'gray'} />
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                  {request.period || 'Final'} • {request.requestedAt ? format(new Date(request.requestedAt), 'MMM d, yyyy h:mm a') : '—'}
                </div>
                {request.status === 'sent' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button size="sm" variant="outline" onClick={() => setViewCard(request.reportCard)}>View received report card</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card padding="16px">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <select value={ayFilter} onChange={(e) => { setAyFilter(e.target.value); setPage(1); }}
            style={{ padding: '9px 14px', border: '1.5px solid var(--gray-200)', borderRadius: '9px', fontSize: '0.875rem', outline: 'none', fontFamily: 'var(--font-body)', background: '#fff', cursor: 'pointer', minWidth: '180px' }}>
            {ayOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </Card>

      <Card style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <DataTable columns={columns} data={cards} loading={loading} emptyMessage="No report cards generated yet" onRowClick={(c) => setViewCard(c)} />
          </div>
          <div style={{ marginTop: '16px' }}>
            <Pagination {...pagination} onChange={setPage} />
          </div>
        </div>
      </Card>

      {isAdmin && (
        <Modal open={generateModal} onClose={() => setGenerateModal(false)} title="Generate Report Card"
          footer={<><Button variant="secondary" onClick={() => setGenerateModal(false)}>Cancel</Button><Button loading={saving} onClick={handleGenerate}>Generate</Button></>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '12px', background: '#EFF6FF', borderRadius: '10px', border: '1px solid #BFDBFE' }}>
              <p style={{ fontSize: '0.8rem', color: '#1E40AF' }}>
                📊 This will automatically calculate grades from the selected student's exam submissions and generate a printable report card.
              </p>
            </div>
            <Select label="Student *" value={genForm.studentId} onChange={(e) => setGenForm({ ...genForm, studentId: e.target.value })} options={studentOptions} />
            <Select label="Class *" value={genForm.classId} onChange={(e) => setGenForm({ ...genForm, classId: e.target.value })} options={classOptions} />
            <Select label="Academic Year *" value={genForm.academicYearId} onChange={(e) => setGenForm({ ...genForm, academicYearId: e.target.value })} options={ayGenOptions} />
            <Select label="Period *" value={genForm.period} onChange={(e) => setGenForm({ ...genForm, period: e.target.value })} options={PERIODS} />
          </div>
        </Modal>
      )}

      {isTeacher && (
        <Modal open={requestModal} onClose={() => setRequestModal(false)} title="Request Report Card"
          footer={<><Button variant="secondary" onClick={() => setRequestModal(false)}>Cancel</Button><Button loading={requesting} onClick={handleRequestReportCard}>Submit Request</Button></>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Select label="Student *" value={requestForm.studentId} onChange={(e) => setRequestForm({ ...requestForm, studentId: e.target.value })} options={studentOptions} />
            <Select label="Period *" value={requestForm.period} onChange={(e) => setRequestForm({ ...requestForm, period: e.target.value })} options={PERIODS} />
          </div>
        </Modal>
      )}

      {viewCard && <PrintableReportCard card={viewCard} onClose={() => setViewCard(null)} />}
    </div>
  );
}
