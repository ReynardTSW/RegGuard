import { useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toActionStatement, extractCoreObligations, toActionList } from '../utils/text';

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To do', className: '' },
  { value: 'done', label: 'Completed', className: 'status-badge status-done' },
  { value: 'later', label: 'Later date', className: 'status-badge status-later' },
  { value: 'cancelled', label: 'Cancelled', className: 'status-badge status-cancelled' },
];

export default function RuleDetail({
  rule,
  steps,
  onAddStep,
  onUpdateStepStatus,
  onUpdateStepComment,
  onReorderSteps,
}) {
  const [draftStep, setDraftStep] = useState('');
  const [draftDueDate, setDraftDueDate] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftAssignee, setDraftAssignee] = useState('');
  const [draftComment, setDraftComment] = useState('');
  const [draftPriority, setDraftPriority] = useState('low');
  const [dueDateError, setDueDateError] = useState('');
  const [selectedStepId, setSelectedStepId] = useState(null);

  const coreObligations = useMemo(
    () => extractCoreObligations(rule.text),
    [rule.text]
  );
  const actionStatement = useMemo(() => toActionStatement(rule.text), [rule.text]);
  const actionList = useMemo(() => toActionList(rule.text), [rule.text]);
  const selectedStep = steps.find((s) => s.id === selectedStepId);

  const scoreClass = (score) => {
    if (score >= 80) return 'score-pill score-critical';
    if (score >= 60) return 'score-pill score-high';
    if (score >= 40) return 'score-pill score-medium';
    return 'score-pill score-low';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (dueDateError) return;
    onAddStep(rule.control_id, draftStep, draftDueDate, draftDescription, draftAssignee, draftComment, draftPriority);
    setDraftStep('');
    setDraftDueDate('');
    setDraftDescription('');
    setDraftAssignee('');
    setDraftComment('');
    setDraftPriority('low');
  };

  const handleStepDragEnd = (result) => {
    if (!result.destination) return;
    onReorderSteps?.(rule.control_id, result.source.index, result.destination.index);
  };

  return (
    <div className="glass-panel" style={{ textAlign: 'left' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            {rule.control_id}
          </div>
          <h2 style={{ margin: 0 }}>Rule Detail</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className={scoreClass(rule.score)}>Score {rule.score}</span>
          <span className={`tag tag-${rule.severity}`}>{rule.severity}</span>
        </div>
      </div>

      <div className="rule-detail-grid">
        <div className="rule-detail-main">
          <div style={{ marginTop: '1rem' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Legal sentence</p>
            <p style={{ fontWeight: 600, lineHeight: 1.5 }}>{rule.text}</p>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Core obligations</p>
            <ul style={{ marginTop: '0.5rem' }}>
              {coreObligations.map((ob, idx) => (
                <li key={idx} style={{ lineHeight: 1.4 }}>{ob}</li>
              ))}
            </ul>
          </div>

          <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '10px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Plain-English action</div>
            {actionList.length > 1 ? (
              <ul className="action-list">
                {actionList.map((act, idx) => (
                  <li key={idx}>{act}</li>
                ))}
              </ul>
            ) : (
              <div style={{ fontWeight: 600 }}>{actionStatement}</div>
            )}
          </div>

          <div style={{ marginTop: '1rem' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Scoring breakdown</p>
            {rule.score_reasons?.length ? (
              <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem', color: 'var(--text-primary)' }}>
                {rule.score_reasons.map((reason, idx) => (
                  <li key={idx} style={{ lineHeight: 1.3 }}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>No scoring reasons available.</p>
            )}
          </div>
        </div>

        <div className="rule-detail-steps">
          <h3 style={{ marginTop: '1rem' }}>Action Steps</h3>
          <form onSubmit={handleSubmit} style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Add actionable step..."
              value={draftStep}
              onChange={(e) => setDraftStep(e.target.value)}
              style={{
                flex: '1 1 220px',
                padding: '0.75rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(15,23,42,0.6)',
                color: 'var(--text-primary)',
              }}
            />
            <input
              type="date"
              inputMode="numeric"
              pattern="\d{4}-\d{2}-\d{2}"
              value={draftDueDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => {
                const val = e.target.value;
                // Allow partial typing; only enforce when pattern matches
                setDraftDueDate(val);
                if (!val) {
                  setDueDateError('');
                  return;
                }
                if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
                  const today = new Date().toISOString().split('T')[0];
                  if (val >= today) {
                    setDueDateError('');
                  } else {
                    setDueDateError('Date must be today or later.');
                  }
                } else {
                  setDueDateError('Enter date as YYYY-MM-DD.');
                }
              }}
              style={{
                flex: '0 1 170px',
                padding: '0.75rem 0.9rem',
                borderRadius: '8px',
                border: dueDateError ? '1px solid rgba(248,113,113,0.6)' : '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(15,23,42,0.6)',
                color: 'var(--text-primary)',
              }}
            />
            {dueDateError && (
              <div style={{ color: 'var(--danger)', fontSize: '0.85rem', width: '100%' }}>{dueDateError}</div>
            )}
            <input
              type="text"
              placeholder="Assignee (optional)"
              value={draftAssignee}
              onChange={(e) => setDraftAssignee(e.target.value)}
              style={{
                flex: '1 1 180px',
                padding: '0.75rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(15,23,42,0.6)',
                color: 'var(--text-primary)',
              }}
            />
            <textarea
              placeholder="Description / context"
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              rows={2}
              style={{
                flex: '1 1 100%',
                padding: '0.75rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(15,23,42,0.6)',
                color: 'var(--text-primary)',
                resize: 'vertical',
              }}
            />
            <textarea
              placeholder="Comment (e.g., blockers, notes)"
              value={draftComment}
              onChange={(e) => setDraftComment(e.target.value)}
              rows={2}
              style={{
                flex: '1 1 100%',
                padding: '0.75rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(15,23,42,0.6)',
                color: 'var(--text-primary)',
                resize: 'vertical',
              }}
            />
            <select
              value={draftPriority}
              onChange={(e) => setDraftPriority(e.target.value)}
              className="select"
              style={{ minWidth: '140px' }}
            >
              <option value="low">Priority: Low</option>
              <option value="medium">Priority: Medium</option>
              <option value="high">Priority: High</option>
            </select>
            <button type="submit" className="btn">
              Add Step
            </button>
          </form>

          <div style={{ marginTop: '1rem' }}>
            {steps.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No actionable steps yet.</p>
            ) : (
              <>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Priority (top = highest)</p>
                <DragDropContext onDragEnd={handleStepDragEnd}>
                  <Droppable droppableId={`${rule.control_id}-steps`}>
                    {(provided) => (
                      <ul
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        style={{ listStyle: 'none', padding: 0, margin: 0 }}
                      >
                        {steps.map((step, index) => (
                          <Draggable key={step.id} draggableId={step.id} index={index}>
                            {(draggableProvided, snapshot) => (
                              <li
                                ref={draggableProvided.innerRef}
                                {...draggableProvided.draggableProps}
                                className="step-row"
                                style={{
                                  background: snapshot.isDragging ? 'rgba(30,41,59,0.9)' : undefined,
                                  ...draggableProvided.draggableProps.style,
                                }}
                                onClick={() => setSelectedStepId(step.id)}
                                title={step.comment ? `Comment: ${step.comment}` : 'Click to view details'}
                              >
                                <div className="step-handle" {...draggableProvided.dragHandleProps}>
                                  ::
                                </div>
                                <select
                                  value={step.status}
                                  onChange={(e) => onUpdateStepStatus(rule.control_id, step.id, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="status-select"
                                >
                                  {STATUS_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                                <span className={step.status === 'done' ? 'step-done' : ''}>{step.text}</span>
                                {step.dueDate && (
                                  <span className="step-date">Due {step.dueDate}</span>
                                )}
                              </li>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </ul>
                    )}
                  </Droppable>
                </DragDropContext>
                {selectedStep && (
                  <div style={{ marginTop: '1rem', padding: '0.85rem', borderRadius: '10px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Task detail</div>
                        <div style={{ fontWeight: 600 }}>{selectedStep.text}</div>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Status: <strong>{selectedStep.status}</strong>
                      </div>
                    </div>
                    {selectedStep.description && (
                      <p style={{ marginTop: '0.5rem', color: 'var(--text-primary)' }}>{selectedStep.description}</p>
                    )}
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Comment</div>
                      <textarea
                        value={selectedStep.comment || ''}
                        onChange={(e) => onUpdateStepComment?.(rule.control_id, selectedStep.id, e.target.value)}
                        rows={2}
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.8rem',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: 'rgba(15,23,42,0.6)',
                          color: 'var(--text-primary)',
                          resize: 'vertical',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.35rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      <span>Created: {selectedStep.createdAt ? new Date(selectedStep.createdAt).toLocaleString() : '—'}</span>
                      <span>Due: {selectedStep.dueDate || '—'}</span>
                      <span>Assignee: {selectedStep.assignee || 'Unassigned'}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
