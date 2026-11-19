import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { EditorTheme } from '../utils/themes';

export interface ModalShellTab<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface ModalShellProps<T extends string = string> {
  isOpen: boolean;
  onClose: () => void;
  theme: EditorTheme;
  ariaLabel: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  maxWidthClass?: 'max-w-xl' | 'max-w-2xl' | 'max-w-3xl' | 'max-w-4xl';
  tabs?: ModalShellTab<T>[];
  activeTab?: T;
  onTabChange?: (tabId: T) => void;
  subHeader?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function ModalShell<T extends string = string>({
  isOpen,
  onClose,
  theme,
  ariaLabel,
  title,
  subtitle,
  icon,
  maxWidthClass = 'max-w-3xl',
  tabs,
  activeTab,
  onTabChange,
  subHeader,
  footer,
  children,
}: ModalShellProps<T>) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[data-shortcut-recording="true"]')) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-5 backdrop-blur-[1px]"
    >
      <div
        className={`w-full ${maxWidthClass} rounded-xl border shadow-2xl overflow-hidden flex flex-col max-h-[88vh]`}
        style={{
          backgroundColor: theme.ui.bg,
          borderColor: theme.ui.border,
          color: theme.ui.text,
        }}
      >
        {/* Header + Optional Tab Strip */}
        <div
          className={`px-5 pt-3.5 ${tabs && tabs.length > 0 ? 'pb-0' : 'pb-3.5'} border-b shrink-0`}
          style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.surface }}
        >
          <div className={`flex items-start justify-between gap-3 ${tabs && tabs.length > 0 ? 'pb-3' : ''}`}>
            <div className="flex items-start gap-2.5 min-w-0">
              {icon && (
                <div
                  className="p-1.5 rounded-lg border shrink-0 mt-0.5"
                  style={{
                    backgroundColor: theme.ui.bg,
                    borderColor: theme.ui.border,
                    color: theme.ui.accent,
                  }}
                >
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-semibold leading-tight truncate">{title}</h2>
                {subtitle && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: theme.ui.textMuted }}>
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              aria-label={`Close ${title}`}
              onClick={onClose}
              className="p-1.5 rounded-md border hover:opacity-80 transition-opacity shrink-0"
              style={{
                color: theme.ui.textMuted,
                borderColor: 'transparent',
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {tabs && tabs.length > 0 && onTabChange && (
            <div role="tablist" aria-label={`${title} sections`} className="flex items-center gap-4 overflow-x-auto">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    data-active={isActive ? 'true' : 'false'}
                    onClick={() => onTabChange(tab.id)}
                    className="inline-flex items-center gap-1.5 pb-2.5 text-xs font-semibold whitespace-nowrap"
                    style={{
                      borderBottomStyle: 'solid',
                      borderBottomWidth: '2px',
                      borderBottomColor: isActive ? theme.ui.accent : 'transparent',
                      color: isActive ? theme.ui.text : theme.ui.textMuted,
                    }}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && tab.badge !== '' && (
                      <span
                        className="px-1.5 py-0.2 text-[10px] rounded font-mono tabular-nums"
                        style={{
                          backgroundColor: theme.ui.surfaceAlt,
                          color: isActive ? theme.ui.text : theme.ui.textMuted,
                        }}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {subHeader}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>

        {/* Sticky Footer */}
        {footer && (
          <div
            className="px-5 py-3 border-t flex items-center justify-between gap-3 shrink-0"
            style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.surface }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
