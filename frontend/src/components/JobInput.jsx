import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Copy, Check,
  Search, ClipboardPaste, FileText, Sparkles, ClipboardCheck, CircleCheck,
  ChevronDown, ChevronRight,
} from 'lucide-react';
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

const JSON_PLACEHOLDER = `貼上 AI 回覆的內容，例如：

{
  "title": "前端工程師",
  "company": "ABC科技",
  "salary_min": 50000,
  ...
}

支援一筆或多筆資料
也支援被程式碼區塊包覆的格式`;

const GUIDE_KEY = 'fyj_guide_completed';

const ONBOARDING_STEPS = [
  { icon: Search,         label: '找到感興趣的職缺', sub: '104、1111 等求職網' },
  { icon: ClipboardPaste, label: '貼上職缺內容',     sub: '不須整理，直接貼' },
  { icon: FileText,       label: '複製我們的模板' },
  { icon: Sparkles,       label: '貼到 AI 工具',     sub: 'ChatGPT、Gemini 等' },
  { icon: ClipboardCheck, label: '把結果貼回來' },
  { icon: CircleCheck,    label: '完成！' },
];

export default function JobInput({ onParsed, loading, setLoading }) {
  // 'input' = 貼原始文字 | 'online' = 線上 AI 流程
  const [step, setStep] = useState('input');
  const [rawText, setRawText] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [copied, setCopied] = useState(false);

  // 引導區塊：第一次成功解析前顯示
  const [guideVisible, setGuideVisible] = useState(() => {
    try { return localStorage.getItem(GUIDE_KEY) !== 'true'; }
    catch { return true; }
  });
  const [guideOpen, setGuideOpen] = useState(true);

  useEffect(() => {
    fetchPromptTemplate().then((p) => {
      if (p) setPromptTemplate(p);
    });
  }, []);

  const combinedPrompt = promptTemplate
    ? promptTemplate + '\n' + rawText
    : rawText;

  function markGuideCompleted() {
    setGuideVisible(false);
    try { localStorage.setItem(GUIDE_KEY, 'true'); }
    catch { /* localStorage unavailable */ }
  }

  // ── 路線 B：自動解析 ──
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
      markGuideCompleted();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── 路線 A：進入線上 AI 流程 ──
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

  // ── 路線 A：匯入 AI 結果 ──
  async function handleImport() {
    if (!jsonText.trim()) {
      setError('請貼上 AI 回覆的內容');
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
      markGuideCompleted();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── 複製組合好的模板 ──
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
          {/* ── Onboarding 引導區塊 ── */}
          {guideVisible && (
            <div className="mb-6">
              <button
                onClick={() => setGuideOpen((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium text-primary-600
                           hover:text-primary-700 transition-colors mb-2"
              >
                {guideOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                使用流程說明
                {!guideOpen && (
                  <span className="text-xs text-surface-400 font-normal">（點擊展開）</span>
                )}
              </button>

              <AnimatePresence>
                {guideOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-100
                                    rounded-xl p-5">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        {ONBOARDING_STEPS.map((s, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="flex flex-col items-center text-center w-20">
                              <div className="w-10 h-10 rounded-full bg-white border-2 border-primary-200
                                              flex items-center justify-center text-primary-600 mb-1.5
                                              shadow-sm">
                                <s.icon size={18} />
                              </div>
                              <span className="text-xs font-medium text-surface-700 leading-tight">
                                {s.label}
                              </span>
                              {s.sub && (
                                <span className="text-[10px] text-surface-400 leading-tight mt-0.5">
                                  {s.sub}
                                </span>
                              )}
                            </div>
                            {i < ONBOARDING_STEPS.length - 1 && (
                              <span className="text-surface-300 text-lg mt-[-12px]">→</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <h2 className="text-lg font-semibold text-surface-700 mb-1">
            貼上職缺資訊
          </h2>
          <p className="text-sm text-surface-400 mb-2">
            從求職網站複製職缺內容，直接貼上即可，不需要整理格式
          </p>
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
              透過 AI 整理
            </button>
            <button
              onClick={handleLocalParse}
              disabled={loading}
              className="text-sm text-surface-400 hover:text-surface-500
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              {loading ? '解析中...' : '自動解析'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: 線上 AI 流程 ── */}
      {step === 'online' && (
        <div>
          {/* 返回 */}
          <button
            onClick={handleBack}
            className="text-sm text-surface-400 hover:text-surface-600 mb-4 transition-colors"
          >
            <ArrowLeft size={14} className="inline-block mr-1" />返回修改
          </button>

          {/* 組合好的模板 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-surface-700">
                複製以下內容貼到 AI 工具
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
              <li>把 AI 回覆的結果貼到下方</li>
            </ol>
          </div>

          {/* AI 結果貼回區 */}
          <h3 className="text-sm font-medium text-surface-600 mb-1">
            貼上 AI 回覆的結果
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
