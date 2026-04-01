import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

const ICONS = {
  success: <CheckCircle size={18} className="text-green-500" />,
  error: <XCircle size={18} className="text-red-500" />,
  warning: <AlertTriangle size={18} className="text-amber-500" />,
  info: <Info size={18} className="text-blue-500" />,
};

const BG = {
  success: 'bg-green-50 border-green-200',
  error: 'bg-red-50 border-red-200',
  warning: 'bg-amber-50 border-amber-200',
  info: 'bg-blue-50 border-blue-200',
};

const ToastItem = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration || 3000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div className={`flex items-start space-x-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm ${BG[toast.type] || BG.info} animate-slide-in-right min-w-[300px] max-w-[420px]`}>
      <div className="mt-0.5 shrink-0">{ICONS[toast.type] || ICONS.info}</div>
      <div className="flex-1 min-w-0">
        {toast.title && <p className="font-semibold text-slate-800 text-sm">{toast.title}</p>}
        <p className="text-slate-600 text-sm leading-relaxed">{toast.message}</p>
      </div>
      <button onClick={() => onDismiss(toast.id)} className="shrink-0 p-0.5 text-slate-400 hover:text-slate-600 rounded transition-colors">
        <X size={14} />
      </button>
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback(({ type = 'info', title, message, duration = 3000 }) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, type, title, message, duration }]);
  }, []);

  const success = useCallback((message, title) => toast({ type: 'success', title, message }), [toast]);
  const error = useCallback((message, title) => toast({ type: 'error', title, message, duration: 5000 }), [toast]);
  const warning = useCallback((message, title) => toast({ type: 'warning', title, message }), [toast]);
  const info = useCallback((message, title) => toast({ type: 'info', title, message }), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
