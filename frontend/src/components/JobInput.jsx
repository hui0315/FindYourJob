import { useState, useEffect } from 'react';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import { parseJobs, importJobs, fetchPromptTemplate } from '../api';

const RAW_PLACEHOLDER = `貼上職缺資訊，例如：

職位：前端工程師
公司：ABC科技
薪資：月薪 50,000 - 70,000
保障年薪：14個月（含年終2個月）
地點：台北市信義區
技能：React, TypeScript, Tailwind
工作類型：全職
休假制度：週休二日
語文條件：英文中等以上
福利：三節獎金、績效獎金、員工旅遊、旅遊補助、團體保險、教育訓練

---

可以一次貼多筆，用空行或 --- 分隔
也可以直接從 104 / 1111 複製貼上`;

const JSON_PLACEHOLDER = `貼上 LLM 回覆的 JSON，例如：

{
  "title": "前端工程師",
  "company": "ABC科技",
  "salary_min": 50000,
  ...
}

支援單筆 JSON 物件或多筆 JSON 陣列
也支援 \`\`\`json ... \`\`\` 格式`;

export default function JobInput({ onParsed, loading, setLoading }) {
  // 'input' = 貼原始文字 | 'online' = 線上 LLM 流程
  const [step, setStep] = useState('input');
  const [rawText, setRawText] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchPromptTemplate().then((p) => {
      if (p) setPromptTemplate(p);
    });
  }, []);

  const combinedPrompt = promptTemplate
    ? promptTemplate + '\n' + rawText
    : rawText;

  // ── 路線 B：本地模型解析 ──
  async function handleLocalParse() {
    if (!rawText.trim()) {
      setError('請輸入職缺資訊');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const jobs = await parseJobs(rawText);
      onParsed(jobs);
      setRawText('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── 路線 A：進入線上 LLM 流程 ──
  function handleGoOnline() {
    if (!rawText.trim()) {
      setError('請先輸入職缺資訊');
      return;
    }
    setError('');
    setJsonText('');
    setCopied(false);
    setStep('online');
  }

  // ── 路線 A：匯入 JSON ──
  async function handleImport() {
    if (!jsonText.trim()) {
      setError('請貼上 LLM 回覆的 JSON');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const jobs = await importJobs(jsonText, rawText);
      onParsed(jobs);
      setRawText('');
      setJsonText('');
      setStep('input');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── 複製組合好的 prompt ──
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

  function handleBack() {
    setStep('input');
    setJsonText('');
    setError('');
  }

  return (
    <div className="w-full max-w-3xl mx-auto">

      {/* ── Step 1: 貼上原始文字 ── */}
      {step === 'input' && (
        <div>
          <h2 className="text-lg font-semibold text-surface-700 mb-2">
            貼上職缺資訊
          </h2>
          <textarea
            className="w-full h-64 p-4 border border-surface-300 rounded-lg
                       focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       resize-y text-sm font-mono bg-white text-surface-800
                       placeholder:text-surface-400"
            placeholder={RAW_PLACEHOLDER}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            maxLength={50000}
          />
          <div className="text-xs text-surface-400 text-right mt-1">
            {rawText.length.toLocaleString()} / 50,000
          </div>

          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}

          {/* 兩個行動按鈕 */}
          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={handleGoOnline}
              disabled={loading}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium
                         hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              複製 Prompt 給線上 LLM
            </button>
            <button
              onClick={handleLocalParse}
              disabled={loading}
              className="text-sm text-surface-400 hover:text-surface-500
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              {loading ? '解析中...' : '本地模型解析'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: 線上 LLM 流程 ── */}
      {step === 'online' && (
        <div>
          {/* 返回 */}
          <button
            onClick={handleBack}
            className="text-sm text-surface-400 hover:text-surface-600 mb-4 transition-colors"
          >
            <ArrowLeft size={14} className="inline-block mr-1" />返回修改
          </button>

          {/* 組合好的 prompt */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-surface-700">
                複製以下內容貼到 LLM
              </h2>
              <button
                onClick={handleCopy}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  copied
                    ? 'bg-green-50 text-green-600 border-green-300'
                    : 'bg-white text-surface-600 border-surface-300 hover:border-primary-400 hover:text-primary-600'
                }`}
              >
                {copied ? <><Check size={14} className="inline-block mr-1" />已複製</> : <><Copy size={14} className="inline-block mr-1" />複製</>}
              </button>
            </div>
            <pre className="w-full p-4 bg-surface-50 border border-surface-200 rounded-lg
                            text-xs font-mono text-surface-700 whitespace-pre-wrap
                            overflow-y-auto max-h-64 leading-relaxed">
              {combinedPrompt}
            </pre>
          </div>

          {/* 步驟提示 */}
          <div className="mb-4 p-3 bg-primary-50 border border-primary-100 rounded-lg text-sm text-primary-700">
            <ol className="list-decimal list-inside space-y-0.5 text-primary-600">
              <li>複製上方內容</li>
              <li>貼到 ChatGPT / Gemini / Claude</li>
              <li>把 LLM 回覆的 JSON 貼到下方</li>
            </ol>
          </div>

          {/* JSON 貼回區 */}
          <h3 className="text-sm font-medium text-surface-600 mb-1">
            貼上 LLM 回覆的 JSON
          </h3>
          <textarea
            className="w-full h-48 p-4 border border-surface-300 rounded-lg
                       focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       resize-y text-sm font-mono bg-white text-surface-800
                       placeholder:text-surface-400"
            placeholder={JSON_PLACEHOLDER}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          <div className="flex gap-3 mt-3">
            <button
              onClick={handleImport}
              disabled={loading}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium
                         hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              {loading ? '匯入中...' : '匯入'}
            </button>
            <button
              onClick={() => setJsonText('')}
              className="px-4 py-2.5 bg-surface-100 text-surface-600 rounded-lg
                         hover:bg-surface-200 transition-colors"
            >
              清除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
