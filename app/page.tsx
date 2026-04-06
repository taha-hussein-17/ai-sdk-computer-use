"use client";

import { PreviewMessage } from "@/components/message";
import { getDesktopURL } from "@/lib/sandbox/utils";
import { useScrollToBottom } from "@/lib/use-scroll-to-bottom";
import { useChat } from "@ai-sdk/react";
import { useEffect, useState, useRef, useCallback } from "react";
import { Input } from "@/components/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DeployButton, ProjectInfo } from "@/components/project-info";
import { AISDKLogo } from "@/components/icons";
import { PromptSuggestions } from "@/components/prompt-suggestions";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ABORTED, cn } from "@/lib/utils";
import { useEventStore } from "@/lib/store/event-store";
import { useChatSessionStore } from "@/lib/store/chat-session-store";
import { PlusIcon, MessageSquareIcon, TrashIcon, Loader2, CircleSlash } from "lucide-react";

export default function Chat() {
  const [desktopContainerRef, desktopEndRef] = useScrollToBottom();
  const [isInitializing, setIsInitializing] = useState(true);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [sandboxId, setSandboxId] = useState<string | null>(null);

  const addEvent = useEventStore((s) => s.addEvent);
  const updateEvent = useEventStore((s) => s.updateEvent);
  const setAgentStatus = useEventStore((s) => s.setAgentStatus);
  
  const sessions = useChatSessionStore((s) => s.sessions);
  const activeSessionId = useChatSessionStore((s) => s.activeSessionId);
  const createSession = useChatSessionStore((s) => s.createSession);
  const deleteSession = useChatSessionStore((s) => s.deleteSession);
  const setActiveSession = useChatSessionStore((s) => s.setActiveSession);
  const updateMessages = useChatSessionStore((s) => s.updateMessages);
  const setSessionTitle = useChatSessionStore((s) => s.setSessionTitle);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    stop: stopGeneration,
    append,
    setMessages,
  } = useChat({
    api: "/api/chat",
    id: activeSessionId ?? undefined,
    initialMessages: sessions.find(s => s.id === activeSessionId)?.messages ?? [],
    body: {
      sandboxId,
    },
    maxSteps: 5,
    onFinish: (message) => {
      if (activeSessionId) {
        const currentSession = useChatSessionStore.getState().sessions.find(s => s.id === activeSessionId);
        if (currentSession && (currentSession.title === "Untitled Session" || !currentSession.title)) {
          const firstUserMessage = currentSession.messages.find(m => m.role === 'user');
          if (firstUserMessage) {
            const title = typeof firstUserMessage.content === 'string' 
              ? firstUserMessage.content.slice(0, 40) 
              : "New Chat";
            setSessionTitle(activeSessionId, title);
          }
        }
      }
    },
    onError: (error) => {
      console.error(error);
      toast.error("There was an error", {
        description: "Please try again later.",
        richColors: true,
        position: "top-center",
      });
    },
  });

  const lastSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeSessionId !== lastSessionIdRef.current) {
      const session = useChatSessionStore.getState().sessions.find(s => s.id === activeSessionId);
      if (session) {
        setMessages(session.messages);
      } else {
        setMessages([]);
      }
      handleInputChange({ target: { value: "" } } as any);
      lastSessionIdRef.current = activeSessionId;
    }
  }, [activeSessionId, setMessages, handleInputChange]);

  useEffect(() => {
    if (activeSessionId && messages.length > 0) {
      updateMessages(activeSessionId, messages);
    }
  }, [messages, activeSessionId, updateMessages]);

  useEffect(() => {
    const currentSessions = useChatSessionStore.getState().sessions;
    if (currentSessions.length === 0) {
      createSession();
    } else if (!activeSessionId) {
      setActiveSession(currentSessions[0].id);
    }
  }, [activeSessionId, createSession, setActiveSession]);

  useEffect(() => {
    setAgentStatus(status === "ready" ? "idle" : "running");
  }, [status, setAgentStatus]);

  useEffect(() => {
    messages.forEach((message: any) => {
      message.parts?.forEach((part: any) => {
        if (part.type === "tool-invocation") {
          const { toolCallId, toolName, state, args } = part.toolInvocation;
          const events = useEventStore.getState().events;
          const existingEvent = events.find((e) => e.id === toolCallId);

          if (state === "call") {
            if (!existingEvent) {
              addEvent({
                id: toolCallId,
                type: toolName as "computer" | "bash" | "play_sound",
                action: toolName === "computer" ? args.action : toolName,
                payload: args,
              });
            }
          } else if (state === "result") {
            if (existingEvent && existingEvent.status === "pending") {
              updateEvent(toolCallId, {
                status: "success",
              });
            }
          }
        }
      });
    });
  }, [messages, addEvent, updateEvent]);

  const stop = () => {
    stopGeneration();
    const lastMessage = messages.at(-1);
    const lastMessageLastPart = lastMessage?.parts.at(-1);
    if (
      lastMessage?.role === "assistant" &&
      lastMessageLastPart?.type === "tool-invocation"
    ) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          ...lastMessage,
          parts: [
            ...lastMessage.parts.slice(0, -1),
            {
              ...lastMessageLastPart,
              toolInvocation: {
                ...lastMessageLastPart.toolInvocation,
                state: "result",
                result: ABORTED,
              },
            },
          ],
        },
      ]);
    }
  };

  const isLoading = status !== "ready";

   
  const refreshDesktop = useCallback(async () => {
    try {
      setIsInitializing(true);
      const { streamUrl, id } = await getDesktopURL(sandboxId || undefined);
      setStreamUrl(streamUrl);
      setSandboxId(id);
    } catch (err) {
      console.error("Failed to refresh desktop:", err);
    } finally {
      setIsInitializing(false);
    }
  }, [sandboxId]);

  useEffect(() => {
    if (!sandboxId) return;
    const killDesktop = () => {
      if (!sandboxId) return;
      navigator.sendBeacon(`/api/kill-desktop?sandboxId=${encodeURIComponent(sandboxId)}`);
    };
    window.addEventListener("beforeunload", killDesktop);
    return () => {
      window.removeEventListener("beforeunload", killDesktop);
      killDesktop();
    };
  }, [sandboxId]);

  useEffect(() => {
    refreshDesktop();
  }, [refreshDesktop]);

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmit(e);
  };

  return (
    <main className="flex h-screen w-full bg-[#0a0a0a] text-zinc-100 overflow-hidden font-sans">
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Sidebar - History on the Left */}
        <ResizablePanel
          defaultSize={20}
          minSize={15}
          maxSize={30}
          className="hidden md:flex flex-col border-r border-zinc-800/50 bg-[#0f0f0f]/80 backdrop-blur-xl"
        >
          <div className="p-6 border-b border-zinc-800/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="size-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <AISDKLogo />
              </div>
              <div>
                <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                  AI SDK
                </h1>
                <p className="text-xs text-zinc-500 font-medium tracking-wide uppercase">
                  Computer Use Agent
                </p>
              </div>
            </div>
            
            <Button
               onClick={() => createSession()}
               className="w-full justify-start gap-2 bg-zinc-100 text-zinc-950 hover:bg-white rounded-xl h-11 transition-all duration-200 active:scale-95 font-semibold text-sm shadow-lg shadow-white/5"
             >
               <PlusIcon className="size-4" />
               New Session
             </Button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => setActiveSession(session.id)}
                className={cn(
                  "group flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200",
                  activeSessionId === session.id
                    ? "bg-zinc-800/50 text-white ring-1 ring-zinc-700/50"
                    : "text-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-300"
                )}
              >
                <MessageSquareIcon className="size-4 shrink-0" />
                <span className="flex-1 truncate text-[13px] font-medium tracking-tight">
                  {session.title || "Untitled Session"}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-zinc-800 rounded-lg transition-all"
                >
                  <TrashIcon className="size-3.5 text-zinc-500 hover:text-red-400" />
                </button>
              </div>
            ))}
          </div>
          
          <div className="p-4 border-t border-zinc-800/50">
             <ProjectInfo />
          </div>
        </ResizablePanel>

        <ResizableHandle className="bg-zinc-800/50 w-[1px]" />

        {/* Main Content Area - Desktop Preview (Left) then Chat (Right) */}
        <ResizablePanel defaultSize={80} className="flex flex-col bg-[#0a0a0a]">
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            
            {/* Desktop Preview Area */}
            <ResizablePanel defaultSize={60} minSize={40} className="hidden md:flex flex-col bg-[#050505]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50 bg-[#0a0a0a]/50 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="size-3 rounded-full bg-red-500/20 border border-red-500/30" />
                    <div className="size-3 rounded-full bg-amber-500/20 border border-amber-500/30" />
                    <div className="size-3 rounded-full bg-green-500/20 border border-green-500/30" />
                  </div>
                  <span className="text-[11px] font-bold text-zinc-500 ml-2 tracking-[0.2em] uppercase">
                    Sandbox Desktop Preview
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refreshDesktop}
                    disabled={isInitializing}
                    className="h-8 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
                  >
                    Refresh
                  </Button>
                  <DeployButton />
                </div>
              </div>

              <div className="flex-1 relative flex items-center justify-center p-8 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900 to-[#050505]">
                <div className="relative w-full aspect-video max-w-5xl rounded-2xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-zinc-800/50 group">
                  {isInitializing ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 gap-4">
                      <Loader2 className="size-8 text-blue-500 animate-spin" />
                      <p className="text-zinc-500 text-[13px] font-semibold tracking-tight animate-pulse">Initializing Virtual Desktop...</p>
                    </div>
                  ) : streamUrl ? (
                    <iframe
                      src={streamUrl}
                      className="w-full h-full border-none"
                      title="Desktop Preview"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 gap-4">
                      <div className="size-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                        <CircleSlash className="size-8 text-zinc-700" />
                      </div>
                      <p className="text-zinc-500 text-[13px] font-semibold tracking-tight">Virtual desktop not connected</p>
                       <Button onClick={refreshDesktop} variant="outline" className="mt-2 h-9 rounded-xl border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white font-medium text-xs">
                         Establish Connection
                       </Button>
                    </div>
                  )}
                  
                  {status === "streaming" && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 backdrop-blur-md rounded-full">
                      <div className="size-2 bg-blue-500 rounded-full animate-ping" />
                      <span className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter">AI Controlling</span>
                    </div>
                  )}
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle className="bg-zinc-800/50 w-[1px]" />

            {/* Chat Area (Right Side) */}
            <ResizablePanel defaultSize={40} minSize={30} className="flex flex-col relative bg-[#0a0a0a]">
              <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
              
              <div className="flex-1 overflow-y-auto no-scrollbar pt-20 pb-32 px-6" ref={desktopContainerRef}>
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="size-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 animate-pulse">
                      <div className="text-zinc-400 size-8">
                        <AISDKLogo />
                      </div>
                    </div>
                    <h2 className="text-2xl font-bold mb-2 tracking-tight">How can I assist you today?</h2>
                    <p className="text-zinc-400 max-w-sm mb-8 leading-relaxed text-sm">
                      I can manage your desktop, automate workflows, and handle complex browser tasks with the power of AI SDK.
                    </p>
                    <PromptSuggestions
                      disabled={isInitializing}
                      submitPrompt={(prompt: string) => append({ role: "user", content: prompt })}
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <PreviewMessage
                        key={message.id}
                        message={message}
                        isLatestMessage={index === messages.length - 1}
                        status={status}
                        isLoading={isLoading}
                      />
                    ))}
                    <div ref={desktopEndRef} />
                  </div>
                )}
              </div>

              {/* Chat Input Area */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/90 to-transparent">
                <div className="max-w-3xl mx-auto">
                  <form
                    onSubmit={handleFormSubmit}
                    className="relative group bg-zinc-900/50 border border-zinc-800 rounded-2xl p-1.5 focus-within:border-zinc-700 transition-all duration-300 backdrop-blur-md shadow-2xl"
                  >
                    <Input
                      handleInputChange={handleInputChange}
                      input={input}
                      isInitializing={isInitializing}
                      isLoading={isLoading}
                      status={status}
                      stop={stop}
                    />
                  </form>
                  <p className="text-[10px] text-center mt-3 text-zinc-600 font-medium tracking-tight">
                    AI can make mistakes. Check important info.
                  </p>
                </div>
              </div>
            </ResizablePanel>

          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}
