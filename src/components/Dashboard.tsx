import React, { useState, useEffect } from 'react';
import { Plus, Server, LayoutDashboard, Clock } from 'lucide-react';
import { Session, Task } from '../types';
import { NewChangeModal } from './NewChangeModal';
import { cn } from '../lib/utils';

const SessionTile: React.FC<{ session: Session; onClick: () => void }> = ({ session, onClick }) => {
  const [now, setNow] = useState(Date.now());
  
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const getTileColor = (session: Session) => {
    const statuses = new Set(Object.values(session.activeTaskStates || {}).map(s => s.status));
    if (statuses.size === 0) return 'bg-gradient-to-br from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black shadow-slate-900/20';
    if (statuses.has('pink')) return 'bg-gradient-to-br from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-pink-500/30';
    if (statuses.size === 1 && statuses.has('green')) return 'bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/30';
    return 'bg-gradient-to-br from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 shadow-blue-500/30';
  };

  let leastDurationTask: Task | null = null;
  let leastRemainingMs = Infinity;
  let leastDurationMs = Infinity;

  session.activeTasks.forEach(task => {
    const state = session.activeTaskStates[task.id];
    if (state && state.status !== 'green') {
      const durMs = Math.max(1, task.durationMins || 1) * 60 * 1000;
      const elapsed = now - (state.startedAt || now);
      const remaining = Math.max(0, durMs - Math.max(0, elapsed));
      if (remaining < leastRemainingMs) {
        leastRemainingMs = remaining;
        leastDurationMs = durMs;
        leastDurationTask = task;
      }
    }
  });

  let strokeColor = 'text-white/20';
  let progressColor = 'text-white';
  let dashoffset = 0;
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  let timeText = '--:--';
  
  if (leastDurationTask) {
    const state = session.activeTaskStates[leastDurationTask.id];
    const durationMs = leastDurationMs;
    const elapsed = now - (state.startedAt || now);
    const remaining = Math.max(0, durationMs - Math.max(0, elapsed));
    const progressPercent = (remaining / durationMs);
    
    dashoffset = circumference * (1 - progressPercent);
    
    const isDelayed = leastDurationTask.plannedStart ? now > leastDurationTask.plannedStart : false;
    progressColor = isDelayed ? 'text-red-300' : 'text-blue-100';

    const minsRemaining = Math.floor(remaining / 60000);
    const secsRemaining = Math.floor((remaining % 60000) / 1000);
    timeText = `${minsRemaining}:${secsRemaining.toString().padStart(2, '0')}`;
  } else if (session.activeTasks.length > 0) {
    timeText = '0:00';
    dashoffset = 0;
    progressColor = 'text-white';
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-[290px] h-[180px] rounded-2xl text-white flex flex-col items-center justify-center transition-all duration-300 shadow-xl relative overflow-hidden group hover:-translate-y-1 hover:shadow-2xl border border-white/10 shrink-0",
        getTileColor(session)
      )}
    >
      <div className="absolute top-3 right-3 flex items-center justify-center w-14 h-14 opacity-90 group-hover:opacity-100 transition-opacity bg-black/10 rounded-full backdrop-blur-sm">
        <svg className="transform -rotate-90 w-10 h-10">
          <circle cx="20" cy="20" r={radius} stroke="currentColor" strokeWidth="3" fill="transparent" className={strokeColor} />
          {leastDurationTask && (
            <circle 
              cx="20" cy="20" r={radius} 
              stroke="currentColor" 
              strokeWidth="3" 
              fill="transparent" 
              strokeDasharray={circumference}
              strokeDashoffset={dashoffset}
              className={cn("transition-all duration-1000 ease-linear", progressColor)} 
            />
          )}
        </svg>
        <span className="absolute text-[10px] font-mono font-bold tracking-tighter drop-shadow-md">{timeText}</span>
      </div>
      <Server className="w-10 h-10 mb-3 opacity-90 drop-shadow-md" />
      <span className="font-bold text-xl tracking-tight drop-shadow-sm">{session.changeNumber}</span>
    </button>
  );
}

interface DashboardProps {
  sessions: Record<string, Session>;
  onNewSession: (changeNumber: string, file: File) => void;
  onOpenSession: (changeNumber: string) => void;
}

export function Dashboard({ sessions, onNewSession, onOpenSession }: DashboardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <div className="bg-white px-8 py-5 flex items-center justify-between shadow-sm border-b border-slate-200/60 sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2.5 rounded-lg shadow-sm">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight" style={{ fontStyle: "normal", textAlign: "left" }}>ChangeTracker Pro</h1>
        </div>
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-all text-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Change
        </button>
      </div>

      <div className="p-8 flex-1 max-w-7xl mx-auto w-full flex flex-col items-center">
        <div className="mb-10 text-center">
          <h2 className="text-slate-500 font-medium text-sm uppercase tracking-wider mb-1">Overview</h2>
          <h3 className="text-3xl font-bold text-slate-800 tracking-tight">Active Sessions</h3>
        </div>

        <div className="flex flex-wrap justify-center gap-6 w-full max-w-5xl">
          {Object.values(sessions).length === 0 ? (
            <div className="text-slate-500 mt-10 flex flex-col items-center">
              <Server className="w-12 h-12 mb-4 text-slate-300" />
              <p>No active sessions. Click "New Change" to start.</p>
            </div>
          ) : (
            Object.values(sessions).map((session) => (
              <SessionTile 
                key={session.changeNumber}
                session={session}
                onClick={() => onOpenSession(session.changeNumber)}
              />
            ))
          )}
        </div>
      </div>

      <NewChangeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={(changeNumber, file) => {
          onNewSession(changeNumber, file);
          setIsModalOpen(false);
        }}
        existingSessions={Object.keys(sessions)}
      />
    </div>
  );
}
