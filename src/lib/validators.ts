const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim()) && email.trim().length <= 254;
}

export function validateEmailRecipients(
  recipients: string | string[]
): { valid: boolean; invalid: string[] } {
  const emails = Array.isArray(recipients) ? recipients : [recipients];
  const invalid = emails.filter((e) => !isValidEmail(e));
  return { valid: invalid.length === 0, invalid };
}
