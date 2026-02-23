import { useState, useEffect } from 'react';
import {
  fetchCompanies, updateCompany, deleteCompany,
  fetchCompanyPromptTemplate, previewSupplementCompany, supplementCompany,
} from '../api';

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

function parseInterviewQuestions(str) {
  if (!str) return null;
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

function parseEditHistory(company) {
  if (!company.edit_history) return [];
  try { return JSON.parse(company.edit_history); } catch { return []; }
}

function parseFieldMetadata(company) {
  if (!company.field_metadata) return {};
  try { return JSON.parse(company.field_metadata); } catch { return {}; }
}

function formatTimestamp(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return isoStr; }
}

const CONTACT_FIELDS = [
  { key: 'contact_name', label: '聯絡人' },
  { key: 'contact_title', label: '職稱' },
  { key: 'contact_phone', label: '電話' },
  { key: 'contact_email', label: 'Email' },
  { key: 'address', label: '公司地址' },
  { key: 'website', label: '公司網站' },
];

const EXTRA_FIELDS = [
  { key: 'industry', label: '產業別' },
  { key: 'company_size', label: '公司規模' },
  { key: 'culture', label: '工作文化' },
];

// Unified field list for edit mode (drives the empty/filled split)
const ALL_EDITABLE_FIELDS = [
  { key: 'name', label: '公司名稱', type: 'text' },
  { key: 'industry', label: '產業別', type: 'text' },
  { key: 'company_size', label: '公司規模', type: 'text' },
  { key: 'culture', label: '工作文化', type: 'text' },
  { key: 'contact_name', label: '聯絡人', type: 'text' },
  { key: 'contact_title', label: '聯絡人職稱', type: 'text' },
  { key: 'contact_phone', label: '電話', type: 'text' },
  { key: 'contact_email', label: 'Email', type: 'text' },
  { key: 'address', label: '公司地址', type: 'text' },
  { key: 'website', label: '公司網站', type: 'text' },
  { key: 'interview_process', label: '面試流程', type: 'textarea', rows: 2 },
  { key: 'ai_notes', label: 'AI 備註', type: 'textarea', rows: 3 },
  { key: 'notes', label: '備註', type: 'textarea', rows: 2 },
];

const SOURCE_LABELS = {
  import: 'LLM 匯入',
  user: '手動填寫',
};

const ACTION_LABELS = {
  created: '建立',
  supplement: '補充資料',
  manual_edit: '手動編輯',
};

const COMPANY_FIELD_LABELS = {
  name: '公司名稱', benefits: '福利', benefits_structured: '結構化福利',
  contact_name: '聯絡人', contact_title: '聯絡人職稱',
  contact_phone: '電話', contact_email: 'Email',
  address: '公司地址', website: '公司網站', notes: '備註',
  interview_process: '面試流程', interview_questions: '考古題',
  ai_notes: 'AI 備註', industry: '產業別',
  company_size: '公司規模', culture: '工作文化',
};

