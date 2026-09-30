import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/users/login', { email, password }),
  logout: () => api.post('/users/logout'),
  getProfile: () => api.get('/users/profile'),
  register: (data: any) => api.post('/users/register', data),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  verifyResetToken: (token: string) => api.get(`/auth/reset-password/${encodeURIComponent(token)}`),
  resetPassword: (token: string, password: string, confirmPassword: string) => api.post(`/auth/reset-password/${encodeURIComponent(token)}`, { password, confirmPassword }),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  getAll: (params?: any) => api.get('/users', { params }),
  create: (data: any) => api.post('/users/create-user', data),
  update: (id: string, data: any) => api.put(`/users/update/${id}`, data),
  delete: (id: string) => api.delete(`/users/delete/${id}`),
};

// ── Academic Years ────────────────────────────────────────────────────────────
export const academicYearsApi = {
  getAll: () => api.get('/academicYear'),
  create: (data: any) => api.post('/academicYear', data),
  update: (id: string, data: any) => api.put(`/academicYear/${id}`, data),
  delete: (id: string) => api.delete(`/academicYear/${id}`),
  setCurrent: (id: string) => api.patch(`/academicYear/${id}/current`),
};

// ── Classes ───────────────────────────────────────────────────────────────────
export const classesApi = {
  getAll: (params?: any) => api.get('/classes', { params }),
  getById: (id: string) => api.get(`/classes/${id}`),
  create: (data: any) => api.post('/classes', data),
  requestClass: (data: any) => api.post('/classes/request', data),
  getRequests: () => api.get('/classes/requests'),
  approveRequest: (id: string) => api.patch(`/classes/requests/${id}/approve`),
  rejectRequest: (id: string, reason?: string) => api.patch(`/classes/requests/${id}/reject`, { reason }),
  joinByCode: (code: string) => api.post('/classes/join', { code }),
  update: (id: string, data: any) => api.put(`/classes/${id}`, data),
  delete: (id: string) => api.delete(`/classes/${id}`),
  addStudent: (id: string, studentId: string) =>
    api.post(`/classes/${id}/students`, { studentId }),
  removeStudent: (id: string, studentId: string) =>
    api.delete(`/classes/${id}/students/${studentId}`),
  addCoTeacher: (id: string, teacherId: string) =>
    api.post(`/classes/${id}/co-teachers`, { teacherId }),
  removeCoTeacher: (id: string, teacherId: string) =>
    api.delete(`/classes/${id}/co-teachers/${teacherId}`),
};

