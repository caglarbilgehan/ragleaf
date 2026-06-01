import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Play, RefreshCw, RotateCcw, AlertCircle, Edit3, Trash2, ChevronDown, MoreHorizontal, Pause, StopCircle } from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import ConfirmationModal from './ConfirmationModal';

interface DocumentItem {
  id: number;
  status: string;
  name: string;
}

interface ActionButtonGroupProps {
  document: DocumentItem;
  onAction: (action: string, documentId: number) => void;
  disabled?: boolean;
}

const ActionButtonGroup: React.FC<ActionButtonGroupProps> = ({
  document: doc,
  onAction,
  disabled = false,
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // Determine visible buttons based on status
  const getVisibleActions = () => {
    switch (doc.status) {
      case 'uploaded':
        return [
          { id: 'edit', label: 'Düzenle', icon: Edit3, type: 'secondary' },
          { id: 'process', label: 'İşle', icon: Play, type: 'primary' },
          { id: 'delete', label: 'Sil', icon: Trash2, type: 'destructive' }
        ];
      case 'ocr_editing':
        return [
          { id: 'edit', label: 'Düzenle', icon: Edit3, type: 'secondary' },
          { id: 'ocr_edit', label: 'OCR Düzenle', icon: Edit3, type: 'primary' },
          { id: 'delete', label: 'Sil', icon: Trash2, type: 'destructive' }
        ];
      case 'processing':
      case 'indexing':
        // Show control buttons during processing/indexing
        return [
          { id: 'viewProgress', label: 'İşlem Durumu', icon: Play, type: 'primary' },
          { id: 'pause', label: 'Duraklat', icon: Pause, type: 'warning' },
          { id: 'cancel', label: 'Durdur', icon: StopCircle, type: 'destructive' }
        ];
      case 'processed':
      case 'enriched':
        return [
          { id: 'edit', label: 'Düzenle', icon: Edit3, type: 'secondary' },
          { id: 'index', label: 'İndeksle', icon: Play, type: 'primary' },
          { id: 'reprocess', label: 'Yeniden İşle', icon: RefreshCw, type: 'secondary' },
          { id: 'reset', label: 'Sıfırla', icon: RotateCcw, type: 'destructive' },
          { id: 'delete', label: 'Sil', icon: Trash2, type: 'destructive' }
        ];
      case 'indexed':
        return [
          { id: 'edit', label: 'Düzenle', icon: Edit3, type: 'secondary' },
          { id: 'reindex', label: 'Yeniden İndeksle', icon: RefreshCw, type: 'secondary' },
          { id: 'reset', label: 'Sıfırla', icon: RotateCcw, type: 'destructive' },
          { id: 'delete', label: 'Sil', icon: Trash2, type: 'destructive' }
        ];
      case 'error':
        return [
          { id: 'edit', label: 'Düzenle', icon: Edit3, type: 'secondary' },
          { id: 'retry', label: 'Yeniden Dene', icon: AlertCircle, type: 'primary' },
          { id: 'delete', label: 'Sil', icon: Trash2, type: 'destructive' }
        ];
      default:
        return [
          { id: 'edit', label: 'Düzenle', icon: Edit3, type: 'secondary' },
          { id: 'delete', label: 'Sil', icon: Trash2, type: 'destructive' }
        ];
    }
  };

  const actions = getVisibleActions();

  const handleActionClick = (actionId: string, isDestructive: boolean) => {
    if (isDestructive) {
      setPendingAction(actionId);
      setShowConfirm(true);
    } else {
      onAction(actionId, doc.id);
    }
  };

  const handleConfirm = () => {
    if (pendingAction) {
      onAction(pendingAction, doc.id);
    }
    setShowConfirm(false);
    setPendingAction(null);
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setPendingAction(null);
  };

  const getMenuItemClasses = (type: string, active: boolean) => {
    const base = 'flex items-center gap-2 w-full px-4 py-2 text-sm';
    if (type === 'destructive') {
      return `${base} ${active ? 'bg-red-50' : ''} text-red-600`;
    }
    if (type === 'primary') {
      return `${base} ${active ? 'bg-blue-50' : ''} text-blue-600 font-medium`;
    }
    if (type === 'warning') {
      return `${base} ${active ? 'bg-yellow-50' : ''} text-yellow-600 font-medium`;
    }
    return `${base} ${active ? 'bg-gray-100' : ''} text-gray-700`;
  };

  // No actions available
  if (actions.length === 0) {
    return null;
  }

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.top - 8, // 8px gap above button
        left: rect.right - 192, // 192px = w-48 width, align right edge
      });
    }
  };

  // Single dropdown for all views - using Portal for proper z-index
  return (
    <>
      <Menu as="div" className="relative inline-block text-left">
        {({ open }) => {
          // Update position when menu opens
          useEffect(() => {
            if (open) {
              updatePosition();
            }
          }, [open]);

          return (
            <>
              <Menu.Button
                ref={buttonRef}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                disabled={disabled}
              >
                <MoreHorizontal className="w-4 h-4" />
                İşlemler
                <ChevronDown className="w-4 h-4" />
              </Menu.Button>

              {createPortal(
                <Transition
                  show={open}
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items
                    static
                    className="fixed w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                    style={{
                      top: menuPosition.top,
                      left: menuPosition.left,
                      transform: 'translateY(-100%)',
                      zIndex: 9999,
                    }}
                  >
                    <div className="py-1">
                      {actions.map((action, index) => (
                        <React.Fragment key={action.id}>
                          {/* Add separator before destructive actions */}
                          {action.type === 'destructive' && index > 0 && actions[index - 1]?.type !== 'destructive' && (
                            <div className="border-t border-gray-100 my-1" />
                          )}
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={() => handleActionClick(action.id, action.type === 'destructive')}
                                className={getMenuItemClasses(action.type, active)}
                              >
                                <action.icon className="w-4 h-4" />
                                {action.label}
                              </button>
                            )}
                          </Menu.Item>
                        </React.Fragment>
                      ))}
                    </div>
                  </Menu.Items>
                </Transition>,
                document.body
              )}
            </>
          );
        }}
      </Menu>

      {/* Confirmation Dialog */}
      <ConfirmationModal
        isOpen={showConfirm}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title="Emin misiniz?"
        message={
          <>
            <strong>{doc.name}</strong> dökümanı için bu işlem geri alınamaz.
          </>
        }
        type="danger"
        confirmText="Onayla"
        cancelText="İptal"
      />
    </>
  );
};

export default ActionButtonGroup;
