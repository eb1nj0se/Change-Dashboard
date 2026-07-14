import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Save, Undo, Check, Inbox, X } from 'lucide-react';
import { Session, Task, TaskState } from '../types';
import { cn } from '../lib/utils';

function TaskProgressBars({ activeTasks, activeTaskStates }: { activeTasks: Task[], activeTaskStates: Record<string, TaskState> }) {
  const [now, setNow] = useState(Date.now());
  
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (activeTasks.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {activeTasks.map(task => {
        const state = activeTaskStates[task.id];
        if (!state) return null;

        const durationMs = Math.max(1, task.durationMins || 1) * 60 * 1000;
        const elapsed = now - (state.startedAt || now);
        const remaining = Math.max(0, durationMs - Math.max(0, elapsed));
        const progressPercent = (remaining / durationMs) * 100;

        const isDelayed = task.plannedStart ? now > task.plannedStart : false;
        const isDone = state.status === 'green';
        
        let barColor = isDelayed ? 'bg-rose-500' : 'bg-indigo-500';
        if (isDone) barColor = 'bg-emerald-500';

        const minsRemaining = Math.floor(remaining / 60000);
        const secsRemaining = Math.floor((remaining % 60000) / 1000);

        return (
          <div key={task.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50 flex flex-col justify-center transition-all hover:border-slate-300 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-slate-700 text-sm truncate mr-2" title={`Task ${task.id} - ${task.team}`}>Task {task.id}</span>
              <span className="text-[10px] font-mono text-slate-600 bg-white px-2 py-0.5 border border-slate-200 rounded-md font-semibold tracking-tight shadow-sm">
                {isDone ? 'COMPLETED' : `${minsRemaining}:${secsRemaining.toString().padStart(2, '0')}`}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden shadow-inner">
              <div 
                className={`h-full transition-all duration-1000 ease-linear ${barColor}`} 
                style={{ width: isDone ? '100%' : `${progressPercent}%` }} 
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface SessionViewProps {
  session: Session;
  onBack: () => void;
  onNextTasks: (selectedTaskIds: string[]) => void;
  onLogAck: (taskId: string) => void;
  onLogDone: (taskId: string) => void;
  onLogCustomEvent: (type: string, details: string) => void;
  onUndo: (taskId: string) => void;
}

export function SessionView({
  session,
  onBack,
  onNextTasks,
  onLogAck,
  onLogDone,
  onLogCustomEvent,
  onUndo
}: SessionViewProps) {
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [eventType, setEventType] = useState('Incident / Issue');
  const [eventDetails, setEventDetails] = useState('');
  const feedEndRef = useRef<HTMLDivElement>(null);
  
  const [isTaskSelectionOpen, setIsTaskSelectionOpen] = useState(false);
  const [selectedTaskIdsToStart, setSelectedTaskIdsToStart] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Auto-select the first task when activeTasks changes
    if (session.activeTasks.length > 0 && !session.activeTasks.find(t => t.id === selectedTask)) {
      setSelectedTask(session.activeTasks[0].id);
    }
  }, [session.activeTasks]);

  useEffect(() => {
    // Scroll feed to bottom
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.feed]);

  const handleRegisterEvent = () => {
    if (!eventDetails.trim()) {
      alert("Please enter event details.");
      return;
    }
    onLogCustomEvent(eventType, eventDetails);
    setEventDetails('');
  };

  const handleNextTasksClick = () => {
    if (session.currentBlockIdx >= session.taskBlocks.length) {
      alert("You have reached the end of the cutover plan!");
      return;
    }
    const nextTasks = session.taskBlocks[session.currentBlockIdx];
    setSelectedTaskIdsToStart(new Set(nextTasks.map(t => t.id)));
    setIsTaskSelectionOpen(true);
  };

  const handleSaveLog = () => {
    const logContent = session.feed
      .map(f => `[${f.timestamp}] ${f.message}`)
      .join('\n\n');
    
    if (!logContent) {
      alert("The log is currently empty.");
      return;
    }

    const blob = new Blob([`=== CUTOVER TIMELINE: ${session.changeNumber} ===\n\n${logContent}`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Timeline_${session.changeNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getColorClass = (status?: string) => {
    switch (status) {
      case 'pink': return 'text-purple-600';
      case 'blue': return 'text-indigo-500';
      case 'green': return 'text-emerald-600';
      default: return 'text-slate-900';
    }
  };

  const activeTaskDetails = selectedTask ? session.globalTaskDetails[selectedTask] : null;

  return (
    <div className="h-screen flex flex-col bg-slate-50 font-sans overflow-hidden">
      {/* Navigation Bar */}
      <div className="bg-white border-b border-slate-200/60 px-6 py-4 flex items-center shadow-sm shrink-0 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="flex items-center px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm transition-colors mr-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </button>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Active Change: <span className="text-indigo-600">{session.changeNumber}</span></h1>
        
        <div className="ml-auto">
          <button
            onClick={handleSaveLog}
            className="flex items-center bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg shadow-sm transition-all"
          >
            <Save className="w-4 h-4 mr-2" /> Export Logs
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden p-6 max-w-[1600px] mx-auto w-full gap-6">
        
        {/* Left Column: Controls */}
        <div className="w-[360px] shrink-0 flex flex-col space-y-6 overflow-y-auto pr-2 custom-scrollbar">
          
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 rounded-l-2xl"></div>
            <h2 className="font-bold text-slate-800 mb-4 text-sm tracking-wide uppercase">1. Task Progression</h2>
            
            <button
              onClick={handleNextTasksClick}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-lg mb-4 shadow-sm transition-colors text-sm"
            >
              🚀 Send Next Tasks
            </button>

            <div className="bg-slate-50 p-4 rounded-xl mb-5 min-h-[60px] text-sm font-semibold border border-slate-200/60 shadow-inner">
              <div className="text-slate-500 mb-2 uppercase tracking-wider text-xs">Current Tasks</div>
              {session.activeTasks.length === 0 ? (
                <span className="font-medium text-slate-400 italic">No tasks active</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {session.activeTasks.map((t, i) => (
                    <span 
                      key={t.id}
                      onClick={() => setSelectedTask(t.id)}
                      className={cn(
                        "cursor-pointer px-2.5 py-1 rounded-md transition-all border text-sm shadow-sm", 
                        selectedTask === t.id ? "bg-indigo-50 border-indigo-200 text-indigo-700 ring-1 ring-indigo-500/20" : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                        getColorClass(session.activeTaskStates[t.id]?.status)
                      )}
                    >
                      Task {t.id}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => onUndo(selectedTask)}
                className="flex items-center justify-center bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-3 rounded-lg shadow-sm transition-colors text-xs"
              >
                <Undo className="w-3.5 h-3.5 mr-1.5" /> Undo
              </button>
              <button
                onClick={() => onLogAck(selectedTask)}
                disabled={!selectedTask}
                className="flex-1 flex items-center justify-center bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white font-semibold py-2 px-2 rounded-lg shadow-sm transition-colors text-xs"
              >
                <Inbox className="w-3.5 h-3.5 mr-1.5" /> ACK (Blue)
              </button>
              <button
                onClick={() => onLogDone(selectedTask)}
                disabled={!selectedTask}
                className="flex-1 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-semibold py-2 px-2 rounded-lg shadow-sm transition-colors text-xs"
              >
                <Check className="w-3.5 h-3.5 mr-1.5" /> DONE (Green)
              </button>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-rose-500 rounded-l-2xl"></div>
            <h2 className="font-bold text-slate-800 mb-4 text-sm tracking-wide uppercase">2. Event Logging</h2>
            
            <label className="block text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Event Type</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 mb-4 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm transition-all shadow-sm font-medium text-slate-700"
            >
              <option>Incident / Issue</option>
              <option>Bridge Call Started</option>
              <option>Bridge Call Resolved</option>
              <option>General Note</option>
            </select>

            <label className="block text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Details</label>
            <textarea
              value={eventDetails}
              onChange={(e) => setEventDetails(e.target.value)}
              rows={4}
              className="w-full border border-slate-300 rounded-lg p-3 mb-4 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm resize-none transition-all shadow-sm text-slate-700"
            />

            <button
              onClick={handleRegisterEvent}
              className="w-full bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-colors text-sm flex items-center justify-center"
            >
              <span className="mr-2">🛑</span> Log Event
            </button>
          </div>

        </div>

        {/* Middle Column: Live Feed & Progress */}
        <div className="flex-1 bg-white border border-slate-200/60 rounded-2xl shadow-sm flex flex-col overflow-hidden min-w-[300px]">
          {session.activeTasks.length > 0 && (
            <div className="border-b border-slate-200/60 bg-slate-50/50 p-4 shrink-0 shadow-sm">
              <TaskProgressBars 
                activeTasks={session.activeTasks} 
                activeTaskStates={session.activeTaskStates} 
              />
            </div>
          )}
          <div className="bg-slate-100 py-3 border-b border-slate-200/60 text-center text-xs font-bold text-slate-500 uppercase tracking-widest shrink-0 shadow-sm">
            Live Timeline
          </div>
          <div className="flex-1 overflow-y-auto p-5 bg-white font-mono text-sm space-y-3">
            {session.feed.map(event => (
              <div key={event.id} className={cn(
                "whitespace-pre-wrap break-words leading-relaxed p-2.5 rounded-lg border shadow-sm",
                event.tag === 'tag_sent' ? 'bg-slate-50 border-slate-200 text-slate-800 font-medium' :
                event.tag === 'tag_ack' ? 'bg-indigo-50 border-indigo-200 text-indigo-800' :
                event.tag === 'tag_done' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold' :
                event.tag === 'tag_incident' ? 'bg-rose-50 border-rose-200 text-rose-800 font-semibold' :
                event.tag === 'tag_bridge' ? 'bg-orange-50 border-orange-200 text-orange-800 font-semibold' :
                event.tag === 'tag_note' ? 'bg-amber-50 border-amber-200 text-amber-800 italic' :
                'bg-slate-100 border-slate-200 text-slate-500 italic text-xs'
              )}>
                <span className="text-slate-400 font-medium mr-3 tracking-tight">[{event.timestamp}]</span>
                {event.message}
              </div>
            ))}
            <div ref={feedEndRef} />
          </div>
        </div>

        {/* Right Column: Task Details */}
        <div className="w-[360px] shrink-0 bg-white border border-slate-200/60 rounded-2xl shadow-sm flex flex-col overflow-hidden">
          <div className="bg-slate-800 text-white py-3 px-5 text-xs font-bold tracking-widest uppercase text-center shadow-md z-10">
            Task Details
          </div>
          
          <div className="p-5 flex-1 flex flex-col overflow-y-auto bg-slate-50 space-y-6">
            <div className="text-center pb-4 border-b border-slate-200/60">
              {selectedTask ? (
                <span className="text-indigo-600 font-bold text-lg">
                  Task {selectedTask}
                </span>
              ) : (
                <span className="text-slate-400 font-medium italic text-sm">
                  Select a task to view details
                </span>
              )}
            </div>

            <div>
              <h3 className="font-bold text-slate-700 text-xs tracking-wider uppercase mb-3 flex items-center">
                <span className="bg-slate-200 w-6 h-[1px] mr-2"></span>
                Task Description
                <span className="bg-slate-200 flex-1 h-[1px] ml-2"></span>
              </h3>
              <div className="bg-white border border-slate-200/60 rounded-xl p-4 shadow-sm min-h-[120px] max-h-[300px] overflow-y-auto">
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                  {activeTaskDetails?.desc || <span className="text-slate-400 italic font-normal">Data not found.</span>}
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-slate-700 text-xs tracking-wider uppercase mb-3 flex items-center">
                <span className="bg-slate-200 w-6 h-[1px] mr-2"></span>
                POC Details
                <span className="bg-slate-200 flex-1 h-[1px] ml-2"></span>
              </h3>
              <div className="bg-white border border-slate-200/60 rounded-xl p-4 shadow-sm min-h-[120px] max-h-[300px] overflow-y-auto">
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                  {activeTaskDetails?.poc || <span className="text-slate-400 italic font-normal">Data not found.</span>}
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Task Selection Modal */}
      {isTaskSelectionOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] border border-slate-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Select Tasks to Track</h2>
              <button onClick={() => setIsTaskSelectionOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 custom-scrollbar">
              <p className="text-sm text-slate-600 mb-6 font-medium leading-relaxed bg-blue-50 text-blue-800 p-3 rounded-lg border border-blue-100">
                The following tasks are planned for this time slot. Uncheck any tasks you don't need to log or track.
              </p>
              
              <div className="space-y-3">
                {session.taskBlocks[session.currentBlockIdx]?.map(task => (
                  <label key={task.id} className="flex items-start space-x-4 p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group">
                    <input
                      type="checkbox"
                      className="mt-1 w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 focus:ring-offset-0 transition-colors cursor-pointer"
                      checked={selectedTaskIdsToStart.has(task.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedTaskIdsToStart);
                        if (e.target.checked) newSet.add(task.id);
                        else newSet.delete(task.id);
                        setSelectedTaskIdsToStart(newSet);
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 text-sm truncate group-hover:text-indigo-700 transition-colors">Task {task.id} - {task.team}</div>
                      <div className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{task.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0 flex justify-end space-x-3">
              <button
                onClick={() => setIsTaskSelectionOpen(false)}
                className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onNextTasks(Array.from(selectedTaskIdsToStart));
                  setIsTaskSelectionOpen(false);
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-colors text-sm"
              >
                Confirm Sent Tasks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
