import { useState, useEffect, useRef, useCallback } from 'react';
import { Undo2, Redo2, Save, CheckCircle, Loader2, AlertCircle } from 'lucide-react';

interface TextEditorPanelProps {
  text: string;
  confidence: number;
  onChange: (text: string) => void;
  onSave: () => Promise<void>;
  isDirty: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

export default function TextEditorPanel({
  text,
  confidence,
  onChange,
  onSave,
  isDirty,
  saveStatus,
}: TextEditorPanelProps) {
  const [history, setHistory] = useState<string[]>([text]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [lastSavedText, setLastSavedText] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const AUTO_SAVE_DELAY = 30000; // 30 seconds

  // Update history when text changes externally
  useEffect(() => {
    if (text !== history[historyIndex]) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(text);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [text]);

  // Auto-save functionality
  useEffect(() => {
    if (isDirty && text !== lastSavedText) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(async () => {
        await onSave();
        setLastSavedText(text);
      }, AUTO_SAVE_DELAY);
    }
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [text, isDirty, lastSavedText, onSave]);


  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      onChange(history[newIndex]);
    }
  }, [historyIndex, history, onChange]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onChange(history[newIndex]);
    }
  }, [historyIndex, history, onChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, onSave]);

  const getConfidenceColor = (conf: number) => {
    if (conf >= 80) return 'text-green-600 bg-green-100';
    if (conf >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const charCount = text.length;
  const lineCount = text.split('\n').length;

  return (
    <div className="bg-gray-50 rounded-lg p-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900">Metin Düzenle</h4>
        <div className="flex items-center gap-2">
          {saveStatus === 'saved' && (
            <span className="flex items-center text-sm text-green-600">
              <CheckCircle className="h-4 w-4 mr-1" /> Kaydedildi
            </span>
          )}
          {saveStatus === 'saving' && (
            <span className="flex items-center text-sm text-blue-600">
              <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Kaydediliyor...
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center text-sm text-red-600">
              <AlertCircle className="h-4 w-4 mr-1" /> Hata
            </span>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3">
        <button onClick={handleUndo} disabled={historyIndex <= 0}
          className="p-2 rounded bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          title="Geri Al (Ctrl+Z)">
          <Undo2 className="h-4 w-4" />
        </button>
        <button onClick={handleRedo} disabled={historyIndex >= history.length - 1}
          className="p-2 rounded bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          title="Yinele (Ctrl+Y)">
          <Redo2 className="h-4 w-4" />
        </button>
        <div className="flex-1" />
        <span className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(confidence)}`}>
          OCR: {confidence.toFixed(0)}%
        </span>
      </div>

      {/* Textarea */}
      <textarea ref={textareaRef} value={text} onChange={(e) => onChange(e.target.value)}
        className="flex-1 w-full p-4 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="OCR metni buraya yazın..."
      />

      {/* Footer Stats */}
      <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
        <span>{charCount} karakter</span>
        <span>{lineCount} satır</span>
      </div>
    </div>
  );
}