import { useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toActionStatement, extractCoreObligations, toActionList } from '../utils/text';

export default function RuleDetail({
  rule,
  steps,
  onAddStep,
  onToggleStepStatus,
  onReorderSteps,
}) {
  const [draftStep, setDraftStep] = useState('');
  const [draftDueDate, setDraftDueDate] = useState('');

  const coreObligations = useMemo(
    () => extractCoreObligations(rule.text),
    [rule.text]
  );
  const actionStatement = useMemo(() => toActionStatement(rule.text), [rule.text]);
  const actionList = useMemo(() => toActionList(rule.text), [rule.text]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddStep(rule.control_id, draftStep, draftDueDate);
    setDraftStep('');
    setDraftDueDate('');
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
        <span className={`tag tag-${rule.severity}`}>{rule.severity}</span>
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
              value={draftDueDate}
              onChange={(e) => setDraftDueDate(e.target.value)}
              style={{
                flex: '0 1 170px',
                padding: '0.75rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(15,23,42,0.6)',
                color: 'var(--text-primary)',
              }}
            />
            <button type="submit" className="btn">
              Add Step
            </button>
          </form>

          <div style={{ marginTop: '1rem' }}>
            {steps.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No actionable steps yet.</p>
            ) : (
              <>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>To do</p>
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
                                onClick={() => onToggleStepStatus(rule.control_id, step.id)}
                                title="Click to toggle done"
                              >
                                <div className="step-handle" {...draggableProvided.dragHandleProps}>
                                  ::
                                </div>
                                <input type="checkbox" readOnly checked={step.status === 'done'} />
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