// ── Subjects ─────────────────────────────────────────────────────────────────
export const subjectsApi = {
  getAll: (params?: any) => api.get('/subjects', { params }),
  getById: (id: string) => api.get(`/subjects/${id}`),
  create: (data: any) => api.post('/subjects', data),
  update: (id: string, data: any) => api.put(`/subjects/${id}`, data),
  delete: (id: string) => api.delete(`/subjects/${id}`),
  getWorkspace: (id: string) => api.get(`/subjects/${id}/workspace`),
  createPost: (id: string, data: FormData) => api.post(`/subjects/${id}/posts`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// ── Exams ─────────────────────────────────────────────────────────────────────
export const examsApi = {
  getAll: (params?: any) => api.get('/exams', { params }),
  getById: (id: string) => api.get(`/exams/${id}`),
  start: (id: string) => api.post(`/exams/${id}/start`),
  create: (data: any) => api.post('/exams', data),
  update: (id: string, data: any) => api.put(`/exams/${id}`, data),
  delete: (id: string) => api.delete(`/exams/${id}`),
  publish: (id: string) => api.patch(`/exams/${id}/publish`),
  close: (id: string) => api.patch(`/exams/${id}/close`),
};

// ── Submissions ───────────────────────────────────────────────────────────────
export const submissionsApi = {
  getAll: (params?: any) => api.get('/submissions', { params }),
  getById: (id: string) => api.get(`/submissions/${id}`),
  submit: (examId: string, attemptId: string, answers: any[], timeSpent?: number) =>
    api.post('/submissions', { examId, attemptId, answers, timeSpent }),
  grade: (id: string, data: any) => api.patch(`/submissions/${id}/grade`, data),
  getMySubmissions: () => api.get('/submissions/mine'),
};

// ── Activity Logs ─────────────────────────────────────────────────────────────
export const logsApi = {
  getAll: (params?: any) => api.get('/activitieslog', { params }),
};

// ── Announcements ─────────────────────────────────────────────────────────────
export const announcementsApi = {
  getAll: (params?: any) => api.get('/announcements', { params }),
  create: (data: any) => api.post('/announcements', data),
  update: (id: string, data: any) => api.put(`/announcements/${id}`, data),
  delete: (id: string) => api.delete(`/announcements/${id}`),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
};

// ── Report Cards ──────────────────────────────────────────────────────────────
export const reportCardsApi = {
  generate: (data: any) => api.post('/reportcards/generate', data),
  getByStudent: (studentId: string, academicYearId?: string) =>
    api.get(`/reportcards/student/${studentId}`, { params: { academicYearId } }),
  getAll: (params?: any) => api.get('/reportcards', { params }),
  getRequests: () => api.get('/reportcards/requests'),
  request: (data: any) => api.post('/reportcards/requests', data),
  sendRequest: (id: string, reportCardId?: string) => api.patch(`/reportcards/requests/${id}/send`, { reportCardId }),
};

// ── Timetable ─────────────────────────────────────────────────────────────────
export const timetableApi = {
  getByClass: (classId: string) => api.get(`/timetable/${classId}`),
  create: (data: any) => api.post('/timetable', data),
  update: (id: string, data: any) => api.put(`/timetable/${id}`, data),
};

// ── AI Assistant ───────────────────────────────────────────────────────────────
export const aiApi = {
  getAccess: () => api.get('/ai/access'),
  chat: (message: string, conversationHistory?: any[]) =>
    api.post('/ai/chat', { message, conversationHistory }),
};

export default api;

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsApi = {
  get: (period?: 'month' | 'quarter' | 'year') =>
    api.get('/analytics', { params: period ? { period } : {} }),
};

// ── Notifications ──────────────────────────────────────────────────────────
export const notificationsApi = {
  getAll: () => api.get('/notifications'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

// ── Google Meet ─────────────────────────────────────────────────────────────
export const googleApi = {
  getStatus: () => api.get('/google/status'),
  connectCalendar: () => { window.location.assign(`${apiBaseUrl}/google/auth`); },
};

export const meetingsApi = {
  createClassMeet: (classId: string) => api.post(`/classes/${classId}/meet`),
  getClassMeet: (classId: string) => api.get(`/classes/${classId}/meet`),
  endClassMeet: (classId: string) => api.delete(`/classes/${classId}/meet`),
  createForClass: (classId: string, data: any) => api.post(`/classes/${classId}/meetings`, data),
  getForClass: (classId: string) => api.get(`/classes/${classId}/meetings`),
  updateForClass: (classId: string, meetingId: string, data: any) => api.put(`/classes/${classId}/meetings/${meetingId}`, data),
  cancelForClass: (classId: string, meetingId: string) => api.delete(`/classes/${classId}/meetings/${meetingId}`),
  create: (data: any) => api.post('/meetings/create', data),
  update: (id: string, data: any) => api.put(`/meetings/${id}`, data),
  delete: (id: string) => api.delete(`/meetings/${id}`),
  getTeacher: () => api.get('/meetings/teacher'),
  getStudent: () => api.get('/meetings/student'),
  getById: (id: string) => api.get(`/meetings/${id}`),
  getAdmin: (params?: any) => api.get('/admin/meetings', { params }),
};

// ── Classwork ─────────────────────────────────────────────────────────────────
export const classworkApi = {
  create: (data: FormData) => api.post('/classwork', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getAll: (params?: any) => api.get('/classwork', { params }),
  getById: (id: string) => api.get(`/classwork/${id}`),
  update: (id: string, data: any) => api.put(`/classwork/${id}`, data),
  delete: (id: string) => api.delete(`/classwork/${id}`),
  publish: (id: string, data: any = {}) => api.patch(`/classwork/${id}/publish`, data),
  close: (id: string) => api.patch(`/classwork/${id}/close`),
  submit: (id: string, data: FormData) => api.post(`/classwork/${id}/submit`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getSubmissions: (id: string) => api.get(`/classwork/${id}/submissions`),
  getGrades: (id: string) => api.get(`/classwork/${id}/grades`),
  getMyGrades: () => api.get('/classwork/grades/mine'),
  saveGrade: (classworkId: string, studentId: string, data: any) => api.put(`/classwork/${classworkId}/grades/${studentId}`, data),
  getMySubmissions: () => api.get('/classwork/submissions/mine'),
  gradeSubmission: (submissionId: string, data: any) => api.patch(`/classwork/submissions/${submissionId}/grade`, data),
  submissionAttachmentUrl: (submissionId: string, attachmentId: string) => `${apiBaseUrl}/classwork/submissions/${submissionId}/attachments/${attachmentId}?download=1`,
  attachmentUrl: (classworkId: string, attachmentId: string) => `${apiBaseUrl}/classwork/${classworkId}/attachments/${attachmentId}?download=1`,
};

export const rubricsApi = {
  getAll: () => api.get('/rubrics'),
  create: (data: { name: string; criteria: Array<{ title: string; description: string; maxPoints: number }> }) => api.post('/rubrics', data),
};

// ── Messages ──────────────────────────────────────────────────────────────────
export const messagesApi = {
  getConversations: (params?: any) => api.get('/messages', { params }),
  createPrivate: (data: any) => api.post('/messages/private', data),
  getClassChat: (classId: string) => api.get(`/messages/class/${classId}`),
  getMessages: (conversationId: string, params?: any) => api.get(`/messages/${conversationId}/messages`, { params }),
  sendMessage: (conversationId: string, data: any) => api.post(`/messages/${conversationId}/messages`, data),
  editMessage: (conversationId: string, messageId: string, data: any) => api.put(`/messages/${conversationId}/messages/${messageId}`, data),
  deleteMessage: (conversationId: string, messageId: string) => api.delete(`/messages/${conversationId}/messages/${messageId}`),
  addReaction: (conversationId: string, messageId: string, data: any) => api.post(`/messages/${conversationId}/messages/${messageId}/reactions`, data),
  removeReaction: (conversationId: string, messageId: string, data: any) => api.delete(`/messages/${conversationId}/messages/${messageId}/reactions`, { data }),
  toggleAnnouncementOnly: (conversationId: string) => api.patch(`/messages/${conversationId}/announcement-only`),
  updateGroupSettings: (conversationId: string, data: FormData) => api.patch(`/messages/${conversationId}/settings`, data, { headers: { 'Content-Type': undefined } }),
  getGroupPhotoUrl: (conversationId: string) => `${apiBaseUrl}/messages/${conversationId}/icon`,
  addGroupMember: (conversationId: string, userId: string) => api.post(`/messages/${conversationId}/members`, { userId }),
  removeGroupMember: (conversationId: string, userId: string) => api.delete(`/messages/${conversationId}/members`, { data: { userId } }),
  leaveGroup: (conversationId: string) => api.post(`/messages/${conversationId}/leave`),
};

// ── Comments & Reactions on Announcements ─────────────────────────────────────
export const announcementCommentsApi = {
  getComments: (announcementId: string, params?: any) => api.get(`/announcements/${announcementId}/comments`, { params }),
  createComment: (announcementId: string, data: any) => api.post(`/announcements/${announcementId}/comments`, data),
  updateComment: (commentId: string, data: any) => api.put(`/comments/${commentId}`, data),
  deleteComment: (commentId: string) => api.delete(`/comments/${commentId}`),
  getReactions: (announcementId: string) => api.get(`/announcements/${announcementId}/reactions`),
  addReaction: (announcementId: string, data: any) => api.post(`/announcements/${announcementId}/reactions`, data),
  removeReaction: (announcementId: string, data: any) => api.delete(`/announcements/${announcementId}/reactions`, { data }),
  changeReaction: (announcementId: string, data: any) => api.patch(`/announcements/${announcementId}/reactions`, data),
};
