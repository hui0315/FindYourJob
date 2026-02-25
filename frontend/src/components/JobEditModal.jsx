import { useState, useEffect, useRef } from 'react';
import { X, ArrowLeft, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { supplementJob, previewSupplement, updateJob, fetchPromptTemplate } from '../api';

const SALARY_TYPE_OPTIONS = [
  { value: 'monthly', label: '月薪' },
  { value: 'yearly', label: '年薪' },
  { value: 'hourly', label: '時薪' },
  { value: 'negotiable', label: '面議' },
];

const JOB_TYPE_OPTIONS = [
  { value: 'full-time', label: '全職' },
  { value: 'part-time', label: '兼職' },
  { value: 'contract', label: '約聘' },
  { value: 'intern', label: '實習' },
];

const WORKLOAD_OPTIONS = [
  { value: 'light', label: '輕鬆' },
  { value: 'moderate', label: '適中' },
  { value: 'heavy', label: '繁重' },
];

const EDUCATION_OPTIONS = [
  { value: 'none', label: '不拘' },
  { value: 'high_school', label: '高中' },
  { value: 'bachelor', label: '大學' },
  { value: 'master', label: '碩士' },
  { value: 'phd', label: '博士' },
];

const REMOTE_OPTIONS = [
  { value: 'onsite', label: '到班' },
  { value: 'hybrid', label: '混合' },
  { value: 'remote', label: '遠端' },
];

const STATUS_OPTIONS = [
  { value: 'not_applied', label: '未投遞' },
  { value: 'applied', label: '已投遞' },
  { value: 'interviewing', label: '面試中' },
  { value: 'offered', label: '已取得 Offer' },
  { value: 'rejected', label: '未錄取' },
];

const EDITABLE_FIELDS = [
  { key: 'title', label: '職位名稱', type: 'text' },
  { key: 'company', label: '公司名稱', type: 'text' },
  { key: 'salary_min', label: '最低薪資', type: 'number' },
  { key: 'salary_max', label: '最高薪資', type: 'number' },
  { key: 'salary_type', label: '薪資類型', type: 'select', options: SALARY_TYPE_OPTIONS },
  { key: 'salary_guaranteed_months', label: '保障月數', type: 'number' },
  { key: 'location', label: '工作地點', type: 'text' },
  { key: 'city', label: '縣市', type: 'text' },
  { key: 'job_type', label: '工作類型', type: 'select', options: JOB_TYPE_OPTIONS },
  { key: 'description', label: '工作內容', type: 'textarea', rows: 4 },
  { key: 'skills', label: '技能需求', type: 'text' },
  { key: 'experience_years', label: '經驗年數', type: 'number' },
  { key: 'education', label: '學歷要求', type: 'select', options: EDUCATION_OPTIONS },
  { key: 'remote_type', label: '遠端類型', type: 'select', options: REMOTE_OPTIONS },
  { key: 'work_hours', label: '上班時間', type: 'text' },
  { key: 'leave_policy', label: '休假制度', type: 'text' },
  { key: 'benefits', label: '福利', type: 'text' },
  { key: 'language', label: '語文條件', type: 'text' },
  { key: 'source_url', label: '來源連結', type: 'text' },
  { key: 'notes', label: '備註', type: 'text' },
];

// Lookup maps for displaying enum values in Chinese
const ENUM_DISPLAY = Object.fromEntries(
  [SALARY_TYPE_OPTIONS, JOB_TYPE_OPTIONS, WORKLOAD_OPTIONS,
   EDUCATION_OPTIONS, REMOTE_OPTIONS, STATUS_OPTIONS]
    .flat()
    .map((o) => [String(o.value), o.label])
);

const SOURCE_LABELS = {
  llm: '模型解析',
  import: 'LLM 匯入',
  user: '手動填寫',
  regex: 'Regex 解析',
};

function formatTimestamp(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return isoStr;
  }
}

function parseFieldMetadata(job) {
  if (!job.field_metadata) return {};
  try { return JSON.parse(job.field_metadata); } catch { return {}; }
}

/** Format a raw field value for display in conflict UI */
function displayValue(val) {
  if (val == null) return '-';
  const s = String(val);
  return ENUM_DISPLAY[s] || s;
}

