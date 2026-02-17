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

export default function ProfileSettings({ onSaved }) {
  const [profile, setProfile] = useState({
    experience_years: '',
    education: '',
    skills: '',
    preferred_locations: '',
    min_salary: '',
    salary_type: 'monthly',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchProfile().then((data) => {
      if (data) {
        setProfile({
          experience_years: data.experience_years ?? '',
          education: data.education ?? '',
          skills: data.skills ?? '',
          preferred_locations: data.preferred_locations ?? '',
          min_salary: data.min_salary ?? '',
          salary_type: data.salary_type || 'monthly',
        });
      }
    });
  }, []);

  function handleChange(field, value) {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setMessage('');
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        ...profile,
        experience_years: profile.experience_years === '' ? null : Number(profile.experience_years),
        education: profile.education || null,
        skills: profile.skills || null,
        preferred_locations: profile.preferred_locations || null,
        min_salary: profile.min_salary === '' ? null : Number(profile.min_salary),
      };
      await updateProfile(payload);
      setMessage('已儲存');
      onSaved?.();
    } catch {
      setMessage('儲存失敗');
    } finally {
      setSaving(false);
    }
  }

  const hasAnyFilter = profile.experience_years !== '' || profile.education !== '' || profile.min_salary !== '';

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold text-gray-700 mb-1">
        我的條件
      </h2>
      <p className="text-sm text-gray-400 mb-6">
        設定你的硬性條件，系統會在職缺不符合時自動警告
      </p>

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

        {/* Min salary */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            期望最低薪資
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="1000"
              className="w-36 px-3 py-2 border border-gray-300 rounded-lg
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         bg-white text-gray-800"
              placeholder="例: 50000"
              value={profile.min_salary}
              onChange={(e) => handleChange('min_salary', e.target.value)}
            />
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-800"
              value={profile.salary_type}
              onChange={(e) => handleChange('salary_type', e.target.value)}
            >
              <option value="monthly">月薪</option>
              <option value="yearly">年薪</option>
              <option value="hourly">時薪</option>
            </select>
          </div>
        </div>

        {/* Preferred locations */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            偏好工作地點（選填，逗號分隔）
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       bg-white text-gray-800"
            placeholder="例: 台北, 新竹, 遠端"
            value={profile.preferred_locations}
            onChange={(e) => handleChange('preferred_locations', e.target.value)}
          />
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
          <span className={`text-sm ${message === '已儲存' ? 'text-green-600' : 'text-red-500'}`}>
            {message}
          </span>
        )}
      </div>

      {!hasAnyFilter && (
        <p className="mt-4 text-sm text-yellow-600 bg-yellow-50 border border-yellow-200
                      rounded-lg px-4 py-3">
          尚未設定任何硬性條件。設定後，系統會在新增職缺時自動檢查是否符合你的條件。
        </p>
      )}

      {/* Skill picker - grown from job data */}
      <hr className="my-8 border-gray-200" />
      <SkillPicker />
    </div>
  );
}
