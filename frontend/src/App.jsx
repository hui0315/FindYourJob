import { useState, useEffect, useCallback } from 'react';
import JobInput from './components/JobInput';
import JobTable from './components/JobTable';
import { fetchJobs, deleteJob, deleteAllJobs, fetchStatus } from './api';

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [sortBy, setSortBy] = useState('created_at');
  const [order, setOrder] = useState('desc');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('input'); // 'input' | 'table'
  const [status, setStatus] = useState(null);

  const loadJobs = useCallback(async () => {
    try {
      const data = await fetchJobs(sortBy, order);
      setJobs(data);
    } catch {
      // silently fail on initial load
    }
  }, [sortBy, order]);

  useEffect(() => {
    loadJobs();
    fetchStatus().then(setStatus);
  }, [loadJobs]);

  function handleParsed(newJobs) {
    setJobs((prev) => [...newJobs, ...prev]);
    setView('table');
  }

  function handleSortChange(key, dir) {
    setSortBy(key);
    setOrder(dir);
  }

  async function handleDelete(id) {
    try {
      await deleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch {
      alert('刪除失敗');
    }
  }

  async function handleClearAll() {
    if (!confirm('確定要清除所有職缺嗎？')) return;
    try {
      await deleteAllJobs();
      setJobs([]);
    } catch {
      alert('清除失敗');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-800">
              FindYourJob
            </h1>
            {status && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                status.ollama_available
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {status.ollama_available ? `LLM: ${status.model}` : 'Regex 模式'}
              </span>
            )}
          </div>
          <nav className="flex gap-1">
            <button
              onClick={() => setView('input')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${view === 'input'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              輸入職缺
            </button>
            <button
              onClick={() => { setView('table'); loadJobs(); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${view === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              整理檢視
              {jobs.length > 0 && (
                <span className="ml-1.5 bg-blue-500 text-white text-xs
                                  px-1.5 py-0.5 rounded-full">
                  {jobs.length}
                </span>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {view === 'input' ? (
          <JobInput
            onParsed={handleParsed}
            loading={loading}
            setLoading={setLoading}
          />
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-700">
                職缺列表
              </h2>
              {jobs.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-sm text-red-400 hover:text-red-600 transition-colors"
                >
                  清除全部
                </button>
              )}
            </div>
            <JobTable
              jobs={jobs}
              sortBy={sortBy}
              order={order}
              onSortChange={handleSortChange}
              onRefresh={loadJobs}
              onDelete={handleDelete}
            />
          </div>
        )}
      </main>
    </div>
  );
}
