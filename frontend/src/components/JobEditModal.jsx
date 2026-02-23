import { useState, useEffect } from 'react';
import { supplementJob, updateJob, fetchPromptTemplate } from '../api';

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

const PRIORITY_OPTIONS = [
  { value: 1, label: '1 - 最高' },
  { value: 2, label: '2 - 高' },
  { value: 3, label: '3 - 中' },
  { value: 4, label: '4 - 低' },
  { value: 5, label: '5 - 最低' },
];

const EDITABLE_FIELDS = [
  { key: 'title', label: '職位名稱', type: 'text' },
  { key: 'company', label: '公司名稱', type: 'text' },
  { key: 'salary_min', label: '最低薪資', type: 'number' },
  { key: 'salary_max', label: '最高薪資', type: 'number' },
  { key: 'salary_type', label: '薪資類型', type: 'select', options: SALARY_TYPE_OPTIONS },
  { key: 'salary_guaranteed_months', label: '保障月數', type: 'number' },
  { key: 'location', label: '工作地點', type: 'text' },
  { key: 'job_type', label: '工作類型', type: 'select', options: JOB_TYPE_OPTIONS },
  { key: 'workload', label: '工作量', type: 'select', options: WORKLOAD_OPTIONS },
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
  { key: 'priority', label: '優先順序', type: 'select', options: PRIORITY_OPTIONS },
];

const SOURCE_LABELS = {
  llm: '模型解析',
  import: 'LLM 匯入',
  user: '手動填寫',
  regex: 'Regex 解析',
};

const ACTION_LABELS = {
  created: '建立',
  supplement: '補充資料',
  manual_edit: '手動編輯',
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
  try {
    return JSON.parse(job.field_metadata);
  } catch {
    return {};
  }
}

function parseEditHistory(job) {
  if (!job.edit_history) return [];
  try {
    return JSON.parse(job.edit_history);
  } catch {
    return [];
  }
}

const FIELD_LABELS = Object.fromEntries(EDITABLE_FIELDS.map((f) => [f.key, f.label]));

