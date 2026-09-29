export const isIcsqcEmail = (value: string): boolean =>
  value.trim().toLowerCase() === 'rafaelelago23@gmail.com' ||
  /^[a-z0-9]+(?:-[a-z0-9]+)*\.icsqc@gmail\.com$/i.test(value.trim());

export const isStrongPassword = (value: string): boolean =>
  value.length >= 8 &&
  /[A-Z]/.test(value) &&
  /[a-z]/.test(value) &&
  /\d/.test(value) &&
  /[^A-Za-z0-9]/.test(value);

export const passwordRequirements = [
  "At least 8 characters",
  "One uppercase letter",
  "One lowercase letter",
  "One number",
  "One special character",
];
