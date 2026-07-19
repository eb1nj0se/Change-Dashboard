export interface Task {
  id: string;
  team: string;
  desc: string;
  poc: string;
  durationMins: number;
  plannedStart: number | null;
  dependencies: string[];
}

export interface TaskAction {
  id: string;
  type: 'ack' | 'done';
  feedEventId: string;
}

export interface TaskState {
  status: 'pink' | 'blue' | 'green' | 'default';
  history: TaskAction[];
  startedAt?: number;
}

export interface FeedEvent {
  id: string;
  timestamp: string;
  message: string;
  tag: 'tag_sent' | 'tag_ack' | 'tag_done' | 'tag_incident' | 'tag_bridge' | 'tag_note' | 'tag_sys';
}

export interface ActionHistoryItem {
  id: string;
  type: 'event' | 'next_tasks';
  feedEventIds: string[]; // To remove events on undo
  prevBlockIdx?: number;
  prevActiveTasks?: Task[];
  prevActiveTaskStates?: Record<string, TaskState>;
  prevDispatchedTaskIds?: string[];
  prevCompletedTaskIds?: string[];
}

export interface Session {
  changeNumber: string;
  taskBlocks: Task[][];
  allTasks: Task[];
  regressionStartTask?: string;
  currentBlockIdx: number;
  activeTasks: Task[];
  activeTaskStates: Record<string, TaskState>;
  dispatchedTaskIds: string[];
  completedTaskIds: string[];
  globalTaskDetails: Record<string, Task>;
  feed: FeedEvent[];
  actionHistory: ActionHistoryItem[];
}
