export const normalizeEmail = (email: unknown): string =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

export const isIcsqcEmail = (email: string): boolean =>
  email.trim().toLowerCase() === "rafaelelago23@gmail.com" ||
  /^[a-z0-9]+(?:-[a-z0-9]+)*\.icsqc@gmail\.com$/i.test(email);

export const passwordRequirementsMessage =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.";

export const isStrongPassword = (password: unknown): password is string =>
  typeof password === "string" &&
  password.length >= 8 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password);
