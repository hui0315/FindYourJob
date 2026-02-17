import { useState } from 'react';

const SORT_OPTIONS = [
  { key: 'created_at', label: '加入時間', icon: '⏱' },
  { key: 'salary_max', label: '薪資高低', icon: '$' },
  { key: 'priority', label: '優先順序', icon: '!' },
  { key: 'company', label: '公司名稱', icon: 'A' },
  { key: 'location', label: '工作地點', icon: '⌂' },
  { key: 'workload', label: '工作量', icon: '◷' },
];

const SALARY_TYPE_LABELS = {
  monthly: '月薪',
  yearly: '年薪',
  hourly: '時薪',
  negotiable: '面議',
};

const WORKLOAD_LABELS = {
  light: { text: '輕鬆', color: 'bg-green-100 text-green-700' },
  moderate: { text: '適中', color: 'bg-yellow-100 text-yellow-700' },
  heavy: { text: '繁重', color: 'bg-red-100 text-red-700' },
};

const JOB_TYPE_LABELS = {
  'full-time': '全職',
  'part-time': '兼職',
  contract: '約聘',
  intern: '實習',
};

const PRIORITY_LABELS = {
  1: { text: '最高', color: 'bg-red-500 text-white' },
  2: { text: '高', color: 'bg-orange-400 text-white' },
  3: { text: '中', color: 'bg-yellow-400 text-gray-800' },
  4: { text: '低', color: 'bg-blue-200 text-blue-800' },
  5: { text: '最低', color: 'bg-gray-200 text-gray-600' },
};

function formatSalary(min, max, type) {
  if (type === 'negotiable') return '面議';
  if (!min && !max) return '-';
  const fmt = (n) => n?.toLocaleString() ?? '?';
  const prefix = SALARY_TYPE_LABELS[type] || '';
  if (min === max || !max) return `${prefix} ${fmt(min)}`;
  return `${prefix} ${fmt(min)} - ${fmt(max)}`;
}

export default function JobTable({ jobs, sortBy, order, onSortChange, onRefresh, onDelete }) {
  const [expandedId, setExpandedId] = useState(null);

  function handleSort(key) {
    if (sortBy === key) {
      onSortChange(key, order === 'asc' ? 'desc' : 'asc');
    } else {
      const defaultOrder = key === 'salary_max' ? 'desc' : key === 'priority' ? 'asc' : 'desc';
      onSortChange(key, defaultOrder);
    }
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-4">📋</p>
        <p className="text-lg">尚無職缺資料</p>
        <p className="text-sm mt-1">在上方貼上職缺資訊並送出解析</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-sm text-gray-500 mr-1">排序：</span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => handleSort(opt.key)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors
              ${sortBy === opt.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
          >
            <span className="mr-1">{opt.icon}</span>
            {opt.label}
            {sortBy === opt.key && (
              <span className="ml-1">{order === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
        ))}
      </div>

      {/* Job cards */}
      <div className="space-y-3">
        {jobs.map((job) => {
          const expanded = expandedId === job.id;
          const priority = PRIORITY_LABELS[job.priority] || PRIORITY_LABELS[3];
          const workload = job.workload ? WORKLOAD_LABELS[job.workload] : null;

          return (
            <div
              key={job.id}
              className="bg-white border border-gray-200 rounded-xl shadow-sm
                         hover:shadow-md transition-shadow"
            >
              {/* Main row */}
              <div
                className="p-4 flex items-center gap-4 cursor-pointer"
                onClick={() => setExpandedId(expanded ? null : job.id)}
              >
                {/* Priority badge */}
                <span className={`shrink-0 w-8 h-8 rounded-full flex items-center
                                  justify-center text-xs font-bold ${priority.color}`}>
                  {job.priority}
                </span>

                {/* Core info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-800 truncate">
                      {job.title}
                    </h3>
                    {job.job_type && (
                      <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
                        {JOB_TYPE_LABELS[job.job_type] || job.job_type}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">{job.company}</p>
                </div>

                {/* Salary */}
                <div className="shrink-0 text-right">
                  <p className="font-medium text-green-700">
                    {formatSalary(job.salary_min, job.salary_max, job.salary_type)}
                  </p>
                </div>

                {/* Location */}
                <div className="shrink-0 w-20 text-center">
                  <p className="text-sm text-gray-500">{job.location || '-'}</p>
                </div>

                {/* Workload */}
                <div className="shrink-0 w-16 text-center">
                  {workload ? (
                    <span className={`text-xs px-2 py-1 rounded-full ${workload.color}`}>
                      {workload.text}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">-</span>
                  )}
                </div>

                {/* Expand icon */}
                <span className="shrink-0 text-gray-400 text-sm">
                  {expanded ? '▲' : '▼'}
                </span>
              </div>

              {/* Expanded detail */}
              {expanded && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-3 text-sm">
                    {job.skills && (
                      <div className="col-span-2">
                        <span className="text-gray-400">技能需求：</span>
                        <span className="text-gray-700">{job.skills}</span>
                      </div>
                    )}
                    {job.source_url && (
                      <div className="col-span-2">
                        <span className="text-gray-400">來源：</span>
                        <a
                          href={job.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          {job.source_url}
                        </a>
                      </div>
                    )}
                    {job.notes && (
                      <div className="col-span-2">
                        <span className="text-gray-400">備註：</span>
                        <span className="text-gray-700">{job.notes}</span>
                      </div>
                    )}
                    {job.raw_text && (
                      <details className="col-span-2 mt-2">
                        <summary className="text-gray-400 cursor-pointer hover:text-gray-600">
                          原始文字
                        </summary>
                        <pre className="mt-1 p-3 bg-gray-50 rounded text-xs text-gray-600
                                        whitespace-pre-wrap overflow-x-auto max-h-40">
                          {job.raw_text}
                        </pre>
                      </details>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(job.id);
                      }}
                      className="px-3 py-1 text-sm text-red-500 border border-red-200
                                 rounded hover:bg-red-50 transition-colors"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer stats */}
      <div className="mt-4 text-sm text-gray-400 text-center">
        共 {jobs.length} 筆職缺
      </div>
    </div>
  );
}
