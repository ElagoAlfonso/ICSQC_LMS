# ICSQC LMS Frontend Implementation Guide

## Status: 70% Complete (Backend & Types Done)

### What's Been Completed
- ✅ All database models (6 new models)
- ✅ All backend APIs (30+ endpoints)
- ✅ All routes registered and tested
- ✅ Frontend types added (Classwork, Message, Comment, Reaction, Conversation)
- ✅ API utilities updated with all endpoints
- ✅ Backend server running successfully with MongoDB

### What Remains: Frontend Implementation

---

## Phase 1: Classwork System (HIGHEST PRIORITY)

### Files to Create/Modify:

#### 1. Update ClassWorkspacePage.tsx (CRITICAL)
**Location:** `frontend/src/pages/shared/ClassWorkspacePage.tsx`

**Changes Required:**
- Import classworkApi from utils/api
- Import Classwork type from types
- Add state for classwork data: `const [classwork, setClasswork] = useState<Classwork[]>([])`
- Import classworkApi: `import { classworkApi, announcementsApi, classesApi, examsApi, meetingsApi, submissionsApi } from '../../utils/api';`
- Update the load function to fetch classwork:
  ```typescript
  const classworkResponse = await classworkApi.getAll({ classId });
  setClasswork(classworkResponse.data.classwork || []);
  ```
- Replace renderClasswork() function to show actual classwork (see below)
- Add form state for creating classwork if teacher
- Add modal for creating classwork

**Updated renderClasswork Function:**
```typescript
const renderClasswork = () => {
  const hasClasswork = classwork.length > 0;
  
  return (
    <Card 
      title="Classwork" 
      subtitle="Assignments, activities, and assessments for this class"
      action={isTeacher ? (
        <Button size="sm" icon={<Plus size={15} />} onClick={() => setClassworkFormOpen(true)}>
          Create Classwork
        </Button>
      ) : null}
    >
      {!hasClasswork ? (
        <p style={{ color: '#64748B', margin: 0 }}>
          {isTeacher ? 'Create your first classwork assignment' : 'No classwork available yet'}
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {classwork.map((item) => {
            const subject = typeof item.subject === 'object' ? item.subject : null;
            const isOverdue = new Date(item.dueDate) < new Date();
            
            return (
              <div
                key={item._id}
                onClick={() => navigate(`/classwork/${item._id}`)}
                style={{
                  border: '1px solid #E5E7EB',
                  borderRadius: 12,
                  padding: 16,
                  background: '#F8FAFC',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  ':hover': { background: '#F0F4F8' }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '0.72rem',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: '#7a1010',
                      fontWeight: 700
                    }}>
                      {item.type.toUpperCase()} • {subject?.name || 'Class'}
                    </div>
                    <h4 style={{ margin: '6px 0 4px', fontSize: '1rem', fontWeight: 700, color: 'var(--gray-900)' }}>
                      {item.title}
                    </h4>
                    <p style={{ margin: '4px 0', fontSize: '0.875rem', color: '#64748B', lineHeight: 1.5 }}>
                      {item.description}
                    </p>
                    <div style={{
                      marginTop: 8,
                      fontSize: '0.8rem',
                      color: isOverdue && item.status === 'published' ? '#7a1010' : '#64748B',
                      display: 'flex',
                      gap: 16,
                      alignItems: 'center',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CalendarDays size={13} /> Due {format(new Date(item.dueDate), 'MMM d, yyyy')}
                      </span>
                      <span>• {item.points} points</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    <Badge
                      label={item.status}
                      color={item.status === 'published' ? 'green' : item.status === 'closed' ? 'gray' : 'yellow'}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
```

#### 2. Create ClassworkFormModal.tsx
**Location:** `frontend/src/components/classwork/ClassworkFormModal.tsx`

```typescript
import { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { Button, Input, Modal, Select } from '../ui';
import { classworkApi } from '../../utils/api';
import toast from 'react-hot-toast';

interface ClassworkFormModalProps {
  open: boolean;
  onClose: () => void;
  classId: string;
  subjectId: string;
  onSuccess: () => void;
}

export default function ClassworkFormModal({ open, onClose, classId, subjectId, onSuccess }: ClassworkFormModalProps) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'assignment' as const,
    instructions: '',
    dueDate: '',
    dueTime: '23:59',
    points: 100,
    allowLateSubmission: false,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.dueDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      await classworkApi.create({
        classId,
        subjectId,
        ...form,
      });
      toast.success('Classwork created successfully');
      onSuccess();
      onClose();
      setForm({
        title: '',
        description: '',
        type: 'assignment',
        instructions: '',
        dueDate: '',
        dueTime: '23:59',
        points: 100,
        allowLateSubmission: false,
      });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create classwork');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Classwork"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={loading} onClick={handleSubmit}>Create</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 500 }}>
            Type *
          </label>
          <Select
            value={form.type}
            onChange={(type) => setForm({ ...form, type: type as any })}
            options={[
              { value: 'assignment', label: 'Assignment' },
              { value: 'activity', label: 'Activity' },
              { value: 'assessment', label: 'Assessment' },
            ]}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 500 }}>
            Title *
          </label>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Assignment title"
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 500 }}>
            Description *
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder="Describe the classwork..."
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1.5px solid #E5E7EB',
              borderRadius: 9,
              fontSize: '0.875rem',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 500 }}>
            Instructions
          </label>
          <textarea
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            rows={3}
            placeholder="Detailed instructions for students..."
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1.5px solid #E5E7EB',
              borderRadius: 9,
              fontSize: '0.875rem',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 500 }}>
              Due Date *
            </label>
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 500 }}>
              Due Time
            </label>
            <Input
              type="time"
              value={form.dueTime}
              onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 500 }}>
            Points
          </label>
          <Input
            type="number"
            value={form.points}
            onChange={(e) => setForm({ ...form, points: parseInt(e.target.value) })}
            min="0"
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.allowLateSubmission}
            onChange={(e) => setForm({ ...form, allowLateSubmission: e.target.checked })}
          />
          Allow late submissions
        </label>
      </div>
    </Modal>
  );
}
```