export default function JobEditModal({ job, onSave, onClose }) {
  const [activeTab, setActiveTab] = useState('manual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Supplement state
  const [rawText, setRawText] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [supplementStep, setSupplementStep] = useState('input'); // 'input' | 'online' | 'preview'
  const [promptTemplate, setPromptTemplate] = useState('');
  const [copied, setCopied] = useState(false);

  // Preview / conflict resolution state
  const [previewData, setPreviewData] = useState(null); // { source, conflicts, new_fields }
  const [conflictChoices, setConflictChoices] = useState({}); // { field: 'old' | 'new' }
  const [newFieldChecked, setNewFieldChecked] = useState({}); // { field: boolean }

  // Quick-access fields — independent from manual edit form
  const [statusValue, setStatusValue] = useState(job.status || 'not_applied');
  const [statusSaving, setStatusSaving] = useState(false);
  const [workloadValue, setWorkloadValue] = useState(job.workload || '');
  const [workloadSaving, setWorkloadSaving] = useState(false);

  // Manual mode state
  const [formData, setFormData] = useState({});
  const [dirtyFields, setDirtyFields] = useState(new Set());
  const [editSectionOpen, setEditSectionOpen] = useState(false);
  const contentRef = useRef(null);

  const fieldMeta = parseFieldMetadata(job);

  useEffect(() => {
    fetchPromptTemplate().then((p) => { if (p) setPromptTemplate(p); });
  }, []);

  useEffect(() => {
    const data = {};
    for (const field of EDITABLE_FIELDS) {
      data[field.key] = job[field.key] ?? '';
    }
    setFormData(data);
    setDirtyFields(new Set());
    setStatusValue(job.status || 'not_applied');
    setWorkloadValue(job.workload || '');
  }, [job]);

  // ── Status: independent save ──
  async function handleStatusSave() {
    if (statusValue === job.status) return;
    setStatusSaving(true);
    try {
      const updated = await updateJob(job.id, { status: statusValue });
      onSave(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setStatusSaving(false);
    }
  }

  // ── Workload: independent save ──
  async function handleWorkloadSave() {
    if (workloadValue === (job.workload || '')) return;
    setWorkloadSaving(true);
    try {
      const updated = await updateJob(job.id, { workload: workloadValue || null });
      onSave(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setWorkloadSaving(false);
    }
  }

  const combinedPrompt = promptTemplate ? promptTemplate + '\n' + rawText : rawText;

  // ── Supplement: request preview ──
  async function handlePreview(method, jText) {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const result = await previewSupplement(job.id, {
        rawText,
        jsonText: jText || '',
        method,
      });
      setPreviewData(result);
      // Initialize choices: new fields default checked, conflicts have no default
      const nc = {};
      for (const f of result.new_fields) nc[f.field] = true;
      setNewFieldChecked(nc);
      setConflictChoices({});
      setSupplementStep('preview');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Supplement: local parse → preview ──
  function handleLocalPreview() {
    if (!rawText.trim()) { setError('請輸入職缺補充資訊'); return; }
    handlePreview('local', '');
  }

  // ── Supplement: go to online LLM flow ──
  function handleGoOnline() {
    if (!rawText.trim()) { setError('請先輸入職缺補充資訊'); return; }
    setError('');
    setJsonText('');
    setCopied(false);
    setSupplementStep('online');
  }

  // ── Supplement: import JSON → preview ──
  function handleImportPreview() {
    if (!jsonText.trim()) { setError('請貼上 LLM 回覆的 JSON'); return; }
    handlePreview('import', jsonText);
  }

  // ── Supplement: confirm merge after conflict resolution ──
  async function handleConfirmMerge() {
    if (!previewData) return;

    // Check all conflicts are resolved
    const unresolvedCount = previewData.conflicts.filter(
      (c) => !conflictChoices[c.field]
    ).length;
    if (unresolvedCount > 0) {
      setError(`還有 ${unresolvedCount} 個衝突欄位尚未選擇`);
      return;
    }

    // Build selected fields list
    const selectedFields = [];
    for (const f of previewData.new_fields) {
      if (newFieldChecked[f.field]) selectedFields.push(f.field);
    }
    for (const c of previewData.conflicts) {
      if (conflictChoices[c.field] === 'new') selectedFields.push(c.field);
    }

    if (selectedFields.length === 0) {
      setError('沒有選擇任何欄位');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const updated = await supplementJob(job.id, {
        rawText,
        jsonText,
        method: previewData.source === 'import' ? 'import' : 'local',
        selectedFields,
      });
      setSuccess('合併成功');
      setRawText('');
      setJsonText('');
      setPreviewData(null);
      setSupplementStep('input');
      onSave(updated);
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Copy prompt ──
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

  // ── Manual: field change ──
  function handleFieldChange(key, value) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setDirtyFields((prev) => new Set(prev).add(key));
  }

  // ── Manual: save ──
  async function handleManualSave() {
    if (dirtyFields.size === 0) { setError('沒有修改任何欄位'); return; }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const payload = {};
      for (const key of dirtyFields) {
        const field = EDITABLE_FIELDS.find((f) => f.key === key);
        let value = formData[key];
        if (field?.type === 'number') {
          value = value === '' ? null : Number(value);
          if (value !== null && isNaN(value)) {
            setError(`${field.label} 需為數字`);
            setLoading(false);
            return;
          }
        }
        if (value === '') value = null;
        const original = job[key] ?? null;
        if (value !== original) payload[key] = value;
      }
      if (Object.keys(payload).length === 0) {
        setError('沒有實際變更的欄位');
        setLoading(false);
        return;
      }
      const updated = await updateJob(job.id, payload);
      setSuccess('儲存成功');
      setDirtyFields(new Set());
      onSave(updated);
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const emptyFields = EDITABLE_FIELDS.filter(
    (f) => job[f.key] == null || job[f.key] === ''
  );
  const filledFields = EDITABLE_FIELDS.filter(
    (f) => job[f.key] != null && job[f.key] !== ''
  );

  // For conflict resolution: count unresolved
  const unresolvedConflicts = previewData
    ? previewData.conflicts.filter((c) => !conflictChoices[c.field]).length
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 backdrop-blur-sm overflow-y-auto py-8">
      <div className="bg-white rounded-xl shadow-card-active w-full max-w-2xl mx-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200">
          <div>
            <h2 className="text-lg font-semibold text-surface-800">編輯職缺</h2>
            <p className="text-sm text-surface-500 mt-0.5">
              {job.title} - {job.company}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-surface-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick-access: status + workload */}
        <div className="px-6 py-3 border-b border-surface-200 flex flex-wrap items-center gap-x-6 gap-y-2">
          {/* 投遞狀態 */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-surface-700 shrink-0">投遞狀態</label>
            <select
              value={statusValue}
              onChange={(e) => setStatusValue(e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-surface-300 rounded
                         focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {statusValue !== job.status && (
              <button
                onClick={handleStatusSave}
                disabled={statusSaving}
                className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded
                           hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {statusSaving ? '儲存中...' : '儲存'}
              </button>
            )}
          </div>
          {/* 工作量 */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-surface-700 shrink-0">工作量</label>
            <select
              value={workloadValue}
              onChange={(e) => setWorkloadValue(e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-surface-300 rounded
                         focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            >
              <option value="">-- 未選擇 --</option>
              {WORKLOAD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {workloadValue !== (job.workload || '') && (
              <button
                onClick={handleWorkloadSave}
                disabled={workloadSaving}
                className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded
                           hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {workloadSaving ? '儲存中...' : '儲存'}
              </button>
            )}
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-surface-200">
          {[
            { key: 'manual', label: '手動填寫', badge: emptyFields.length > 0 ? `${emptyFields.length} 待填` : null },
            { key: 'supplement', label: '補充資料' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setError(''); setSuccess(''); }}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors
                ${activeTab === tab.key
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                  : 'text-surface-500 hover:text-surface-700'
                }`}
            >
              {tab.label}
              {tab.badge && (
                <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div ref={contentRef} className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-600">
              {success}
            </div>
          )}

          {/* ═══ Tab: Manual Fill + Edit ═══ */}
          {activeTab === 'manual' && (
            <div>
              {/* Section 1: Quick fill empty fields */}
              {emptyFields.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-sm font-medium text-amber-700 mb-2">
                    快速填寫 ({emptyFields.length} 個空欄位)
                  </h3>
                  <div className="space-y-3">
                    {emptyFields.map((field) => (
                      <FieldInput
                        key={field.key}
                        field={field}
                        value={formData[field.key]}
                        onChange={(v) => handleFieldChange(field.key, v)}
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
                    onClick={() => setEditSectionOpen(!editSectionOpen)}
                    className="flex items-center gap-2 text-sm font-medium text-surface-500
                               hover:text-surface-700 transition-colors mb-2 w-full"
                  >
                    <span>{editSectionOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                    修正已有資料 ({filledFields.length} 個欄位)
                    <span className="text-xs text-surface-400 font-normal ml-1">
                      修正 LLM 解析錯誤
                    </span>
                  </button>
                  {editSectionOpen && (
                    <div className="space-y-3">
                      {filledFields.map((field) => (
                        <EditFieldInput
                          key={field.key}
                          field={field}
                          currentValue={job[field.key]}
                          editValue={formData[field.key]}
                          onChange={(v) => handleFieldChange(field.key, v)}
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
                  onClick={handleManualSave}
                  disabled={loading || dirtyFields.size === 0}
                  className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium
                             hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors"
                >
                  {loading ? '儲存中...' : '儲存修改'}
                </button>
                {dirtyFields.size > 0 && (
                  <span className="text-xs text-surface-400 self-center">
                    已修改 {dirtyFields.size} 個欄位
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ═══ Tab: Supplement (Raw Data) ═══ */}
          {activeTab === 'supplement' && (
            <div>
              {/* Step: Input raw text */}
              {supplementStep === 'input' && (
                <div>
                  <p className="text-sm text-surface-500 mb-3">
                    貼上從其他來源複製的職缺補充資訊，系統會先預覽解析結果，再讓你確認合併。
                  </p>
                  <textarea
                    className="w-full h-40 p-3 border border-surface-300 rounded-lg
                               focus:ring-2 focus:ring-primary-500 focus:border-transparent
                               resize-y text-sm font-mono bg-white text-surface-800
                               placeholder:text-surface-400"
                    placeholder="貼上補充的職缺資訊..."
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    maxLength={50000}
                  />
                  <div className="text-xs text-surface-400 text-right mt-1">
                    {rawText.length.toLocaleString()} / 50,000
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={handleGoOnline}
                      disabled={loading}
                      className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium
                                 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
                                 transition-colors"
                    >
                      複製 Prompt 給線上 LLM
                    </button>
                    <button
                      onClick={handleLocalPreview}
                      disabled={loading}
                      className="text-sm text-surface-400 hover:text-surface-500
                                 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? '解析中...' : '本地模型解析'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step: Online LLM flow */}
              {supplementStep === 'online' && (
                <div>
                  <button
                    onClick={() => { setSupplementStep('input'); setError(''); }}
                    className="text-sm text-surface-400 hover:text-surface-600 mb-3 transition-colors"
                  >
                    <ArrowLeft size={14} className="inline-block mr-1" />返回修改
                  </button>
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-surface-700">
                        複製以下內容貼到 LLM
                      </h3>
                      <button
                        onClick={handleCopy}
                        className={`px-3 py-1 text-xs rounded border transition-colors ${
                          copied
                            ? 'bg-green-50 text-green-600 border-green-300'
                            : 'bg-white text-surface-600 border-surface-300 hover:border-primary-400'
                        }`}
                      >
                        {copied ? 'OK' : 'Copy'}
                      </button>
                    </div>
                    <pre className="w-full p-3 bg-surface-50 border border-surface-200 rounded-lg
                                    text-xs font-mono text-surface-600 whitespace-pre-wrap
                                    overflow-y-auto max-h-32 leading-relaxed">
                      {combinedPrompt}
                    </pre>
                  </div>
                  <div className="mb-3 p-2.5 bg-primary-50 border border-blue-100 rounded-lg text-xs text-primary-600">
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>複製上方內容</li>
                      <li>貼到 ChatGPT / Gemini / Claude</li>
                      <li>把 LLM 回覆的 JSON 貼到下方</li>
                    </ol>
                  </div>
                  <textarea
                    className="w-full h-32 p-3 border border-surface-300 rounded-lg
                               focus:ring-2 focus:ring-primary-500 focus:border-transparent
                               resize-y text-sm font-mono bg-white text-surface-800
                               placeholder:text-surface-400"
                    placeholder="貼上 LLM 回覆的 JSON..."
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                  />
                  <div className="flex gap-3 mt-3">
                    <button
                      onClick={handleImportPreview}
                      disabled={loading}
                      className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium
                                 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
                                 transition-colors"
                    >
                      {loading ? '解析中...' : '預覽解析結果'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step: Preview / Conflict Resolution */}
              {supplementStep === 'preview' && previewData && (
                <div>
                  <button
                    onClick={() => { setSupplementStep('input'); setError(''); setPreviewData(null); }}
                    className="text-sm text-surface-400 hover:text-surface-600 mb-3 transition-colors"
                  >
                    <ArrowLeft size={14} className="inline-block mr-1" />返回修改
                  </button>

                  <h3 className="text-sm font-medium text-surface-700 mb-3">
                    解析結果預覽
                  </h3>

                  {/* New fields (filling empty) */}
                  {previewData.new_fields.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-medium text-green-700 mb-2">
                        新增欄位（補充空缺）
                      </h4>
                      <div className="space-y-2">
                        {previewData.new_fields.map((f) => (
                          <label
                            key={f.field}
                            className="flex items-center gap-3 p-2.5 bg-green-50 border border-green-200
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
                              className="rounded text-green-600 focus:ring-green-500"
                            />
                            <span className="text-sm text-surface-600 w-24 shrink-0">{f.label}</span>
                            <span className="text-sm font-medium text-green-700">
                              {displayValue(f.new_value)}
                            </span>
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
                                  : 'border-surface-200 bg-surface-50'
                              }`}
                            >
                              <div className="text-sm font-medium text-surface-700 mb-2">
                                {c.label}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {/* Old value */}
                                <label
                                  className={`flex items-start gap-2 p-2 rounded border cursor-pointer
                                    transition-colors ${
                                    choice === 'old'
                                      ? 'border-primary-400 bg-primary-50'
                                      : 'border-surface-200 bg-white hover:border-surface-300'
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
                                    className="mt-0.5 text-primary-600 focus:ring-primary-500"
                                  />
                                  <div>
                                    <div className="text-[10px] text-surface-400 mb-0.5">目前值</div>
                                    <div className="text-sm text-surface-700 break-all">
                                      {displayValue(c.old_value)}
                                    </div>
                                  </div>
                                </label>

                                {/* New value */}
                                <label
                                  className={`flex items-start gap-2 p-2 rounded border cursor-pointer
                                    transition-colors ${
                                    choice === 'new'
                                      ? 'border-green-400 bg-green-50'
                                      : 'border-surface-200 bg-white hover:border-surface-300'
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
                                  <div>
                                    <div className="text-[10px] text-green-600 mb-0.5">新值</div>
                                    <div className="text-sm text-green-700 break-all">
                                      {displayValue(c.new_value)}
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
                    <p className="text-sm text-surface-400 text-center py-6">
                      解析後沒有新的欄位變更
                    </p>
                  )}

                  {/* Confirm button */}
                  {(previewData.conflicts.length > 0 || previewData.new_fields.length > 0) && (
                    <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={handleConfirmMerge}
                        disabled={loading || unresolvedConflicts > 0}
                        className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium
                                   hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
                                   transition-colors"
                      >
                        {loading ? '合併中...' : '確認合併'}
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
          )}

        </div>
      </div>
    </div>
  );
}


/** Input for empty fields — simple fill mode */
function FieldInput({ field, value, onChange, isDirty, meta, isEmpty }) {
  const displayVal = value ?? '';
  return (
    <div className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors
                     ${isEmpty ? 'bg-amber-50/50 border border-amber-200' : 'bg-surface-50 border border-surface-200'}
                     ${isDirty ? 'ring-2 ring-primary-300' : ''}`}>
      <div className="w-28 shrink-0 pt-1.5">
        <label className="text-sm font-medium text-surface-700">{field.label}</label>
        {meta && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] px-1 py-px rounded bg-surface-100 text-surface-400">
              {SOURCE_LABELS[meta.source] || meta.source}
            </span>
            <span className="text-[10px] text-surface-400">{formatTimestamp(meta.updated_at)}</span>
          </div>
        )}
      </div>
      <div className="flex-1">
        <InputWidget field={field} value={displayVal} onChange={onChange} placeholder={isEmpty ? '待填寫' : ''} />
      </div>
    </div>
  );
}


/** Input for existing fields — shows current value for comparison */
function EditFieldInput({ field, currentValue, editValue, onChange, isDirty, meta }) {
  const displayVal = editValue ?? '';
  return (
    <div className={`p-2.5 rounded-lg transition-colors bg-surface-50 border border-surface-200
                     ${isDirty ? 'ring-2 ring-primary-300' : ''}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <label className="text-sm font-medium text-surface-700">{field.label}</label>
        {meta && (
          <>
            <span className="text-[10px] px-1 py-px rounded bg-surface-100 text-surface-400">
              {SOURCE_LABELS[meta.source] || meta.source}
            </span>
            <span className="text-[10px] text-surface-400">{formatTimestamp(meta.updated_at)}</span>
          </>
        )}
      </div>
      {/* Current value display */}
      <div className="mb-1.5 px-2 py-1 bg-white border border-surface-200 rounded text-xs text-surface-500 break-all">
        目前：{displayValue(currentValue)}
      </div>
      {/* Edit input */}
      <InputWidget field={field} value={displayVal} onChange={onChange} placeholder="" />
    </div>
  );
}


/** Shared input widget for text/number/select/textarea fields */
function InputWidget({ field, value, onChange, placeholder }) {
  if (field.type === 'select') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 text-sm border border-surface-300 rounded
                   focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
      >
        <option value="">-- 未選擇 --</option>
        {field.options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }
  if (field.type === 'textarea') {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 text-sm border border-surface-300 rounded
                   focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y"
        rows={field.rows || 3}
        placeholder={placeholder}
      />
    );
  }
  return (
    <input
      type={field.type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2.5 py-1.5 text-sm border border-surface-300 rounded
                 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      placeholder={placeholder}
    />
  );
}
