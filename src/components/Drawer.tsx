import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: string;
  children: React.ReactNode;
}

/**
 * Right-side slide-over for the secondary surfaces (alerts, manuals, settings)
 * so they never compete with the map for space.
 */
export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  width = 'max-w-2xl',
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute inset-0 bg-ink/20 animate-fadeIn cursor-default"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative w-full ${width} h-full bg-surface border-l border-hairline shadow-xl flex flex-col animate-slideIn focus:outline-none`}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-3.5 border-b border-hairline shrink-0">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
            {subtitle && <p className="text-[11px] text-ink-3 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            className="p-1.5 -mr-1.5 rounded-md text-ink-3 hover:text-ink hover:bg-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto thin-scroll">{children}</div>
      </div>
    </div>
  );
};
