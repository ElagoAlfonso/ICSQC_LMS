import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
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
  update: (id: string, data: any) => api.put(`/classes/${id}`, data),
  delete: (id: string) => api.delete(`/classes/${id}`),
  addStudent: (id: string, studentId: string) =>
    api.post(`/classes/${id}/students`, { studentId }),
};

// ── Subjects ─────────────────────────────────────────────────────────────────
export const subjectsApi = {
  getAll: (params?: any) => api.get('/subjects', { params }),
  getById: (id: string) => api.get(`/subjects/${id}`),
  create: (data: any) => api.post('/subjects', data),
  update: (id: string, data: any) => api.put(`/subjects/${id}`, data),
  delete: (id: string) => api.delete(`/subjects/${id}`),
};

// ── Exams ─────────────────────────────────────────────────────────────────────
export const examsApi = {
  getAll: (params?: any) => api.get('/exams', { params }),
  getById: (id: string) => api.get(`/exams/${id}`),
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
  submit: (examId: string, answers: any[]) =>
    api.post('/submissions', { examId, answers }),
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
};

// ── Timetable ─────────────────────────────────────────────────────────────────
export const timetableApi = {
  getByClass: (classId: string) => api.get(`/timetable/${classId}`),
  create: (data: any) => api.post('/timetable', data),
  update: (id: string, data: any) => api.put(`/timetable/${id}`, data),
};

export default api;

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsApi = {
  get: (period?: 'month' | 'quarter' | 'year') =>
    api.get('/analytics', { params: period ? { period } : {} }),
};
