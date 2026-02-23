import { useState, useEffect } from 'react';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import { fetchSkillPool, updateUserSkills } from '../api';

const STATUS_CYCLE = ['none', 'known', 'learning'];

const ZONES = {
  known: {
    title: '已會的技能',
    containerBg: 'bg-green-50 border-green-200',
    chipBg: 'bg-green-100 border-green-400 text-green-800',
    emptyText: '點擊下方技能，標記你已會的技能',
    dotColor: 'bg-green-400',
  },
  learning: {
    title: '可快速補強',
    containerBg: 'bg-amber-50 border-amber-200',
    chipBg: 'bg-amber-100 border-amber-400 text-amber-800',
    emptyText: '點擊已會的技能，可將其改標為「可快速補強」',
    dotColor: 'bg-amber-400',
  },
  none: {
    title: '尚未分類',
    containerBg: 'bg-gray-50 border-gray-200',
    chipBg: 'bg-gray-100 border-gray-300 text-gray-500',
    emptyText: null,
    dotColor: 'bg-gray-400',
  },
};

const chipTransition = { type: 'spring', stiffness: 500, damping: 30 };

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

  const grouped = {
    known: skills.filter((s) => s.status === 'known'),
    learning: skills.filter((s) => s.status === 'learning'),
    none: skills.filter((s) => s.status === 'none'),
  };

  const hasDirty = Object.keys(dirty).length > 0;

  return (
    <div className="mt-8">
      <h3 className="text-base font-semibold text-gray-700 mb-1">
        技能匹配
      </h3>
      <p className="text-sm text-gray-400 mb-4">
        點擊技能切換分類：未選 → 已會 → 可補強 → 未選
      </p>

      <LayoutGroup>
        <div className="space-y-4">
          {['known', 'learning', 'none'].map((status) => {
            const zone = ZONES[status];
            const items = grouped[status];

            return (
              <div
                key={status}
                className={`rounded-xl border p-4 ${zone.containerBg}`}
              >
                {/* Zone header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${zone.dotColor}`} />
                  <span className="text-sm font-medium text-gray-700">
                    {zone.title}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({items.length})
                  </span>
                </div>

                {/* Skill chips or empty state */}
                {items.length === 0 ? (
                  zone.emptyText && (
                    <p className="text-xs text-gray-400 italic">
                      {zone.emptyText}
                    </p>
                  )
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <AnimatePresence>
                      {items.map(({ skill, job_count }) => (
                        <motion.button
                          key={skill}
                          layoutId={skill}
                          layout
                          transition={chipTransition}
                          onClick={() => cycleStatus(skill, status)}
                          className={`px-3 py-1.5 rounded-lg border text-sm
                                     select-none cursor-pointer hover:shadow-sm
                                     ${zone.chipBg}`}
                          title={`出現在 ${job_count} 筆職缺中`}
                        >
                          {skill}
                        </motion.button>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </LayoutGroup>

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