#### 3. Create ClassworkDetailPage.tsx
**Location:** `frontend/src/pages/shared/ClassworkDetailPage.tsx`

This should display:
- Full classwork details (title, description, instructions, due date, points)
- Teacher view: Show submissions, allow grading
- Student view: Show submission status, allow submitting work
- Use classworkApi endpoints to fetch and submit data

---

## Phase 2: Messaging System

### Key Components to Create:

1. **MessagesPage.tsx** - Main messaging hub
   - Left sidebar: Conversation list
   - Main area: Chat window
   - Displays conversations, allows creation of new ones

2. **ConversationList.tsx** - List of all conversations
   - Shows last message preview
   - Highlights unread conversations
   - Search functionality

3. **ChatWindow.tsx** - Message display area
   - Shows messages in chronological order
   - Displays message reactions and replies
   - Sender/receiver bubbles

4. **MessageInput.tsx** - Message composer
   - Text input with emoji picker
   - Attachment support
   - Send button

### Socket.IO Setup (When ready)
- Install socket.io-client in frontend
- Create hooks/useSocket.ts for WebSocket connection
- Implement real-time message delivery
- Handle typing indicators
- Implement seen/read status

---

## Phase 3: Stream Comments/Reactions

### Files to Modify:
- Update announcement display to show comment count and reaction count
- Add CommentSection.tsx component
- Add ReactionBar.tsx component

---

## Integration Checklist:

- [ ] Update ClassWorkspacePage with classwork display
- [ ] Create ClassworkFormModal component
- [ ] Create ClassworkDetailPage
- [ ] Create full Classwork submission form
- [ ] Create teacher grading interface
- [ ] Create MessagesPage and related components
- [ ] Add Messages route to App.tsx
- [ ] Update navigation to include Messages link
- [ ] Add Stream comments/reactions UI
- [ ] Set up Socket.IO for real-time messaging
- [ ] Test all flows end-to-end
- [ ] Test mobile responsiveness
- [ ] Test permissions and access control

---

## API Integration Summary

### Classwork APIs Ready ✅
```
POST /api/classwork - Create
GET /api/classwork - List
GET /api/classwork/:id - Get
PUT /api/classwork/:id - Update
DELETE /api/classwork/:id - Delete
PATCH /api/classwork/:id/publish - Publish
POST /api/classwork/:id/submit - Submit
GET /api/classwork/:id/submissions - View submissions
PATCH /api/classwork/submissions/:id/grade - Grade
```

### Messaging APIs Ready ✅
```
GET /api/messages - Get conversations
POST /api/messages/private - Create private
GET /api/messages/class/:classId - Get class chat
POST /api/messages/:conversationId/messages - Send
PUT /api/messages/:conversationId/messages/:messageId - Edit
DELETE /api/messages/:conversationId/messages/:messageId - Delete
POST /api/messages/:conversationId/messages/:messageId/reactions - React
```

### Stream Comment/Reaction APIs Ready ✅
```
GET /api/announcements/:announcementId/comments
POST /api/announcements/:announcementId/comments
PUT /api/comments/:commentId
DELETE /api/comments/:commentId
GET /api/announcements/:announcementId/reactions
POST /api/announcements/:announcementId/reactions
PATCH /api/announcements/:announcementId/reactions
```

---

## Next Immediate Steps:

1. **UPDATE ClassWorkspacePage.tsx** - Replace renderClasswork() function
2. Create **ClassworkFormModal.tsx** - For creating classwork
3. Create **ClassworkDetailPage.tsx** - For viewing/submitting classwork
4. Add **Messages page and components** - For messaging system
5. **Test backend APIs** - Verify all endpoints work correctly
6. **Hook everything together** - Ensure UI connects to APIs

---

## Technology Notes:
- Use existing UI components from /components/ui/
- Follow existing styling patterns
- Maintain responsive design for mobile
- Use react-hot-toast for notifications
- Use date-fns for date formatting
- Leverage Zustand for auth state

---

## Testing Strategy:
1. Test each component individually
2. Test teacher workflows (create classwork, grade submissions)
3. Test student workflows (view classwork, submit work)
4. Test messaging flows (create conversation, send messages)
5. Test permission enforcement
6. Test on mobile devices
7. Test with real MongoDB data
