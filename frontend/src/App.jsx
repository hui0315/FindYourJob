import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { User, PenLine, LayoutList, Building2 } from 'lucide-react';
import JobInput from './components/JobInput';
import JobTable from './components/JobTable';
import ProfileSettings from './components/ProfileSettings';
import CompanyManager from './components/CompanyManager';
import { fetchJobs, deleteJob, deleteAllJobs, fetchStatus, fetchCities } from './api';

function LogoIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" className="fill-primary-600" />
      <circle cx="16" cy="16" r="7" stroke="white" strokeWidth="2" fill="none" />
      <circle cx="16" cy="16" r="2.5" fill="white" />
      <line x1="16" y1="6" x2="16" y2="11" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="21" x2="16" y2="26" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6" y1="16" x2="11" y2="16" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="21" y1="16" x2="26" y2="16" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

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

  function handleViewCompany() {
    setView('companies');
  }

  const NAV_ITEMS = [
    { key: 'profile', label: '我的條件', icon: User },
    { key: 'input', label: '輸入職缺', icon: PenLine },
    { key: 'table', label: '整理檢視', icon: LayoutList, badge: jobs.length || null },
    { key: 'companies', label: '公司管理', icon: Building2 },
  ];

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-surface-200/60 sticky top-0 z-10 shadow-header">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <LogoIcon size={28} />
              <h1 className="text-xl tracking-tight">
                <span className="font-medium text-surface-500">Find</span>
                <span className="font-bold text-primary-700">YourJob</span>
              </h1>
            </div>
            {status && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                status.ollama_available
                  ? 'bg-green-50 text-green-600 border border-green-200'
                  : 'bg-amber-50 text-amber-600 border border-amber-200'
              }`}>
                {status.ollama_available ? `LLM: ${status.model}` : 'Regex 模式'}
              </span>
            )}
          </div>
          <nav className="flex gap-1 bg-surface-100 rounded-xl p-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = view === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    setView(item.key);
                    if (item.key === 'table') loadJobs();
                  }}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm
                              font-medium transition-colors duration-200
                    ${isActive
                      ? 'text-primary-700'
                      : 'text-surface-500 hover:text-surface-700'
                    }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-white rounded-lg shadow-sm"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="relative flex items-center gap-2">
                    <Icon size={16} strokeWidth={isActive ? 2.25 : 1.75} />
                    {item.label}
                    {item.badge && (
                      <span className="bg-primary-100 text-primary-700 text-xs
                                        px-1.5 py-0.5 rounded-full font-medium">
                        {item.badge}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-10">
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
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-surface-700">
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
          <CompanyManager />
        )}
      </main>
    </div>
  );
}
