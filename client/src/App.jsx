import { useEffect, useMemo, useState } from 'react';
import UploadForm from './components/UploadForm';
import KanbanBoard from './components/KanbanBoard';
import RuleDetail from './components/RuleDetail';
import DetectedRulesList from './components/DetectedRulesList';
import SeverityBoard from './components/SeverityBoard';

const WORKFLOW_COLUMNS = ['in-progress', 'implemented', 'not-applicable'];

const moveRuleToColumn = (prevColumns, rule, target) => {
  const updated = { ...prevColumns };
  WORKFLOW_COLUMNS.forEach((col) => {
    if (updated[col]) {
      updated[col] = updated[col].filter((r) => r.control_id !== rule.control_id);
    }
  });
  if (!updated[target]) updated[target] = [];
  const exists = updated[target].some((r) => r.control_id === rule.control_id);
  if (!exists) {
    updated[target] = [...updated[target], rule];
  }
  return updated;
};

function App() {
  const [columns, setColumns] = useState({
    'analyzed': [],
    'in-progress': [],
    'implemented': [],
    'not-applicable': [],
  });
  const [selectedRule, setSelectedRule] = useState(null);
  const [actionStepsByRule, setActionStepsByRule] = useState({});
  const [activeTab, setActiveTab] = useState('detected');
  const [severityFilter, setSeverityFilter] = useState('all');

  // When a new file is uploaded, push the parsed items into the board
  const handleUploadSuccess = (items) => {
    if (!items || items.length === 0) return;
    setColumns((prev) => ({
      ...prev,
      analyzed: [...prev.analyzed, ...items],
    }));
  };

  const handleSelectRule = (rule) => {
    setSelectedRule(rule);
  };

  const handleAddStep = (ruleId, stepText, dueDate) => {
    const trimmed = stepText.trim();
    if (!trimmed) return;
    const rule = selectedRule;
    setActionStepsByRule((prev) => {
      const existing = prev[ruleId] || [];
      const nextStep = {
        id: `${ruleId}-${existing.length + 1}`,
        text: trimmed,
        status: 'todo',
        dueDate: dueDate || null,
      };
      return { ...prev, [ruleId]: [...existing, nextStep] };
    });
    if (rule) {
      setColumns((prev) => moveRuleToColumn(prev, rule, 'in-progress'));
    }
  };

  const handleToggleStepStatus = (ruleId, stepId) => {
    let updatedForRule = [];
    setActionStepsByRule((prev) => {
      const existing = prev[ruleId] || [];
      updatedForRule = existing.map((step) =>
        step.id === stepId
          ? { ...step, status: step.status === 'done' ? 'todo' : 'done' }
          : step
      );
      return { ...prev, [ruleId]: updatedForRule };
    });
    const rule = selectedRule;
    if (rule) {
      const allDone = updatedForRule.length > 0 && updatedForRule.every((s) => s.status === 'done');
      setColumns((prev) =>
        moveRuleToColumn(prev, rule, allDone ? 'implemented' : 'in-progress')
      );
    }
  };

  const handleReorderSteps = (ruleId, sourceIndex, destIndex) => {
    if (sourceIndex === destIndex) return;
    setActionStepsByRule((prev) => {
      const existing = [...(prev[ruleId] || [])];
      const [moved] = existing.splice(sourceIndex, 1);
      existing.splice(destIndex, 0, moved);
      return { ...prev, [ruleId]: existing };
    });
  };

  const selectedRuleSteps = useMemo(
    () => (selectedRule ? actionStepsByRule[selectedRule.control_id] || [] : []),
    [selectedRule, actionStepsByRule]
  );

  const filteredDetected = useMemo(() => {
    if (severityFilter === 'all') return columns.analyzed;
    return columns.analyzed.filter((r) => r.severity?.toLowerCase() === severityFilter);
  }, [columns.analyzed, severityFilter]);

  const allRules = useMemo(() => {
    const seen = {};
    Object.values(columns).forEach((list) => {
      (list || []).forEach((r) => {
        if (!seen[r.control_id]) {
          seen[r.control_id] = r;
        }
      });
    });
    return Object.values(seen);
  }, [columns]);

  useEffect(() => {
    if (!selectedRule) return;
    const detail = document.getElementById('rule-detail');
    if (detail) detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedRule]);

  return (
    <div className="container" style={{ paddingTop: '2rem' }}>
      <header style={{ marginBottom: '3rem' }}>
        <h1
          style={{
            fontSize: '2.5rem',
            fontWeight: '800',
            background: 'linear-gradient(to right, #60a5fa, #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
          }}
        >
          ReguGuard
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          AI-Powered Regulatory Compliance Workspace
        </p>
      </header>

      <main>
        <UploadForm onUploadSuccess={handleUploadSuccess} />

        <div style={{ marginTop: '2rem' }}>
          <div className="tab-row">
            <button
              className={`tab-btn ${activeTab === 'detected' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab('detected')}
            >
              Detected Rules
            </button>
            <button
              className={`tab-btn ${activeTab === 'workflow' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab('workflow')}
            >
              In Progress & Implemented
            </button>
            <button
              className={`tab-btn ${activeTab === 'severity' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab('severity')}
            >
              By Severity
            </button>
          </div>

          {activeTab === 'detected' && (
            <div className="split-view">
              <div>
                <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Filter by severity:</span>
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="select"
                  >
                    <option value="all">All</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
                <DetectedRulesList
                  rules={filteredDetected}
                  onSelectRule={handleSelectRule}
                  selectedRuleId={selectedRule?.control_id}
                  actionStepsByRule={actionStepsByRule}
                />
              </div>
              <div id="rule-detail">
                {selectedRule ? (
                  <RuleDetail
                    rule={selectedRule}
                    steps={selectedRuleSteps}
                    onAddStep={handleAddStep}
                    onToggleStepStatus={handleToggleStepStatus}
                    onReorderSteps={handleReorderSteps}
                  />
                ) : (
                  <div className="glass-panel" style={{ textAlign: 'left' }}>
                    <h3 style={{ marginTop: 0 }}>Select a rule</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      Choose a detected rule on the left to view details and add actionable steps.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'workflow' && (
            <KanbanBoard
              columns={{
                'in-progress': columns['in-progress'],
                'implemented': columns['implemented'],
                'not-applicable': columns['not-applicable'],
              }}
              setColumns={(nextColumns) =>
                setColumns((prev) => ({
                  ...prev,
                  ...nextColumns,
                }))
              }
              onSelectRule={handleSelectRule}
              selectedRuleId={selectedRule?.control_id}
              actionStepsByRule={actionStepsByRule}
              visibleColumns={['in-progress', 'implemented', 'not-applicable']}
              onReorderSteps={handleReorderSteps}
              onToggleStepStatus={handleToggleStepStatus}
            />
          )}

          {activeTab === 'severity' && (
            <SeverityBoard
              rules={allRules}
              onSelectRule={handleSelectRule}
              selectedRuleId={selectedRule?.control_id}
              actionStepsByRule={actionStepsByRule}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
