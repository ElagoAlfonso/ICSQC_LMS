export const MAX_ATTACHMENT_COUNT = 10;
export const MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024;

export const SUPPORTED_ATTACHMENT_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.ppt', '.xls', '.xlsx', '.pptx',
  '.txt', '.md', '.json', '.xml', '.rtf', '.log', '.ini', '.cfg', '.csv',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp',
  '.mp3', '.wav', '.mp4', '.mov', '.zip', '.rar', '.7z',
];

export const SUPPORTED_ATTACHMENT_ACCEPT = SUPPORTED_ATTACHMENT_EXTENSIONS.join(',');