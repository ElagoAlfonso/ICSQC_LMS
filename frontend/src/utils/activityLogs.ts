import type { ActivityLog, User } from '../types';

export type ActivityColor = 'red' | 'green' | 'blue' | 'yellow' | 'gray';

export const ACTIVITY_COLOR_MAP: Record<ActivityColor, { bg: string; text: string }> = {
  green: { bg: '#D1FAE5', text: '#059669' },
  blue: { bg: '#DBEAFE', text: '#2563EB' },
  red: { bg: '#FEE2E2', text: '#DC2626' },
  yellow: { bg: '#FEF3C7', text: '#D97706' },
  gray: { bg: '#F3F4F6', text: '#6B7280' },
};

export const ACTIVITY_AVATAR_COLORS = ['#7a1010', '#2563EB', '#059669', '#7C3AED', '#D97706'];

const ACTION_COLORS: Record<string, ActivityColor> = {
  CREATE: 'green', UPDATE: 'blue', DELETE: 'red',
  LOGIN: 'gray', REGISTER: 'green', LOGOUT: 'gray',
  REPORT: 'blue', MESSAGE: 'green', ANNOUNCEMENT: 'yellow', EXAM: 'blue',
};

const HUMAN_ACTIONS: Record<string, string> = {
  CREATE_EXAM: 'Created an exam',
  UPDATE_EXAM: 'Updated an exam',
  DELETE_EXAM: 'Deleted an exam',
  PUBLISH_EXAM: 'Published an exam',
  SUBMIT_EXAM: 'Submitted an exam',
  CREATE_ANNOUNCEMENT: 'Created an announcement',
  PUBLISH_ANNOUNCEMENT: 'Published an announcement',
  UPDATE_ANNOUNCEMENT: 'Updated an announcement',
  DELETE_ANNOUNCEMENT: 'Deleted an announcement',
  REQUEST_REPORT_CARD: 'Requested a report card',
  GENERATE_REPORT_CARD: 'Generated a report card',
  SEND_REPORT_CARD: 'Sent a report card',
  VIEW_REPORT_CARD: 'Viewed a report card',
  LOGIN: 'Logged in',
  LOGOUT: 'Logged out',
  REGISTER: 'Registered a user',
  START_PRIVATE_CONVERSATION: 'Started a private conversation',
  SENT_MESSAGE: 'Sent a message',
  MESSAGE_SENT: 'Sent a message',
  REACTION_ANNOUNCEMENT: 'Reacted to an announcement',
  TOGGLED_ANNOUNCEMENT_ONLY_MODE: 'Changed announcement settings',
  TOGGLED_ANNOUNCEMENT_ONLY: 'Changed announcement settings',
};

export const getActionColor = (action: string): ActivityColor => {
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (action.toUpperCase().includes(key)) return color;
  }
  return 'gray';
};

export const formatLogAction = (action: string) => {
  if (!action) return 'System activity';
  const normalized = action.replace(/[-\s]+/g, '_').toUpperCase();
  if (HUMAN_ACTIONS[normalized]) return HUMAN_ACTIONS[normalized];

  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bcreate\b/i, 'Created')
    .replace(/\bupdate\b/i, 'Updated')
    .replace(/\bdelete\b/i, 'Deleted')
    .replace(/\bpublish\b/i, 'Published')
    .replace(/\brequest\b/i, 'Requested')
    .replace(/\bgenerate\b/i, 'Generated')
    .replace(/\bsend\b/i, 'Sent')
    .replace(/\bview\b/i, 'Viewed')
    .replace(/\bmessage\b/i, 'Message')
    .replace(/\bannouncement\b/i, 'Announcement');
};

export const cosmetifyDetails = (details?: string) => {
  if (!details) return 'Completed an action.';
  const raw = String(details).trim();
  if (!raw) return 'Completed an action.';
  if (raw.includes('conversationId') || raw.includes('messageId') || raw.includes('announcementId') || raw.includes('{')) {
    const text = raw.replace(/[\{\}"\[\]]/g, '').replace(/:/g, ' ');
    if (text.includes('private')) return 'Sent a message in a private conversation.';
    if (text.includes('announcement')) return 'Reacted to an announcement.';
    return 'Completed this action.';
  }
  if (/^Created: /i.test(raw)) return raw.replace(/^Created:\s*/i, 'Created an announcement: ');
  if (/^Updated: /i.test(raw)) return raw.replace(/^Updated:\s*/i, 'Updated an announcement: ');
  if (/^Deleted: /i.test(raw)) return raw.replace(/^Deleted:\s*/i, 'Deleted an announcement: ');
  if (/^Published: /i.test(raw)) return raw.replace(/^Published:\s*/i, 'Published an announcement: ');
  if (/^Sent a message/i.test(raw)) return raw;
  if (/^Started private/i.test(raw)) return raw.replace(/^Started private/i, 'Started a private');
  if (/^Requested a report card|^Requested report card/i.test(raw)) return raw.replace(/^Requested\s+/i, 'Requested ');
  if (/^Generated a report card|^Generated report card/i.test(raw)) return raw.replace(/^Generated\s+/i, 'Generated ');
  if (/^Sent a report card|^Sent report card/i.test(raw)) return raw.replace(/^Sent\s+/i, 'Sent ');
  return raw;
};

export const getLogUserName = (log: Pick<ActivityLog, 'user'>) => {
  if (!log.user) return 'System';
  if (typeof log.user === 'object') return (log.user as User).name || (log.user as User).email || 'Unknown';
  return String(log.user);
};

export const getLogUserInitial = (log: Pick<ActivityLog, 'user'>) => getLogUserName(log).charAt(0).toUpperCase();
