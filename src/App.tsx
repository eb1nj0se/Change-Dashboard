/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useSessions } from './hooks/useSessions';
import { Dashboard } from './components/Dashboard';
import { SessionView } from './components/SessionView';

export default function App() {
  const {
    sessions,
    createSession,
    triggerNextTasks,
    logAck,
    logDone,
    logCustomEvent,
    addCheckpoint,
    undoLastAction
  } = useSessions();

  const [activeChange, setActiveChange] = useState<string | null>(null);

  const handleNewSession = async (changeNumber: string, file: File, regressionStartTask?: string) => {
    const success = await createSession(changeNumber, file, regressionStartTask);
    if (success) {
      setActiveChange(changeNumber);
    }
  };

  if (activeChange && sessions[activeChange]) {
    return (
      <SessionView
        session={sessions[activeChange]}
        onBack={() => setActiveChange(null)}
        onNextTasks={(selectedTaskIds, uncheckedTaskIds) => triggerNextTasks(activeChange, selectedTaskIds, uncheckedTaskIds)}
        onLogAck={(taskId) => logAck(activeChange, taskId)}
        onLogDone={(taskId) => logDone(activeChange, taskId)}
        onLogCustomEvent={(type, details) => logCustomEvent(activeChange, type, details)}
        onAddCheckpoint={(taskId, durationMins) => addCheckpoint(activeChange, taskId, durationMins)}
        onUndo={(taskId) => undoLastAction(activeChange, taskId)}
      />
    );
  }

  return (
    <Dashboard
      sessions={sessions}
      onNewSession={handleNewSession}
      onOpenSession={setActiveChange}
    />
  );
}
