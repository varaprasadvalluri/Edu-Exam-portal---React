'use client';
import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
}

const variantMap = {
  danger: { btn: 'btn-danger', icon: '🗑️', iconBg: 'bg-danger-50' },
  warning: { btn: 'bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl px-5 py-2.5 inline-flex items-center justify-center gap-2 text-sm transition-all', icon: '⚠️', iconBg: 'bg-amber-50' },
  primary: { btn: 'btn-primary', icon: '✓', iconBg: 'bg-primary-50' },
};

export default function ConfirmDialog({
  open, onClose, onConfirm, title, message,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'danger', loading = false,
}: ConfirmDialogProps) {
  const v = variantMap[variant];

  return (
    <Modal open={open} onClose={onClose} size="sm" hideClose>
      <div className="p-6 text-center">
        <div className={`w-14 h-14 ${v.iconBg} rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4`}>
          {v.icon}
        </div>
        <h3 className="font-display font-bold text-gray-900 text-lg mb-2">{title}</h3>
        <p className="text-gray-500 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="btn-secondary flex-1">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} disabled={loading} className={`${v.btn} flex-1`}>
            {loading ? (
              <svg className="w-4 h-4 animate-spin mx-auto" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
