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

export async function fetchStatus() {
  const res = await fetch(`${BASE}/status`);
  if (!res.ok) return null;
  return res.json();
}
