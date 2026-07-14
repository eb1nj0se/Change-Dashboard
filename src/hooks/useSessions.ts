import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Session, Task, FeedEvent, ActionHistoryItem, TaskState, TaskAction } from '../types';
import { format } from 'date-fns';

export function useSessions() {
  const [sessions, setSessions] = useState<Record<string, Session>>({});

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const getBstTimestamp = () => {
    return format(new Date(), 'HH:mm:ss');
  };

  const parseDurationMins = (durationStr: string): number => {
    if (!durationStr) return 0;
    const num = Number(durationStr);
    if (!isNaN(num)) {
      return Math.round(num * 24 * 60);
    }
    const parts = String(durationStr).split(':').map(Number);
    if (parts.length >= 2) {
      return parts[0] * 60 + parts[1];
    }
    return 0;
  };

  const parsePlannedStart = (startStr: string): number | null => {
    if (!startStr) return null;
    const num = Number(startStr);
    if (!isNaN(num)) {
      return Math.round((num - 25569) * 86400 * 1000);
    }
    const cleanStr = String(startStr).replace(/^[A-Za-z]{3}\s/, '');
    const match = cleanStr.match(/(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (match) {
      const [_, d, m, y, h, min] = match;
      return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min)).getTime();
    }
    const d = new Date(startStr);
    if (!isNaN(d.getTime())) return d.getTime();
    return null;
  };

  const createSession = async (changeNumber: string, file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames.includes("Cutover") ? "Cutover" : workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

      const durationColIdx = 3;
      const groupColIdx = 4; // Planned Start
      const taskColIdx = 0; // Task No
      const teamColIdx = 1; // Description
      const pocColIdx = 9; // POC Details

      let currentTasks: Task[] = [];
      const taskBlocks: Task[][] = [];
      let currentTimeVal: string | null = null;
      const globalTaskDetails: Record<string, Task> = {};

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const timeVal = String(row[groupColIdx] || '').trim();
        let rawTask = String(row[taskColIdx] || '').trim();
        let rawDesc = String(row[teamColIdx] || '').trim();
        let rawPoc = String(row[pocColIdx] || '').trim();
        const durationVal = String(row[durationColIdx] || '').trim();

        rawDesc = rawDesc.replace(/_x000[dD]_/g, '').trim();
        rawPoc = rawPoc ? rawPoc.replace(/_x000[dD]_/g, '').trim() : "No POC data in Column J";

        if (!timeVal || timeVal.toLowerCase() === 'nan' || timeVal === 'Planned Start') {
          continue;
        }

        let cleanTask = rawTask;
        const numTask = parseFloat(rawTask);
        if (!isNaN(numTask)) {
          cleanTask = Number.isInteger(numTask) ? numTask.toString() : numTask.toFixed(3);
        }

        const teamMatch = rawDesc.split(/:|\s-|- /);
        const teamName = teamMatch.length > 0 ? teamMatch[0].trim() : rawDesc;

        const taskData: Task = { 
          id: cleanTask, 
          team: teamName, 
          desc: rawDesc, 
          poc: rawPoc,
          durationMins: parseDurationMins(durationVal),
          plannedStart: parsePlannedStart(timeVal)
        };
        globalTaskDetails[cleanTask] = taskData;

        if (currentTimeVal === null) {
          currentTimeVal = timeVal;
          currentTasks.push(taskData);
        } else if (timeVal === currentTimeVal) {
          if (!currentTasks.some(t => t.id === cleanTask)) {
            currentTasks.push(taskData);
          }
        } else {
          taskBlocks.push(currentTasks);
          currentTimeVal = timeVal;
          currentTasks = [taskData];
        }
      }

      if (currentTasks.length > 0) {
        taskBlocks.push(currentTasks);
      }

      const initialFeedEvent: FeedEvent = {
        id: generateId(),
        timestamp: getBstTimestamp(),
        message: `--- SYSTEM: Successfully loaded ${taskBlocks.length} task blocks from plan. ---`,
        tag: 'tag_sys'
      };

      setSessions(prev => ({
        ...prev,
        [changeNumber]: {
          changeNumber,
          taskBlocks,
          currentBlockIdx: 0,
          activeTasks: [],
          activeTaskStates: {},
          globalTaskDetails,
          feed: [initialFeedEvent],
          actionHistory: []
        }
      }));

      return true;
    } catch (e) {
      console.error(e);
      alert('Failed to parse plan. Ensure the Excel file matches the required format.');
      return false;
    }
  };

  const triggerNextTasks = (changeNumber: string, selectedTaskIds: string[]) => {
    setSessions(prev => {
      const session = prev[changeNumber];
      if (!session) return prev;

      if (session.currentBlockIdx >= session.taskBlocks.length) {
        alert("You have reached the end of the cutover plan!");
        return prev;
      }

      const allTasksInBlock = session.taskBlocks[session.currentBlockIdx];
      const activeTasks = allTasksInBlock.filter(t => selectedTaskIds.includes(t.id));
      
      const activeTaskStates: Record<string, TaskState> = {};
      const newEvents: FeedEvent[] = [];
      const now = Date.now();

      activeTasks.forEach(task => {
        activeTaskStates[task.id] = {
          status: 'pink',
          history: [],
          startedAt: now
        };
        newEvents.push({
          id: generateId(),
          timestamp: getBstTimestamp(),
          message: `📤 Task ${task.id} sent to ${task.team}.`,
          tag: 'tag_sent'
        });
      });

      const historyItem: ActionHistoryItem = {
        id: generateId(),
        type: 'next_tasks',
        feedEventIds: newEvents.map(e => e.id),
        prevBlockIdx: session.currentBlockIdx,
        prevActiveTasks: session.activeTasks,
        prevActiveTaskStates: session.activeTaskStates
      };

      return {
        ...prev,
        [changeNumber]: {
          ...session,
          activeTasks,
          activeTaskStates,
          currentBlockIdx: session.currentBlockIdx + 1,
          feed: [...session.feed, ...newEvents],
          actionHistory: [...session.actionHistory, historyItem]
        }
      };
    });
  };

  const logAck = (changeNumber: string, taskId: string) => {
    setSessions(prev => {
      const session = prev[changeNumber];
      if (!session) return prev;

      const taskState = session.activeTaskStates[taskId];
      if (!taskState || taskState.status === 'blue' || taskState.status === 'green') return prev;

      const newEvent: FeedEvent = {
        id: generateId(),
        timestamp: getBstTimestamp(),
        message: `📥 Received acknowledgment for Task ${taskId}`,
        tag: 'tag_ack'
      };

      const taskAction: TaskAction = {
        id: generateId(),
        type: 'ack',
        feedEventId: newEvent.id
      };

      return {
        ...prev,
        [changeNumber]: {
          ...session,
          activeTaskStates: {
            ...session.activeTaskStates,
            [taskId]: {
              ...taskState,
              status: 'blue',
              history: [...taskState.history, taskAction]
            }
          },
          feed: [...session.feed, newEvent]
        }
      };
    });
  };

  const logDone = (changeNumber: string, taskId: string) => {
    setSessions(prev => {
      const session = prev[changeNumber];
      if (!session) return prev;

      const taskState = session.activeTaskStates[taskId];
      if (!taskState || taskState.status === 'green') return prev;

      const newEvent: FeedEvent = {
        id: generateId(),
        timestamp: getBstTimestamp(),
        message: `✅ Task ${taskId} marked as COMPLETED`,
        tag: 'tag_done'
      };

      const taskAction: TaskAction = {
        id: generateId(),
        type: 'done',
        feedEventId: newEvent.id
      };

      return {
        ...prev,
        [changeNumber]: {
          ...session,
          activeTaskStates: {
            ...session.activeTaskStates,
            [taskId]: {
              ...taskState,
              status: 'green',
              history: [...taskState.history, taskAction]
            }
          },
          feed: [...session.feed, newEvent]
        }
      };
    });
  };

  const logCustomEvent = (changeNumber: string, eventType: string, details: string) => {
    setSessions(prev => {
      const session = prev[changeNumber];
      if (!session) return prev;

      let tag: FeedEvent['tag'] = 'tag_note';
      let prefix = '📝 NOTE:';

      if (eventType.includes('Incident')) {
        tag = 'tag_incident';
        prefix = '🛑 INCIDENT:';
      } else if (eventType.includes('Started')) {
        tag = 'tag_bridge';
        prefix = '📞 BRIDGE CALL:';
      } else if (eventType.includes('Resolved')) {
        tag = 'tag_done';
        prefix = '🏁 RESOLVED:';
      }

      const newEvent: FeedEvent = {
        id: generateId(),
        timestamp: getBstTimestamp(),
        message: `${prefix} ${details}`,
        tag
      };

      const historyItem: ActionHistoryItem = {
        id: generateId(),
        type: 'event',
        feedEventIds: [newEvent.id]
      };

      return {
        ...prev,
        [changeNumber]: {
          ...session,
          feed: [...session.feed, newEvent],
          actionHistory: [...session.actionHistory, historyItem]
        }
      };
    });
  };

  const undoLastAction = (changeNumber: string, taskId: string) => {
    setSessions(prev => {
      const session = prev[changeNumber];
      if (!session) return prev;

      // 1. If we have a taskId, try to undo its specific state change
      const taskState = session.activeTaskStates[taskId];
      if (taskState && taskState.history.length > 0) {
        const historyCopy = [...taskState.history];
        const lastAction = historyCopy.pop()!;
        
        let newStatus: TaskState['status'] = 'pink';
        if (historyCopy.length > 0) {
          const prevAction = historyCopy[historyCopy.length - 1];
          if (prevAction.type === 'ack') newStatus = 'blue';
          if (prevAction.type === 'done') newStatus = 'green';
        }

        const newFeed = session.feed.filter(f => f.id !== lastAction.feedEventId);

        return {
          ...prev,
          [changeNumber]: {
            ...session,
            activeTaskStates: {
              ...session.activeTaskStates,
              [taskId]: {
                ...taskState,
                status: newStatus,
                history: historyCopy
              }
            },
            feed: newFeed
          }
        };
      }

      // 2. Fallback: If no task specific action to undo, pop from global action history
      if (session.actionHistory.length > 0) {
        const historyCopy = [...session.actionHistory];
        const lastAction = historyCopy.pop()!;

        let newActiveTaskStates = session.activeTaskStates;
        let newActiveTasks = session.activeTasks;
        let newCurrentBlockIdx = session.currentBlockIdx;

        if (lastAction.type === 'next_tasks') {
          newActiveTaskStates = lastAction.prevActiveTaskStates || {};
          newActiveTasks = lastAction.prevActiveTasks || [];
          newCurrentBlockIdx = lastAction.prevBlockIdx ?? session.currentBlockIdx;
        }

        const newFeed = session.feed.filter(f => !lastAction.feedEventIds.includes(f.id));

        return {
          ...prev,
          [changeNumber]: {
            ...session,
            activeTaskStates: newActiveTaskStates,
            activeTasks: newActiveTasks,
            currentBlockIdx: newCurrentBlockIdx,
            feed: newFeed,
            actionHistory: historyCopy
          }
        };
      }

      alert("Nothing to undo!");
      return prev;
    });
  };

  return {
    sessions,
    createSession,
    triggerNextTasks,
    logAck,
    logDone,
    logCustomEvent,
    undoLastAction
  };
}
