import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, FileSpreadsheet } from 'lucide-react';
import { useCSVEditor } from './csvUtils';

interface TableViewerProps {
  content: string;
  sourceFileId: string;
  fileName: string;
}

export default function TableViewer({ content, sourceFileId, fileName }: TableViewerProps) {
  const {
    headers, rows, saveStatus, statusLabel,
    updateCell, addRow, deleteRow, addColumn, deleteColumn, updateHeader,
  } = useCSVEditor(content, sourceFileId);

  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingHeader, setEditingHeader] = useState<number | null>(null);
  const [headerValue, setHeaderValue] = useState('');
  const [showAddCol, setShowAddCol] = useState(false);
  const [newColName, setNewColName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const addColRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCell && inputRef.current) inputRef.current.focus();
  }, [editingCell]);

  useEffect(() => {
    if (editingHeader !== null && headerInputRef.current) headerInputRef.current.focus();
  }, [editingHeader]);

  useEffect(() => {
    if (showAddCol && addColRef.current) addColRef.current.focus();
  }, [showAddCol]);

  const startEdit = (row: number, col: number) => {
    setEditingCell({ row, col });
    setEditValue(rows[row]?.[col] || '');
  };

  const commitEdit = () => {
    if (editingCell) {
      updateCell(editingCell.row, editingCell.col, editValue);
      setEditingCell(null);
    }
  };

  const cancelEdit = () => {
    setEditingCell(null);
  };

  const moveEdit = (dRow: number, dCol: number) => {
    if (!editingCell) return;
    commitEdit();
    const newRow = editingCell.row + dRow;
    const newCol = editingCell.col + dCol;
    if (newRow >= 0 && newRow < rows.length && newCol >= 0 && newCol < headers.length) {
      // Use setTimeout to allow state to settle before starting next edit
      setTimeout(() => startEdit(newRow, newCol), 0);
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      moveEdit(1, 0);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      moveEdit(0, e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const startHeaderEdit = (colIdx: number) => {
    setEditingHeader(colIdx);
    setHeaderValue(headers[colIdx]);
  };

  const commitHeaderEdit = () => {
    if (editingHeader !== null) {
      updateHeader(editingHeader, headerValue);
      setEditingHeader(null);
    }
  };

  const handleAddColumn = () => {
    if (newColName.trim()) {
      addColumn(newColName.trim());
      setNewColName('');
      setShowAddCol(false);
    }
  };

  if (headers.length === 0) {
    return (
      <div className="text-center py-8">
        <FileSpreadsheet size={32} className="mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">No data to display.</p>
        <button
          type="button"
          onClick={() => {
            addColumn('Column 1');
            addRow(['']);
          }}
          className="mt-3 text-xs text-indigo-600 hover:underline"
        >
          Create a table
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col -m-5">
      {/* Save status bar */}
      <div className="flex items-center justify-between px-4 py-1 border-b border-gray-100 bg-gray-50/50 shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <FileSpreadsheet size={12} />
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

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b border-gray-200">
              {/* Row number header */}
              <th className="w-10 px-2 py-1.5 text-center text-[10px] text-gray-400 font-normal border-r border-gray-200 bg-gray-50">
                #
              </th>
              {headers.map((h, ci) => (
                <th
                  key={ci}
                  className="group relative px-3 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap border-r border-gray-200 bg-gray-50 min-w-[100px]"
                >
                  {editingHeader === ci ? (
                    <input
                      ref={headerInputRef}
                      value={headerValue}
                      onChange={(e) => setHeaderValue(e.target.value)}
                      onBlur={commitHeaderEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitHeaderEdit();
                        if (e.key === 'Escape') setEditingHeader(null);
                      }}
                      className="w-full px-1 py-0 text-sm font-semibold text-gray-700 border border-indigo-400 rounded outline-none bg-white"
                    />
                  ) : (
                    <span
                      onDoubleClick={() => startHeaderEdit(ci)}
                      className="cursor-default select-none"
                    >
                      {h}
                    </span>
                  )}
                  {headers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => deleteColumn(ci)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition"
                      title="Delete column"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </th>
              ))}
              {/* Add column */}
              <th className="w-8 bg-gray-50 border-r-0">
                {showAddCol ? (
                  <input
                    ref={addColRef}
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    onBlur={() => { handleAddColumn(); setShowAddCol(false); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddColumn();
                      if (e.key === 'Escape') { setNewColName(''); setShowAddCol(false); }
                    }}
                    placeholder="Name"
                    className="w-20 px-1 py-0 text-xs border border-indigo-400 rounded outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddCol(true)}
                    className="w-full flex items-center justify-center text-gray-300 hover:text-indigo-500 transition"
                    title="Add column"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="group border-b border-gray-100 hover:bg-gray-50/50">
                {/* Row number */}
                <td className="w-10 px-2 py-1.5 text-center text-[10px] text-gray-400 border-r border-gray-200 relative">
                  <span className="group-hover:hidden">{ri + 1}</span>
                  <button
                    type="button"
                    onClick={() => deleteRow(ri)}
                    className="hidden group-hover:inline-flex items-center justify-center text-gray-300 hover:text-red-400 transition"
                    title="Delete row"
                  >
                    <Trash2 size={11} />
                  </button>
                </td>
                {headers.map((_, ci) => {
                  const isEditing = editingCell?.row === ri && editingCell?.col === ci;
                  return (
                    <td
                      key={ci}
                      onClick={() => { if (!isEditing) startEdit(ri, ci); }}
                      className={`px-3 py-1.5 whitespace-nowrap border-r border-gray-200 cursor-text ${
                        isEditing ? 'p-0' : 'text-gray-800'
                      }`}
                    >
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={handleCellKeyDown}
                          className="w-full h-full px-3 py-1.5 text-sm text-gray-800 outline-none ring-2 ring-indigo-500 rounded-sm bg-white"
                        />
                      ) : (
                        <span className="block min-h-[1.25rem]">{row[ci] || ''}</span>
                      )}
                    </td>
                  );
                })}
                <td className="w-8" />
              </tr>
            ))}
          </tbody>
        </table>

        {/* Add row */}
        <div className="border-t border-gray-200">
          <button
            type="button"
            onClick={() => addRow()}
            className="w-full flex items-center gap-1.5 px-4 py-2 text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition"
          >
            <Plus size={13} />
            Add row
          </button>
        </div>
      </div>
    </div>
  );
}