export default function JobEditModal({ job, onSave, onClose }) {
  // 'supplement' = paste raw data | 'manual' = fill empty fields
  const [activeTab, setActiveTab] = useState('manual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Supplement mode state
  const [rawText, setRawText] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [supplementStep, setSupplementStep] = useState('input'); // 'input' | 'online'
  const [promptTemplate, setPromptTemplate] = useState('');
  const [copied, setCopied] = useState(false);

  // Manual mode state
  const [formData, setFormData] = useState({});
  const [dirtyFields, setDirtyFields] = useState(new Set());

  const fieldMeta = parseFieldMetadata(job);
  const editHistory = parseEditHistory(job);

  useEffect(() => {
    fetchPromptTemplate().then((p) => {
      if (p) setPromptTemplate(p);
    });
  }, []);

  // Initialize form data from job
  useEffect(() => {
    const data = {};
    for (const field of EDITABLE_FIELDS) {
      data[field.key] = job[field.key] ?? '';
    }
    setFormData(data);
    setDirtyFields(new Set());
  }, [job]);

  const combinedPrompt = promptTemplate
    ? promptTemplate + '\n' + rawText
    : rawText;

  // ── Supplement: local parse ──
  async function handleLocalSupplement() {
    if (!rawText.trim()) {
      setError('請輸入職缺補充資訊');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const updated = await supplementJob(job.id, { rawText, method: 'local' });
      setSuccess('補充成功');
      setRawText('');
      onSave(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Supplement: go to online LLM flow ──
  function handleGoOnline() {
    if (!rawText.trim()) {
      setError('請先輸入職缺補充資訊');
      return;
    }
    setError('');
    setJsonText('');
    setCopied(false);
    setSupplementStep('online');
  }

  // ── Supplement: import JSON ──
  async function handleImportSupplement() {
    if (!jsonText.trim()) {
      setError('請貼上 LLM 回覆的 JSON');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const updated = await supplementJob(job.id, {
        rawText,
        jsonText,
        method: 'import',
      });
      setSuccess('補充成功');
      setRawText('');
      setJsonText('');
      setSupplementStep('input');
      onSave(updated);
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
    if (dirtyFields.size === 0) {
      setError('沒有修改任何欄位');
      return;
    }
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
        // Only include if actually changed from original
        const original = job[key] ?? null;
        if (value !== original) {
          payload[key] = value;
        }
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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              編輯職缺
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {job.title} - {job.company}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
          >
            x
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => { setActiveTab('manual'); setError(''); setSuccess(''); }}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors
              ${activeTab === 'manual'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            手動填寫
            {emptyFields.length > 0 && (
              <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                {emptyFields.length} 待填
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('supplement'); setError(''); setSuccess(''); }}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors
              ${activeTab === 'supplement'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            補充資料 (Raw Data)
          </button>
          <button
            onClick={() => { setActiveTab('history'); setError(''); setSuccess(''); }}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors
              ${activeTab === 'history'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            編輯紀錄
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {/* Error / Success messages */}
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

          {/* ── Tab: Manual Fill ── */}
          {activeTab === 'manual' && (
            <div>
              {/* Empty fields first */}
              {emptyFields.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-amber-700 mb-2">
                    尚未填寫的欄位
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

              {/* Filled fields */}
              {filledFields.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    已有資料的欄位
                  </h3>
                  <div className="space-y-3">
                    {filledFields.map((field) => (
                      <FieldInput
                        key={field.key}
                        field={field}
                        value={formData[field.key]}
                        onChange={(v) => handleFieldChange(field.key, v)}
                        isDirty={dirtyFields.has(field.key)}
                        meta={fieldMeta[field.key]}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Save button */}
              <div className="flex gap-3 mt-4 pt-3 border-t border-gray-100">
                <button
                  onClick={handleManualSave}
                  disabled={loading || dirtyFields.size === 0}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium
                             hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors"
                >
                  {loading ? '儲存中...' : '儲存修改'}
                </button>
                {dirtyFields.size > 0 && (
                  <span className="text-xs text-gray-400 self-center">
                    已修改 {dirtyFields.size} 個欄位
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── Tab: Supplement (Raw Data) ── */}
          {activeTab === 'supplement' && (
            <div>
              {supplementStep === 'input' && (
                <div>
                  <p className="text-sm text-gray-500 mb-3">
                    貼上從其他來源複製的職缺補充資訊，系統會解析後合併到此職缺。
                  </p>
                  <textarea
                    className="w-full h-40 p-3 border border-gray-300 rounded-lg
                               focus:ring-2 focus:ring-blue-500 focus:border-transparent
                               resize-y text-sm font-mono bg-white text-gray-800
                               placeholder:text-gray-400"
                    placeholder="貼上補充的職缺資訊..."
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
                      disabled={loading}
                      className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium
                                 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                                 transition-colors"
                    >
                      複製 Prompt 給線上 LLM
                    </button>
                    <button
                      onClick={handleLocalSupplement}
                      disabled={loading}
                      className="text-sm text-gray-400 hover:text-gray-500
                                 disabled:opacity-50 disabled:cursor-not-allowed
                                 transition-colors"
                    >
                      {loading ? '解析中...' : '本地模型解析'}
                    </button>
                  </div>
                </div>
              )}

              {supplementStep === 'online' && (
                <div>
                  <button
                    onClick={() => { setSupplementStep('input'); setError(''); }}
                    className="text-sm text-gray-400 hover:text-gray-600 mb-3 transition-colors"
                  >
                    &larr; 返回修改
                  </button>

                  {/* Combined prompt */}
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

                  {/* Steps hint */}
                  <div className="mb-3 p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-600">
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>複製上方內容</li>
                      <li>貼到 ChatGPT / Gemini / Claude</li>
                      <li>把 LLM 回覆的 JSON 貼到下方</li>
                    </ol>
                  </div>

                  {/* JSON paste area */}
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
                      onClick={handleImportSupplement}
                      disabled={loading}
                      className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium
                                 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                                 transition-colors"
                    >
                      {loading ? '匯入中...' : '匯入並合併'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Edit History ── */}
          {activeTab === 'history' && (
            <div>
              {editHistory.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  尚無編輯紀錄
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Newest first */}
                  {[...editHistory].reverse().map((entry, i) => (
                    <div
                      key={i}
                      className="border border-gray-200 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                          ${entry.source === 'user'
                            ? 'bg-teal-100 text-teal-700'
                            : entry.source === 'import'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                          {SOURCE_LABELS[entry.source] || entry.source}
                        </span>
                        <span className="text-xs text-gray-500">
                          {ACTION_LABELS[entry.action] || entry.action}
                        </span>
                        <span className="text-xs text-gray-400 ml-auto">
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>
                      {entry.fields_updated && entry.fields_updated.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {entry.fields_updated.map((f) => (
                            <span
                              key={f}
                              className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded"
                            >
                              {FIELD_LABELS[f] || f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function FieldInput({ field, value, onChange, isDirty, meta, isEmpty }) {
  const displayValue = value ?? '';

  return (
    <div className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors
                     ${isEmpty ? 'bg-amber-50/50 border border-amber-200' : 'bg-gray-50 border border-gray-200'}
                     ${isDirty ? 'ring-2 ring-blue-300' : ''}`}>
      <div className="w-28 shrink-0 pt-1.5">
        <label className="text-sm font-medium text-gray-700">{field.label}</label>
        {meta && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`text-[10px] px-1 py-px rounded
              ${meta.source === 'user'
                ? 'bg-teal-100 text-teal-600'
                : 'bg-gray-200 text-gray-500'
              }`}>
              {SOURCE_LABELS[meta.source] || meta.source}
            </span>
            <span className="text-[10px] text-gray-400">
              {formatTimestamp(meta.updated_at)}
            </span>
          </div>
        )}
      </div>
      <div className="flex-1">
        {field.type === 'select' ? (
          <select
            value={displayValue}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">-- 未選擇 --</option>
            {field.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : field.type === 'number' ? (
          <input
            type="number"
            value={displayValue}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={isEmpty ? '待填寫' : ''}
          />
        ) : (
          <input
            type="text"
            value={displayValue}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={isEmpty ? '待填寫' : ''}
          />
        )}
      </div>
    </div>
  );
}
