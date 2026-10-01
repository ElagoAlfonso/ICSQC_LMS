import React, { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Bell, Pin, Megaphone, MessageCircle, Send, Trash2, Plus } from 'lucide-react';
import { Card, Badge, EmptyState, Button, Modal } from '../../components/ui';
import { announcementCommentsApi, announcementsApi, usersApi } from '../../utils/api';
import type { Announcement, Comment, User } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

export default function AnnouncementsPage() {
  const { user } = useAuthStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [audience, setAudience] = useState<'all' | 'student' | 'teacher' | 'individual'>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [form, setForm] = useState({ title: '', content: '', isPinned: false });

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await announcementsApi.getAll({ limit: 100 });
      setAnnouncements((res.data.announcements || []).sort((a: Announcement, b: Announcement) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch {
      toast.error('Failed to load announcements');
    }
    setLoading(false);
  };

  useEffect(() => { fetchAnnouncements(); }, []);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    usersApi.getAll({ limit: 200, search: recipientSearch }).then((res) => setUsers(res.data.users || [])).catch(() => toast.error('Failed to load users'));
  }, [user?.role, recipientSearch]);

  const closeComposer = () => {
    setComposerOpen(false);
    setForm({ title: '', content: '', isPinned: false });
    setAudience('all');
    setSelectedUsers([]);
  };

  const createAnnouncement = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and message are required.');
      return;
    }
    if (audience === 'individual' && selectedUsers.length === 0) {
      toast.error('Select at least one recipient.');
      return;
    }
    setPosting(true);
    try {
      await announcementsApi.create({
        title: form.title.trim(),
        content: form.content.trim(),
        targetRole: audience === 'individual' ? 'all' : audience,
        targetUsers: audience === 'individual' ? selectedUsers : [],
        isPinned: form.isPinned,
        isActive: true,
      });
      toast.success('Announcement published.');
      closeComposer();
      await fetchAnnouncements();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to publish announcement.');
    } finally {
      setPosting(false);
    }
  };

  const targetColor = (role: string) => {
    switch (role) {
      case 'student': return 'green';
      case 'teacher': return 'blue';
      case 'admin': return 'red';
      default: return 'gray';
    }
  };

  const pinned = announcements.filter(a => a.isPinned);
  const regular = announcements.filter(a => !a.isPinned);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gray-900)', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Megaphone size={22} color="#8B1A1A" /> Announcements
        </h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginTop: '2px' }}>
          Recent updates and class announcements archive
        </p>
        </div>
        {user?.role === 'admin' && <Button icon={<Plus size={16} />} onClick={() => setComposerOpen(true)}>New announcement</Button>}
      </div>

      <Modal open={composerOpen} onClose={closeComposer} title="New announcement" width="620px" footer={<><Button variant="secondary" onClick={closeComposer}>Cancel</Button><Button loading={posting} onClick={createAnnouncement}>Publish</Button></>}>
        <div style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: '0.8rem', fontWeight: 500, color: 'var(--gray-700)' }}>Title
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Announcement title" style={{ padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 9, fontSize: '0.875rem' }} />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: '0.8rem', fontWeight: 500, color: 'var(--gray-700)' }}>Message
            <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} rows={5} placeholder="Write your announcement..." style={{ padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 9, fontSize: '0.875rem', resize: 'vertical', fontFamily: 'inherit' }} />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: '0.8rem', fontWeight: 500, color: 'var(--gray-700)' }}>Audience
            <select value={audience} onChange={(event) => setAudience(event.target.value as typeof audience)} style={{ padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 9, fontSize: '0.875rem', background: '#fff' }}>
              <option value="all">All students and teachers</option>
              <option value="student">All students</option>
              <option value="teacher">All teachers</option>
              <option value="individual">Specific individuals</option>
            </select>
          </label>
          {audience === 'individual' && <div style={{ display: 'grid', gap: 8 }}>
            <input value={recipientSearch} onChange={(event) => setRecipientSearch(event.target.value)} placeholder="Search recipients by name or LRN" aria-label="Search recipients by name or LRN" style={{ padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 9, fontSize: '0.875rem' }} />
            <div style={{ maxHeight: 190, overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: 9, padding: 8, display: 'grid', gap: 5 }}>
              {users.filter((recipient) => recipient.role !== 'admin').map((recipient) => <label key={recipient._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 5px', color: '#374151', fontSize: '0.82rem', cursor: 'pointer' }}><input type="checkbox" checked={selectedUsers.includes(recipient._id)} onChange={(event) => setSelectedUsers(event.target.checked ? [...selectedUsers, recipient._id] : selectedUsers.filter((id) => id !== recipient._id))} /><span>{recipient.name}</span><small style={{ color: '#64748B' }}>{recipient.lrn ? `LRN ${recipient.lrn} · ` : ''}{recipient.role}</small></label>)}
              {users.filter((recipient) => recipient.role !== 'admin').length === 0 && <span style={{ padding: 8, color: '#64748B', fontSize: '0.82rem' }}>No matching recipients.</span>}
            </div>
          </div>}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: '#374151', cursor: 'pointer' }}><input type="checkbox" checked={form.isPinned} onChange={(event) => setForm({ ...form, isPinned: event.target.checked })} />Pin this announcement</label>
        </div>
      </Modal>

      {loading ? (
        <Card padding="48px">
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #E5E7EB', borderTopColor: '#8B1A1A', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </Card>
      ) : announcements.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bell size={28} />}
            title="No announcements yet"
            description="Check back later for class updates and announcements."
          />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {pinned.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Pin size={12} /> Pinned
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pinned.map(ann => <AnnouncementCard key={ann._id} ann={ann} targetColor={targetColor} />)}
              </div>
            </div>
          )}

          {regular.length > 0 && (
            <div>
              {pinned.length > 0 && (
                <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px', marginTop: '8px' }}>
                  Recent
                </h3>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {regular.map(ann => <AnnouncementCard key={ann._id} ann={ann} targetColor={targetColor} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AnnouncementCard({ ann, targetColor, readOnly = false }: any) {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [replies, setReplies] = useState<Record<string, Comment[]>>({});
  const [reactions, setReactions] = useState<Record<string, User[]>>({});
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [reactionMenu, setReactionMenu] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [reactionSubmitting, setReactionSubmitting] = useState(false);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const reactionOptions = ['👍', '❤️', '🎉', '👏', '💯', '🙏', '😮', '😂'];
  const selectedReaction = Object.entries(reactions).find(([, users]) => users.some((reactionUser) => String(reactionUser?._id) === String(user?._id)))?.[0];
  const totalCommentCount = comments.length + Object.values(replies).reduce((total, items) => total + items.length, 0);
  const visibleComments = commentsExpanded ? comments : comments.slice(0, 2);
  const hasHiddenComments = totalCommentCount > visibleComments.length;

  const loadDiscussion = async () => {
    try {
      const commentResponse = await announcementCommentsApi.getComments(ann._id);
      const topLevel = (commentResponse.data.comments || []) as Comment[];
      setComments(topLevel);
      const replyEntries = await Promise.all(topLevel.map(async (comment) => {
        const response = await announcementCommentsApi.getComments(ann._id, { replyTo: comment._id });
        return [comment._id, (response.data.comments || []) as Comment[]] as const;
      }));
      setReplies(Object.fromEntries(replyEntries));
      try {
        const reactionResponse = await announcementCommentsApi.getReactions(ann._id);
        setReactions(reactionResponse.data.reactions || {});
      } catch {
        setReactions({});
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to load discussion.');
    }
  };

  useEffect(() => { loadDiscussion(); }, [ann._id]);

  useEffect(() => {
    const socket: Socket = io(import.meta.env.VITE_REALTIME_URL || window.location.origin, { withCredentials: true, transports: ['websocket', 'polling'] });
    const addComment = (event: { comment: Comment }) => {
      const comment = event.comment;
      if (comment.replyTo) {
        setReplies((current) => ({
          ...current,
          [String(comment.replyTo)]: (current[String(comment.replyTo)] || []).some((item) => item._id === comment._id)
            ? current[String(comment.replyTo)]
            : [comment, ...(current[String(comment.replyTo)] || [])],
        }));
      } else {
        setComments((current) => current.some((item) => item._id === comment._id) ? current : [comment, ...current]);
      }
    };
    const updateComment = (event: { comment: Comment }) => {
      setComments((current) => current.map((item) => item._id === event.comment._id ? event.comment : item));
      setReplies((current) => Object.fromEntries(Object.entries(current).map(([key, items]) => [key, items.map((item) => item._id === event.comment._id ? event.comment : item)])));
    };
    const deleteCommentEvent = (event: { commentId: string }) => {
      setComments((current) => current.filter((item) => item._id !== event.commentId));
      setReplies((current) => Object.fromEntries(Object.entries(current).map(([key, items]) => [key, items.filter((item) => item._id !== event.commentId)])));
    };
    socket.on('connect', () => socket.emit('announcement:join', ann._id));
    socket.on('announcement:comment-added', addComment);
    socket.on('announcement:comment-updated', updateComment);
    socket.on('announcement:comment-deleted', deleteCommentEvent);
    socket.on('announcement:reactions-updated', (event: { reactions: Record<string, User[]> }) => setReactions(event.reactions));
    return () => {
      socket.emit('announcement:leave', ann._id);
      socket.disconnect();
    };
  }, [ann._id]);

  const react = async (emoji: string) => {
    if (reactionSubmitting) return;
    setReactionSubmitting(true);
    try {
      const response = selectedReaction === emoji
        ? await announcementCommentsApi.removeReaction(ann._id, { emoji })
        : selectedReaction
          ? await announcementCommentsApi.changeReaction(ann._id, { oldEmoji: selectedReaction, newEmoji: emoji })
          : await announcementCommentsApi.addReaction(ann._id, { emoji });
      if (response.data.reactions) setReactions(response.data.reactions);
      setReactionMenu(false);
    } catch (error: any) { toast.error(error.response?.data?.message || 'Unable to update reaction.'); }
    finally { setReactionSubmitting(false); }
  };

  const handleReactionSelect = (event: React.MouseEvent<HTMLButtonElement>, emoji: string) => {
    event.preventDefault();
    event.stopPropagation();
    void react(emoji);
  };

  const submitComment = async () => {
    if (!commentText.trim() || commentSubmitting) return;
    setCommentSubmitting(true);
    try {
      const response = editingComment
        ? await announcementCommentsApi.updateComment(editingComment._id, { text: commentText.trim() })
        : await announcementCommentsApi.createComment(ann._id, { text: commentText.trim(), replyToCommentId: replyTo?._id });
      const savedComment = response.data.comment as Comment;
      if (editingComment) {
        const updatedComment = savedComment;
        setComments((current) => current.map((item) => item._id === updatedComment._id ? updatedComment : item));
        setReplies((current) => Object.fromEntries(Object.entries(current).map(([key, items]) => [key, items.map((item) => item._id === updatedComment._id ? updatedComment : item)])));
      } else if (savedComment.replyTo) {
        setReplies((current) => ({
          ...current,
          [String(savedComment.replyTo)]: (current[String(savedComment.replyTo)] || []).some((item) => item._id === savedComment._id)
            ? current[String(savedComment.replyTo)]
            : [savedComment, ...(current[String(savedComment.replyTo)] || [])],
        }));
      } else {
        setComments((current) => current.some((item) => item._id === savedComment._id) ? current : [savedComment, ...current]);
      }
      setCommentText('');
      setReplyTo(null);
      setEditingComment(null);
    } catch (error: any) { toast.error(error.response?.data?.message || 'Unable to post comment.'); }
    finally { setCommentSubmitting(false); }
  };

  const deleteComment = async (comment: Comment) => {
    if (!window.confirm('Delete this comment?')) return;
    try { await announcementCommentsApi.deleteComment(comment._id); await loadDiscussion(); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Unable to delete comment.'); }
  };

  const authorName = typeof ann.author === 'object' ? ann.author?.name || 'Unknown' : 'Unknown';
  const className = typeof ann.targetClass === 'object' ? `${ann.targetClass.name}${ann.targetClass.section ? ` - ${ann.targetClass.section}` : ''}` : 'Class announcement';

  return (
    <div style={{
      background: '#fff',
      borderRadius: '14px',
      border: ann.isPinned ? '1px solid #FDE68A' : '1px solid var(--gray-100)',
      padding: '20px 24px',
      boxShadow: ann.isPinned ? '0 2px 12px rgba(201,168,76,0.1)' : 'var(--shadow-card)',
      position: 'relative',
    }}>
      {ann.isPinned && (
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <Pin size={14} color="#C9A84C" fill="#C9A84C" />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        <div style={{
          width: 42, height: 42, borderRadius: '12px', flexShrink: 0,
          background: ann.isPinned ? '#FEF3C7' : '#FEE2E2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Bell size={20} color={ann.isPinned ? '#D97706' : '#8B1A1A'} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>
              {ann.title}
            </h3>
            {ann.targetClass && (
              <span style={{ fontSize: '0.7rem', color: '#7a1010', background: '#FEE2E2', padding: '3px 8px', borderRadius: 999, fontWeight: 700 }}>
                {className}
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)', lineHeight: 1.7, marginBottom: '12px' }}>
            {ann.content}
          </p>
          {ann.attachments?.length > 0 && <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>{ann.attachments.map((attachment: any) => <a key={attachment._id} href={`/api/posts/${ann._id}/attachments/${attachment._id}`} target="_blank" rel="noreferrer" style={{ color: '#7a1010', fontSize: '0.78rem', fontWeight: 600 }}>{attachment.originalName}</a>)}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
              By <strong style={{ color: 'var(--gray-600)' }}>{authorName}</strong>
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
              {formatDistanceToNow(new Date(ann.createdAt), { addSuffix: true })}
            </span>
            <Badge label={ann.targetUsers?.length ? `${ann.targetUsers.length} recipients` : ann.targetRole === 'all' ? 'Everyone' : ann.targetRole} color={ann.targetUsers?.length ? 'purple' : targetColor(ann.targetRole)} />
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {!readOnly && <div style={{ position: 'relative' }}>
            <button type="button" disabled={reactionSubmitting} onClick={() => setReactionMenu((value) => !value)} style={{ border: 0, background: '#FFF7F7', color: '#7a1010', borderRadius: 8, padding: '6px 9px', cursor: reactionSubmitting ? 'wait' : 'pointer' }}>{reactionSubmitting ? '...' : 'React'}</button>
            {reactionMenu && <div style={{ position: 'absolute', left: 0, top: 34, zIndex: 3, display: 'flex', gap: 3, padding: 5, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 4px 12px rgba(15,23,42,0.12)' }}>{reactionOptions.map((emoji) => <button key={emoji} type="button" disabled={reactionSubmitting} aria-pressed={selectedReaction === emoji} onClick={(event) => handleReactionSelect(event, emoji)} style={{ border: selectedReaction === emoji ? '1px solid #8B1A1A' : 0, background: selectedReaction === emoji ? '#FEE2E2' : 'transparent', borderRadius: 5, cursor: reactionSubmitting ? 'wait' : 'pointer', fontSize: '1rem', padding: 2 }}>{emoji}</button>)}</div>}
          </div>}
          {Object.entries(reactions).map(([emoji, users]) => <span key={emoji} style={{ fontSize: '0.78rem', color: '#475569' }}>{emoji} {users.length}</span>)}
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#64748B' }}><MessageCircle size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />{totalCommentCount} comments</span>
        </div>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {visibleComments.map((comment) => {
            const commentAuthor = typeof comment.author === 'object' ? comment.author as User : null;
            return <div key={comment._id} style={{ padding: 10, background: '#F8FAFC', borderRadius: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong style={{ fontSize: '0.78rem', color: '#334155' }}>{commentAuthor?.name || 'User'}</strong><span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span></div>
              <p style={{ margin: '5px 0 8px', fontSize: '0.8rem', color: '#475569', whiteSpace: 'pre-wrap' }}>{comment.text} {comment.isEdited && <em style={{ fontSize: '0.7rem', color: '#94A3B8' }}>(edited)</em>}</p>
              {!readOnly && <div style={{ display: 'flex', gap: 8 }}><button type="button" onClick={() => { setReplyTo(comment); setEditingComment(null); setCommentText(''); }} style={{ border: 0, background: 'transparent', color: '#7a1010', fontSize: '0.72rem', cursor: 'pointer' }}>Reply</button>{commentAuthor?._id === user?._id && <button type="button" onClick={() => { setEditingComment(comment); setReplyTo(null); setCommentText(comment.text); }} style={{ border: 0, background: 'transparent', color: '#64748B', fontSize: '0.72rem', cursor: 'pointer' }}>Edit</button>}{(commentAuthor?._id === user?._id || user?.role === 'teacher' || user?.role === 'admin') && <button type="button" onClick={() => deleteComment(comment)} style={{ border: 0, background: 'transparent', color: '#DC2626', cursor: 'pointer' }} aria-label="Delete comment"><Trash2 size={13} /></button>}</div>}
              {(replies[comment._id] || []).map((reply) => { const replyAuthor = typeof reply.author === 'object' ? reply.author as User : null; return <div key={reply._id} style={{ margin: '8px 0 0 18px', padding: 8, borderLeft: '2px solid #E2E8F0' }}><strong style={{ fontSize: '0.74rem', color: '#334155' }}>{replyAuthor?.name || 'User'}</strong><p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748B' }}>{reply.text} {reply.isEdited && <em>(edited)</em>}</p></div>; })}
            </div>;
          })}
        </div>
        {(hasHiddenComments || commentsExpanded) && (
          <button
            type="button"
            onClick={() => setCommentsExpanded((expanded) => !expanded)}
            style={{ border: 0, background: 'transparent', color: '#7a1010', fontSize: '0.75rem', fontWeight: 600, padding: '2px 0', cursor: 'pointer' }}
          >
            {commentsExpanded ? 'Hide comments' : `View all ${totalCommentCount} comments`}
          </button>
        )}
        {!readOnly && (replyTo || editingComment) && <div style={{ marginTop: 10, fontSize: '0.75rem', color: '#64748B' }}>{editingComment ? 'Editing comment' : `Replying to ${typeof replyTo?.author === 'object' ? replyTo.author.name : 'comment'}`} <button type="button" onClick={() => { setReplyTo(null); setEditingComment(null); setCommentText(''); }} style={{ border: 0, background: 'transparent', color: '#7a1010', cursor: 'pointer' }}>Cancel</button></div>}
        {!readOnly && <form onSubmit={(event) => { event.preventDefault(); submitComment(); }} style={{ display: 'flex', gap: 8, marginTop: 10 }}><input disabled={commentSubmitting} value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder={replyTo ? 'Write a reply...' : 'Add a comment...'} style={{ flex: 1, minWidth: 0, padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none' }} /><button type="submit" disabled={commentSubmitting} aria-label="Post comment" style={{ border: 0, background: '#8B1A1A', color: '#fff', borderRadius: 8, padding: '0 11px', cursor: commentSubmitting ? 'wait' : 'pointer' }}>{commentSubmitting ? '...' : <Send size={14} />}</button></form>}
      </div>
    </div>
  );
}
