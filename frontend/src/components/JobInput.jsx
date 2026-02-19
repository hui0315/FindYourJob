import { useState } from 'react';
import { parseJobs } from '../api';

const PLACEHOLDER = `貼上職缺資訊，例如：

職位：前端工程師
公司：ABC科技
薪資：50,000 - 70,000
地點：台北
技能：React, TypeScript, Tailwind
工作類型：全職

---

可以一次貼多筆，用空行或 --- 分隔`;

export default function JobInput({ onParsed, loading, setLoading }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit() {
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

  return (
    <div className="w-full max-w-3xl mx-auto">
      <h2 className="text-lg font-semibold text-gray-700 mb-2">
        貼上職缺資訊
      </h2>
      <textarea
        className="w-full h-64 p-4 border border-gray-300 rounded-lg
                   focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   resize-y text-sm font-mono bg-white text-gray-800
                   placeholder:text-gray-400"
        placeholder={PLACEHOLDER}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={50000}
      />
      <div className="text-xs text-gray-400 text-right mt-1">
        {text.length.toLocaleString()} / 50,000
      </div>
      {error && (
        <p className="text-red-500 text-sm mt-1">{error}</p>
      )}
      <div className="flex gap-3 mt-3">
        <button
          onClick={handleSubmit}
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
  );
}
