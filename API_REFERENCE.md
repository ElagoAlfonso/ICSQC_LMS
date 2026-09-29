# Complete API Endpoint Reference

## Backend Status: ✅ FULLY IMPLEMENTED & TESTED

All endpoints are ready to use. Base URL: `http://localhost:5000/api`

---

## 📚 CLASSWORK ENDPOINTS (11 endpoints)

### Create Classwork
```
POST /classwork
Auth: Required (Teacher/Admin)
Body: {
  classId: string,
  subjectId: string,
  title: string,
  description: string,
  type: 'assignment' | 'activity' | 'assessment',
  dueDate: date,
  dueTime?: string,
  points: number,
  instructions?: string,
  attachments?: [],
  allowLateSubmission?: boolean
}
Response: { message: string, classwork: Classwork }
```

### List Classwork
```
GET /classwork?classId=...&status=...&type=...
Auth: Required
Response: { message: string, classwork: Classwork[] }
```

### Get Classwork Details
```
GET /classwork/:classworkId
Auth: Required
Response: { message: string, classwork: Classwork }
```

### Update Classwork
```
PUT /classwork/:classworkId
Auth: Required (Owner)
Response: { message: string, classwork: Classwork }
```

### Delete Classwork
```
DELETE /classwork/:classworkId
Auth: Required (Owner)
Response: { message: string }
```

### Publish/Schedule Classwork
```
PATCH /classwork/:classworkId/publish
Auth: Required (Owner)
Body: {
  scheduleDate?: date,
  scheduleTime?: string
}
Response: { message: string, classwork: Classwork }
```

### Close Classwork (Stop Submissions)
```
PATCH /classwork/:classworkId/close
Auth: Required (Owner)
Response: { message: string, classwork: Classwork }
```

### Submit Classwork
```
POST /classwork/:classworkId/submit
Auth: Required (Student)
Body: {
  submittedNotes?: string,
  attachments?: [],
  isRevision?: boolean
}
Response: { message: string, submission: ClassworkSubmission }
```

### View Submissions
```
GET /classwork/:classworkId/submissions?status=...
Auth: Required (Teacher/Admin)
Response: { message: string, submissions: ClassworkSubmission[] }
```

### Get My Submissions
```
GET /classwork/submissions/mine?classId=...
Auth: Required (Student)
Response: { message: string, submissions: ClassworkSubmission[] }
```

### Grade Submission
```
PATCH /classwork/submissions/:submissionId/grade
Auth: Required (Teacher/Admin)
Body: {
  score: number,
  feedback?: string
}
Response: { message: string, submission: ClassworkSubmission }
```

---

## 💬 MESSAGING ENDPOINTS (10 endpoints)

### Get Conversations
```
GET /messages?search=...&type=...
Auth: Required
Response: { message: string, conversations: Conversation[] }
```

### Create Private Conversation
```
POST /messages/private
Auth: Required
Body: {
  participantId: string,
  type: 'private_teacher_student' | 'private_student_student'
}
Response: { message: string, conversation: Conversation }
```

### Get Class Group Chat
```
GET /messages/class/:classId
Auth: Required
Response: { message: string, conversation: Conversation }
```

### Get Messages in Conversation
```
GET /messages/:conversationId/messages?limit=50&offset=0
Auth: Required
Response: { message: string, messages: Message[] }
```

### Send Message
```
POST /messages/:conversationId/messages
Auth: Required
Body: {
  text: string,
  attachments?: [],
  replyToMessageId?: string
}
Response: { message: string, message: Message }
```

### Edit Message
```
PUT /messages/:conversationId/messages/:messageId
Auth: Required (Sender)
Body: { text: string }
Response: { message: string, message: Message }
```

### Delete Message
```
DELETE /messages/:conversationId/messages/:messageId
Auth: Required (Sender or Teacher)
Response: { message: string }
```

### Add Reaction to Message
```
POST /messages/:conversationId/messages/:messageId/reactions
Auth: Required
Body: { emoji: string }
Response: { message: string, reactions: MessageReaction[] }
```

### Remove Reaction from Message
```
DELETE /messages/:conversationId/messages/:messageId/reactions
Auth: Required
Body: { emoji: string }
Response: { message: string }
```

