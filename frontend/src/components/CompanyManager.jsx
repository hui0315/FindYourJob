import { useState, useEffect } from 'react';
import { fetchCompanies, updateCompany, deleteCompany } from '../api';

const BENEFIT_CATEGORY_LABELS = {
  bonus: { label: '獎金', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  insurance: { label: '保險', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  leave: { label: '休假', color: 'bg-green-50 text-green-700 border-green-200' },
  subsidy: { label: '補助', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  system: { label: '制度', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  other: { label: '其他', color: 'bg-gray-50 text-gray-600 border-gray-200' },
};

function parseBenefitsStructured(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}

const CONTACT_FIELDS = [
  { key: 'contact_name', label: '聯絡人' },
  { key: 'contact_title', label: '職稱' },
  { key: 'contact_phone', label: '電話' },
  { key: 'contact_email', label: 'Email' },
  { key: 'address', label: '公司地址' },
  { key: 'website', label: '公司網站' },
];

export default function CompanyManager({ onNavigateToJob }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCompanies();
  }, []);

  async function loadCompanies() {
    setLoading(true);
    try {
      const data = await fetchCompanies();
      setCompanies(data);
    } catch {
      setError('載入公司資料失敗');
    } finally {
      setLoading(false);
    }
  }

  function startEditing(company) {
    setEditingId(company.id);
    setEditForm({
      name: company.name || '',
      contact_name: company.contact_name || '',
      contact_title: company.contact_title || '',
      contact_phone: company.contact_phone || '',
      contact_email: company.contact_email || '',
      address: company.address || '',
      website: company.website || '',
      notes: company.notes || '',
    });
    setError('');
  }

  async function handleSave(companyId) {
    setSaving(true);
    setError('');
    try {
      const payload = {};
      const company = companies.find((c) => c.id === companyId);
      for (const [key, val] of Object.entries(editForm)) {
        const original = company[key] ?? '';
        if (val !== original) {
          payload[key] = val || null;
        }
      }
      if (Object.keys(payload).length === 0) {
        setEditingId(null);
        return;
      }
      const updated = await updateCompany(companyId, payload);
      setCompanies((prev) =>
        prev.map((c) => (c.id === companyId ? updated : c))
      );
      setEditingId(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(companyId) {
    const company = companies.find((c) => c.id === companyId);
    if (!confirm(`確定要刪除「${company?.name}」嗎？相關職缺不會被刪除。`)) return;
    try {
      await deleteCompany(companyId);
      setCompanies((prev) => prev.filter((c) => c.id !== companyId));
    } catch {
      setError('刪除失敗');
    }
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-400">
        載入中...
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-4">🏢</p>
        <p className="text-lg">尚無公司資料</p>
        <p className="text-sm mt-1">新增職缺時會自動建立公司</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-700">
          公司管理
        </h2>
        <span className="text-sm text-gray-400">
          共 {companies.length} 間公司
        </span>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {companies.map((company) => {
          const expanded = expandedId === company.id;
          const editing = editingId === company.id;
          const bs = parseBenefitsStructured(company.benefits_structured);
          const hasContact = CONTACT_FIELDS.some((f) => company[f.key]);

          return (
            <div
              key={company.id}
              className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-200"
            >
              {/* Header row */}
              <div
                className="p-4 flex items-center gap-4 cursor-pointer"
                onClick={() => {
                  setExpandedId(expanded ? null : company.id);
                  if (editing && !expanded) setEditingId(null);
                }}
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center
                                text-blue-600 font-bold text-lg shrink-0">
                  {company.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">{company.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                    <span>{company.job_count ?? 0} 筆職缺</span>
                    {hasContact && <span>有聯絡資訊</span>}
                    {bs && <span>有福利資料</span>}
                  </div>
                </div>
                <span className="shrink-0 text-gray-400 text-sm">
                  {expanded ? '▲' : '▼'}
                </span>
              </div>

              {/* Expanded detail */}
              {expanded && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                  {!editing ? (
                    /* ── View mode ── */
                    <div className="mt-3">
                      {/* Benefits */}
                      {bs && (
                        <div className="mb-4">
                          <h4 className="text-xs font-medium text-gray-500 mb-2">福利制度</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(bs)
                              .filter(([, items]) => items.length > 0)
                              .map(([cat, items]) => {
                                const meta = BENEFIT_CATEGORY_LABELS[cat] || BENEFIT_CATEGORY_LABELS.other;
                                return items.map((item) => (
                                  <span
                                    key={`${cat}-${item}`}
                                    className={`text-xs px-2 py-0.5 rounded border ${meta.color}`}
                                    title={meta.label}
                                  >
                                    {item}
                                  </span>
                                ));
                              })}
                          </div>
                        </div>
                      )}
                      {!bs && company.benefits && (
                        <div className="mb-4">
                          <h4 className="text-xs font-medium text-gray-500 mb-1">福利</h4>
                          <p className="text-sm text-gray-700">{company.benefits}</p>
                        </div>
                      )}

                      {/* Contact info */}
                      {hasContact && (
                        <div className="mb-4">
                          <h4 className="text-xs font-medium text-gray-500 mb-2">聯絡資訊</h4>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                            {CONTACT_FIELDS.map((f) =>
                              company[f.key] ? (
                                <div key={f.key}>
                                  <span className="text-gray-400">{f.label}：</span>
                                  {f.key === 'website' ? (
                                    <a
                                      href={company[f.key]}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-500 hover:underline"
                                    >
                                      {company[f.key]}
                                    </a>
                                  ) : f.key === 'contact_email' ? (
                                    <a
                                      href={`mailto:${company[f.key]}`}
                                      className="text-blue-500 hover:underline"
                                    >
                                      {company[f.key]}
                                    </a>
                                  ) : (
                                    <span className="text-gray-700">{company[f.key]}</span>
                                  )}
                                </div>
                              ) : null
                            )}
                          </div>
                        </div>
                      )}

                      {company.notes && (
                        <div className="mb-4">
                          <h4 className="text-xs font-medium text-gray-500 mb-1">備註</h4>
                          <p className="text-sm text-gray-700">{company.notes}</p>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                        <button
                          onClick={(e) => { e.stopPropagation(); startEditing(company); }}
                          className="px-3 py-1 text-sm text-blue-600 border border-blue-200
                                     rounded hover:bg-blue-50 transition-colors"
                        >
                          編輯
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(company.id); }}
                          className="px-3 py-1 text-sm text-red-500 border border-red-200
                                     rounded hover:bg-red-50 transition-colors"
                        >
                          刪除
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Edit mode ── */
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500">公司名稱</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                          className="w-full mt-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded
                                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {CONTACT_FIELDS.map((f) => (
                          <div key={f.key}>
                            <label className="text-xs font-medium text-gray-500">{f.label}</label>
                            <input
                              type="text"
                              value={editForm[f.key] || ''}
                              onChange={(e) => setEditForm((p) => ({ ...p, [f.key]: e.target.value }))}
                              className="w-full mt-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded
                                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder={`輸入${f.label}`}
                            />
                          </div>
                        ))}
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-500">備註</label>
                        <textarea
                          value={editForm.notes || ''}
                          onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                          className="w-full mt-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded
                                     focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                          rows={2}
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleSave(company.id)}
                          disabled={saving}
                          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded
                                     hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {saving ? '儲存中...' : '儲存'}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-4 py-1.5 text-sm text-gray-500 border border-gray-300 rounded
                                     hover:bg-gray-50 transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
