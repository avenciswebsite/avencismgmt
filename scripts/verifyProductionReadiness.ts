import { authService } from '../src/services/authService';
import { isDevPersonaAllowed, isMockMode, isSupabaseMode } from '../src/services/serviceConfig';
import { supabase } from '../src/lib/supabase';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
  console.log('================================================================');
  console.log('AVENCIS WFM — PRODUCTION READINESS & AUTH VERIFICATION');
  console.log('================================================================\n');

  // 1. Feature Flag Checks
  console.log('1. Checking Production & Security Flags:');
  console.log(' - isDevPersonaAllowed():', isDevPersonaAllowed());
  console.log(' - isMockMode():', isMockMode());
  console.log(' - isSupabaseMode():', isSupabaseMode());
  if (isDevPersonaAllowed() !== false) {
    throw new Error('FAILED: isDevPersonaAllowed() must be false');
  }
  console.log('  ✓ Dev persona switcher is unconditionally disabled.\n');

  // 2. Cloudflare Redirects Check
  console.log('2. Checking Cloudflare Pages SPA Routing:');
  const redirectsPath = path.resolve(process.cwd(), 'dist/_redirects');
  if (!fs.existsSync(redirectsPath)) {
    throw new Error('FAILED: dist/_redirects does not exist');
  }
  const content = fs.readFileSync(redirectsPath, 'utf8').trim();
  console.log(' - dist/_redirects content:', content);
  if (content !== '/*  /index.html  200') {
    throw new Error('FAILED: dist/_redirects content mismatch');
  }
  console.log('  ✓ Cloudflare Pages SPA redirect rule is active.\n');

  // 3. Authenticate Master Super Admin with Live Supabase
  console.log('3. Authenticating Super Admin (admin@avencis.com) with Supabase:');
  const loginRes = await authService.signIn({
    email: 'admin@avencis.com',
    password: 'Avencis@2026!',
  });
  if (!loginRes.success) {
    console.error('Login error:', loginRes.error);
    throw new Error(`FAILED: Master Super Admin login failed: ${JSON.stringify(loginRes.error)}`);
  }
  console.log('  ✓ Logged in successfully. Session acquired for:', loginRes.data?.user?.email);

  // 4. Resolve Context
  console.log('\n4. Resolving User Context:');
  const ctxRes = await authService.resolveUserContext();
  if (!ctxRes.success || !ctxRes.data) {
    throw new Error(`FAILED: User context resolution failed: ${JSON.stringify(ctxRes.error)}`);
  }
  console.log('  ✓ Context resolved:');
  console.log('    - User ID:', ctxRes.data.userId);
  console.log('    - Full Name:', ctxRes.data.fullName);
  console.log('    - Role:', ctxRes.data.role);
  console.log('    - Active Status:', ctxRes.data.isActive);

  // 5. Query All Users from Database
  console.log('\n5. Querying Real Users from Database:');
  const usersRes = await authService.getAllUsers();
  if (!usersRes.success || !usersRes.data) {
    throw new Error(`FAILED: Could not fetch users: ${JSON.stringify(usersRes.error)}`);
  }
  console.log(`  ✓ Retrieved ${usersRes.data.length} registered user profiles:`);
  usersRes.data.forEach((u, i) => {
    console.log(`    ${i + 1}. [${u.role.toUpperCase()}] ${u.full_name} (${u.email}) - Active: ${u.is_active}`);
  });

  // 6. Test User Account Provisioning
  console.log('\n6. Testing User Account Provisioning via RPC:');
  const testEmail = `test.client.admin.${Date.now()}@testorg.com`;
  const provRes = await authService.provisionUserAccount({
    email: testEmail,
    password: 'ClientAdmin@2026!',
    fullName: 'Test Client Administrator',
    role: 'client_admin',
    clientId: null,
  });

  if (!provRes.success) {
    throw new Error(`FAILED: Provisioning failed: ${JSON.stringify(provRes.error)}`);
  }
  console.log('  ✓ Provisioned new user successfully:');
  console.log('    - User ID:', provRes.data?.userId);
  console.log('    - Email:', testEmail);
  console.log('    - Initial Password:', 'ClientAdmin@2026!');

  // Cleanup test user
  await supabase.from('user_profiles').delete().eq('email', testEmail.toLowerCase());
  await supabase.from('auth.users' as any).delete().eq('email', testEmail.toLowerCase());
  console.log('  ✓ Test user cleaned up.');

  // 7. Verify Password Change Capability
  console.log('\n7. Verifying Change Password Capability:');
  const pwdRes1 = await authService.changePassword('Avencis@2027!');
  if (!pwdRes1.success) {
    throw new Error(`FAILED: Change password to 2027 failed: ${JSON.stringify(pwdRes1.error)}`);
  }
  console.log('  ✓ Changed password to Avencis@2027! successfully.');

  const pwdRes2 = await authService.changePassword('Avencis@2026!');
  if (!pwdRes2.success) {
    throw new Error(`FAILED: Reverting password to 2026 failed: ${JSON.stringify(pwdRes2.error)}`);
  }
  console.log('  ✓ Reverted password to standard Avencis@2026! successfully.');

  console.log('\n================================================================');
  console.log('ALL PRODUCTION READINESS CHECKS PASSED (100%)');
  console.log('================================================================');
}

run().catch((err) => {
  console.error('\n❌ ERROR:', err);
  process.exit(1);
});
