import { create } from 'zustand';
import { useMemo } from 'react';

export type ToolEventStatus = 'pending' | 'success' | 'error';

export interface ToolEvent {
  id: string;
  timestamp: number;
  startTime: number;
  type: 'computer' | 'bash';
  action: string;
  payload: any;
  status: ToolEventStatus;
  duration?: number;
}

interface EventStore {
  events: ToolEvent[];
  agentStatus: 'idle' | 'running';
  
  // Actions
  addEvent: (event: Omit<ToolEvent, 'timestamp' | 'status' | 'startTime'>) => void;
  updateEvent: (id: string, updates: Partial<Pick<ToolEvent, 'status'>>) => void;
  setAgentStatus: (status: 'idle' | 'running') => void;
  clearEvents: () => void;
}

export const useEventStore = create<EventStore>((set) => ({
  events: [],
  agentStatus: 'idle',
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEvent: (event: any) => set((state) => {
    const now = Date.now();
    return {
      events: [
        ...state.events,
        {
          ...event,
          timestamp: now,
          startTime: now,
          status: 'pending',
        },
      ],
    };
  }),
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateEvent: (id: any, updates: any) => set((state) => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    events: state.events.map((event: any) => {
      if (event.id === id) {
        const newStatus = updates.status || event.status;
        const duration = (newStatus === 'success' || newStatus === 'error') 
          ? Date.now() - event.startTime 
          : event.duration;
          
        return { 
          ...event, 
          ...updates,
          duration 
        };
      }
      return event;
    }),
  })),
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setAgentStatus: (status: any) => set({ agentStatus: status }),
  
  clearEvents: () => set({ events: [] }),
}));

// Derived state hooks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useTotalEventCount = () => useEventStore((state: any) => state.events.length);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useEventCountsByAction = () => {
  const events = useEventStore((state: any) => state.events);
  return useMemo(() => {
    const counts: Record<string, number> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    events.forEach((event: any) => {
      counts[event.action] = (counts[event.action] || 0) + 1;
    });
    return counts;
  }, [events]);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useAgentStatus = () => useEventStore((state: any) => state.agentStatus);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useToolEvents = () => useEventStore((state: any) => state.events);
