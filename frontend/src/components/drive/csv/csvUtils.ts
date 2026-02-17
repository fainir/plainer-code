import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateFileContent } from '../../../api/drive';

// ── CSV Parsing ─────────────────────────────────────────

export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split('\n');
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).filter((l) => l.trim()).map(parseLine);
  return { headers, rows };
}

// ── CSV Serialization ───────────────────────────────────

export function serializeCSV(headers: string[], rows: string[][]): string {
  const escapeField = (field: string): string => {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return '"' + field.replace(/"/g, '""') + '"';
    }
    return field;
  };
  const lines = [
    headers.map(escapeField).join(','),
    ...rows.map((row) => row.map(escapeField).join(',')),
  ];
  return lines.join('\n');
}

// ── Column Detection ────────────────────────────────────

export function detectStatusColumn(headers: string[]): number {
  const candidates = ['status', 'stage', 'state', 'column', 'category'];
  const idx = headers.findIndex((h) => candidates.includes(h.toLowerCase()));
  return idx >= 0 ? idx : headers.length > 1 ? 1 : 0;
}

export function detectDateColumn(headers: string[]): number {
  const candidates = ['date', 'due', 'due_date', 'start', 'start_date', 'created', 'deadline'];
  const idx = headers.findIndex((h) =>
    candidates.includes(h.toLowerCase().replace(/\s+/g, '_'))
  );
  return idx >= 0 ? idx : -1;
}

// ── useCSVEditor Hook ───────────────────────────────────

export function useCSVEditor(content: string, sourceFileId: string) {
  const initial = useMemo(() => parseCSV(content), [content]);
  const [headers, setHeaders] = useState<string[]>(initial.headers);
  const [rows, setRows] = useState<string[][]>(initial.rows);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  // Keep a ref to current data for save callbacks
  const dataRef = useRef({ headers, rows });
  dataRef.current = { headers, rows };

  const saveMutation = useMutation({
    mutationFn: (csv: string) => updateFileContent(sourceFileId, csv),
    onMutate: () => setSaveStatus('saving'),
    onSuccess: () => {
      setSaveStatus('saved');
      queryClient.invalidateQueries({ queryKey: ['file-content', sourceFileId] });
    },
    onError: () => setSaveStatus('unsaved'),
  });

  const scheduleSave = useCallback(() => {
    setSaveStatus('unsaved');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const { headers: h, rows: r } = dataRef.current;
      saveMutation.mutate(serializeCSV(h, r));
    }, 2000);
  }, [saveMutation]);

  const updateCell = useCallback((rowIdx: number, colIdx: number, value: string) => {
    setRows((prev) => {
      const next = prev.map((r) => [...r]);
      if (next[rowIdx]) next[rowIdx][colIdx] = value;
      return next;
    });
    scheduleSave();
  }, [scheduleSave]);

  const addRow = useCallback((values?: string[]) => {
    setRows((prev) => [...prev, values || headers.map(() => '')]);
    scheduleSave();
  }, [headers, scheduleSave]);

  const deleteRow = useCallback((rowIdx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== rowIdx));
    scheduleSave();
  }, [scheduleSave]);

  const addColumn = useCallback((name: string) => {
    setHeaders((prev) => [...prev, name]);
    setRows((prev) => prev.map((r) => [...r, '']));
    scheduleSave();
  }, [scheduleSave]);

  const deleteColumn = useCallback((colIdx: number) => {
    setHeaders((prev) => prev.filter((_, i) => i !== colIdx));
    setRows((prev) => prev.map((r) => r.filter((_, i) => i !== colIdx)));
    scheduleSave();
  }, [scheduleSave]);

  const updateHeader = useCallback((colIdx: number, value: string) => {
    setHeaders((prev) => {
      const next = [...prev];
      next[colIdx] = value;
      return next;
    });
    scheduleSave();
  }, [scheduleSave]);

  // Cmd+S manual save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const { headers: h, rows: r } = dataRef.current;
        saveMutation.mutate(serializeCSV(h, r));
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [saveMutation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const statusLabel = useMemo(() => {
    switch (saveStatus) {
      case 'saving': return 'Saving...';
      case 'unsaved': return 'Unsaved changes';
      case 'saved': return 'All changes saved';
    }
  }, [saveStatus]);

  return {
    headers,
    rows,
    saveStatus,
    statusLabel,
    setHeaders,
    setRows,
    updateCell,
    addRow,
    deleteRow,
    addColumn,
    deleteColumn,
    updateHeader,
    scheduleSave,
  };
}
