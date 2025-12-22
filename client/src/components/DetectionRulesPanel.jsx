import { useMemo, useState } from 'react';

const DEFAULT_RULES = [
  { id: 'shall', keyword: 'shall', severity: 'High', match_type: 'contains', enabled: true },
  { id: 'must', keyword: 'must', severity: 'High', match_type: 'contains', enabled: true },
  { id: 'prohibited', keyword: 'prohibited', severity: 'High', match_type: 'contains', enabled: true },
  { id: 'required', keyword: 'required', severity: 'Medium', match_type: 'contains', enabled: true },
  { id: 'should', keyword: 'should', severity: 'Low', match_type: 'contains', enabled: true },
  { id: 'may', keyword: 'may', severity: 'Low', match_type: 'contains', enabled: true },
];
const DEFAULT_SUGGESTIONS = DEFAULT_RULES;

const severityPillClass = (severity) => {
  const key = (severity || '').toLowerCase();
  if (key === 'critical') return 'pill pill-critical';
  if (key === 'high') return 'pill pill-high';
  if (key === 'medium') return 'pill pill-medium';
  if (key === 'low') return 'pill pill-low';
  return 'pill';
};

const splitTerms = (value) =>
  (value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

export default function DetectionRulesPanel({ detectionRules, onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    keyword: '',
    severity: 'Medium',
    match_type: 'contains',
    must_also: '',
    must_not: '',
  });

  const rules = useMemo(() => {
    if (!detectionRules || detectionRules.length === 0) return DEFAULT_RULES;
    return detectionRules;
  }, [detectionRules]);

  const handleAddDefault = (id) => {
    const candidate = DEFAULT_SUGGESTIONS.find((r) => r.id === id);
    if (!candidate) return;
    const exists = rules.some((r) => r.id === id);
    const next = exists ? rules.map((r) => (r.id === id ? { ...candidate, enabled: true } : r)) : [...rules, candidate];
    onChange(next);
  };

  const handleToggle = (id, checked) => {
    const next = rules.map((r) => (r.id === id ? { ...r, enabled: checked } : r));
    onChange(next);
  };

  const handleOpenForm = (rule) => {
    if (rule) {
      setEditingId(rule.id);
      setForm({
        keyword: rule.keyword || '',
        severity: rule.severity || 'Medium',
        match_type: rule.match_type || 'contains',
        must_also: (rule.must_also_contain || []).join(', '),
        must_not: (rule.must_not_contain || []).join(', '),
      });
    } else {
      setEditingId(null);
      setForm({
        keyword: '',
        severity: 'Medium',
        match_type: 'contains',
        must_also: '',
        must_not: '',
      });
    }
    setShowForm(true);
  };

  const handleSave = () => {
    const payload = {
      id: editingId || `custom-${Date.now()}`,
      keyword: form.keyword.trim(),
      severity: form.severity,
      match_type: form.match_type,
      enabled: true,
      must_also_contain: splitTerms(form.must_also),
      must_not_contain: splitTerms(form.must_not),
    };
    if (!payload.keyword) return;

    let next;
    if (editingId) {
      next = rules.map((r) => (r.id === editingId ? payload : r));
    } else {
      next = [...rules, payload];
    }
    onChange(next);
    setShowForm(false);
    setEditingId(null);
  };

  const handleDelete = (id) => {
    const next = rules.filter((r) => r.id !== id);
    onChange(next);
  };

  return (
    <div className="glass-panel detection-rules-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
        <h3 style={{ margin: 0 }}>Custom Detection Rules</h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            className="select"
            defaultValue=""
            onChange={(e) => {
              if (!e.target.value) return;
              handleAddDefault(e.target.value);
              e.target.value = '';
            }}
          >
            <option value="">Add default filter…</option>
            {DEFAULT_SUGGESTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.keyword} ({opt.severity})</option>
            ))}
          </select>
          <button className="btn btn-ghost" onClick={() => handleOpenForm(null)}>
            + Add Custom Filter
          </button>
        </div>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', marginBottom: '0.75rem' }}>
        Toggle or edit default filters, or add your own keywords for GDPR, HIPAA, ISO, or custom frameworks.
      </p>

      <div className="detection-rules-list">
        {rules.map((rule) => (
          <div key={rule.id} className="detection-rule-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: '1 1 auto' }}>
              <input
                type="checkbox"
                checked={rule.enabled !== false}
                onChange={(e) => handleToggle(rule.id, e.target.checked)}
              />
              <div>
                <div style={{ fontWeight: 600 }}>{rule.keyword}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Match: {rule.match_type || 'contains'}
                  {(rule.must_also_contain?.length || rule.must_not_contain?.length) ? (
                    <>
                      {' '}| Must also: {(rule.must_also_contain || []).join(', ') || '—'}
                      {' '}| Must not: {(rule.must_not_contain || []).join(', ') || '—'}
                    </>
                  ) : null}
                </div>
              </div>
            </label>
            <span className={severityPillClass(rule.severity)}>{rule.severity || 'Unknown'}</span>
            <button className="link-btn" onClick={() => handleOpenForm(rule)}>Edit</button>
            {rule.id?.startsWith('custom-') && (
              <button className="link-btn link-btn-danger" onClick={() => handleDelete(rule.id)}>Delete</button>
            )}
          </div>
        ))}
      </div>

      {showForm && (
        <div className="detection-rule-form glass-panel">
          <h4 style={{ marginTop: 0 }}>{editingId ? 'Edit Detection Rule' : 'Create New Detection Rule'}</h4>
          <div className="form-grid">
            <label className="form-field">
              <span>Keyword/Phrase</span>
              <input
                type="text"
                placeholder="e.g., must ensure that"
                value={form.keyword}
                onChange={(e) => setForm((prev) => ({ ...prev, keyword: e.target.value }))}
              />
            </label>
            <div className="form-field">
              <span>Severity</span>
              <div className="pill-group">
                {['Critical', 'High', 'Medium', 'Low', 'Any'].map((level) => (
                  <label key={level} className="pill-option">
                    <input
                      type="radio"
                      name="severity"
                      value={level}
                      checked={form.severity === level}
                      onChange={() => setForm((prev) => ({ ...prev, severity: level }))}
                    />
                    {level === 'Any' ? 'Any / Unknown' : level}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-field">
              <span>Match Type</span>
              <div className="pill-group">
                {[
                  { value: 'contains', label: 'Contains phrase' },
                  { value: 'exact', label: 'Exact match' },
                  { value: 'startswith', label: 'Starts with' },
                  { value: 'regex', label: 'Regex (advanced)' },
                ].map((opt) => (
                  <label key={opt.value} className="pill-option">
                    <input
                      type="radio"
                      name="match_type"
                      value={opt.value}
                      checked={form.match_type === opt.value}
                      onChange={() => setForm((prev) => ({ ...prev, match_type: opt.value }))}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <label className="form-field">
              <span>Must also contain (comma separated)</span>
              <input
                type="text"
                placeholder="e.g., personal data, encryption"
                value={form.must_also}
                onChange={(e) => setForm((prev) => ({ ...prev, must_also: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span>Must NOT contain (comma separated)</span>
              <input
                type="text"
                placeholder="e.g., exemption"
                value={form.must_not}
                onChange={(e) => setForm((prev) => ({ ...prev, must_not: e.target.value }))}
              />
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button className="btn btn-ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            <button className="btn" onClick={handleSave}>Save & Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}
