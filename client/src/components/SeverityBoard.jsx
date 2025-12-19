import { toActionStatement } from '../utils/text';

const SEVERITY_ORDER = ['Low', 'Medium', 'High', 'Unknown'];

export default function SeverityBoard({ rules = [], onSelectRule, selectedRuleId, actionStepsByRule = {} }) {
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {item.control_id} — {toActionStatement(item.text).split('.')[0]}
                    </span>
                    <span className={`tag tag-${item.severity}`}>{item.severity}</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    {toActionStatement(item.text)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Steps: {(actionStepsByRule[item.control_id] || []).length}
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
