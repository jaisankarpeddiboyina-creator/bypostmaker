const { spawn, execSync } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = 8788;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TEST_EMAIL = 'testuser_e2e@example.com';
const LINK_EMAIL = 'linkuser_e2e@example.com';
const TEST_PASSWORD = 'Password123!';
const TEST_NAME = 'E2E Test User';

function log(msg) {
  console.log(`[E2E TEST] ${msg}`);
}

function logError(msg) {
  console.error(`[E2E TEST ERROR] ${msg}`);
}

// Helper to execute local D1 commands
function executeD1(query) {
  const cmd = `npx wrangler d1 execute postmaker-db-dev --env development --local --command "${query.replace(/"/g, '\\"')}" --json`;
  try {
    const output = execSync(cmd, { cwd: path.join(__dirname, '../worker') }).toString();
    const jsonStart = output.indexOf('[');
    if (jsonStart === -1) {
      throw new Error(`Unexpected non-JSON output from wrangler D1: ${output}`);
    }
    const cleanJson = output.substring(jsonStart);
    const parsed = JSON.parse(cleanJson);
    return parsed[0].results;
  } catch (err) {
    logError(`D1 Query failed: ${query}`);
    throw err;
  }
}

let ipCounter = 1;

// Promise-based HTTP request helper
function request(method, pathname, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': `127.0.0.${ipCounter++}`,
        ...headers,
      },
    };

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
          json: () => JSON.parse(data),
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function getCookieHeader(resHeaders) {
  const setCookies = resHeaders['set-cookie'] || [];
  for (const cookie of setCookies) {
    if (cookie.startsWith('pm_session=')) {
      return cookie.split(';')[0];
    }
  }
  return '';
}

