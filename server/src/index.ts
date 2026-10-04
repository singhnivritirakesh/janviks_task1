import { createApp } from './app.js';
import { env } from './config/env.js';
import { runMigrations } from './db/migrations.js';
import { initKeys } from './security/jwt.js';
import { initAuditHashChain } from './logging/audit.js';

async function bootstrap() {
  console.log('🚀 Starting PlaySphere Hardened Security API...');

  // 1. Initialize RSA-2048 Cryptographic Keys
  initKeys();

  // 2. Run Database Migrations
  await runMigrations();

  // 3. Initialize Audit Log Hash Chain
  await initAuditHashChain();

  // 4. Create and start Express server
  const app = createApp();

  const server = app.listen(env.PORT, env.HOST, () => {
    console.log(`🛡️ PlaySphere API Server running securely at http://${env.HOST}:${env.PORT}`);
    console.log(`🔐 RS256 JWKS available at http://${env.HOST}:${env.PORT}/.well-known/jwks.json`);
  });

  const shutdown = () => {
    console.log('\n🛑 Graceful shutdown initiated...');
    server.close(() => {
      console.log('🔒 HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
