import { useState, useMemo } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isToday,
  addMonths, subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, Trash2 } from 'lucide-react';
import { useCSVEditor, detectDateColumn } from './csvUtils';

interface CalendarViewerProps {
  content: string;
  sourceFileId: string;
  fileName: string;
}

interface EditingEvent {
  rowIdx: number;
  values: string[];
  isNew: boolean;
}

export default function CalendarViewer({ content, sourceFileId, fileName }: CalendarViewerProps) {
  const {
    headers, rows, saveStatus, statusLabel,
    updateCell, addRow, deleteRow,
  } = useCSVEditor(content, sourceFileId);

  const dateIdx = useMemo(() => detectDateColumn(headers), [headers]);
  const nameIdx = 0;

  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [editingEvent, setEditingEvent] = useState<EditingEvent | null>(null);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // Group rows by date string
  const eventsByDate = useMemo(() => {
    if (dateIdx < 0) return new Map<string, { row: string[]; rowIdx: number }[]>();
    const map = new Map<string, { row: string[]; rowIdx: number }[]>();
    rows.forEach((row, rowIdx) => {
      const d = new Date(row[dateIdx]);
      if (isNaN(d.getTime())) return;
      const key = format(d, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ row, rowIdx });
    });
    return map;
  }, [rows, dateIdx]);

  const handleDayClick = (day: Date) => {
    if (dateIdx < 0) return;
    const newValues = headers.map((_, i) => {
      if (i === dateIdx) return format(day, 'yyyy-MM-dd');
      return '';
    });
    setEditingEvent({ rowIdx: -1, values: newValues, isNew: true });
  };

  const openEventEditor = (rowIdx: number) => {
    setEditingEvent({ rowIdx, values: [...rows[rowIdx]], isNew: false });
  };

  const updateEventField = (colIdx: number, value: string) => {
    if (!editingEvent) return;
    const next = [...editingEvent.values];
    next[colIdx] = value;
    setEditingEvent({ ...editingEvent, values: next });
  };

  const saveEvent = () => {
    if (!editingEvent) return;
    if (editingEvent.isNew) {
      addRow(editingEvent.values);
    } else {
      editingEvent.values.forEach((val, ci) => {
        if (val !== rows[editingEvent.rowIdx]?.[ci]) {
          updateCell(editingEvent.rowIdx, ci, val);
        }
      });
    }
    setEditingEvent(null);
  };

  const handleDeleteEvent = () => {
    if (!editingEvent || editingEvent.isNew) return;
    deleteRow(editingEvent.rowIdx);
    setEditingEvent(null);
  };

  if (dateIdx < 0) {
    return (
      <div className="text-center py-8">
        <Calendar size={32} className="mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">No date column found in this file.</p>
        <p className="text-xs text-gray-400 mt-1">
          Add a column named "date", "due", or "deadline" to use calendar view.
        </p>
      </div>
    );
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="h-full flex flex-col -m-5">
      {/* Save status bar */}
      <div className="flex items-center justify-between px-4 py-1 border-b border-gray-100 bg-gray-50/50 shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Calendar size={12} />
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

      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-sm font-semibold text-gray-800 w-36 text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setCurrentMonth(startOfMonth(new Date()))}
          className="text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition"
        >
          Today
        </button>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto p-2">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {weekDays.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 border-t border-l border-gray-200">
          {calendarDays.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const events = eventsByDate.get(key) || [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);

            return (
              <div
                key={key}
                onClick={() => handleDayClick(day)}
                className={`min-h-[90px] p-1 border-r border-b border-gray-200 cursor-pointer transition hover:bg-gray-50 ${
                  !inMonth ? 'bg-gray-50/60' : ''
                } ${today ? 'bg-indigo-50/40' : ''}`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className={`text-xs font-medium leading-none ${
                      today
                        ? 'bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center'
                        : inMonth
                          ? 'text-gray-700'
                          : 'text-gray-300'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  {events.length > 0 && inMonth && (
                    <span className="text-[9px] text-gray-400">{events.length}</span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {events.slice(0, 3).map(({ row, rowIdx }) => (
                    <button
                      key={rowIdx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEventEditor(rowIdx);
                      }}
                      className="block w-full text-left px-1.5 py-0.5 text-[11px] bg-indigo-100 text-indigo-700 rounded truncate hover:bg-indigo-200 transition"
                    >
                      {row[nameIdx] || 'Untitled'}
                    </button>
                  ))}
                  {events.length > 3 && (
                    <p className="text-[10px] text-gray-400 px-1">+{events.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event editor modal */}
      {editingEvent && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => setEditingEvent(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-5 w-96 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                {editingEvent.isNew ? 'New Event' : 'Edit Event'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingEvent(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>&times;
              </button>
            </div>

            <div className="space-y-3">
              {headers.map((header, i) => (
                <div key={i}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{header}</label>
                  <input
                    type={i === dateIdx ? 'date' : 'text'}
                    value={editingEvent.values[i] || ''}
                    onChange={(e) => updateEventField(i, e.target.value)}
                    autoFocus={i === (nameIdx === dateIdx ? 0 : nameIdx)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={saveEvent}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
              >
                {editingEvent.isNew ? 'Add Event' : 'Save'}
              </button>
              {!editingEvent.isNew && (
                <button
                  type="button"
                  onClick={handleDeleteEvent}
                  className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditingEvent(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
