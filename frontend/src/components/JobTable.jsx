import { useState } from 'react';
import JobEditModal from './JobEditModal';

const SORT_OPTIONS = [
  { key: 'created_at', label: '加入時間', icon: '⏱' },
  { key: 'salary_max', label: '薪資', icon: '$' },
  { key: 'status', label: '投遞狀態', icon: '📋' },
  { key: 'priority', label: '優先順序', icon: '★' },
  { key: 'skill_match', label: '匹配度', icon: '⚡' },
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

const EDUCATION_LABELS = {
  none: '不拘',
  high_school: '高中',
  bachelor: '大學',
  master: '碩士',
  phd: '博士',
};

const REMOTE_LABELS = {
  onsite: '到班',
  hybrid: '混合',
  remote: '遠端',
};

const PRIORITY_LABELS = {
  1: { text: '最高', color: 'bg-red-500 text-white' },
  2: { text: '高', color: 'bg-orange-400 text-white' },
  3: { text: '中', color: 'bg-yellow-400 text-gray-800' },
  4: { text: '低', color: 'bg-blue-200 text-blue-800' },
  5: { text: '最低', color: 'bg-gray-200 text-gray-600' },
};

const STATUS_LABELS = {
  not_applied:  { text: '未投遞',       color: 'bg-red-100 text-red-700 border-red-300' },
  applied:      { text: '已投遞',       color: 'bg-blue-100 text-blue-700 border-blue-300' },
  interviewing: { text: '面試中',       color: 'bg-orange-100 text-orange-700 border-orange-300' },
  offered:      { text: '已取得 Offer', color: 'bg-green-100 text-green-700 border-green-300' },
  rejected:     { text: '未錄取',       color: 'bg-gray-100 text-gray-400 border-gray-300' },
};

function formatSalary(min, max, type, guaranteedMonths) {
  if (type === 'negotiable') return '面議';
  if (!min && !max) return '-';
  const fmt = (n) => n?.toLocaleString() ?? '?';
  const prefix = SALARY_TYPE_LABELS[type] || '';
  let base;
  if (min === max || !max) base = `${prefix} ${fmt(min)}`;
  else base = `${prefix} ${fmt(min)} - ${fmt(max)}`;
  if (guaranteedMonths) base += ` (${guaranteedMonths}M)`;
  return base;
}

const BENEFIT_CATEGORY_LABELS = {
  bonus: { label: '獎金', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  insurance: { label: '保險', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  leave: { label: '休假', color: 'bg-green-50 text-green-700 border-green-200' },
  subsidy: { label: '補助', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  system: { label: '制度', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  other: { label: '其他', color: 'bg-gray-50 text-gray-600 border-gray-200' },
};

function parseBenefitsStructured(benefitsStructured) {
  if (!benefitsStructured) return null;
  try {
    return JSON.parse(benefitsStructured);
  } catch {
    return null;
  }
}

/**
 * Merge company benefits + job extra benefits into a single structured object.
 * Returns { merged, hasCompany, hasJobExtra } for display purposes.
 */
function mergeBenefits(job) {
  const companyBs = job.company_data
    ? parseBenefitsStructured(job.company_data.benefits_structured)
    : null;
  const jobBs = parseBenefitsStructured(job.benefits_structured);

  if (!companyBs && !jobBs) {
    // Fallback to text
    const companyText = job.company_data?.benefits;
    const jobText = job.benefits;
    return {
      structured: null,
      companyText,
      jobText,
      hasCompany: !!companyText,
      hasJobExtra: !!jobText,
    };
  }

  // Merge structured benefits
  const merged = {};
  const categories = new Set([
    ...Object.keys(companyBs || {}),
    ...Object.keys(jobBs || {}),
  ]);

  for (const cat of categories) {
    const companyItems = (companyBs && companyBs[cat]) || [];
    const jobItems = (jobBs && jobBs[cat]) || [];
    // Deduplicate
    const all = [...companyItems];
    for (const item of jobItems) {
      if (!all.includes(item)) all.push(item);
    }
    if (all.length > 0) merged[cat] = { items: all, companyItems, jobItems };
  }

  return {
    structured: Object.keys(merged).length > 0 ? merged : null,
    companyText: null,
    jobText: null,
    hasCompany: !!companyBs,
    hasJobExtra: !!jobBs,
  };
}

function parseMismatches(mismatches) {
  if (!mismatches) return [];
  try {
    const parsed = JSON.parse(mismatches);
    // Handle both old format (array of strings) and new format (array of objects)
    return parsed.map((item) =>
      typeof item === 'string' ? { type: 'unknown', message: item } : item
    );
  } catch {
    return [];
  }
}

function parseSkillMatch(skill_match) {
  if (!skill_match) return null;
  try {
    return JSON.parse(skill_match);
  } catch {
    return null;
  }
}

function matchScoreColor(score) {
  if (score >= 75) return 'bg-green-100 text-green-700 border-green-300';
  if (score >= 50) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
  return 'bg-red-100 text-red-600 border-red-300';
}

const SOURCE_BADGE_STYLES = {
  user: 'bg-teal-100 text-teal-600',
  import: 'bg-purple-100 text-purple-600',
  llm: 'bg-blue-100 text-blue-600',
  regex: 'bg-gray-200 text-gray-500',
};

const SOURCE_BADGE_LABELS = {
  user: '手動',
  import: '匯入',
  llm: '模型',
  regex: 'Regex',
};

function parseFieldMeta(job) {
  if (!job.field_metadata) return {};
  try { return JSON.parse(job.field_metadata); } catch { return {}; }
}

function SourceBadge({ fieldKey, fieldMeta }) {
  const meta = fieldMeta[fieldKey];
  if (!meta || !meta.source || meta.source === 'llm') return null; // only show non-default sources
  return (
    <span className={`text-[10px] px-1 py-px rounded ml-1 ${SOURCE_BADGE_STYLES[meta.source] || SOURCE_BADGE_STYLES.llm}`}>
      {SOURCE_BADGE_LABELS[meta.source] || meta.source}
    </span>
  );
}

export default function JobTable({ jobs, sortBy, order, onSortChange, onRefresh, onDelete, onJobUpdated, onViewCompany, allCities, selectedCities, onCityFilterChange }) {
  const [expandedId, setExpandedId] = useState(null);
  const [editingJob, setEditingJob] = useState(null);

  function handleSort(key) {
    if (sortBy === key) {
      onSortChange(key, order === 'asc' ? 'desc' : 'asc');
    } else {
      const defaultOrder = (key === 'priority' || key === 'status') ? 'asc' : 'desc';
      onSortChange(key, defaultOrder);
    }
  }

  // Show empty state only when there are truly no jobs AND no city filters to show
  if (jobs.length === 0 && (!allCities || allCities.length === 0)) {
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

      {/* City filter */}
      {allCities && allCities.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-sm text-gray-500 mr-1">篩選：</span>
          <button
            onClick={() => {
              if (selectedCities.length === allCities.length) {
                onCityFilterChange([]);
              } else {
                onCityFilterChange([...allCities]);
              }
            }}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              selectedCities.length === allCities.length
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-500 border-gray-300 hover:border-blue-400'
            }`}
          >
            {selectedCities.length === allCities.length ? '清除全選' : '全選'}
          </button>
          {allCities.map((city) => {
            const checked = selectedCities.includes(city);
            return (
              <label
                key={city}
                className={`flex items-center gap-1 px-2 py-1 text-sm rounded border cursor-pointer transition-colors ${
                  checked
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    if (checked) {
                      onCityFilterChange(selectedCities.filter((c) => c !== city));
                    } else {
                      onCityFilterChange([...selectedCities, city]);
                    }
                  }}
                  className="sr-only"
                />
                {city}
              </label>
            );
          })}
        </div>
      )}

      {/* Empty state when filtering results in 0 jobs */}
      {jobs.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">沒有符合篩選條件的職缺</p>
          <p className="text-sm mt-1">請調整上方縣市篩選</p>
        </div>
      )}

      {/* Job cards */}
      <div className="space-y-3">
        {jobs.map((job) => {
          const expanded = expandedId === job.id;
          const priority = PRIORITY_LABELS[job.priority] || PRIORITY_LABELS[3];
          const workload = job.workload ? WORKLOAD_LABELS[job.workload] : null;
          const mismatches = parseMismatches(job.mismatches);
          const hasMismatch = mismatches.length > 0;
          const skillMatch = parseSkillMatch(job.skill_match);
          const fieldMeta = parseFieldMeta(job);
          const benefitsMerged = mergeBenefits(job);

          return (
            <div
              key={job.id}
              className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow
                ${hasMismatch
                  ? 'border-2 border-red-300'
                  : 'border border-gray-200'
                }${job.status === 'rejected' ? ' opacity-50' : ''}`}
            >
              {/* Mismatch banner */}
              {hasMismatch && (
                <div className="px-4 py-2 bg-red-50 rounded-t-xl border-b border-red-200
                                flex items-start gap-2">
                  <span className="text-red-500 font-bold text-sm shrink-0 mt-0.5">!</span>
                  <div className="text-sm text-red-600">
                    {mismatches.map((item, i) => (
                      <span key={i}>
                        {item.message}{i < mismatches.length - 1 ? '；' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

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
                    <h3 className={`font-semibold truncate ${
                      hasMismatch ? 'text-red-700' : 'text-gray-800'
                    }`}>
                      {job.title}
                    </h3>
                    {job.job_type && (
                      <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
                        {JOB_TYPE_LABELS[job.job_type] || job.job_type}
                      </span>
                    )}
                    {job.remote_type && (
                      <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded">
                        {REMOTE_LABELS[job.remote_type] || job.remote_type}
                      </span>
                    )}
                    {(() => {
                      const st = STATUS_LABELS[job.status] || STATUS_LABELS.not_applied;
                      return (
                        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${st.color}`}>
                          {st.text}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {job.company_data ? (
                      <button
                        className="hover:text-blue-600 hover:underline transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onViewCompany) onViewCompany(job.company_id);
                        }}
                      >
                        {job.company}
                      </button>
                    ) : (
                      job.company
                    )}
                  </p>
                </div>

                {/* Salary */}
                <div className="shrink-0 text-right">
                  <p className={`font-medium ${
                    hasMismatch && mismatches.some((m) => m.type === 'salary')
                      ? 'text-red-600' : 'text-green-700'
                  }`}>
                    {formatSalary(job.salary_min, job.salary_max, job.salary_type, job.salary_guaranteed_months)}
                  </p>
                </div>

                {/* City */}
                <div className="shrink-0 w-20 text-center">
                  <p className={`text-sm ${
                    hasMismatch && mismatches.some((m) => m.type === 'location')
                      ? 'text-red-600 font-medium' : 'text-gray-500'
                  }`}>{job.city || '-'}</p>
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

                {/* Skill match badge */}
                <div className="shrink-0 w-14 text-center">
                  {skillMatch ? (
                    <span className={`text-xs px-2 py-1 rounded-full border font-medium
                                      ${matchScoreColor(skillMatch.score)}`}>
                      {skillMatch.score}%
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
                    {/* Location detail */}
                    {job.location && (
                      <div>
                        <span className="text-gray-400">工作地點：</span>
                        <span className={
                          hasMismatch && mismatches.some((m) => m.type === 'location')
                            ? 'text-red-600 font-medium' : 'text-gray-700'
                        }>
                          {job.location}
                        </span>
                        <SourceBadge fieldKey="location" fieldMeta={fieldMeta} />
                      </div>
                    )}
                    {job.experience_years != null && (
                      <div>
                        <span className="text-gray-400">經驗要求：</span>
                        <span className={
                          hasMismatch && mismatches.some((m) => m.type === 'experience')
                            ? 'text-red-600 font-medium' : 'text-gray-700'
                        }>
                          {job.experience_years === 0 ? '不拘' : `${job.experience_years} 年以上`}
                        </span>
                        <SourceBadge fieldKey="experience_years" fieldMeta={fieldMeta} />
                      </div>
                    )}
                    {job.education && (
                      <div>
                        <span className="text-gray-400">學歷要求：</span>
                        <span className={
                          hasMismatch && mismatches.some((m) => m.type === 'education')
                            ? 'text-red-600 font-medium' : 'text-gray-700'
                        }>
                          {EDUCATION_LABELS[job.education] || job.education}
                        </span>
                        <SourceBadge fieldKey="education" fieldMeta={fieldMeta} />
                      </div>
                    )}
                    {job.work_hours && (
                      <div>
                        <span className="text-gray-400">上班時間：</span>
                        <span className="text-gray-700">{job.work_hours}</span>
                        <SourceBadge fieldKey="work_hours" fieldMeta={fieldMeta} />
                      </div>
                    )}
                    {job.remote_type && (
                      <div>
                        <span className="text-gray-400">遠端類型：</span>
                        <span className="text-gray-700">
                          {REMOTE_LABELS[job.remote_type] || job.remote_type}
                        </span>
                        <SourceBadge fieldKey="remote_type" fieldMeta={fieldMeta} />
                      </div>
                    )}
                    {job.skills && (
                      <div className="col-span-2">
                        <span className="text-gray-400">技能需求：</span>
                        {skillMatch ? (
                          <span className="text-gray-700">
                            {skillMatch.known.length > 0 && (
                              <span>
                                {skillMatch.known.map((s, i) => (
                                  <span key={s} className="text-green-700 font-medium">
                                    {s}{i < skillMatch.known.length - 1 ? ', ' : ''}
                                  </span>
                                ))}
                              </span>
                            )}
                            {skillMatch.known.length > 0 && (skillMatch.learning.length > 0 || skillMatch.missing.length > 0) && ', '}
                            {skillMatch.learning.length > 0 && (
                              <span>
                                {skillMatch.learning.map((s, i) => (
                                  <span key={s} className="text-amber-600">
                                    {s}{i < skillMatch.learning.length - 1 ? ', ' : ''}
                                  </span>
                                ))}
                              </span>
                            )}
                            {skillMatch.learning.length > 0 && skillMatch.missing.length > 0 && ', '}
                            {skillMatch.missing.length > 0 && (
                              <span>
                                {skillMatch.missing.map((s, i) => (
                                  <span key={s} className="text-gray-400">
                                    {s}{i < skillMatch.missing.length - 1 ? ', ' : ''}
                                  </span>
                                ))}
                              </span>
                            )}
                            <span className="text-xs text-gray-400 ml-2">
                              ({skillMatch.score}% 匹配)
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-700">{job.skills}</span>
                        )}
                      </div>
                    )}
                    {job.description && (
                      <div className="col-span-2">
                        <span className="text-gray-400">工作內容：</span>
                        <SourceBadge fieldKey="description" fieldMeta={fieldMeta} />
                        <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                          {job.description}
                        </div>
                      </div>
                    )}
                    {job.salary_guaranteed_months && (
                      <div>
                        <span className="text-gray-400">保障年薪：</span>
                        <span className="text-green-700 font-medium">{job.salary_guaranteed_months} 個月</span>
                        <SourceBadge fieldKey="salary_guaranteed_months" fieldMeta={fieldMeta} />
                      </div>
                    )}
                    {job.leave_policy && (
                      <div>
                        <span className="text-gray-400">休假制度：</span>
                        <span className="text-gray-700">{job.leave_policy}</span>
                        <SourceBadge fieldKey="leave_policy" fieldMeta={fieldMeta} />
                      </div>
                    )}
                    {job.language && (
                      <div>
                        <span className="text-gray-400">語文條件：</span>
                        <span className="text-gray-700">{job.language}</span>
                        <SourceBadge fieldKey="language" fieldMeta={fieldMeta} />
                      </div>
                    )}

                    {/* ── Merged benefits (company + job extra) ── */}
                    {(() => {
                      if (benefitsMerged.structured) {
                        const categories = Object.entries(benefitsMerged.structured);
                        return (
                          <div className="col-span-2">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-gray-400">福利制度：</span>
                              {benefitsMerged.hasCompany && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded">
                                  公司福利
                                </span>
                              )}
                              {benefitsMerged.hasJobExtra && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-teal-50 text-teal-500 rounded">
                                  + 職缺額外
                                </span>
                              )}
                            </div>
                            <div className="space-y-1">
                              {categories
                                .filter(([, { items }]) => items.length > 0)
                                .map(([cat, { items, companyItems, jobItems }]) => {
                                  const meta = BENEFIT_CATEGORY_LABELS[cat] || BENEFIT_CATEGORY_LABELS.other;
                                  return (
                                    <div key={cat} className="flex items-start gap-1.5">
                                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded shrink-0 ${meta.color}`}>
                                        {meta.label}
                                      </span>
                                      <div className="flex flex-wrap gap-1">
                                        {items.map((item) => {
                                          const isExtra = jobItems.includes(item) && !companyItems.includes(item);
                                          return (
                                            <span
                                              key={`${cat}-${item}`}
                                              className={`text-xs px-2 py-0.5 rounded border ${meta.color}
                                                ${isExtra ? 'ring-1 ring-teal-300' : ''}`}
                                            >
                                              {item}
                                              {isExtra && <span className="text-[9px] ml-0.5 text-teal-500">+</span>}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        );
                      }
                      // Fallback to text
                      const texts = [
                        benefitsMerged.companyText,
                        benefitsMerged.jobText,
                      ].filter(Boolean);
                      if (texts.length > 0) {
                        return (
                          <div className="col-span-2">
                            <span className="text-gray-400">福利：</span>
                            <span className="text-gray-700">{texts.join('；')}</span>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Company contact info (from company_data) */}
                    {job.company_data && (job.company_data.contact_name || job.company_data.contact_email || job.company_data.contact_phone) && (
                      <div className="col-span-2">
                        <span className="text-gray-400">公司聯絡：</span>
                        <span className="text-gray-700">
                          {[
                            job.company_data.contact_name &&
                              `${job.company_data.contact_name}${job.company_data.contact_title ? ` (${job.company_data.contact_title})` : ''}`,
                            job.company_data.contact_phone,
                            job.company_data.contact_email,
                          ].filter(Boolean).join(' / ')}
                        </span>
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
                        setEditingJob(job);
                      }}
                      className="px-3 py-1 text-sm text-blue-600 border border-blue-200
                                 rounded hover:bg-blue-50 transition-colors"
                    >
                      編輯
                    </button>
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
        {jobs.some((j) => j.mismatches && JSON.parse(j.mismatches).length > 0) && (
          <span className="text-red-400 ml-2">
            （{jobs.filter((j) => {
              try { return JSON.parse(j.mismatches || '[]').length > 0; }
              catch { return false; }
            }).length} 筆不符合條件）
          </span>
        )}
      </div>

      {/* Edit Modal */}
      {editingJob && (
        <JobEditModal
          job={editingJob}
          onSave={(updatedJob) => {
            setEditingJob(updatedJob);
            if (onJobUpdated) onJobUpdated(updatedJob);
          }}
          onClose={() => setEditingJob(null)}
        />
      )}
    </div>
  );
}
