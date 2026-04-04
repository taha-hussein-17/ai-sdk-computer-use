import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Message } from 'ai';

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

interface ChatSessionState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  
  // Actions
  createSession: () => string;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  updateMessages: (sessionId: string, messages: Message[]) => void;
  setSessionTitle: (sessionId: string, title: string) => void;
  getActiveSession: () => ChatSession | undefined;
}

export const useChatSessionStore = create<ChatSessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,

      createSession: () => {
        const id = crypto.randomUUID();
        const newSession: ChatSession = {
          id,
          title: 'New Chat',
          messages: [],
          createdAt: Date.now(),
        };

        set((state) => ({
          sessions: [newSession, ...state.sessions],
          activeSessionId: id,
        }));

        return id;
      },

      deleteSession: (id) => {
        set((state) => {
          const newSessions = state.sessions.filter((s) => s.id !== id);
          let newActiveId = state.activeSessionId;

          if (state.activeSessionId === id) {
            newActiveId = newSessions.length > 0 ? newSessions[0].id : null;
          }

          return {
            sessions: newSessions,
            activeSessionId: newActiveId,
          };
        });
      },

      setActiveSession: (id) => {
        set({ activeSessionId: id });
      },

      updateMessages: (sessionId, messages) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, messages } : s
          ),
        }));
      },

      setSessionTitle: (sessionId, title) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, title } : s
          ),
        }));
      },

      getActiveSession: () => {
        const { sessions, activeSessionId } = get();
        return sessions.find((s) => s.id === activeSessionId);
      },
    }),
    {
      name: 'chat-sessions',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
