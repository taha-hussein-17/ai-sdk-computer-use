"use client";

import { useState } from "react";
import { useToolEvents, useAgentStatus, useEventStore, useEventCountsByAction } from "@/lib/store/event-store";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Terminal, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Eye,
  EyeOff
} from "lucide-react";

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const events = useToolEvents();
  const status = useAgentStatus();
  const clearEvents = useEventStore((s) => s.clearEvents);
  const counts = useEventCountsByAction();
  const formatTime = (ts: number) =>
    new Date(ts).toLocaleString([], { hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <motion.div 
      initial={false}
      animate={{ 
        width: isOpen ? 400 : 140,
        height: isOpen ? 500 : 36,
      }}
      className={cn(
        "fixed bottom-4 right-4 z-50 flex flex-col border border-zinc-200 bg-white shadow-2xl overflow-hidden font-mono text-[10px] rounded-lg",
      )}
    >
      {/* Header / Toggle */}
      <div 
        className="flex items-center justify-between px-3 h-9 bg-zinc-50 border-b border-zinc-200 cursor-pointer hover:bg-zinc-100 shrink-0 select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Terminal size={12} className={cn(status === 'running' ? "text-yellow-500 animate-pulse" : "text-zinc-400")} />
          <span className="font-bold uppercase tracking-tighter">Debug</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", status === 'running' ? "bg-yellow-100 text-yellow-700" : "bg-zinc-100 text-zinc-600")}>
            {status === 'running' ? "RUNNING" : "IDLE"}
          </div>
          <div className="px-1.5 py-0.5 rounded bg-zinc-100 text-[9px] font-bold text-zinc-700">
            {events.length} total
          </div>
          <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-zinc-200/50 rounded text-[9px] font-bold text-zinc-600">
            {isOpen ? <EyeOff size={10} /> : <Eye size={10} />}
            <span>{isOpen ? "HIDE" : "SHOW"}</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col flex-1 overflow-hidden"
          >
            {/* Toolbar */}
            <div className="flex items-center justify-between px-2 py-1.5 bg-zinc-50 border-b border-zinc-200 shrink-0">
              <span className="text-zinc-600 uppercase text-[9px] font-bold">
                {events.length} events recorded
              </span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  clearEvents();
                }}
                className="p-1 hover:bg-zinc-200 rounded text-zinc-500 transition-colors"
                title="Clear all events"
              >
                <Trash2 size={12} />
              </button>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white border-b border-zinc-200 shrink-0 flex-wrap">
              {Object.entries(counts).map(([key, value]) => (
                <div key={key} className="px-1.5 py-0.5 rounded bg-zinc-100 text-[9px] font-bold text-zinc-700">
                  {key}: {value}
                </div>
              ))}
            </div>

            {/* Event List */}
            <div className="flex-1 overflow-y-auto overscroll-contain bg-zinc-50/50 p-2 space-y-1.5">
              {events.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 opacity-50 space-y-2 italic">
                  <span>Waiting for events...</span>
                </div>
              ) : (
                events.slice().reverse().map((event) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={event.id + event.timestamp} 
                    className="flex flex-col p-2.5 bg-white border border-zinc-200 rounded-lg shadow-sm hover:border-zinc-300 transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase",
                          event.type === 'computer' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                        )}>
                          {event.type}
                        </span>
                        <span className="font-bold text-zinc-800">{event.action}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-400">
                        {event.status === 'pending' && <Clock size={10} className="animate-spin text-yellow-500" />}
                        {event.status === 'success' && <CheckCircle2 size={10} className="text-green-500" />}
                        {event.status === 'error' && <AlertCircle size={10} className="text-red-500" />}
                        <span className="tabular-nums font-medium">
                          {formatTime(event.timestamp)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[9px]">
                      <div className="text-zinc-600 truncate max-w-[220px] bg-zinc-50 px-1.5 py-1 rounded border border-zinc-100">
                        {JSON.stringify(event.payload)}
                      </div>
                      {event.duration && (
                        <div className="text-zinc-500 font-bold italic tabular-nums">
                          +{((event.duration - event.timestamp) / 1000).toFixed(2)}s
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
