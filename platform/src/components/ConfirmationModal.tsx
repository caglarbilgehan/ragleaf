import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Info, CheckCircle, XCircle, X } from 'lucide-react';

export type ConfirmationType = 'warning' | 'danger' | 'info' | 'success';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    type?: ConfirmationType;
    isLoading?: boolean;
}

const typeConfig = {
    warning: {
        icon: AlertTriangle,
        iconBg: 'bg-yellow-500/10',
        iconColor: 'text-yellow-400',
        confirmBtnClass: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
        borderColor: 'border-yellow-500/20',
    },
    danger: {
        icon: AlertTriangle,
        iconBg: 'bg-red-500/10',
        iconColor: 'text-red-400',
        confirmBtnClass: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
        borderColor: 'border-red-500/20',
    },
    info: {
        icon: Info,
        iconBg: 'bg-blue-500/10',
        iconColor: 'text-blue-400',
        confirmBtnClass: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
        borderColor: 'border-blue-500/20',
    },
    success: {
        icon: CheckCircle,
        iconBg: 'bg-green-500/10',
        iconColor: 'text-green-400',
        confirmBtnClass: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
        borderColor: 'border-green-500/20',
    },
};

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Onayla',
    cancelText = 'İptal',
    type = 'warning',
    isLoading = false,
}: ConfirmationModalProps) {
    const confirmButtonRef = useRef<HTMLButtonElement>(null);
    const config = typeConfig[type];
    const IconComponent = config.icon;

    // Focus confirm button when modal opens
    useEffect(() => {
        if (isOpen && confirmButtonRef.current) {
            confirmButtonRef.current.focus();
        }
    }, [isOpen]);

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop with blur */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <div
                    className={`
                        bg-dark-800/60 rounded-2xl shadow-2xl max-w-lg w-full pointer-events-auto
                        transform transition-all duration-200 ease-out
                        border ${config.borderColor}
                    `}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="relative p-6 pb-4">
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-dark-600"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Icon and Title */}
                        <div className="flex items-center gap-4">
                            <div className={`${config.iconBg} p-3 rounded-xl flex-shrink-0`}>
                                <IconComponent className={`w-6 h-6 ${config.iconColor}`} />
                            </div>
                            <div className="flex-1 min-w-0 pr-8">
                                <h3 className="text-lg font-semibold text-gray-100 leading-tight">
                                    {title}
                                </h3>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-6 pb-5">
                        <div className="text-sm text-gray-300 leading-relaxed">
                            {message}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 px-6 py-4 bg-dark-700/50 rounded-b-2xl border-t border-white/[0.06]">
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="
                px-4 py-2.5 text-sm font-medium text-gray-300 
                bg-dark-800/60 border border-white/[0.1] rounded-xl
                hover:bg-dark-700/50 hover:border-gray-400
                focus:outline-none focus:ring-2 focus:ring-gray-200
                transition-all duration-150
                disabled:opacity-50 disabled:cursor-not-allowed
              "
                        >
                            {cancelText}
                        </button>
                        <button
                            ref={confirmButtonRef}
                            onClick={onConfirm}
                            disabled={isLoading}
                            className={`
                px-5 py-2.5 text-sm font-medium text-white rounded-xl
                ${config.confirmBtnClass}
                focus:outline-none focus:ring-2 focus:ring-offset-2
                transition-all duration-150
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center gap-2
              `}
                        >
                            {isLoading && (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            )}
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

// Helper hook for easier usage
export function useConfirmation() {
    const [state, setState] = React.useState<{
        isOpen: boolean;
        title: string;
        message: string | React.ReactNode;
        type: ConfirmationType;
        confirmText: string;
        cancelText: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'warning',
        confirmText: 'Onayla',
        cancelText: 'İptal',
        onConfirm: () => { },
    });

    const confirm = React.useCallback(
        (options: {
            title: string;
            message: string | React.ReactNode;
            type?: ConfirmationType;
            confirmText?: string;
            cancelText?: string;
        }): Promise<boolean> => {
            return new Promise((resolve) => {
                setState({
                    isOpen: true,
                    title: options.title,
                    message: options.message,
                    type: options.type || 'warning',
                    confirmText: options.confirmText || 'Onayla',
                    cancelText: options.cancelText || 'İptal',
                    onConfirm: () => {
                        setState((prev) => ({ ...prev, isOpen: false }));
                        resolve(true);
                    },
                });
            });
        },
        []
    );

    const close = React.useCallback(() => {
        setState((prev) => ({ ...prev, isOpen: false }));
    }, []);

    const ConfirmationDialog = React.useCallback(
        () => (
            <ConfirmationModal
                isOpen={state.isOpen}
                onClose={close}
                onConfirm={state.onConfirm}
                title={state.title}
                message={state.message}
                type={state.type}
                confirmText={state.confirmText}
                cancelText={state.cancelText}
            />
        ),
        [state, close]
    );

    return { confirm, close, ConfirmationDialog };
}
