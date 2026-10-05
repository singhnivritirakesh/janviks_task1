import bcrypt from 'bcryptjs';

const BCRYPT_SALT_ROUNDS = 12;

// Common breached and dictionary passwords to reject (NIST 800-63B)
const COMMON_PASSWORDS = new Set([
  'password1234',
  'password12345',
  '123456789012',
  'admin1234567',
  'administrator',
  'changeme1234',
  'letmein12345',
  'welcome12345',
  'qwertyuiop12',
  'football1234',
  'basketball12',
  'playsphere123'
]);

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('Password is too common or easily guessable');
  }

  if (!/[a-zA-Z]/.test(password)) {
    errors.push('Password must contain at least one letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
