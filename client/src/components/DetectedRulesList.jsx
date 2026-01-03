import { toActionList, summarizeRule } from '../utils/text';

const scoreClass = (score) => {
  if (score >= 80) return 'score-pill score-critical';
  if (score >= 60) return 'score-pill score-high';
  if (score >= 40) return 'score-pill score-medium';
  return 'score-pill score-low';
};

export default function DetectedRulesList({
  rules,
  onSelectRule,
  selectedRuleId,
  actionStepsByRule = {},
  taskDeadlines = {},
  selectedRuleIds = [],
  onToggleSelect,
}) {
  return (
    <div className="detected-list">
      <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
        Detected Rules <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>({rules.length})</span>
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {rules.map((item) => (
          <div
            key={item.control_id}
            className={`glass-panel rule-card ${selectedRuleId === item.control_id ? 'rule-card--selected' : ''}`}
            style={{ padding: '1rem' }}
            onClick={() => onSelectRule?.(item)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectRule?.(item);
              }
            }}
          >
            {(() => {
              const meta = taskDeadlines[item.control_id] || {};
              const dueLabel = meta.earliest ? meta.earliest.toISOString().slice(0, 10) : 'No due';
              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Next due: {meta.overdue ? 'Overdue' : dueLabel}
                  </span>
                  {meta.overdue && (
                    <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700 }}>Overdue</span>
                  )}
                </div>
              );
            })()}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {item.control_id} - {summarizeRule(item.text)}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                <span className={scoreClass(item.score)}>Score {item.score}</span>
                <span className={`tag tag-${item.severity}`}>{item.severity}</span>
                {onToggleSelect && (
                  <input
                    type="checkbox"
                    checked={selectedRuleIds.includes(item.control_id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleSelect(item.control_id, e.target.checked);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Select rule for export"
                  />
                )}
              </div>
            </div>
            <div style={{ fontSize: '0.9rem', lineHeight: '1.4', color: 'var(--text-primary)' }}>
              {toActionList(item.text)[0]}
            </div>
            {item.score_reasons?.length > 0 && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Scoring: {item.score_reasons.slice(0, 2).join(' · ')}
                {item.score_reasons.length > 2 ? ' · …' : ''}
              </div>
            )}
            {(actionStepsByRule[item.control_id] || []).length > 0 && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {(actionStepsByRule[item.control_id] || []).slice(0, 2).map((s) => (
                  <div key={s.id} className="step-pill">
                    <span className="step-pill__dot" aria-hidden /> {s.text}
                    {s.dueDate && <span className="step-pill__date">({s.dueDate})</span>}
                  </div>
                ))}
                {(actionStepsByRule[item.control_id] || []).length > 2 && (
                  <div style={{ marginTop: '0.25rem' }}>+ more...</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
