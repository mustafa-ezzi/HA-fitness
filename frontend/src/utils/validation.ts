export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatCnic(value: string): string {
  const digits = digitsOnly(value).slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

export function validateContact(value: string): string | null {
  const length = digitsOnly(value).length;
  return length >= 10 && length <= 15 ? null : 'Contact must contain 10 to 15 digits';
}

export function validateCnic(value: string): string | null {
  return digitsOnly(value).length === 13 ? null : 'CNIC must contain exactly 13 digits';
}
