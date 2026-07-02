export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim().replace(/[^a-z0-9@._+-]/g, '');
}
