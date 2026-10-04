import { initKeys } from '../src/security/jwt.js';

console.log('🔐 Generating RSA-2048 Asymmetric Key Pair for RS256 JWT Authentication...');
const { publicKey } = initKeys();

console.log('✅ Key pair ready:');
console.log('   - Private Key: server/keys/jwt_private.pem (chmod 600)');
console.log('   - Public Key:  server/keys/jwt_public.pem');
console.log('\nPublic Key Content Preview:');
console.log(publicKey.split('\n').slice(0, 3).join('\n') + '\n...');
