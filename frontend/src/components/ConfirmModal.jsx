import React from 'react';
import { AlertCircle } from 'lucide-react';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", isDestructive = true }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
        <div className="p-8 flex flex-col items-center text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-inner ${isDestructive ? 'bg-red-50 text-red-500' : 'bg-primary-50 text-primary-500'}`}>
            <AlertCircle size={40} className={isDestructive ? 'animate-pulse' : ''} />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">{title}</h3>
          <p className="text-base text-slate-500 mb-8 leading-relaxed px-2">{message}</p>
          <div className="flex w-full gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all focus:ring-4 focus:ring-slate-100"
            >
              {cancelText}
            </button>
            <button
              onClick={() => { onConfirm(); onClose(); }}
              className={`flex-1 px-5 py-3.5 font-bold rounded-2xl transition-all shadow-lg text-white ${isDestructive ? 'bg-red-600 hover:bg-red-700 focus:ring-4 focus:ring-red-200 shadow-red-600/20 hover:shadow-red-600/40 hover:-translate-y-0.5' : 'bg-primary-600 hover:bg-primary-700 focus:ring-4 focus:ring-primary-200 shadow-primary-600/20 hover:shadow-primary-600/40 hover:-translate-y-0.5'}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