export default function CompanyManager({ onNavigateToJob }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [dirtyFields, setDirtyFields] = useState(new Set());
  const [editSectionOpen, setEditSectionOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // AI supplement state
  const [supplementId, setSupplementId] = useState(null);
  const [supplementStep, setSupplementStep] = useState('input'); // 'input' | 'online' | 'preview' | 'history'
  const [rawText, setRawText] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [copied, setCopied] = useState(false);
  const [supplementLoading, setSupplementLoading] = useState(false);
  const [supplementError, setSupplementError] = useState('');
  const [supplementSuccess, setSupplementSuccess] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [conflictChoices, setConflictChoices] = useState({});
  const [newFieldChecked, setNewFieldChecked] = useState({});

  useEffect(() => {
    loadCompanies();
    fetchCompanyPromptTemplate().then((p) => { if (p) setPromptTemplate(p); });
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
    setSupplementId(null);
    const data = {};
    for (const field of ALL_EDITABLE_FIELDS) {
      data[field.key] = company[field.key] ?? '';
    }
    setEditForm(data);
    setDirtyFields(new Set());
    setEditSectionOpen(false);
    setError('');
  }

  function handleFieldChange(key, value) {
    setEditForm((prev) => ({ ...prev, [key]: value }));
    setDirtyFields((prev) => new Set(prev).add(key));
  }

  function startSupplement(company) {
    setSupplementId(company.id);
    setEditingId(null);
    setSupplementStep('input');
    setRawText('');
    setJsonText('');
    setPreviewData(null);
    setSupplementError('');
    setSupplementSuccess('');
  }

  async function handleSave(companyId) {
    if (dirtyFields.size === 0) { setError('沒有修改任何欄位'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {};
      const company = companies.find((c) => c.id === companyId);
      for (const key of dirtyFields) {
        let value = editForm[key];
        if (value === '') value = null;
        const original = company[key] ?? null;
        if (value !== original) payload[key] = value;
      }
      if (Object.keys(payload).length === 0) {
        setError('沒有實際變更的欄位');
        setSaving(false);
        return;
      }
      const updated = await updateCompany(companyId, payload);
      setCompanies((prev) =>
        prev.map((c) => (c.id === companyId ? updated : c))
      );
      setEditingId(null);
      setDirtyFields(new Set());
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

  // ── AI Supplement handlers ──

  const combinedPrompt = promptTemplate ? promptTemplate + '\n' + rawText : rawText;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(combinedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = combinedPrompt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleGoOnline() {
    if (!rawText.trim()) { setSupplementError('請先輸入公司相關資訊'); return; }
    setSupplementError('');
    setJsonText('');
    setCopied(false);
    setSupplementStep('online');
  }

  async function handleImportPreview() {
    if (!jsonText.trim()) { setSupplementError('請貼上 LLM 回覆的 JSON'); return; }
    setSupplementError('');
    setSupplementSuccess('');
    setSupplementLoading(true);
    try {
      const result = await previewSupplementCompany(supplementId, {
        rawText,
        jsonText,
        method: 'import',
      });
      setPreviewData(result);
      const nc = {};
      for (const f of result.new_fields) nc[f.field] = true;
      setNewFieldChecked(nc);
      setConflictChoices({});
      setSupplementStep('preview');
    } catch (e) {
      setSupplementError(e.message);
    } finally {
      setSupplementLoading(false);
    }
  }

  async function handleConfirmMerge() {
    if (!previewData) return;
    const unresolvedCount = previewData.conflicts.filter(
      (c) => !conflictChoices[c.field]
    ).length;
    if (unresolvedCount > 0) {
      setSupplementError(`還有 ${unresolvedCount} 個衝突欄位尚未選擇`);
      return;
    }
    const selectedFields = [];
    for (const f of previewData.new_fields) {
      if (newFieldChecked[f.field]) selectedFields.push(f.field);
    }
    for (const c of previewData.conflicts) {
      if (conflictChoices[c.field] === 'new') selectedFields.push(c.field);
    }
    if (selectedFields.length === 0) {
      setSupplementError('沒有選擇任何欄位');
      return;
    }
    setSupplementError('');
    setSupplementLoading(true);
    try {
      const updated = await supplementCompany(supplementId, {
        rawText,
        jsonText,
        method: 'import',
        selectedFields,
      });
      setCompanies((prev) =>
        prev.map((c) => (c.id === supplementId ? updated : c))
      );
      setSupplementSuccess('合併成功');
      setRawText('');
      setJsonText('');
      setPreviewData(null);
      setSupplementStep('input');
      setTimeout(() => { setSupplementId(null); setSupplementSuccess(''); }, 1500);
    } catch (e) {
      setSupplementError(e.message);
    } finally {
      setSupplementLoading(false);
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
          const supplementing = supplementId === company.id;
          const bs = parseBenefitsStructured(company.benefits_structured);
          const hasContact = CONTACT_FIELDS.some((f) => company[f.key]);
          const iq = parseInterviewQuestions(company.interview_questions);
          const editHistory = parseEditHistory(company);
          const unresolvedConflicts = previewData
            ? previewData.conflicts.filter((c) => !conflictChoices[c.field]).length
            : 0;

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
                  if (supplementing && !expanded) setSupplementId(null);
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
                    {company.industry && <span>{company.industry}</span>}
                    {hasContact && <span>有聯絡資訊</span>}
                    {bs && <span>有福利資料</span>}
                    {company.interview_process && <span>有面試流程</span>}
                  </div>
                </div>
                <span className="shrink-0 text-gray-400 text-sm">
                  {expanded ? '▲' : '▼'}
                </span>
              </div>

              {/* Expanded detail */}
              {expanded && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                  {!editing && !supplementing ? (
                    /* ── View mode ── */
                    <div className="mt-3">
                      {/* Company profile fields */}
                      {(company.industry || company.company_size || company.culture) && (
                        <div className="mb-4 grid grid-cols-3 gap-3">
                          {EXTRA_FIELDS.map((f) =>
                            company[f.key] ? (
                              <div key={f.key} className="bg-gray-50 rounded-lg px-3 py-2">
                                <div className="text-[10px] font-medium text-gray-400 mb-0.5">{f.label}</div>
                                <div className="text-sm text-gray-700">{company[f.key]}</div>
                              </div>
                            ) : null
                          )}
                        </div>
                      )}

                      {/* Benefits */}
                      {bs && (
                        <div className="mb-4">
                          <h4 className="text-xs font-medium text-gray-500 mb-2">福利制度</h4>
                          <div className="space-y-1">
                            {Object.entries(bs)
                              .filter(([, items]) => items.length > 0)
                              .map(([cat, items]) => {
                                const meta = BENEFIT_CATEGORY_LABELS[cat] || BENEFIT_CATEGORY_LABELS.other;
                                return (
                                  <div key={cat} className="flex items-start gap-1.5">
                                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded shrink-0 ${meta.color}`}>
                                      {meta.label}
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                      {items.map((item) => (
                                        <span
                                          key={`${cat}-${item}`}
                                          className={`text-xs px-2 py-0.5 rounded border ${meta.color}`}
                                        >
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
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

                      {/* Interview process */}
                      {company.interview_process && (
                        <div className="mb-4">
                          <h4 className="text-xs font-medium text-gray-500 mb-1">面試流程</h4>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{company.interview_process}</p>
                        </div>
                      )}

                      {/* Interview questions */}
                      {iq && iq.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-xs font-medium text-gray-500 mb-2">考古題</h4>
                          <ol className="list-decimal list-inside space-y-1">
                            {iq.map((q, i) => (
                              <li key={i} className="text-sm text-gray-700">{q}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {/* AI notes */}
                      {company.ai_notes && (
                        <div className="mb-4">
                          <h4 className="text-xs font-medium text-gray-500 mb-1">AI 備註</h4>
                          <div className="text-sm text-gray-700 bg-blue-50 border border-blue-100
                                          rounded-lg px-3 py-2 whitespace-pre-wrap">
                            {company.ai_notes}
                          </div>
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
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{company.notes}</p>
                        </div>
                      )}

                      {/* Edit history (inline, collapsible) */}
                      {editHistory.length > 0 && (
                        <HistorySection history={editHistory} />
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
                          onClick={(e) => { e.stopPropagation(); startSupplement(company); }}
                          className="px-3 py-1 text-sm text-indigo-600 border border-indigo-200
                                     rounded hover:bg-indigo-50 transition-colors"
                        >
                          AI 整理
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
                  ) : supplementing ? (
                    /* ── AI Supplement mode ── */
                    <div className="mt-3">
                      {supplementError && (
                        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                          {supplementError}
                        </div>
                      )}
                      {supplementSuccess && (
                        <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-600">
                          {supplementSuccess}
                        </div>
                      )}

                      {/* Step: Input */}
                      {supplementStep === 'input' && (
                        <div>
                          <p className="text-sm text-gray-500 mb-3">
                            貼上從公司官網、面試心得、PTT、Glassdoor 等來源複製的公司資訊，
                            AI 會整理成結構化資料（福利、面試流程、考古題、文化等）。
                          </p>
                          <textarea
                            className="w-full h-40 p-3 border border-gray-300 rounded-lg
                                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                       resize-y text-sm font-mono bg-white text-gray-800
                                       placeholder:text-gray-400"
                            placeholder="貼上公司相關資訊（福利制度、面試經驗、公司介紹等）..."
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            maxLength={50000}
                          />
                          <div className="text-xs text-gray-400 text-right mt-1">
                            {rawText.length.toLocaleString()} / 50,000
                          </div>
                          <div className="flex items-center gap-3 mt-3">
                            <button
                              onClick={handleGoOnline}
                              disabled={supplementLoading}
                              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium
                                         hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
                                         transition-colors"
                            >
                              複製 Prompt 給線上 LLM
                            </button>
                            <button
                              onClick={() => setSupplementId(null)}
                              className="text-sm text-gray-400 hover:text-gray-500 transition-colors"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Step: Online LLM flow */}
                      {supplementStep === 'online' && (
                        <div>
                          <button
                            onClick={() => { setSupplementStep('input'); setSupplementError(''); }}
                            className="text-sm text-gray-400 hover:text-gray-600 mb-3 transition-colors"
                          >
                            &larr; 返回修改
                          </button>
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-700">
                                複製以下內容貼到 LLM
                              </h3>
                              <button
                                onClick={handleCopy}
                                className={`px-3 py-1 text-xs rounded border transition-colors ${
                                  copied
                                    ? 'bg-green-50 text-green-600 border-green-300'
                                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                                }`}
                              >
                                {copied ? 'OK' : 'Copy'}
                              </button>
                            </div>
                            <pre className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg
                                            text-xs font-mono text-gray-600 whitespace-pre-wrap
                                            overflow-y-auto max-h-32 leading-relaxed">
                              {combinedPrompt}
                            </pre>
                          </div>
                          <div className="mb-3 p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-600">
                            <ol className="list-decimal list-inside space-y-0.5">
                              <li>複製上方內容</li>
                              <li>貼到 ChatGPT / Gemini / Claude</li>
                              <li>把 LLM 回覆的 JSON 貼到下方</li>
                            </ol>
                          </div>
                          <textarea
                            className="w-full h-32 p-3 border border-gray-300 rounded-lg
                                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                       resize-y text-sm font-mono bg-white text-gray-800
                                       placeholder:text-gray-400"
                            placeholder="貼上 LLM 回覆的 JSON..."
                            value={jsonText}
                            onChange={(e) => setJsonText(e.target.value)}
                          />
                          <div className="flex gap-3 mt-3">
                            <button
                              onClick={handleImportPreview}
                              disabled={supplementLoading}
                              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium
                                         hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
                                         transition-colors"
                            >
                              {supplementLoading ? '解析中...' : '預覽解析結果'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Step: Preview / Conflict Resolution */}
                      {supplementStep === 'preview' && previewData && (
                        <div>
                          <button
                            onClick={() => { setSupplementStep('online'); setSupplementError(''); setPreviewData(null); }}
                            className="text-sm text-gray-400 hover:text-gray-600 mb-3 transition-colors"
                          >
                            &larr; 返回修改
                          </button>

                          <h3 className="text-sm font-medium text-gray-700 mb-3">
                            解析結果預覽
                          </h3>

                          {/* New fields */}
                          {previewData.new_fields.length > 0 && (
                            <div className="mb-4">
                              <h4 className="text-xs font-medium text-green-700 mb-2">
                                新增欄位（補充空缺）
                              </h4>
                              <div className="space-y-2">
                                {previewData.new_fields.map((f) => (
                                  <label
                                    key={f.field}
                                    className="flex items-start gap-3 p-2.5 bg-green-50 border border-green-200
                                               rounded-lg cursor-pointer hover:bg-green-100/60 transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={newFieldChecked[f.field] ?? true}
                                      onChange={(e) =>
                                        setNewFieldChecked((prev) => ({
                                          ...prev,
                                          [f.field]: e.target.checked,
                                        }))
                                      }
                                      className="mt-0.5 rounded text-green-600 focus:ring-green-500"
                                    />
                                    <span className="text-sm text-gray-600 w-24 shrink-0">{f.label}</span>
                                    <div className="text-sm font-medium text-green-700 min-w-0 flex-1">
                                      <FriendlyValue field={f.field} value={f.new_value} />
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Conflicts */}
                          {previewData.conflicts.length > 0 && (
                            <div className="mb-4">
                              <h4 className="text-xs font-medium text-amber-700 mb-2">
                                衝突欄位 — 請選擇要保留哪一個
                                {unresolvedConflicts > 0 && (
                                  <span className="ml-2 text-red-500">
                                    ({unresolvedConflicts} 個待選擇)
                                  </span>
                                )}
                              </h4>
                              <div className="space-y-3">
                                {previewData.conflicts.map((c) => {
                                  const choice = conflictChoices[c.field];
                                  return (
                                    <div
                                      key={c.field}
                                      className={`p-3 rounded-lg border transition-colors ${
                                        !choice
                                          ? 'border-amber-300 bg-amber-50'
                                          : 'border-gray-200 bg-gray-50'
                                      }`}
                                    >
                                      <div className="text-sm font-medium text-gray-700 mb-2">
                                        {c.label}
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <label
                                          className={`flex items-start gap-2 p-2 rounded border cursor-pointer
                                            transition-colors ${
                                            choice === 'old'
                                              ? 'border-blue-400 bg-blue-50'
                                              : 'border-gray-200 bg-white hover:border-gray-300'
                                          }`}
                                        >
                                          <input
                                            type="radio"
                                            name={`conflict-${c.field}`}
                                            checked={choice === 'old'}
                                            onChange={() =>
                                              setConflictChoices((prev) => ({
                                                ...prev,
                                                [c.field]: 'old',
                                              }))
                                            }
                                            className="mt-0.5 text-blue-600 focus:ring-blue-500"
                                          />
                                          <div className="min-w-0">
                                            <div className="text-[10px] text-gray-400 mb-0.5">目前值</div>
                                            <div className="text-sm text-gray-700">
                                              <FriendlyValue field={c.field} value={c.old_value} />
                                            </div>
                                          </div>
                                        </label>
                                        <label
                                          className={`flex items-start gap-2 p-2 rounded border cursor-pointer
                                            transition-colors ${
                                            choice === 'new'
                                              ? 'border-green-400 bg-green-50'
                                              : 'border-gray-200 bg-white hover:border-gray-300'
                                          }`}
                                        >
                                          <input
                                            type="radio"
                                            name={`conflict-${c.field}`}
                                            checked={choice === 'new'}
                                            onChange={() =>
                                              setConflictChoices((prev) => ({
                                                ...prev,
                                                [c.field]: 'new',
                                              }))
                                            }
                                            className="mt-0.5 text-green-600 focus:ring-green-500"
                                          />
                                          <div className="min-w-0">
                                            <div className="text-[10px] text-green-600 mb-0.5">新值</div>
                                            <div className="text-sm text-green-700">
                                              <FriendlyValue field={c.field} value={c.new_value} />
                                            </div>
                                          </div>
                                        </label>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* No changes */}
                          {previewData.conflicts.length === 0 && previewData.new_fields.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-6">
                              解析後沒有新的欄位變更
                            </p>
                          )}

                          {/* Confirm button */}
                          {(previewData.conflicts.length > 0 || previewData.new_fields.length > 0) && (
                            <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100">
                              <button
                                onClick={handleConfirmMerge}
                                disabled={supplementLoading || unresolvedConflicts > 0}
                                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium
                                           hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
                                           transition-colors"
                              >
                                {supplementLoading ? '合併中...' : '確認合併'}
                              </button>
                              {unresolvedConflicts > 0 && (
                                <span className="text-xs text-amber-600 self-center">
                                  請先選擇所有衝突欄位
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ── Edit mode (empty/filled split) ── */
                    <CompanyEditPanel
                      company={company}
                      editForm={editForm}
                      dirtyFields={dirtyFields}
                      editSectionOpen={editSectionOpen}
                      saving={saving}
                      onFieldChange={handleFieldChange}
                      onToggleEditSection={() => setEditSectionOpen(!editSectionOpen)}
                      onSave={() => handleSave(company.id)}
                      onCancel={() => { setEditingId(null); setDirtyFields(new Set()); }}
                    />
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


/** Collapsible edit history section */
function HistorySection({ history }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-4">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="flex items-center gap-2 text-xs font-medium text-gray-400
                   hover:text-gray-600 transition-colors"
      >
        <span>{open ? '▼' : '▶'}</span>
        編輯紀錄 ({history.length})
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {[...history].reverse().map((entry, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-2.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] px-1.5 py-px rounded-full font-medium bg-gray-100 text-gray-400">
                  {SOURCE_LABELS[entry.source] || entry.source}
                </span>
                <span className="text-[10px] text-gray-500">
                  {ACTION_LABELS[entry.action] || entry.action}
                </span>
                <span className="text-[10px] text-gray-400 ml-auto">
                  {formatTimestamp(entry.timestamp)}
                </span>
              </div>
              {entry.fields_updated && entry.fields_updated.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {entry.fields_updated.map((f) => (
                    <span
                      key={f}
                      className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded"
                    >
                      {COMPANY_FIELD_LABELS[f] || f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/** Company edit panel — empty/filled split with provenance badges */
function CompanyEditPanel({
  company, editForm, dirtyFields, editSectionOpen, saving,
  onFieldChange, onToggleEditSection, onSave, onCancel,
}) {
  const fieldMeta = parseFieldMetadata(company);

  const emptyFields = ALL_EDITABLE_FIELDS.filter(
    (f) => company[f.key] == null || company[f.key] === ''
  );
  const filledFields = ALL_EDITABLE_FIELDS.filter(
    (f) => company[f.key] != null && company[f.key] !== ''
  );

  return (
    <div className="mt-3">
      {/* Section 1: Quick fill empty fields */}
      {emptyFields.length > 0 && (
        <div className="mb-5">
          <h3 className="text-sm font-medium text-amber-700 mb-2">
            快速填寫 ({emptyFields.length} 個空欄位)
          </h3>
          <div className="space-y-3">
            {emptyFields.map((field) => (
              <CompanyFieldInput
                key={field.key}
                field={field}
                value={editForm[field.key]}
                onChange={(v) => onFieldChange(field.key, v)}
                isDirty={dirtyFields.has(field.key)}
                meta={null}
                isEmpty
              />
            ))}
          </div>
        </div>
      )}

      {/* Section 2: Edit existing fields (collapsible) */}
      {filledFields.length > 0 && (
        <div>
          <button
            onClick={onToggleEditSection}
            className="flex items-center gap-2 text-sm font-medium text-gray-500
                       hover:text-gray-700 transition-colors mb-2 w-full"
          >
            <span className="text-xs">{editSectionOpen ? '▼' : '▶'}</span>
            修正已有資料 ({filledFields.length} 個欄位)
            <span className="text-xs text-gray-400 font-normal ml-1">
              修正 LLM 整理錯誤
            </span>
          </button>
          {editSectionOpen && (
            <div className="space-y-3">
              {filledFields.map((field) => (
                <CompanyEditFieldInput
                  key={field.key}
                  field={field}
                  currentValue={company[field.key]}
                  editValue={editForm[field.key]}
                  onChange={(v) => onFieldChange(field.key, v)}
                  isDirty={dirtyFields.has(field.key)}
                  meta={fieldMeta[field.key]}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save button */}
      <div className="flex gap-3 mt-4 pt-3 border-t border-gray-100">
        <button
          onClick={onSave}
          disabled={saving || dirtyFields.size === 0}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium
                     hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          {saving ? '儲存中...' : '儲存修改'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg
                     hover:bg-gray-50 transition-colors"
        >
          取消
        </button>
        {dirtyFields.size > 0 && (
          <span className="text-xs text-gray-400 self-center">
            已修改 {dirtyFields.size} 個欄位
          </span>
        )}
      </div>
    </div>
  );
}


/** Input for empty fields — amber highlight, fill mode */
function CompanyFieldInput({ field, value, onChange, isDirty, meta, isEmpty }) {
  const displayVal = value ?? '';
  return (
    <div className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors
                     ${isEmpty ? 'bg-amber-50/50 border border-amber-200' : 'bg-gray-50 border border-gray-200'}
                     ${isDirty ? 'ring-2 ring-blue-300' : ''}`}>
      <div className="w-28 shrink-0 pt-1.5">
        <label className="text-sm font-medium text-gray-700">{field.label}</label>
        {meta && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`text-[10px] px-1 py-px rounded
              ${meta.source === 'user' ? 'bg-teal-100 text-teal-600' : 'bg-gray-200 text-gray-500'}`}>
              {SOURCE_LABELS[meta.source] || meta.source}
            </span>
            <span className="text-[10px] text-gray-400">{formatTimestamp(meta.updated_at)}</span>
          </div>
        )}
      </div>
      <div className="flex-1">
        <CompanyInputWidget field={field} value={displayVal} onChange={onChange} placeholder={isEmpty ? '待填寫' : ''} />
      </div>
    </div>
  );
}


/** Input for existing fields — shows current value for comparison */
function CompanyEditFieldInput({ field, currentValue, editValue, onChange, isDirty, meta }) {
  const displayVal = editValue ?? '';
  return (
    <div className={`p-2.5 rounded-lg transition-colors bg-gray-50 border border-gray-200
                     ${isDirty ? 'ring-2 ring-blue-300' : ''}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <label className="text-sm font-medium text-gray-700">{field.label}</label>
        {meta && (
          <>
            <span className={`text-[10px] px-1 py-px rounded
              ${meta.source === 'user' ? 'bg-teal-100 text-teal-600' : 'bg-purple-100 text-purple-600'}`}>
              {SOURCE_LABELS[meta.source] || meta.source}
            </span>
            <span className="text-[10px] text-gray-400">{formatTimestamp(meta.updated_at)}</span>
          </>
        )}
      </div>
      {/* Current value display */}
      <div className="mb-1.5 px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-500 break-all whitespace-pre-wrap">
        目前：{displayFieldValue(currentValue)}
      </div>
      {/* Edit input */}
      <CompanyInputWidget field={field} value={displayVal} onChange={onChange} placeholder="" />
    </div>
  );
}


/** Shared input widget for text/textarea fields */
function CompanyInputWidget({ field, value, onChange, placeholder }) {
  if (field.type === 'textarea') {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded
                   focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
        rows={field.rows || 2}
        placeholder={placeholder}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded
                 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      placeholder={placeholder}
    />
  );
}


/** Truncate plain text for display */
function displayFieldValue(val) {
  if (val == null) return '-';
  const s = String(val);
  if (s.length > 200) return s.slice(0, 200) + '...';
  return s;
}


/**
 * Render a field value in a user-friendly way (no raw JSON).
 * - benefits_structured → category-tagged pills
 * - interview_questions → numbered list
 * - everything else     → plain text
 */
function FriendlyValue({ field, value, className = '' }) {
  if (value == null) return <span className={className}>-</span>;

  // benefits_structured: JSON string → tag pills grouped by category
  if (field === 'benefits_structured') {
    const parsed = typeof value === 'string' ? parseBenefitsStructured(value) : value;
    if (parsed && typeof parsed === 'object') {
      const entries = Object.entries(parsed).filter(
        ([, items]) => Array.isArray(items) && items.length > 0
      );
      if (entries.length > 0) {
        return (
          <div className="space-y-1">
            {entries.map(([cat, items]) => {
              const meta = BENEFIT_CATEGORY_LABELS[cat] || BENEFIT_CATEGORY_LABELS.other;
              return (
                <div key={cat} className="flex items-start gap-1.5">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded shrink-0 ${meta.color}`}>
                    {meta.label}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {items.map((item) => (
                      <span
                        key={`${cat}-${item}`}
                        className={`text-xs px-1.5 py-0.5 rounded border ${meta.color}`}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
    }
    return <span className={className}>-</span>;
  }

  // interview_questions: JSON string → numbered list
  if (field === 'interview_questions') {
    const parsed = typeof value === 'string' ? parseInterviewQuestions(value) : value;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return (
        <ol className="list-decimal list-inside space-y-0.5">
          {parsed.map((q, i) => (
            <li key={i} className={`text-sm ${className}`}>{q}</li>
          ))}
        </ol>
      );
    }
    return <span className={className}>-</span>;
  }

  // Plain text fields
  return <span className={`${className} whitespace-pre-wrap break-all`}>{displayFieldValue(value)}</span>;
}
