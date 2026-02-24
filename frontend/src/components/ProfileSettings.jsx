import { useState, useEffect } from 'react';
import { fetchProfile, updateProfile } from '../api';
import SkillPicker from './SkillPicker';

const EDUCATION_OPTIONS = [
  { value: '', label: '不設定' },
  { value: 'high_school', label: '高中/高職' },
  { value: 'bachelor', label: '大學/大專' },
  { value: 'master', label: '碩士' },
  { value: 'phd', label: '博士' },
];

const JOB_TYPE_OPTIONS = [
  { value: 'full-time', label: '正職' },
  { value: 'part-time', label: '兼職' },
  { value: 'contract', label: '約聘' },
  { value: 'intern', label: '實習' },
];

const REMOTE_TYPE_OPTIONS = [
  { value: 'onsite', label: '到班' },
  { value: 'hybrid', label: '混合' },
  { value: 'remote', label: '遠端' },
];

const EDUCATION_LABEL = Object.fromEntries(
  EDUCATION_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label])
);
const JOB_TYPE_LABEL = Object.fromEntries(
  JOB_TYPE_OPTIONS.map((o) => [o.value, o.label])
);
const REMOTE_TYPE_LABEL = Object.fromEntries(
  REMOTE_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

function parseCommaSeparated(str) {
  if (!str) return [];
  return str.split(',').map((s) => s.trim()).filter(Boolean);
}

function profileFromApi(data) {
  return {
    experience_years: data.experience_years ?? '',
    education: data.education ?? '',
    skills: data.skills ?? '',
    preferred_job_types: parseCommaSeparated(data.preferred_job_types),
    preferred_remote_types: parseCommaSeparated(data.preferred_remote_types),
  };
}

function hasSavedConditions(p) {
  return p.experience_years !== '' || p.education !== ''
    || p.preferred_job_types.length > 0 || p.preferred_remote_types.length > 0;
}

export default function ProfileSettings({ onSaved }) {
  const [profile, setProfile] = useState({
    experience_years: '',
    education: '',
    skills: '',
    preferred_job_types: [],
    preferred_remote_types: [],
  });
  const [savedProfile, setSavedProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchProfile().then((data) => {
      if (data) {
        const p = profileFromApi(data);
        setProfile(p);
        setSavedProfile(p);
      }
    });
  }, []);

  function handleChange(field, value) {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setMessage('');
  }

  function toggleCheckbox(field, value) {
    setProfile((prev) => {
      const current = prev[field];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [field]: next };
    });
    setMessage('');
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        experience_years: profile.experience_years === '' ? null : Number(profile.experience_years),
        education: profile.education || null,
        skills: profile.skills || null,
        preferred_job_types: profile.preferred_job_types.length > 0
          ? profile.preferred_job_types.join(',') : null,
        preferred_remote_types: profile.preferred_remote_types.length > 0
          ? profile.preferred_remote_types.join(',') : null,
      };
      await updateProfile(payload);
      setMessage('已儲存，所有職缺的衝突狀態已重新計算');
      setSavedProfile({ ...profile });
      onSaved?.();
    } catch {
      setMessage('儲存失敗');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold text-gray-700 mb-1">
        我的條件
      </h2>
      <p className="text-sm text-gray-400 mb-6">
        設定你的硬性條件，系統會在職缺不符合時自動警告
      </p>

      {/* Currently saved conditions summary */}
      {savedProfile && hasSavedConditions(savedProfile) && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <h3 className="text-sm font-medium text-blue-800 mb-2">
            目前已儲存的條件
          </h3>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-blue-700">
            {savedProfile.experience_years !== '' && (
              <span>年資：{savedProfile.experience_years} 年</span>
            )}
            {savedProfile.education && (
              <span>學歷：{EDUCATION_LABEL[savedProfile.education] || savedProfile.education}</span>
            )}
            {savedProfile.preferred_job_types.length > 0 && (
              <span>類型：{savedProfile.preferred_job_types.map((v) => JOB_TYPE_LABEL[v] || v).join('、')}</span>
            )}
            {savedProfile.preferred_remote_types.length > 0 && (
              <span>遠端：{savedProfile.preferred_remote_types.map((v) => REMOTE_TYPE_LABEL[v] || v).join('、')}</span>
            )}
          </div>
        </div>
      )}

      {savedProfile && !hasSavedConditions(savedProfile) && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
          <p className="text-sm text-yellow-700">
            尚未儲存任何條件。設定下方欄位後點擊「儲存條件」。
          </p>
        </div>
      )}

      <div className="space-y-5">
        {/* Experience */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            工作年資
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="50"
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         bg-white text-gray-800"
              placeholder="例: 3"
              value={profile.experience_years}
              onChange={(e) => handleChange('experience_years', e.target.value)}
            />
            <span className="text-sm text-gray-500">年</span>
          </div>
        </div>

        {/* Education */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            最高學歷
          </label>
          <select
            className="w-48 px-3 py-2 border border-gray-300 rounded-lg
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       bg-white text-gray-800"
            value={profile.education}
            onChange={(e) => handleChange('education', e.target.value)}
          >
            {EDUCATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Job Type — multi-select checkboxes */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">
            工作類型（可複選）
          </label>
          <div className="flex flex-wrap gap-3">
            {JOB_TYPE_OPTIONS.map((opt) => {
              const checked = profile.preferred_job_types.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer
                             transition-colors select-none text-sm
                             ${checked
                               ? 'bg-blue-50 border-blue-400 text-blue-800'
                               : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCheckbox('preferred_job_types', opt.value)}
                    className="accent-blue-600"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>

        {/* Remote Type — multi-select checkboxes */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">
            遠端偏好（可複選）
          </label>
          <div className="flex flex-wrap gap-3">
            {REMOTE_TYPE_OPTIONS.map((opt) => {
              const checked = profile.preferred_remote_types.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer
                             transition-colors select-none text-sm
                             ${checked
                               ? 'bg-blue-50 border-blue-400 text-blue-800'
                               : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCheckbox('preferred_remote_types', opt.value)}
                    className="accent-blue-600"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium
                     hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? '儲存中...' : '儲存條件'}
        </button>
        {message && (
          <span className={`text-sm ${message.startsWith('已儲存') ? 'text-green-600' : 'text-red-500'}`}>
            {message}
          </span>
        )}
      </div>


      {/* Skill picker - grown from job data */}
      <hr className="my-8 border-gray-200" />
      <SkillPicker />
    </div>
  );
}
