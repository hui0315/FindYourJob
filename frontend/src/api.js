const BASE = '/api';

export async function parseJobs(rawText) {
  const res = await fetch(`${BASE}/jobs/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_text: rawText }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || '解析失敗');
  }
  return res.json();
}

export async function fetchJobs(sortBy = 'created_at', order = 'desc') {
  const res = await fetch(`${BASE}/jobs?sort_by=${sortBy}&order=${order}`);
  if (!res.ok) throw new Error('載入失敗');
  return res.json();
}

export async function updateJob(id, data) {
  const res = await fetch(`${BASE}/jobs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('更新失敗');
  return res.json();
}

export async function deleteJob(id) {
  const res = await fetch(`${BASE}/jobs/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('刪除失敗');
  return res.json();
}

export async function deleteAllJobs() {
  const res = await fetch(`${BASE}/jobs`, { method: 'DELETE' });
  if (!res.ok) throw new Error('清除失敗');
  return res.json();
}

export async function importJobs(jsonText, rawText = '') {
  const res = await fetch(`${BASE}/jobs/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json_text: jsonText, raw_text: rawText }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || '匯入失敗');
  }
  return res.json();
}

export async function previewSupplement(id, { rawText = '', jsonText = '', method = 'local' }) {
  const res = await fetch(`${BASE}/jobs/${id}/supplement/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_text: rawText, json_text: jsonText, method }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || '預覽失敗');
  }
  return res.json();
}

export async function supplementJob(id, { rawText = '', jsonText = '', method = 'local', selectedFields = null }) {
  const body = { raw_text: rawText, json_text: jsonText, method };
  if (selectedFields) body.selected_fields = selectedFields;
  const res = await fetch(`${BASE}/jobs/${id}/supplement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || '補充失敗');
  }
  return res.json();
}

export async function fetchPromptTemplate() {
  const res = await fetch(`${BASE}/prompt-template`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.prompt;
}

export async function fetchStatus() {
  const res = await fetch(`${BASE}/status`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchProfile() {
  const res = await fetch(`${BASE}/profile`);
  if (!res.ok) return null;
  return res.json();
}

export async function updateProfile(data) {
  const res = await fetch(`${BASE}/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('儲存失敗');
  return res.json();
}

export async function fetchSkillPool() {
  const res = await fetch(`${BASE}/skills/pool`);
  if (!res.ok) return [];
  return res.json();
}

export async function updateUserSkills(updates) {
  const res = await fetch(`${BASE}/skills`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('更新失敗');
  return res.json();
}

// ── Company API ──────────────────────────────────────────

export async function fetchCompanies() {
  const res = await fetch(`${BASE}/companies`);
  if (!res.ok) throw new Error('載入公司失敗');
  return res.json();
}

export async function fetchCompany(id) {
  const res = await fetch(`${BASE}/companies/${id}`);
  if (!res.ok) throw new Error('載入公司失敗');
  return res.json();
}

export async function updateCompany(id, data) {
  const res = await fetch(`${BASE}/companies/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || '更新公司失敗');
  }
  return res.json();
}

export async function deleteCompany(id) {
  const res = await fetch(`${BASE}/companies/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('刪除公司失敗');
  return res.json();
}

export async function fetchCompanyJobs(companyId) {
  const res = await fetch(`${BASE}/companies/${companyId}/jobs`);
  if (!res.ok) throw new Error('載入公司職缺失敗');
  return res.json();
}

export async function fetchCompanyPromptTemplate() {
  const res = await fetch(`${BASE}/companies/prompt-template`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.prompt;
}

export async function previewSupplementCompany(id, { rawText = '', jsonText = '', method = 'import' }) {
  const res = await fetch(`${BASE}/companies/${id}/supplement/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_text: rawText, json_text: jsonText, method }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || '預覽失敗');
  }
  return res.json();
}

export async function supplementCompany(id, { rawText = '', jsonText = '', method = 'import', selectedFields = null }) {
  const body = { raw_text: rawText, json_text: jsonText, method };
  if (selectedFields) body.selected_fields = selectedFields;
  const res = await fetch(`${BASE}/companies/${id}/supplement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || '補充失敗');
  }
  return res.json();
}
