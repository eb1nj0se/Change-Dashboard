import React, { useState, useRef } from 'react';
import { X, Upload } from 'lucide-react';

interface NewChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (changeNumber: string, file: File, regressionStartTask: string) => void;
  existingSessions: string[];
}

export function NewChangeModal({ isOpen, onClose, onSubmit, existingSessions }: NewChangeModalProps) {
  const [changeNumber, setChangeNumber] = useState('');
  const [regressionStartTask, setRegressionStartTask] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedChange = changeNumber.trim();
    if (!trimmedChange) {
      setError('Please enter a valid Change Number.');
      return;
    }
    if (existingSessions.includes(trimmedChange)) {
      setError(`A session for Change ${trimmedChange} already exists!`);
      return;
    }
    if (!file) {
      setError('Please select a Cutover Excel file.');
      return;
    }

    onSubmit(trimmedChange, file, regressionStartTask.trim());
    setChangeNumber('');
    setRegressionStartTask('');
    setFile(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200/60">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Start New Change</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 bg-slate-50">
          <div className="space-y-6">
            <div>
              <label htmlFor="changeNumber" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Enter Change Number:
              </label>
              <input
                id="changeNumber"
                type="text"
                value={changeNumber}
                onChange={(e) => setChangeNumber(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-center text-lg shadow-sm text-slate-800"
                placeholder="e.g., CHG3784363"
              />
            </div>

            <div>
              <label htmlFor="regressionStartTask" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Start of Regression Tasks (Task ID):
              </label>
              <input
                id="regressionStartTask"
                type="text"
                value={regressionStartTask}
                onChange={(e) => setRegressionStartTask(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-center text-lg shadow-sm text-slate-800"
                placeholder="Optional (e.g. 3.015)"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Select Cutover Plan (Excel):
              </label>
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-300 flex items-center transition-all text-sm font-semibold shadow-sm whitespace-nowrap"
                >
                  <Upload className="w-4 h-4 mr-2 text-indigo-500" />
                  Browse File
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  accept=".xlsx,.xlsm,.xls"
                  className="hidden"
                />
                <span className="text-sm text-slate-500 truncate flex-1 font-medium">
                  {file ? file.name : 'No file selected'}
                </span>
              </div>
            </div>

            {error && <p className="text-rose-500 text-sm font-medium p-3 bg-rose-50 border border-rose-100 rounded-lg">{error}</p>}

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors mt-4 text-base"
            >
              Create Change Session
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
