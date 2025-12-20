import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toActionList, summarizeRule } from '../utils/text';

const COLUMNS = {
  analyzed: 'Detected Rules',
  'in-progress': 'In Progress',
  implemented: 'Implemented',
  'completed-later': 'Completed Later',
};

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To do' },
  { value: 'done', label: 'Completed' },
  { value: 'later', label: 'Later date' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function KanbanBoard({
  columns,
  setColumns,
  onSelectRule,
  selectedRuleId,
  actionStepsByRule = {},
  visibleColumns,
  onReorderSteps,
  onUpdateStepStatus,
  onUpdateStepComment,
}) {
  const [modalRule, setModalRule] = useState(null);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { source, destination } = result;

    if (source.droppableId === destination.droppableId) {
      const column = [...columns[source.droppableId]];
      const [removed] = column.splice(source.index, 1);
      column.splice(destination.index, 0, removed);
      setColumns({ ...columns, [source.droppableId]: column });
    } else {
      const sourceCol = [...columns[source.droppableId]];
      const destCol = [...columns[destination.droppableId]];
      const [removed] = sourceCol.splice(source.index, 1);
      destCol.splice(destination.index, 0, removed);
      setColumns({
        ...columns,
        [source.droppableId]: sourceCol,
        [destination.droppableId]: destCol,
      });
    }
  };

  const closeModal = () => setModalRule(null);

  return (
    <>
      <div style={{ display: 'flex', gap: '1.5rem', overflowX: 'auto', paddingBottom: '1rem' }}>
        <DragDropContext onDragEnd={onDragEnd}>
          {(visibleColumns || Object.keys(COLUMNS)).map((columnId) => (
            <div key={columnId} style={{ minWidth: '300px', width: '300px' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                {COLUMNS[columnId]}{' '}
                <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                  ({(columns[columnId] || []).length})
                </span>
              </h3>
              <Droppable droppableId={columnId}>
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    style={{
                      background: 'rgba(30, 41, 59, 0.4)',
                      padding: '1rem',
                      borderRadius: '12px',
                      minHeight: '500px',
                    }}
                  >
                    {(columns[columnId] || []).map((item, index) => {
                    const steps = actionStepsByRule[item.control_id] || [];
                    const allDone = steps.length > 0 && steps.every((s) => s.status === 'done');
                    const allLater = steps.length > 0 && steps.every((s) => s.status === 'later');
                    return (
                      <Draggable key={item.control_id} draggableId={item.control_id} index={index}>
                        {(draggableProvided, snapshot) => (
                          <div
                            ref={draggableProvided.innerRef}
                            {...draggableProvided.draggableProps}
                            className={`glass-panel rule-card ${selectedRuleId === item.control_id ? 'rule-card--selected' : ''} ${allDone ? 'rule-card--completed' : ''} ${allLater ? 'rule-card--later' : ''}`}
                            style={{
                              marginBottom: '1rem',
                              padding: '1rem',
                              background: allDone
                                ? 'rgba(22,163,74,0.18)'
                                : allLater
                                  ? 'rgba(234,179,8,0.18)'
                                : snapshot.isDragging
                                  ? '#2d3748'
                                  : 'rgba(30, 41, 59, 0.9)',
                                ...draggableProvided.draggableProps.style,
                              }}
                              onClick={() => {
                                onSelectRule?.(item);
                                setModalRule(item);
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onSelectRule?.(item);
                                  setModalRule(item);
                                }
                              }}
                            >
                              <div
                                style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}
                                {...draggableProvided.dragHandleProps}
                              >
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  {item.control_id} — {summarizeRule(item.text)}
                                </span>
                                <span className={`tag tag-${item.severity}`}>{item.severity}</span>
                              </div>
                              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {toActionList(item.text)[0]}
                              </div>
                              <div style={{ marginTop: '0.75rem' }}>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                                  Priority order (top = highest)
                                </div>
                                {steps.length === 0 ? (
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No steps yet.</div>
                                ) : (
                                      <ul className="step-list">
                                    {steps.map((s, idx) => (
                                      <li
                                        key={s.id}
                                        className={`step-list-item status-${s.status || 'todo'}`}
                                        title={s.comment ? `Comment: ${s.comment}` : 'No comment'}
                                      >
                                        <button
                                          type="button"
                                        className="step-move-btn"
                                        aria-label="move up"
                                        title="Higher priority"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (idx > 0) onReorderSteps?.(item.control_id, idx, idx - 1);
                                        }}
                                      >
                                        ↑
                                      </button>
                                      <button
                                        type="button"
                                        className="step-move-btn"
                                        aria-label="move down"
                                        title="Lower priority"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (idx < steps.length - 1) onReorderSteps?.(item.control_id, idx, idx + 1);
                                        }}
                                      >
                                        ↓
                                      </button>
                                        <select
                                          value={s.status}
                                          onChange={(e) => onUpdateStepStatus?.(item.control_id, s.id, e.target.value)}
                                          onClick={(e) => e.stopPropagation()}
                                          className="status-select"
                                        >
                                          {STATUS_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                          ))}
                                        </select>
                                        <span className={s.status === 'done' ? 'step-done' : ''}>{s.text}</span>
                                        {s.dueDate && <span className="step-date">({s.dueDate})</span>}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </DragDropContext>
      </div>

      {modalRule && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
          onClick={closeModal}
        >
          <div
            className="glass-panel"
            style={{ maxWidth: '560px', width: '100%', textAlign: 'left', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeModal}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'var(--text-primary)',
                borderRadius: '8px',
                padding: '0.25rem 0.5rem',
                cursor: 'pointer',
              }}
              aria-label="Close"
            >
              ×
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  {modalRule.control_id}
                </div>
                <h3 style={{ margin: 0 }}>{summarizeRule(modalRule.text)}</h3>
              </div>
              <span className={`tag tag-${modalRule.severity}`}>{modalRule.severity}</span>
            </div>
            <p style={{ color: 'var(--text-primary)', marginTop: '0.5rem', lineHeight: 1.5 }}>
              {modalRule.text}
            </p>
            <div style={{ marginTop: '0.75rem' }}>
              <h4 style={{ margin: 0, color: 'var(--text-secondary)' }}>Tasks (top = higher priority)</h4>
              <ul className="step-list" style={{ marginTop: '0.5rem' }}>
                {(actionStepsByRule[modalRule.control_id] || []).map((s) => (
                  <li key={s.id} className="step-list-item">
                    <span className={`status-pill status-${s.status || 'todo'}`}>
                      {STATUS_OPTIONS.find((o) => o.value === s.status)?.label || 'To do'}
                    </span>
                    <span className={s.status === 'done' ? 'step-done' : ''}>{s.text}</span>
                    {s.dueDate && <span className="step-date">({s.dueDate})</span>}
                    <textarea
                      value={s.comment || ''}
                      onChange={(e) => onUpdateStepComment?.(modalRule.control_id, s.id, e.target.value)}
                      rows={2}
                      style={{
                        width: '100%',
                        marginTop: '0.35rem',
                        padding: '0.5rem 0.6rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(15,23,42,0.6)',
                        color: 'var(--text-primary)',
                        resize: 'vertical',
                      }}
                    />
                  </li>
                ))}
                {(actionStepsByRule[modalRule.control_id] || []).length === 0 && (
                  <li style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No steps yet.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
