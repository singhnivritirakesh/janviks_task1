import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';
import { JWTPayload, PreAuthJWTPayload, UserRole } from '../types/index.js';

let privateKey: string;
let publicKey: string;

/**
 * Initializes or generates RSA-2048 keypair for RS256 JWT authentication.
 */
export function initKeys(): { privateKey: string; publicKey: string } {
  const privPath = path.resolve(process.cwd(), env.JWT_PRIVATE_KEY_PATH);
  const pubPath = path.resolve(process.cwd(), env.JWT_PUBLIC_KEY_PATH);

  if (fs.existsSync(privPath) && fs.existsSync(pubPath)) {
    privateKey = fs.readFileSync(privPath, 'utf8');
    publicKey = fs.readFileSync(pubPath, 'utf8');
    return { privateKey, publicKey };
  }

  // Generate 2048-bit RSA key pair dynamically if not found
  console.log('🔑 Generating new RSA-2048 key pair for RS256 JWT...');
  const keyPair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  const privDir = path.dirname(privPath);
  if (!fs.existsSync(privDir)) {
    fs.mkdirSync(privDir, { recursive: true });
  }

  fs.writeFileSync(privPath, keyPair.privateKey, { mode: 0o600 });
  fs.writeFileSync(pubPath, keyPair.publicKey, { mode: 0o644 });

  privateKey = keyPair.privateKey;
  publicKey = keyPair.publicKey;

  return { privateKey, publicKey };
}

// Ensure keys are initialized
export function getKeys() {
  if (!privateKey || !publicKey) {
    initKeys();
  }
  return { privateKey, publicKey };
}

/**
 * Generates an RS256 access token with <= 15 minutes lifetime.
 */
export function generateAccessToken(user: { id: string; email: string; role: UserRole }): string {
  const { privateKey } = getKeys();
  const jti = uuidv4();
  const ttlSeconds = env.JWT_ACCESS_TOKEN_TTL_MINUTES * 60;

  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    sub: user.id,
    email: user.email,
    role: user.role,
    jti,
    iss: env.JWT_ISSUER,
    aud: env.JWT_AUDIENCE,
  };

  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: ttlSeconds,
  });
}

/**
 * Generates a short-lived Pre-Auth token (5 minutes) for MFA challenges.
 */
export function generatePreAuthToken(user: { id: string; email: string; role: UserRole }): string {
  const { privateKey } = getKeys();
  const jti = uuidv4();

  const payload: Omit<PreAuthJWTPayload, 'iat' | 'exp'> = {
    sub: user.id,
    email: user.email,
    role: user.role,
    pre_auth: true,
    jti,
    iss: env.JWT_ISSUER,
    aud: env.JWT_AUDIENCE,
  };

  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: 300, // 5 minutes
  });
}

/**
 * Verifies access token with strict RS256 enforcement.
 * Rejects 'none', HS256 algorithm confusion, and mismatched issuer/audience.
 */
export function verifyAccessToken(token: string): JWTPayload {
  const { publicKey } = getKeys();

  // Explicitly inspect algorithm in header before verification
  const decodedHeader = jwt.decode(token, { complete: true });
  if (!decodedHeader || typeof decodedHeader !== 'object' || decodedHeader.header.alg !== 'RS256') {
    throw new Error('Invalid token algorithm. Only RS256 is permitted.');
  }

  const decoded = jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  }) as JWTPayload;

  return decoded;
}

/**
 * Verifies pre-auth MFA token with strict RS256 enforcement.
 */
export function verifyPreAuthToken(token: string): PreAuthJWTPayload {
  const { publicKey } = getKeys();

  const decodedHeader = jwt.decode(token, { complete: true });
  if (!decodedHeader || typeof decodedHeader !== 'object' || decodedHeader.header.alg !== 'RS256') {
    throw new Error('Invalid token algorithm. Only RS256 is permitted.');
  }

  const decoded = jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  }) as PreAuthJWTPayload;

  if (!decoded.pre_auth) {
    throw new Error('Token is not a valid pre-auth token');
  }

  return decoded;
}

/**
 * Generates standard JWKS (JSON Web Key Set) representation of the public key.
 */
export function getJwks(): { keys: Array<Record<string, unknown>> } {
  const { publicKey } = getKeys();
  const keyObj = crypto.createPublicKey(publicKey);
  const jwk = keyObj.export({ format: 'jwk' });

  return {
    keys: [
      {
        ...jwk,
        kid: 'playsphere-rs256-key-1',
        use: 'sig',
        alg: 'RS256',
      },
    ],
  };
}
