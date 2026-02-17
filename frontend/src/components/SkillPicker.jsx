import { useState, useEffect } from 'react';
import { fetchSkillPool, updateUserSkills } from '../api';

const STATUS_CYCLE = ['none', 'known', 'learning'];
const STATUS_DISPLAY = {
  known:    { label: '已會',    bg: 'bg-green-100 border-green-400 text-green-800' },
  learning: { label: '可補強',  bg: 'bg-amber-100 border-amber-400 text-amber-800' },
  none:     { label: '',        bg: 'bg-gray-50 border-gray-300 text-gray-400' },
};

export default function SkillPicker() {
  const [skills, setSkills] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState({});

  useEffect(() => {
    fetchSkillPool().then(setSkills);
  }, []);

  function cycleStatus(skill, currentStatus) {
    const idx = STATUS_CYCLE.indexOf(currentStatus);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];

    setSkills((prev) =>
      prev.map((s) => (s.skill === skill ? { ...s, status: next } : s))
    );
    setDirty((prev) => ({ ...prev, [skill]: next }));
  }

  async function handleSave() {
    if (Object.keys(dirty).length === 0) return;
    setSaving(true);
    try {
      await updateUserSkills(dirty);
      setDirty({});
    } catch {
      alert('儲存失敗');
    } finally {
      setSaving(false);
    }
  }

  if (skills.length === 0) {
    return (
      <div className="mt-8 p-6 bg-gray-50 rounded-xl text-center">
        <p className="text-gray-400 text-sm">
          尚無技能資料。先在「輸入職缺」頁新增職缺，系統會自動從中萃取技能關鍵字。
        </p>
      </div>
    );
  }

  const knownCount = skills.filter((s) => s.status === 'known').length;
  const learningCount = skills.filter((s) => s.status === 'learning').length;
  const hasDirty = Object.keys(dirty).length > 0;

  return (
    <div className="mt-8">
      <h3 className="text-base font-semibold text-gray-700 mb-1">
        技能匹配
      </h3>
      <p className="text-sm text-gray-400 mb-4">
        點擊切換狀態：未選 → 已會 → 可補強 → 未選
      </p>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-200 border border-green-400" />
          已會 ({knownCount})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-200 border border-amber-400" />
          可快速補強 ({learningCount})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-gray-100 border border-gray-300" />
          未選
        </span>
      </div>

      {/* Skill chips */}
      <div className="flex flex-wrap gap-2">
        {skills.map(({ skill, status, job_count }) => {
          const display = STATUS_DISPLAY[status] || STATUS_DISPLAY.none;
          return (
            <button
              key={skill}
              onClick={() => cycleStatus(skill, status)}
              className={`px-3 py-1.5 rounded-lg border text-sm transition-all
                         select-none cursor-pointer hover:shadow-sm
                         ${display.bg}`}
              title={`出現在 ${job_count} 筆職缺中`}
            >
              {skill}
              {status !== 'none' && (
                <span className="ml-1 text-xs opacity-70">
                  {display.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Save */}
      {hasDirty && (
        <div className="mt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium
                       hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? '儲存中...' : `儲存變更 (${Object.keys(dirty).length})`}
          </button>
        </div>
      )}
    </div>
  );
}
