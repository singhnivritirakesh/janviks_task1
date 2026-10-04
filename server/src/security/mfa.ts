import crypto from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';

// Configure authenticator: 30-second window, 6 digits, RFC 6238
authenticator.options = {
  window: 1, // Allow 1 step (30s) drift
  step: 30,
  digits: 6,
};

export interface MfaSetupData {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
  hashedBackupCodes: string[];
}

/**
 * Generates an MFA secret, QR code data URL, and 8 single-use backup codes.
 */
export async function generateMfaSetup(userEmail: string): Promise<MfaSetupData> {
  const secret = authenticator.generateSecret();
  const serviceName = 'PlaySphere Connect';
  const otpauthUrl = authenticator.keyuri(userEmail, serviceName, secret);

  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
    margin: 1,
    width: 240,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });

  // Generate 8 random backup codes (8 alphanumeric chars each)
  const backupCodes: string[] = [];
  const hashedBackupCodes: string[] = [];

  for (let i = 0; i < 8; i++) {
    const rawCode = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 hex chars
    backupCodes.push(rawCode);
    const hashed = await bcrypt.hash(rawCode, 10);
    hashedBackupCodes.push(hashed);
  }

  return {
    secret,
    otpauthUrl,
    qrCodeDataUrl,
    backupCodes,
    hashedBackupCodes,
  };
}

/**
 * Verifies a 6-digit TOTP token against the user's secret.
 */
export function verifyTotpToken(token: string, secret: string): boolean {
  if (!token || !secret) return false;
  return authenticator.verify({ token: token.trim(), secret });
}

/**
 * Verifies a single-use backup code against stored hashed codes.
 * Returns the index of the matched code, or -1 if invalid.
 */
export async function verifyAndConsumeBackupCode(
  providedCode: string,
  hashedCodes: string[]
): Promise<number> {
  const cleanCode = providedCode.trim().toUpperCase();
  for (let i = 0; i < hashedCodes.length; i++) {
    const match = await bcrypt.compare(cleanCode, hashedCodes[i]);
    if (match) {
      return i; // Index to remove
    }
  }
  return -1;
}
