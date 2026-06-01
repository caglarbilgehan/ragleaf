import { useEffect } from 'react';

interface Document {
  id: number;
  status: string;
}

interface KeyboardShortcutHandlerProps {
  selectedDocuments: Document[];
  focusedDocument: Document | null;
  onShortcut: (action: string, documentIds: number[]) => void;
  onClearSelection: () => void;
}

const KeyboardShortcutHandler: React.FC<KeyboardShortcutHandlerProps> = ({
  selectedDocuments,
  focusedDocument,
  onShortcut,
  onClearSelection,
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const { key, shiftKey, ctrlKey, metaKey } = event;

      // Prevent default for our shortcuts
      if (['p', 'i', 'r', 'Escape'].includes(key.toLowerCase()) && !ctrlKey && !metaKey) {
        event.preventDefault();
      }

      // Bulk operations (Shift + key)
      if (shiftKey && selectedDocuments.length > 0) {
        const documentIds = selectedDocuments.map((doc) => doc.id);

        switch (key.toLowerCase()) {
          case 'p':
            // Bulk Process (Shift+P)
            if (selectedDocuments.every((doc) => doc.status === 'uploaded')) {
              onShortcut('bulk-process', documentIds);
            }
            break;
          case 'i':
            // Bulk Index (Shift+I)
            if (selectedDocuments.every((doc) => doc.status === 'processed')) {
              onShortcut('bulk-index', documentIds);
            }
            break;
          case 'r':
            // Bulk Reset (Shift+R)
            if (selectedDocuments.every((doc) => ['processed', 'indexed'].includes(doc.status))) {
              onShortcut('bulk-reset', documentIds);
            }
            break;
        }
        return;
      }

      // Single document operations (key only)
      if (!shiftKey && focusedDocument) {
        const documentIds = [focusedDocument.id];

        switch (key.toLowerCase()) {
          case 'p':
            // Process (P)
            if (focusedDocument.status === 'uploaded') {
              onShortcut('process', documentIds);
            }
            break;
          case 'i':
            // Index (I)
            if (focusedDocument.status === 'processed') {
              onShortcut('index', documentIds);
            } else if (focusedDocument.status === 'indexed') {
              onShortcut('reindex', documentIds);
            }
            break;
          case 'r':
            // Reset (R)
            if (focusedDocument.status === 'indexed') {
              onShortcut('reset', documentIds);
            }
            break;
        }
        return;
      }

      // Clear selection (Esc)
      if (key === 'Escape' && selectedDocuments.length > 0) {
        onClearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedDocuments, focusedDocument, onShortcut, onClearSelection]);

  return null; // This component doesn't render anything
};

export default KeyboardShortcutHandler;
