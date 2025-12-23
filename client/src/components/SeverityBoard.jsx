import { toActionStatement } from '../utils/text';

const SEVERITY_ORDER = ['Low', 'Medium', 'High', 'Unknown'];

const scoreClass = (score) => {
  if (score >= 80) return 'score-pill score-critical score-pill--block';
  if (score >= 60) return 'score-pill score-high score-pill--block';
  if (score >= 40) return 'score-pill score-medium score-pill--block';
  return 'score-pill score-low score-pill--block';
};

export default function SeverityBoard({
  rules = [],
  onSelectRule,
  selectedRuleId,
  actionStepsByRule = {},
  selectedRuleIds = [],
  onToggleSelect,
}) {
  const grouped = SEVERITY_ORDER.reduce((acc, sev) => {
    acc[sev] = [];
    return acc;
  }, {});
  rules.forEach((r) => {
    const key = SEVERITY_ORDER.includes(r.severity) ? r.severity : 'Unknown';
    grouped[key].push(r);
  });

  return (
    <div className="severity-grid">
      {SEVERITY_ORDER.map((sev) => (
        <div key={sev} className="severity-col">
          <h3 style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
            {sev} <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>({grouped[sev].length})</span>
          </h3>
          <div className="severity-col-body">
            {grouped[sev].length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No rules.</div>
            ) : (
              grouped[sev].map((item) => (
                <div
                  key={item.control_id}
                  className={`glass-panel rule-card ${selectedRuleId === item.control_id ? 'rule-card--selected' : ''}`}
                  style={{ padding: '0.75rem' }}
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
                  <div style={{ marginBottom: '0.5rem' }}>
                    <div className={scoreClass(item.score)}>Score {item.score}</div>
                  </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {item.control_id} - {toActionStatement(item.text).split('.')[0]}
                </span>
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
              <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                {toActionStatement(item.text)}
              </div>
                  {item.score_reasons?.length > 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                      Scoring: {item.score_reasons.slice(0, 2).join(' · ')}
                      {item.score_reasons.length > 2 ? ' · …' : ''}
                    </div>
                  )}
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Tasks: {(actionStepsByRule[item.control_id] || []).length}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
