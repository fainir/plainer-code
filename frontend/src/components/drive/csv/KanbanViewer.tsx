import { useState, useMemo, useRef, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Plus, X, Columns3, GripVertical } from 'lucide-react';
import { useCSVEditor, detectStatusColumn } from './csvUtils';

interface KanbanViewerProps {
  content: string;
  sourceFileId: string;
  fileName: string;
}

export default function KanbanViewer({ content, sourceFileId, fileName }: KanbanViewerProps) {
  const {
    headers, rows, saveStatus, statusLabel,
    updateCell, addRow, deleteRow,
  } = useCSVEditor(content, sourceFileId);

  const statusIdx = useMemo(() => detectStatusColumn(headers), [headers]);
  const nameIdx = 0;

  // Group rows by status column, preserving original row index
  const columns = useMemo(() => {
    const map = new Map<string, { row: string[]; rowIdx: number }[]>();
    rows.forEach((row, rowIdx) => {
      const status = row[statusIdx] || 'Uncategorized';
      if (!map.has(status)) map.set(status, []);
      map.get(status)!.push({ row, rowIdx });
    });
    return map;
  }, [rows, statusIdx]);

  const [editingCard, setEditingCard] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const newCardRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCard !== null && titleInputRef.current) titleInputRef.current.focus();
  }, [editingCard]);

  useEffect(() => {
    if (addingToColumn && newCardRef.current) newCardRef.current.focus();
  }, [addingToColumn]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;

    if (source.droppableId !== destination.droppableId) {
      const rowIdx = parseInt(draggableId.split('-')[1]);
      updateCell(rowIdx, statusIdx, destination.droppableId);
    }
  };

  const startTitleEdit = (rowIdx: number) => {
    setEditingCard(rowIdx);
    setEditTitle(rows[rowIdx]?.[nameIdx] || '');
  };

  const commitTitleEdit = () => {
    if (editingCard !== null) {
      updateCell(editingCard, nameIdx, editTitle);
      setEditingCard(null);
    }
  };

  const handleAddCard = (status: string) => {
    if (!newCardTitle.trim()) {
      setAddingToColumn(null);
      return;
    }
    const newRow = headers.map((_, i) => {
      if (i === nameIdx) return newCardTitle.trim();
      if (i === statusIdx) return status;
      return '';
    });
    addRow(newRow);
    setNewCardTitle('');
    setAddingToColumn(null);
  };

  if (headers.length === 0) {
    return (
      <div className="text-center py-8">
        <Columns3 size={32} className="mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">No data to display as board.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col -m-5">
      {/* Save status bar */}
      <div className="flex items-center justify-between px-4 py-1 border-b border-gray-100 bg-gray-50/50 shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Columns3 size={12} />
          <span>{fileName}</span>
        </div>
        <span className={`text-xs ${
          saveStatus === 'saving' ? 'text-amber-500' :
          saveStatus === 'unsaved' ? 'text-orange-500' :
          'text-gray-400'
        }`}>
          {statusLabel}
        </span>
      </div>

      {/* Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 flex gap-4 overflow-x-auto p-4">
          {Array.from(columns.entries()).map(([status, items]) => (
            <Droppable key={status} droppableId={status}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-shrink-0 w-72 flex flex-col rounded-lg border transition-colors ${
                    snapshot.isDraggingOver
                      ? 'bg-indigo-50/50 border-indigo-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  {/* Column header */}
                  <div className="px-3 py-2.5 border-b border-gray-200 bg-gray-100/80 rounded-t-lg">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center justify-between">
                      <span>
                        {status}
                        <span className="ml-1.5 text-gray-400 font-normal">{items.length}</span>
                      </span>
                    </h3>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
                    {items.map((item, index) => (
                      <Draggable
                        key={`row-${item.rowIdx}`}
                        draggableId={`row-${item.rowIdx}`}
                        index={index}
                      >
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={`group bg-white border rounded-lg shadow-sm transition ${
                              dragSnapshot.isDragging
                                ? 'border-indigo-300 shadow-lg rotate-2'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="p-3">
                              <div className="flex items-start gap-1.5">
                                <span
                                  {...dragProvided.dragHandleProps}
                                  className="mt-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0"
                                >
                                  <GripVertical size={14} />
                                </span>
                                <div className="flex-1 min-w-0">
                                  {editingCard === item.rowIdx ? (
                                    <input
                                      ref={titleInputRef}
                                      value={editTitle}
                                      onChange={(e) => setEditTitle(e.target.value)}
                                      onBlur={commitTitleEdit}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') commitTitleEdit();
                                        if (e.key === 'Escape') setEditingCard(null);
                                      }}
                                      className="w-full px-1 py-0 text-sm font-medium text-gray-900 border border-indigo-400 rounded outline-none"
                                    />
                                  ) : (
                                    <p
                                      onClick={() => startTitleEdit(item.rowIdx)}
                                      className="text-sm font-medium text-gray-900 cursor-text"
                                    >
                                      {item.row[nameIdx] || <span className="text-gray-300 italic">Untitled</span>}
                                    </p>
                                  )}

                                  {/* Metadata fields (collapsed) */}
                                  {expandedCard !== item.rowIdx ? (
                                    <div
                                      onClick={() => setExpandedCard(item.rowIdx)}
                                      className="cursor-pointer"
                                    >
                                      {headers.map((h, hi) => {
                                        if (hi === nameIdx || hi === statusIdx) return null;
                                        if (!item.row[hi]) return null;
                                        return (
                                          <p key={hi} className="text-xs text-gray-500 mt-1 truncate">
                                            <span className="font-medium">{h}:</span> {item.row[hi]}
                                          </p>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    /* Expanded: editable fields */
                                    <div className="mt-2 space-y-1.5">
                                      {headers.map((h, hi) => {
                                        if (hi === nameIdx || hi === statusIdx) return null;
                                        return (
                                          <div key={hi}>
                                            <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{h}</label>
                                            <input
                                              value={item.row[hi] || ''}
                                              onChange={(e) => updateCell(item.rowIdx, hi, e.target.value)}
                                              className="w-full px-2 py-1 text-xs text-gray-700 border border-gray-200 rounded outline-none focus:border-indigo-400 transition"
                                            />
                                          </div>
                                        );
                                      })}
                                      <button
                                        type="button"
                                        onClick={() => setExpandedCard(null)}
                                        className="text-[10px] text-gray-400 hover:text-gray-600"
                                      >
                                        Collapse
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Delete card */}
                                <button
                                  type="button"
                                  onClick={() => deleteRow(item.rowIdx)}
                                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition shrink-0"
                                  title="Delete card"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}

                    {/* Add card */}
                    {addingToColumn === status ? (
                      <div className="p-2">
                        <input
                          ref={newCardRef}
                          value={newCardTitle}
                          onChange={(e) => setNewCardTitle(e.target.value)}
                          onBlur={() => handleAddCard(status)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddCard(status);
                            if (e.key === 'Escape') { setNewCardTitle(''); setAddingToColumn(null); }
                          }}
                          placeholder="Card title..."
                          className="w-full px-3 py-2 text-sm border border-indigo-300 rounded-lg outline-none bg-white"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingToColumn(status)}
                        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-indigo-600 rounded transition"
                      >
                        <Plus size={13} />
                        Add card
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
