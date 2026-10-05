import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(__dirname, '..', 'evidence');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  console.log('📸 Capturing evidence screenshots...\n');

  // 1. Login Page (Sign In tab)
  console.log('1/5: Login page...');
  await page.goto('http://localhost:8080/login', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(evidenceDir, '06-mfa', 'login-page.png'), fullPage: true });
  console.log('   ✅ Saved: evidence/06-mfa/login-page.png');

  // 2. Register tab with password checklist (partial)
  console.log('2/5: Registration form with NIST checklist...');
  await page.click('button:has-text("Register")');
  await page.waitForTimeout(500);
  await page.fill('#reg-name', 'Security Test User');
  await page.fill('#reg-email', 'evidence-test@playsphere.local');
  await page.fill('#reg-password', 'Short1');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(evidenceDir, '03-brute-force', 'registration-checklist-partial.png'), fullPage: true });
  console.log('   ✅ Saved: evidence/03-brute-force/registration-checklist-partial.png');

  // 3. Register tab - all checklist items green
  console.log('3/5: Registration form with all checks passed...');
  await page.fill('#reg-password', 'SecurePassword2026!');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(evidenceDir, '03-brute-force', 'registration-checklist-complete.png'), fullPage: true });
  console.log('   ✅ Saved: evidence/03-brute-force/registration-checklist-complete.png');

  // 4. Successful registration
  console.log('4/5: Successful registration...');
  const uniqueEmail = `evidence-${Date.now()}@playsphere.local`;
  await page.fill('#reg-email', uniqueEmail);
  await page.fill('#reg-password', 'SecurePassword2026!');
  await page.click('button:has-text("Create Account")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(evidenceDir, '03-brute-force', 'registration-success.png'), fullPage: true });
  console.log('   ✅ Saved: evidence/03-brute-force/registration-success.png');

  // 5. Login and then attempt invalid credentials to show error
  console.log('5/5: Failed login error message...');
  await page.click('button:has-text("Sign In")');
  await page.waitForTimeout(500);
  await page.fill('#login-email', 'attacker@evil.com');
  await page.fill('#login-password', 'wrongpassword');
  await page.click('button:has-text("Sign In")');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(evidenceDir, '03-brute-force', 'login-error.png'), fullPage: true });
  console.log('   ✅ Saved: evidence/03-brute-force/login-error.png');

  await browser.close();
  console.log('\n✅ All 5 evidence screenshots captured successfully!');
}

main().catch((err) => {
  console.error('❌ Screenshot capture failed:', err.message);
  process.exit(1);
});