async function main() {
  log('Starting E2E Authentication tests...');

  // 0. Clean up any existing E2E test users
  log('Cleaning up existing E2E test records in D1...');
  executeD1(`DELETE FROM users WHERE email IN ('${TEST_EMAIL}', '${LINK_EMAIL}')`);
  executeD1(`DELETE FROM email_verifications WHERE email IN ('${TEST_EMAIL}', '${LINK_EMAIL}')`);
  executeD1(`DELETE FROM password_resets WHERE email IN ('${TEST_EMAIL}', '${LINK_EMAIL}')`);

  // 1. Spawn wrangler dev server
  log(`Spawning wrangler dev on port ${PORT}...`);
  const wranglerProcess = spawn('npx', [
    'wrangler',
    'dev',
    '--env',
    'development',
    '--port',
    String(PORT),
    '--local',
    '--ip',
    '127.0.0.1'
  ], {
    cwd: path.join(__dirname, '../worker'),
    stdio: 'pipe',
  });

  // Ensure wrangler process is killed when the test script exits
  const cleanup = () => {
    log('Terminating wrangler dev server...');
    try {
      wranglerProcess.kill('SIGTERM');
    } catch (e) {}
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(1);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(1);
  });
  process.on('uncaughtException', (err) => {
    logError('Uncaught exception: ' + err.stack);
    cleanup();
    process.exit(1);
  });

  // Wait for wrangler dev server to be ready
  await new Promise((resolve, reject) => {
    let output = '';
    const onData = (data) => {
      const str = data.toString();
      output += str;
      if (str.includes('Ready on') || str.includes('http://127.0.0.1:') || str.includes('Local Dev Server')) {
        log('Wrangler dev server is ready!');
        wranglerProcess.stdout.off('data', onData);
        resolve();
      }
    };
    wranglerProcess.stdout.on('data', onData);
    wranglerProcess.stderr.on('data', (data) => {
      logError('Wrangler stderr: ' + data.toString());
    });
    setTimeout(() => {
      reject(new Error('Timeout waiting for wrangler dev to start. Output so far:\n' + output));
    }, 15000);
  });

  try {
    // 2. Signup
    log('Scenario 1: Testing email signup...');
    const signupRes = await request('POST', '/api/auth/email/signup', {}, JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      name: TEST_NAME,
    }));

    if (signupRes.status !== 200) {
      throw new Error(`Signup failed with status ${signupRes.status}: ${signupRes.body}`);
    }

    const signupBody = signupRes.json();
    if (!signupBody.ok) {
      throw new Error(`Signup response not OK: ${JSON.stringify(signupBody)}`);
    }

    const sessionCookie = getCookieHeader(signupRes.headers);
    if (!sessionCookie) {
      throw new Error('Signup response did not set pm_session cookie');
    }
    log('Signup successful. Cookie set: ' + sessionCookie);

    // Verify DB state
    const users = executeD1(`SELECT id, google_id, email_verified, password_hash FROM users WHERE email = '${TEST_EMAIL}'`);
    if (users.length !== 1) {
      throw new Error('User not found in database after signup');
    }
    const user = users[0];
    if (!user.google_id.startsWith('email:')) {
      throw new Error(`User google_id should start with "email:", got ${user.google_id}`);
    }
    if (user.email_verified !== 0) {
      throw new Error(`User email_verified should be 0, got ${user.email_verified}`);
    }
    if (!user.password_hash.startsWith('pbkdf2:')) {
      throw new Error(`User password_hash should use pbkdf2 format, got ${user.password_hash}`);
    }
    log('DB verified: User inserted correctly as unverified, with google_id sentinel and hashed password.');

    // 3. Duplicate signup validation
    log('Scenario 2: Testing duplicate email signup prevention...');
    const dupRes = await request('POST', '/api/auth/email/signup', {}, JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      name: TEST_NAME,
    }));
    if (dupRes.status !== 400) {
      throw new Error(`Duplicate signup expected status 400, got ${dupRes.status}`);
    }
    const dupBody = dupRes.json();
    if (!dupBody.error || !dupBody.error.includes('already exists')) {
      throw new Error(`Expected already exists error, got: ${JSON.stringify(dupBody)}`);
    }
    log('Duplicate signup blocked correctly.');

    // 4. Access protected routes (unverified)
    log('Scenario 3: Testing protected route block for unverified account...');
    const generateRes = await request('GET', '/api/history', { 'Cookie': sessionCookie });
    if (generateRes.status !== 403) {
      throw new Error(`Expected status 403 for unverified user, got ${generateRes.status}`);
    }
    const generateBody = generateRes.json();
    if (generateBody.error !== 'Email not verified') {
      throw new Error(`Expected "Email not verified" error, got ${JSON.stringify(generateBody)}`);
    }
    log('Protected route (/api/history) successfully blocked with 403.');

    // Verify /api/user/me returns email_verified: 0
    const meRes = await request('GET', '/api/user/me', { 'Cookie': sessionCookie });
    if (meRes.status !== 200) {
      throw new Error(`Expected status 200 for /api/user/me, got ${meRes.status}`);
    }
    const meBody = meRes.json();
    if (meBody.user.email_verified !== 0) {
      throw new Error(`Expected email_verified to be 0, got ${meBody.user.email_verified}`);
    }
    log('/api/user/me correctly returned email_verified = 0.');

    // 5. Verification Token and Resend Verification
    log('Scenario 4: Testing resend verification token...');
    const verifications1 = executeD1(`SELECT token FROM email_verifications WHERE email = '${TEST_EMAIL}'`);
    if (verifications1.length !== 1) {
      throw new Error('Verification token not found in database');
    }
    const token1 = verifications1[0].token;

    // Resend
    const resendRes = await request('POST', '/api/user/resend-verification', { 'Cookie': sessionCookie });
    if (resendRes.status !== 200) {
      throw new Error(`Resend verification failed: ${resendRes.body}`);
    }
    const resendBody = resendRes.json();
    if (!resendBody.ok) {
      throw new Error(`Resend response not OK: ${JSON.stringify(resendBody)}`);
    }

    const verifications2 = executeD1(`SELECT token FROM email_verifications WHERE email = '${TEST_EMAIL}'`);
    if (verifications2.length !== 1) {
      throw new Error('Verification token not found in database after resend');
    }
    const token2 = verifications2[0].token;
    if (token1 === token2) {
      throw new Error('Resend should generate a new verification token');
    }
    log('Resend verification token generated and rotated successfully.');

    // 6. Verify Email Flow
    log('Scenario 5: Testing email verification...');
    // Verify with invalid token
    const verifyInvalidRes = await request('GET', `/api/auth/email/verify?token=invalid&email=${TEST_EMAIL}`);
    if (verifyInvalidRes.status !== 302) {
      throw new Error(`Expected redirect 302, got ${verifyInvalidRes.status}`);
    }
    if (!verifyInvalidRes.headers.location.includes('error=invalid_token')) {
      throw new Error(`Expected error redirect, got ${verifyInvalidRes.headers.location}`);
    }

    // Verify with valid token
    const verifyValidRes = await request('GET', `/api/auth/email/verify?token=${token2}&email=${TEST_EMAIL}`);
    if (verifyValidRes.status !== 302) {
      throw new Error(`Expected redirect 302, got ${verifyValidRes.status}`);
    }
    if (!verifyValidRes.headers.location.includes('verified=true')) {
      throw new Error(`Expected verified success redirect, got ${verifyValidRes.headers.location}`);
    }

    // Verify user in DB
    const usersVerified = executeD1(`SELECT email_verified FROM users WHERE email = '${TEST_EMAIL}'`);
    if (usersVerified[0].email_verified !== 1) {
      throw new Error('User not marked as verified in DB after verification');
    }
    const verificationsDeleted = executeD1(`SELECT count(*) as count FROM email_verifications WHERE email = '${TEST_EMAIL}'`);
    if (verificationsDeleted[0].count !== 0) {
      throw new Error('Verification token not deleted from database');
    }
    log('Email verified successfully in database. Redirect locations matched.');

    // 7. Access protected route (verified)
    log('Scenario 6: Testing protected route access after verification...');
    const generateRes2 = await request('GET', '/api/history', { 'Cookie': sessionCookie });
    if (generateRes2.status !== 200) {
      throw new Error(`Expected status 200 for verified user, got ${generateRes2.status}: ${generateRes2.body}`);
    }
    log('Protected route (/api/history) accessed successfully with 200.');

    // 8. Login Flow
    log('Scenario 7: Testing login...');
    // Incorrect password
    const loginFailRes = await request('POST', '/api/auth/email/login', {}, JSON.stringify({
      email: TEST_EMAIL,
      password: 'WrongPassword!',
    }));
    if (loginFailRes.status !== 400) {
      throw new Error(`Expected login failure with status 400, got ${loginFailRes.status}`);
    }

    // Correct password
    const loginSuccessRes = await request('POST', '/api/auth/email/login', {}, JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }));
    if (loginSuccessRes.status !== 200) {
      throw new Error(`Login failed with status ${loginSuccessRes.status}: ${loginSuccessRes.body}`);
    }
    const loginCookie = getCookieHeader(loginSuccessRes.headers);
    if (!loginCookie) {
      throw new Error('Login response did not set pm_session cookie');
    }
    log('Login successful with correct password.');

    // 9. Forgot & Reset Password Flow
    log('Scenario 8: Testing forgot and reset password...');
    const forgotRes = await request('POST', '/api/auth/email/forgot-password', {}, JSON.stringify({
      email: TEST_EMAIL,
    }));
    if (forgotRes.status !== 200) {
      throw new Error(`Forgot password failed with status ${forgotRes.status}`);
    }

    const resetTokens = executeD1(`SELECT token FROM password_resets WHERE email = '${TEST_EMAIL}'`);
    if (resetTokens.length !== 1) {
      throw new Error('Password reset token not generated in DB');
    }
    const resetToken = resetTokens[0].token;

    // Reset password
    const resetRes = await request('POST', '/api/auth/email/reset-password', {}, JSON.stringify({
      email: TEST_EMAIL,
      token: resetToken,
      password: 'NewPassword123!',
    }));
    if (resetRes.status !== 200) {
      throw new Error(`Reset password failed with status ${resetRes.status}: ${resetRes.body}`);
    }

    // Old password should fail now
    const loginOldFailRes = await request('POST', '/api/auth/email/login', {}, JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }));
    if (loginOldFailRes.status !== 400) {
      throw new Error(`Expected login with old password to fail, got ${loginOldFailRes.status}`);
    }

    // New password should succeed
    const loginNewSuccessRes = await request('POST', '/api/auth/email/login', {}, JSON.stringify({
      email: TEST_EMAIL,
      password: 'NewPassword123!',
    }));
    if (loginNewSuccessRes.status !== 200) {
      throw new Error(`Login with new password failed, got ${loginNewSuccessRes.status}`);
    }
    log('Password reset workflow validated successfully.');

    // 10. Silent Account Linking Flow
    log('Scenario 9: Testing silent account linking...');
    // Create another user registered via email
    log('Creating email-only user for linking...');
    const signupLinkRes = await request('POST', '/api/auth/email/signup', {}, JSON.stringify({
      email: LINK_EMAIL,
      password: TEST_PASSWORD,
      name: 'Link E2E User',
    }));
    if (signupLinkRes.status !== 200) {
      throw new Error(`Signup for link user failed: ${signupLinkRes.body}`);
    }

    const linkUsersBefore = executeD1(`SELECT id, google_id, email_verified FROM users WHERE email = '${LINK_EMAIL}'`);
    const linkUserBefore = linkUsersBefore[0];
    if (!linkUserBefore.google_id.startsWith('email:')) {
      throw new Error('Google ID sentinel check failed before linking');
    }
    if (linkUserBefore.email_verified !== 0) {
      throw new Error('Email verified check failed before linking');
    }

    // Now, simulate a Google OAuth signup/login with the same email
    log('Simulating Google OAuth upsert for the same email...');
    const googleProfile = {
      id: 'google-oauth-id-e2e-12345',
      email: LINK_EMAIL,
      name: 'Google User Link E2E',
      picture: 'https://lh3.googleusercontent.com/a/mock',
    };

    const oauthRes = await request('POST', '/api/auth/test/upsert', {}, JSON.stringify(googleProfile));
    if (oauthRes.status !== 200) {
      throw new Error(`Google OAuth simulation endpoint failed: ${oauthRes.body}`);
    }

    const oauthBody = oauthRes.json();
    if (oauthBody.isNew !== false) {
      throw new Error(`Expected isNew to be false (linked), got ${oauthBody.isNew}`);
    }
    if (oauthBody.userId !== linkUserBefore.id) {
      throw new Error(`Expected linked userId ${linkUserBefore.id}, got ${oauthBody.userId}`);
    }

    // Query DB to see if it linked
    const linkUsersAfter = executeD1(`SELECT google_id, email_verified, name, avatar_url FROM users WHERE email = '${LINK_EMAIL}'`);
    const linkUserAfter = linkUsersAfter[0];
    if (linkUserAfter.google_id !== 'google-oauth-id-e2e-12345') {
      throw new Error(`Expected google_id to be updated to Google OAuth ID, got ${linkUserAfter.google_id}`);
    }
    if (linkUserAfter.email_verified !== 1) {
      throw new Error(`Expected email_verified to be silently upgraded to 1, got ${linkUserAfter.email_verified}`);
    }
    if (linkUserAfter.name !== 'Google User Link E2E') {
      throw new Error(`Expected name to be updated, got ${linkUserAfter.name}`);
    }
    if (linkUserAfter.avatar_url !== 'https://lh3.googleusercontent.com/a/mock') {
      throw new Error(`Expected avatar_url to be updated, got ${linkUserAfter.avatar_url}`);
    }
    log('Silent account linking validated successfully. User merged, verified, and google_id replaced without duplicate constraint violation.');

    log('Cleaning up E2E test records in D1...');
    executeD1(`DELETE FROM users WHERE email IN ('${TEST_EMAIL}', '${LINK_EMAIL}')`);

    log('ALL E2E SCENARIOS COMPLETED SUCCESSFULLY!');
    cleanup();
    process.exit(0);
  } catch (err) {
    logError('Test scenario failed: ' + err.message);
    cleanup();
    process.exit(1);
  }
}

main().catch((err) => {
  logError('Fatal error: ' + err.stack);
  process.exit(1);
});
