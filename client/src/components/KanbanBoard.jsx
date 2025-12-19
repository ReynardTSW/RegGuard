import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toActionList, summarizeRule } from '../utils/text';

const COLUMNS = {
    'analyzed': 'Detected Rules',
    'in-progress': 'In Progress',
    'implemented': 'Implemented',
    'not-applicable': 'Not Applicable'
};

export default function KanbanBoard({
    columns,
    setColumns,
    onSelectRule,
    selectedRuleId,
    actionStepsByRule = {},
    visibleColumns,
    onReorderSteps,
    onToggleStepStatus,
}) {
    const onDragEnd = (result) => {
        if (!result.destination) return;
        const { source, destination } = result;

        if (source.droppableId === destination.droppableId) {
            // Reorder within same column
            const column = [...columns[source.droppableId]];
            const [removed] = column.splice(source.index, 1);
            column.splice(destination.index, 0, removed);
            setColumns({ ...columns, [source.droppableId]: column });
        } else {
            // Move to different column
            const sourceCol = [...columns[source.droppableId]];
            const destCol = [...columns[destination.droppableId]];
            const [removed] = sourceCol.splice(source.index, 1);
            destCol.splice(destination.index, 0, removed);
            setColumns({
                ...columns,
                [source.droppableId]: sourceCol,
                [destination.droppableId]: destCol
            });
        }
    };

    return (
        <div style={{ display: 'flex', gap: '1.5rem', overflowX: 'auto', paddingBottom: '1rem' }}>
            <DragDropContext onDragEnd={onDragEnd}>
                {(visibleColumns || Object.keys(COLUMNS)).map((columnId) => (
                    <div key={columnId} style={{ minWidth: '300px', width: '300px' }}>
                        <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                            {COLUMNS[columnId]} <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>({(columns[columnId] || []).length})</span>
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
                                        minHeight: '500px'
                                    }}
                                >
                                    {(columns[columnId] || []).map((item, index) => (
                                        <Draggable key={item.control_id} draggableId={item.control_id} index={index}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    className={`glass-panel rule-card ${selectedRuleId === item.control_id ? 'rule-card--selected' : ''}`}
                                                    style={{
                                                        marginBottom: '1rem',
                                                        padding: '1rem',
                                                        background: snapshot.isDragging ? '#2d3748' : 'rgba(30, 41, 59, 0.9)',
                                                        ...provided.draggableProps.style
                                                    }}
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
                                                    <div
                                                        style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}
                                                        {...provided.dragHandleProps}
                                                    >
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                            {item.control_id} — {summarizeRule(item.text)}
                                                        </span>
                                                        <span className={`tag tag-${item.severity}`}>{item.severity}</span>
                                                    </div>
                                                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                        {(toActionList(item.text)[0])}
                                                    </div>
                                                    <div style={{ marginTop: '0.75rem' }}>
                                                        {(actionStepsByRule[item.control_id] || []).length === 0 ? (
                                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No steps yet.</div>
                                                        ) : (
                                                            <ul className="step-list">
                                                                {(actionStepsByRule[item.control_id] || []).map((s, idx) => (
                                                                    <li key={s.id} className="step-list-item">
                                                                        <button
                                                                            type="button"
                                                                            className="step-move-btn"
                                                                            aria-label="move up"
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
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const steps = actionStepsByRule[item.control_id] || [];
                                                                                if (idx < steps.length - 1) onReorderSteps?.(item.control_id, idx, idx + 1);
                                                                            }}
                                                                        >
                                                                            ↓
                                                                        </button>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={s.status === 'done'}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            onChange={() => onToggleStepStatus?.(item.control_id, s.id)}
                                                                        />
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
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </div>
                ))}
            </DragDropContext>
        </div>
    );
}
