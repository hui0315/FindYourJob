import { useState, useEffect, useRef } from 'react';
// eslint-disable-next-line no-unused-vars -- motion.button used in JSX
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
    containerBg: 'bg-surface-50 border-surface-200',
    chipBg: 'bg-surface-100 border-surface-300 text-surface-500',
    emptyText: null,
    dotColor: 'bg-surface-400',
  },
};

const chipTransition = { type: 'spring', stiffness: 500, damping: 30 };

export default function SkillPicker() {
  const [skills, setSkills] = useState([]);
  const [savingSkill, setSavingSkill] = useState(null); // skill name currently saving
  const [message, setMessage] = useState('');  // success or error
  const [messageType, setMessageType] = useState(''); // 'ok' | 'err'
  const messageClearTimer = useRef(null);

  useEffect(() => {
    fetchSkillPool().then((data) => {
      if (Array.isArray(data)) setSkills(data);
    });
  }, []);

  // Auto-dismiss success messages after 1.5s
  useEffect(() => {
    if (message && messageType === 'ok') {
      clearTimeout(messageClearTimer.current);
      messageClearTimer.current = setTimeout(() => setMessage(''), 1500);
    }
    return () => clearTimeout(messageClearTimer.current);
  }, [message, messageType]);

  async function cycleStatus(skill, currentStatus) {
    if (savingSkill) return; // prevent concurrent saves
    const idx = STATUS_CYCLE.indexOf(currentStatus);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];

    // Optimistic UI update
    setSkills((prev) =>
      prev.map((s) => (s.skill === skill ? { ...s, status: next } : s))
    );
    setSavingSkill(skill);
    setMessage('');

    try {
      const result = await updateUserSkills({ [skill]: next });
      // Apply server-confirmed state
      if (result && result.skills) {
        setSkills((prev) =>
          prev.map((s) => ({
            ...s,
            status: result.skills[s.skill] ?? s.status,
          }))
        );
      }
      setMessage('已儲存');
      setMessageType('ok');
    } catch (e) {
      // Revert on failure
      setSkills((prev) =>
        prev.map((s) => (s.skill === skill ? { ...s, status: currentStatus } : s))
      );
      setMessage('儲存失敗：' + (e.message || '未知錯誤'));
      setMessageType('err');
    } finally {
      setSavingSkill(null);
    }
  }

  if (skills.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-surface-700 mb-1">
          技能匹配
        </h3>
        <p className="text-sm text-surface-400 mb-4">
          點擊技能切換分類：未選 → 已會 → 可補強 → 未選
        </p>
        <div className="p-6 bg-surface-50 rounded-xl text-center">
          <p className="text-surface-400 text-sm">
            尚無技能資料。先在「輸入職缺」頁新增職缺，系統會自動從中萃取技能關鍵字。
          </p>
        </div>
      </div>
    );
  }

  const grouped = {
    known: skills.filter((s) => s.status === 'known'),
    learning: skills.filter((s) => s.status === 'learning'),
    none: skills.filter((s) => s.status === 'none'),
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-surface-700 mb-1">
        技能匹配
      </h3>
      <p className="text-sm text-surface-400 mb-4">
        點擊技能切換分類：未選 → 已會 → 可補強 → 未選（自動儲存）
      </p>

      {/* Save feedback */}
      {message && (
        <div className={`mb-4 px-3 py-2 rounded text-sm transition-opacity ${
          messageType === 'ok'
            ? 'bg-green-50 border border-green-200 text-green-600'
            : 'bg-red-50 border border-red-200 text-red-600'
        }`}>
          {message}
        </div>
      )}

      <LayoutGroup>
        <div className="space-y-5">
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
                  <span className="text-sm font-medium text-surface-700">
                    {zone.title}
                  </span>
                  <span className="text-xs text-surface-400">
                    ({items.length})
                  </span>
                </div>

                {/* Skill chips or empty state */}
                {items.length === 0 ? (
                  zone.emptyText && (
                    <p className="text-xs text-surface-400 italic">
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
                          disabled={savingSkill !== null}
                          className={`px-3 py-1.5 rounded-lg border text-sm
                                     select-none cursor-pointer hover:shadow-sm
                                     disabled:opacity-60 disabled:cursor-wait
                                     ${zone.chipBg}`}
                          title={`出現在 ${job_count} 筆職缺中`}
                        >
                          {savingSkill === skill ? '...' : skill}
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
    </div>
  );
}