### Toggle Announcement-Only Mode
```
PATCH /messages/:conversationId/announcement-only
Auth: Required (Teacher)
Response: { message: string, conversation: Conversation }
```

---

## 💬 STREAM COMMENT ENDPOINTS (4 endpoints)

### Get Comments on Announcement
```
GET /announcements/:announcementId/comments?replyTo=...
Auth: Required
Response: { message: string, comments: Comment[] }
```

### Create Comment
```
POST /announcements/:announcementId/comments
Auth: Required
Body: {
  text: string,
  replyToCommentId?: string
}
Response: { message: string, comment: Comment }
```

### Update Comment
```
PUT /comments/:commentId
Auth: Required (Author)
Body: { text: string }
Response: { message: string, comment: Comment }
```

### Delete Comment
```
DELETE /comments/:commentId
Auth: Required (Author or Teacher)
Response: { message: string }
```

---

## ⭐ ANNOUNCEMENT REACTION ENDPOINTS (4 endpoints)

### Get Reactions on Announcement
```
GET /announcements/:announcementId/reactions
Auth: Required
Response: { message: string, reactions: { [emoji]: User[] } }
```

### Add Reaction
```
POST /announcements/:announcementId/reactions
Auth: Required
Body: { emoji: '👍' | '❤️' | '🎉' | '👏' | '💯' | '🙏' | '😮' | '😂' }
Response: { message: string, reaction: Reaction }
```

### Remove Reaction
```
DELETE /announcements/:announcementId/reactions
Auth: Required
Body: { emoji: string }
Response: { message: string }
```

### Change Reaction
```
PATCH /announcements/:announcementId/reactions
Auth: Required
Body: {
  oldEmoji: string,
  newEmoji: string
}
Response: { message: string, reaction: Reaction }
```

---

## 🔐 Authentication

All endpoints require the `protect` middleware which:
1. Verifies JWT token in cookies
2. Extracts user information
3. Attaches user to request context

Request headers automatically include authentication via axios interceptor.

---

## 📊 Status Codes

- **201**: Created successfully
- **200**: Success
- **400**: Bad request (validation error)
- **403**: Forbidden (permission denied)
- **404**: Not found
- **500**: Server error

---

## 🧪 Example Usage (Frontend)

```typescript
// Create Classwork
const response = await classworkApi.create({
  classId: 'class123',
  subjectId: 'subject456',
  title: 'Assignment 1',
  description: 'First assignment',
  type: 'assignment',
  dueDate: '2024-09-20',
  points: 100,
});
const classwork = response.data.classwork;

// Submit Classwork
const submission = await classworkApi.submit(classworkId, {
  submittedNotes: 'Here is my work',
  attachments: [],
});

// Send Message
const message = await messagesApi.sendMessage(conversationId, {
  text: 'Hello everyone!',
  attachments: [],
});

// Add Reaction to Message
await messagesApi.addReaction(conversationId, messageId, {
  emoji: '👍',
});

// Create Comment on Announcement
const comment = await announcementCommentsApi.createComment(announcementId, {
  text: 'Great announcement!',
});

// Add Reaction to Announcement
await announcementCommentsApi.addReaction(announcementId, {
  emoji: '🎉',
});
```

---

## 🔄 Data Flow Examples

### Classwork Submission Flow
```
1. Teacher creates classwork → status: 'draft'
2. Teacher publishes → status: 'published'
3. Notifications sent to students
4. Student submits work
5. Teacher grades submission
6. Student sees grade/feedback
7. Notification sent to student
```

### Messaging Flow
```
1. User creates/opens conversation
2. User sends message
3. Message stored in DB
4. (Future: Socket.IO broadcasts to recipients)
5. Recipients see message
6. User can react/reply/edit/delete
```

### Comment Flow
```
1. Student creates comment on announcement
2. Comment posted
3. Author of announcement notified
4. Other students see comment
5. Students can reply (threaded)
6. Teacher can delete inappropriate comments
```

---

## 🚀 Ready for Production

- All endpoints tested ✅
- Error handling implemented ✅
- Authentication enforced ✅
- MongoDB integration working ✅
- Type safety with TypeScript ✅
- Comprehensive logging ✅
- Activity tracking ✅
- Notifications integrated ✅
