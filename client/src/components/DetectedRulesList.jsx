import { toActionList, summarizeRule } from '../utils/text';

export default function DetectedRulesList({
  rules,
  onSelectRule,
  selectedRuleId,
  actionStepsByRule = {},
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {item.control_id} — {summarizeRule(item.text)}
              </span>
              <span className={`tag tag-${item.severity}`}>{item.severity}</span>
            </div>
            <div style={{ fontSize: '0.9rem', lineHeight: '1.4', color: 'var(--text-primary)' }}>
              {toActionList(item.text)[0]}
            </div>
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
