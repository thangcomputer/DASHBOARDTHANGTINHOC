'use strict';

const base = process.env.TEST_API_BASE_URL || 'http://127.0.0.1:5097';

function cookieFrom(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  return raw.map((item) => item.split(';')[0]).join('; ');
}

async function main() {
  const results = [];
  async function hit(name, url, options = {}) {
    const res = await fetch(url, options);
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    results.push({
      name,
      status: res.status,
      success: body?.success,
      code: body?.code || null,
      message: body?.message || body?.status || null,
    });
    return { res, body };
  }

  const health = await hit('healthz', `${base}/healthz`);
  const csrfRes = await fetch(`${base}/api/auth/csrf-token`);
  const csrfBody = await csrfRes.json();
  const cookie = cookieFrom(csrfRes);
  const csrf = csrfBody.csrfToken;
  results.push({ name: 'csrf-token', status: csrfRes.status, success: Boolean(csrf) });

  async function login(role, phone) {
    return hit(`login ${role}`, `${base}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
        Cookie: cookie,
      },
      body: JSON.stringify({ phone, password: 'Test@12345', role }),
    });
  }

  const teacher = await login('teacher', '0901000001');
  const student = await login('student', '0902000001');

  await hit('courses no auth', `${base}/api/courses`);
  await hit('students no auth', `${base}/api/students`);

  const teacherToken = teacher.body?.token || teacher.body?.accessToken || teacher.body?.data?.accessToken || teacher.body?.data?.token;
  results.push({ name: 'teacher login keys', status: 0, message: Object.keys(teacher.body || {}).join(',') });
  if (teacherToken) {
    await hit('students as teacher', `${base}/api/students`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
  }
  const studentToken = student.body?.token || student.body?.accessToken || student.body?.data?.accessToken || student.body?.data?.token;
  if (studentToken) {
    await hit('students as student', `${base}/api/students`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
  }

  console.log(JSON.stringify({
    healthDb: health.body?.db || null,
    results: results.map((row) => ({
      name: row.name,
      status: row.status,
      success: row.success,
      code: row.code,
      message: typeof row.message === 'string' ? row.message.slice(0, 140) : row.message,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error('SMOKE_FAILED', error.message);
  process.exit(1);
});
