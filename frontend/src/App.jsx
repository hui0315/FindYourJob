import { useState, useEffect, useCallback } from 'react';
import JobInput from './components/JobInput';
import JobTable from './components/JobTable';
import ProfileSettings from './components/ProfileSettings';
import CompanyManager from './components/CompanyManager';
import { fetchJobs, deleteJob, deleteAllJobs, fetchStatus, fetchCities } from './api';

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [sortBy, setSortBy] = useState('created_at');
  const [order, setOrder] = useState('desc');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('input'); // 'input' | 'table' | 'profile' | 'companies'
  const [status, setStatus] = useState(null);
  const [allCities, setAllCities] = useState([]);           // all distinct cities
  const [selectedCities, setSelectedCities] = useState(null); // null = not yet loaded

  const loadCities = useCallback(async () => {
    const cities = await fetchCities();
    setAllCities(cities);
    setSelectedCities((prev) => {
      if (prev === null) return cities; // first load: select all
      // On refresh: keep existing selections, auto-select any new cities
      const newCities = cities.filter((c) => !prev.includes(c));
      return newCities.length > 0 ? [...prev, ...newCities] : prev;
    });
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      // If filter is active (allCities exist) but nothing selected → show empty
      if (selectedCities && selectedCities.length === 0 && allCities.length > 0) {
        setJobs([]);
        return;
      }
      const citiesToSend = selectedCities || [];
      const data = await fetchJobs(sortBy, order, citiesToSend);
      setJobs(data);
    } catch {
      // silently fail on initial load
    }
  }, [sortBy, order, selectedCities, allCities]);

  useEffect(() => {
    loadCities();
    fetchStatus().then(setStatus);
  }, [loadCities]);

  useEffect(() => {
    if (selectedCities !== null) {
      loadJobs();
    }
  }, [loadJobs, selectedCities]);

  function handleParsed(newJobs) {
    setJobs((prev) => [...newJobs, ...prev]);
    setView('table');
    // Refresh cities since new jobs may have new cities
    loadCities();
  }

  function handleSortChange(key, dir) {
    setSortBy(key);
    setOrder(dir);
  }

  function handleJobUpdated(updatedJob) {
    setJobs((prev) =>
      prev.map((j) => (j.id === updatedJob.id ? updatedJob : j))
    );
  }

  async function handleDelete(id) {
    try {
      await deleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
      loadCities();
    } catch {
      alert('刪除失敗');
    }
  }

  async function handleClearAll() {
    if (!confirm('確定要清除所有職缺嗎？')) return;
    try {
      await deleteAllJobs();
      setJobs([]);
      setAllCities([]);
      setSelectedCities([]);
    } catch {
      alert('清除失敗');
    }
  }

  function handleViewCompany(companyId) {
    setView('companies');
  }

  const NAV_ITEMS = [
    { key: 'profile', label: '我的條件' },
    { key: 'input', label: '輸入職缺' },
    { key: 'table', label: '整理檢視', badge: jobs.length || null },
    { key: 'companies', label: '公司管理' },
  ];

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
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setView(item.key);
                  if (item.key === 'table') loadJobs();
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${view === item.key
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                {item.label}
                {item.badge && (
                  <span className="ml-1.5 bg-blue-500 text-white text-xs
                                    px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {view === 'profile' && (
          <ProfileSettings />
        )}

        {view === 'input' && (
          <JobInput
            onParsed={handleParsed}
            loading={loading}
            setLoading={setLoading}
          />
        )}

        {view === 'table' && (
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
              onJobUpdated={handleJobUpdated}
              onViewCompany={handleViewCompany}
              allCities={allCities}
              selectedCities={selectedCities || []}
              onCityFilterChange={setSelectedCities}
            />
          </div>
        )}

        {view === 'companies' && (
          <CompanyManager onNavigateToJob={(jobId) => setView('table')} />
        )}
      </main>
    </div>
  );
}
