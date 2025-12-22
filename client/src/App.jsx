import { useEffect, useMemo, useState } from 'react';
import UploadForm from './components/UploadForm';
import KanbanBoard from './components/KanbanBoard';
import RuleDetail from './components/RuleDetail';
import DetectedRulesList from './components/DetectedRulesList';
import SeverityBoard from './components/SeverityBoard';
import DetectionRulesPanel from './components/DetectionRulesPanel';
import { uploadRegulation } from './services/api';
import { exportReport } from './services/api';
import MetricsDashboard from './components/MetricsDashboard';
import BeforeAfterPanel from './components/BeforeAfterPanel';
import StakeholderPanel from './components/StakeholderPanel';

const WORKFLOW_COLUMNS = ['in-progress', 'implemented', 'completed-later'];
const DEFAULT_DETECTION_RULES = [
  { id: 'shall', keyword: 'shall', severity: 'High', match_type: 'contains', enabled: true },
  { id: 'must', keyword: 'must', severity: 'High', match_type: 'contains', enabled: true },
  { id: 'prohibited', keyword: 'prohibited', severity: 'High', match_type: 'contains', enabled: true },
  { id: 'required', keyword: 'required', severity: 'Medium', match_type: 'contains', enabled: true },
  { id: 'should', keyword: 'should', severity: 'Low', match_type: 'contains', enabled: true },
  { id: 'may', keyword: 'may', severity: 'Low', match_type: 'contains', enabled: true },
];

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
  const [detectionRules, setDetectionRules] = useState(DEFAULT_DETECTION_RULES);
  const [lastFile, setLastFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processingMs, setProcessingMs] = useState(0);
  const [exporting, setExporting] = useState(false);

  const runUpload = async (file, rules, preserveWorkflow = false) => {
    if (!file) return;
    setUploading(true);
    const started = Date.now();
    const prevSteps = preserveWorkflow ? actionStepsByRule : {};
    const prevColumns = preserveWorkflow ? columns : null;
    try {
      const result = await uploadRegulation(file, rules);
      const items = result.items || [];
      let nextSteps = {};
      let nextColumns = {
        analyzed: [],
        'in-progress': [],
        'implemented': [],
        'completed-later': [],
      };

      if (preserveWorkflow) {
        const itemsById = new Map(items.map((it) => [it.control_id, it]));
        // keep only steps that still belong to returned items
        Object.entries(prevSteps || {}).forEach(([rid, steps]) => {
          if (itemsById.has(rid)) {
            nextSteps[rid] = steps;
          }
        });
        // place items back into their previous columns if present, else analyzed
        items.forEach((it) => {
          let col = 'analyzed';
          if (prevColumns) {
            Object.entries(prevColumns).forEach(([key, arr]) => {
              if ((arr || []).some((r) => r.control_id === it.control_id)) {
                col = key;
              }
            });
          }
          nextColumns[col] = [...(nextColumns[col] || []), it];
        });
      } else {
        nextColumns = {
          analyzed: items,
          'in-progress': [],
          'implemented': [],
          'completed-later': [],
        };
        nextSteps = {};
      }

      setColumns(nextColumns);
      setActionStepsByRule(nextSteps);
      setSelectedRule(null);
      setProcessingMs(Date.now() - started);
    } catch (err) {
      console.error('Upload failed', err);
      setProcessingMs(Date.now() - started);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadSuccess = (items) => {
    if (!items || items.length === 0) return;
    setColumns({
      analyzed: items,
      'in-progress': [],
      'implemented': [],
      'completed-later': [],
    });
    setActionStepsByRule({});
    setSelectedRule(null);
  };

  const handleFileSelected = (file) => {
    setLastFile(file);
    runUpload(file, detectionRules);
  };

  const handleSelectRule = (rule) => {
    setSelectedRule(rule);
  };

  const handleExportReport = async () => {
    if (!lastFile) return;
    setExporting(true);
    try {
      const tasksPayload = {
        columns,
        steps: actionStepsByRule,
      };
      const blob = await exportReport(lastFile, detectionRules, tasksPayload);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${lastFile.name}-report.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Report export failed', err);
    } finally {
      setExporting(false);
    }
  };

  const handleAddStep = (ruleId, stepText, dueDate, description, assignee, comment, priority) => {
    const trimmed = stepText.trim();
    if (!trimmed) return;
    const rule = selectedRule;
    setActionStepsByRule((prev) => {
      const existing = prev[ruleId] || [];
      const nextStep = {
        id: `${ruleId}-${existing.length + 1}`,
        text: trimmed,
        status: 'todo',
        priority: priority || 'low',
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

  // Re-run parsing automatically when detection rules change and a file is available.
  useEffect(() => {
    if (!lastFile) return;
    runUpload(lastFile, detectionRules, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectionRules]);

  return (
    <div className="container" style={{ paddingTop: '2rem' }}>
      <MetricsDashboard
        totalRules={columns.analyzed.length}
        highPriority={columns.analyzed.filter((r) => (r.severity || '').toLowerCase() === 'high' || (r.category || '').toUpperCase() === 'CRITICAL').length}
        mediumLow={columns.analyzed.filter((r) => {
          const sev = (r.severity || '').toLowerCase();
          return sev === 'medium' || sev === 'low';
        }).length}
        timeSavedHours={(columns.analyzed.length * 2.2) / 60}
        processingMs={processingMs}
      />
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
        <BeforeAfterPanel
          totalRules={columns.analyzed.length}
          processingMs={processingMs}
          manualHoursBaseline={4.5}
          hourlyRate={100}
        />

        <MetricsDashboard
          totalRules={columns.analyzed.length}
          highPriority={columns.analyzed.filter((r) => (r.severity || '').toLowerCase() === 'high' || (r.category || '').toUpperCase() === 'CRITICAL').length}
          mediumLow={columns.analyzed.filter((r) => {
            const sev = (r.severity || '').toLowerCase();
            return sev === 'medium' || sev === 'low';
          }).length}
          timeSavedHours={(columns.analyzed.length * 2.2) / 60}
          processingMs={processingMs}
        />

        <StakeholderPanel rules={columns.analyzed} />

        <UploadForm
          onUploadSuccess={handleUploadSuccess}
          detectionRules={detectionRules}
          onFileSelected={handleFileSelected}
          externalLoading={uploading}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button
            className="btn"
            onClick={handleExportReport}
            disabled={!lastFile || exporting}
            style={{ opacity: (!lastFile || exporting) ? 0.6 : 1 }}
          >
            {exporting ? 'Generating PDF...' : 'Export PDF Report'}
          </button>
        </div>
        <DetectionRulesPanel detectionRules={detectionRules} onChange={setDetectionRules} />

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
