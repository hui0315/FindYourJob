import { useState, useEffect } from 'react';
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
  "salary_max": 70000,
  "salary_type": "monthly",
  ...
}

支援單筆 JSON 物件或多筆 JSON 陣列
也支援 \`\`\`json ... \`\`\` 格式`;

const MODES = [
  { key: 'online', label: '線上 LLM' },
  { key: 'local', label: '本地模型' },
];

export default function JobInput({ onParsed, loading, setLoading }) {
  const [mode, setMode] = useState('online');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchPromptTemplate().then((p) => {
      if (p) setPromptTemplate(p);
    });
  }, []);

  async function handleParse() {
    if (!text.trim()) {
      setError('請輸入職缺資訊');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const jobs = await parseJobs(text);
      onParsed(jobs);
      setText('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!text.trim()) {
      setError('請貼上 LLM 回覆的 JSON');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const jobs = await importJobs(text);
      onParsed(jobs);
      setText('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(promptTemplate);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS contexts
      const ta = document.createElement('textarea');
      ta.value = promptTemplate;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // Clear text and error when switching modes
  function switchMode(newMode) {
    setMode(newMode);
    setText('');
    setError('');
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Mode toggle */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => switchMode(m.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors
              ${mode === m.key
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Mode A: Online LLM */}
      {mode === 'online' && (
        <div>
          {/* Prompt display */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-700">
                Prompt 模板
              </h2>
              <button
                onClick={handleCopy}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  copied
                    ? 'bg-green-50 text-green-600 border-green-300'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                {copied ? 'OK' : 'Copy'}
              </button>
            </div>
            <pre className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg
                            text-xs font-mono text-gray-700 whitespace-pre-wrap
                            overflow-y-auto max-h-48 leading-relaxed">
              {promptTemplate || '載入中...'}
            </pre>
          </div>

          {/* Steps */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
            <p className="font-medium mb-1">使用步驟：</p>
            <ol className="list-decimal list-inside space-y-0.5 text-blue-600">
              <li>複製上方 Prompt</li>
              <li>連同職缺文字一起貼到 ChatGPT / Gemini / Claude</li>
              <li>把 LLM 回覆的 JSON 貼到下方</li>
            </ol>
          </div>

          {/* JSON input */}
          <h3 className="text-sm font-medium text-gray-600 mb-1">
            貼上 LLM 回覆的 JSON
          </h3>
          <textarea
            className="w-full h-48 p-4 border border-gray-300 rounded-lg
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       resize-y text-sm font-mono bg-white text-gray-800
                       placeholder:text-gray-400"
            placeholder={JSON_PLACEHOLDER}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          <div className="flex gap-3 mt-3">
            <button
              onClick={handleImport}
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium
                         hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              {loading ? '匯入中...' : '匯入'}
            </button>
            <button
              onClick={() => setText('')}
              className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg
                         hover:bg-gray-200 transition-colors"
            >
              清除
            </button>
          </div>
        </div>
      )}

      {/* Mode B: Local model */}
      {mode === 'local' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            貼上職缺資訊
          </h2>
          <textarea
            className="w-full h-64 p-4 border border-gray-300 rounded-lg
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       resize-y text-sm font-mono bg-white text-gray-800
                       placeholder:text-gray-400"
            placeholder={RAW_PLACEHOLDER}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={50000}
          />
          <div className="text-xs text-gray-400 text-right mt-1">
            {text.length.toLocaleString()} / 50,000
          </div>
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          <div className="flex gap-3 mt-3">
            <button
              onClick={handleParse}
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium
                         hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              {loading ? '解析中...' : '送出解析'}
            </button>
            <button
              onClick={() => setText('')}
              className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg
                         hover:bg-gray-200 transition-colors"
            >
              清除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
