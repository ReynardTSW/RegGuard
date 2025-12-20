import { useEffect, useMemo, useState } from 'react';
import UploadForm from './components/UploadForm';
import KanbanBoard from './components/KanbanBoard';
import RuleDetail from './components/RuleDetail';
import DetectedRulesList from './components/DetectedRulesList';
import SeverityBoard from './components/SeverityBoard';

const WORKFLOW_COLUMNS = ['in-progress', 'implemented', 'completed-later'];

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
    'completed-later': [],
  });
  const [selectedRule, setSelectedRule] = useState(null);
  const [actionStepsByRule, setActionStepsByRule] = useState({});
  const [activeTab, setActiveTab] = useState('detected');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [keywordFilter, setKeywordFilter] = useState('');
  const [scoreMin, setScoreMin] = useState('');
  const [scoreMax, setScoreMax] = useState('');
  const [scoreSort, setScoreSort] = useState('none'); // none | asc | desc

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

  const handleAddStep = (ruleId, stepText, dueDate, description, assignee, comment) => {
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
        description: description?.trim() || '',
        assignee: assignee?.trim() || '',
        comment: comment?.trim() || '',
        createdAt: new Date().toISOString(),
      };
      return { ...prev, [ruleId]: [...existing, nextStep] };
    });
    setColumns((prev) => {
      let foundRule = rule || null;
      if (!foundRule) {
        Object.values(prev).forEach((list) => {
          (list || []).forEach((r) => {
            if (r.control_id === ruleId) foundRule = r;
          });
        });
      }
      if (!foundRule) return prev;
      return moveRuleToColumn(prev, foundRule, 'in-progress');
    });
  };

  const updateColumnsForRule = (ruleId, updatedSteps) => {
    const allDone = updatedSteps.length > 0 && updatedSteps.every((s) => s.status === 'done');
    const allLater = updatedSteps.length > 0 && updatedSteps.every((s) => s.status === 'later');
    const allCancelled = updatedSteps.length > 0 && updatedSteps.every((s) => s.status === 'cancelled');
    const allSet = updatedSteps.length > 0 && updatedSteps.every((s) => s.status !== 'todo');

    setColumns((prevCols) => {
      let foundRule = null;
      const nextCols = { ...prevCols };
      Object.keys(nextCols).forEach((col) => {
        nextCols[col] = nextCols[col].map((r) => {
          if (r.control_id === ruleId) {
            foundRule = r;
          }
          return r;
        });
      });
      if (!foundRule) return nextCols;
      if (allLater) return moveRuleToColumn(nextCols, foundRule, 'completed-later');
      if (allDone || allCancelled || allSet) return moveRuleToColumn(nextCols, foundRule, 'implemented');
      return moveRuleToColumn(nextCols, foundRule, 'in-progress');
    });
  };

  const handleUpdateStepStatus = (ruleId, stepId, newStatus) => {
    setActionStepsByRule((prevSteps) => {
      const existing = prevSteps[ruleId] || [];
      const updatedForRule = existing.map((step) =>
        step.id === stepId ? { ...step, status: newStatus } : step
      );
      updateColumnsForRule(ruleId, updatedForRule);
      return { ...prevSteps, [ruleId]: updatedForRule };
    });
  };

  const handleUpdateStepComment = (ruleId, stepId, comment) => {
    setActionStepsByRule((prevSteps) => {
      const existing = prevSteps[ruleId] || [];
      const updatedForRule = existing.map((step) =>
        step.id === stepId ? { ...step, comment } : step
      );
      return { ...prevSteps, [ruleId]: updatedForRule };
    });
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

  const severityTabRules = useMemo(() => {
    const kw = keywordFilter.trim().toLowerCase();
    const min = Number.isFinite(Number(scoreMin)) && scoreMin !== '' ? Number(scoreMin) : null;
    const max = Number.isFinite(Number(scoreMax)) && scoreMax !== '' ? Number(scoreMax) : null;

    const filtered = allRules.filter((r) => {
      const textMatch = kw ? r.text.toLowerCase().includes(kw) : true;
      const scoreMatch =
        (min === null || r.score >= min) &&
        (max === null || r.score <= max);
      return textMatch && scoreMatch;
    });

    if (scoreSort === 'asc') {
      return [...filtered].sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
    }
    if (scoreSort === 'desc') {
      return [...filtered].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    }
    return filtered;
  }, [allRules, keywordFilter, scoreMin, scoreMax, scoreSort]);

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
                    onUpdateStepStatus={handleUpdateStepStatus}
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
                'completed-later': columns['completed-later'],
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
              visibleColumns={['in-progress', 'implemented', 'completed-later']}
              onReorderSteps={handleReorderSteps}
              onUpdateStepStatus={handleUpdateStepStatus}
              onUpdateStepComment={handleUpdateStepComment}
            />
          )}

          {activeTab === 'severity' && (
            <>
              <div style={{ margin: '1rem 0', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Search keyword..."
                  value={keywordFilter}
                  onChange={(e) => setKeywordFilter(e.target.value)}
                  style={{
                    padding: '0.6rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(15,23,42,0.6)',
                    color: 'var(--text-primary)',
                    minWidth: '220px',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Score between</span>
                  <input
                    type="number"
                    placeholder="Min"
                    value={scoreMin}
                    onChange={(e) => setScoreMin(e.target.value)}
                    style={{
                      width: '90px',
                      padding: '0.55rem 0.5rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(15,23,42,0.6)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <span style={{ color: 'var(--text-secondary)' }}>–</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={scoreMax}
                    onChange={(e) => setScoreMax(e.target.value)}
                    style={{
                      width: '90px',
                      padding: '0.55rem 0.5rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(15,23,42,0.6)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Sort score</span>
                  <select
                    value={scoreSort}
                    onChange={(e) => setScoreSort(e.target.value)}
                    className="select"
                  >
                    <option value="none">None</option>
                    <option value="asc">Low to High</option>
                    <option value="desc">High to Low</option>
                  </select>
                </div>
              </div>
              <SeverityBoard
                rules={severityTabRules}
                onSelectRule={handleSelectRule}
                selectedRuleId={selectedRule?.control_id}
                actionStepsByRule={actionStepsByRule}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
