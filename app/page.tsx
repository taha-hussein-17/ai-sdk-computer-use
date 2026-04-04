"use client";

import { PreviewMessage } from "@/components/message";
import { getDesktopURL } from "@/lib/sandbox/utils";
import { useScrollToBottom } from "@/lib/use-scroll-to-bottom";
import { useChat } from "@ai-sdk/react";
import { useEffect, useState, useRef } from "react";
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
import { PlusIcon, MessageSquareIcon, TrashIcon } from "lucide-react";

export default function Chat() {
  // Create separate refs for mobile and desktop to ensure both scroll properly
  const [desktopContainerRef, desktopEndRef] = useScrollToBottom();
  const [mobileContainerRef, mobileEndRef] = useScrollToBottom();

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
    maxSteps: 30,
    onFinish: (message) => {
      if (activeSessionId) {
        // If it's the first message, update title
        const currentSession = sessions.find(s => s.id === activeSessionId);
        if (currentSession && currentSession.messages.length <= 2) {
          const firstUserMessage = currentSession.messages.find(m => m.role === 'user');
          if (firstUserMessage) {
            setSessionTitle(activeSessionId, firstUserMessage.content.slice(0, 30) + '...');
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

  // Sync messages from store when active session changes
  useEffect(() => {
    // Only sync and clear input if the session ID has actually changed
    if (activeSessionId !== lastSessionIdRef.current) {
      const session = useChatSessionStore.getState().sessions.find(s => s.id === activeSessionId);
      if (session) {
        setMessages(session.messages);
      } else {
        setMessages([]);
      }
      
      // Clear input when switching or creating new chat
      handleInputChange({ target: { value: "" } } as any);
      
      // Update the ref
      lastSessionIdRef.current = activeSessionId;
    }
  }, [activeSessionId, setMessages, handleInputChange]);

  // Sync messages to store whenever they change
  useEffect(() => {
    if (activeSessionId && messages.length > 0) {
      updateMessages(activeSessionId, messages);
    }
  }, [messages, activeSessionId, updateMessages]);

  // Ensure there's always at least one session
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages.forEach((message: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      message.parts?.forEach((part: any) => {
        if (part.type === "tool-invocation") {
          const { toolCallId, toolName, state, args } = part.toolInvocation;
          const events = useEventStore.getState().events;
          const existingEvent = events.find((e) => e.id === toolCallId);

          if (state === "call") {
            if (!existingEvent) {
              addEvent({
                id: toolCallId,
                type: toolName as "computer" | "bash",
                action: toolName === "computer" ? args.action : "bash",
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

  const playSendSound = () => {
    try {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
      audio.volume = 0.5;
      audio.play().catch(err => console.error("Error playing sound:", err));
    } catch (err) {
      console.error("Failed to play sound:", err);
    }
  };

  const manualTriggerTool = async (action: string = "mouse_move", args: any = { coordinate: [500, 300] }) => {
    if (!sandboxId) return;
    
    const toolCallId = `manual_${Date.now()}`;
    
    try {
      console.log(`Triggering manual ${action}...`);
      
      // Manually add to event store
      addEvent({
        id: toolCallId,
        type: "computer",
        action: action as any,
        payload: args,
      });

      const response = await fetch("/api/execute-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId,
          action,
          ...args,
        }),
      });

      const data = await response.json();

      // Update event store with success
      updateEvent(toolCallId, {
        status: "success",
      });

      return data.result;
    } catch (err) {
      console.error(`Manual tool trigger ${action} failed:`, err);
      updateEvent(toolCallId, {
        status: "error",
      });
    }
  };

  const triggerScreenshot = async () => {
    if (!sandboxId) return;
    
    const toolCallId = `screenshot_${Date.now()}`;
    const screenshotMessageId = `msg_screenshot_${Date.now()}`;
    
    setMessages(prev => [
      ...prev,
      {
        id: screenshotMessageId,
        role: 'assistant',
        content: '',
        parts: [{
          type: 'tool-invocation',
          toolInvocation: {
            toolCallId,
            toolName: 'computer',
            state: 'call',
            args: { action: 'screenshot' }
          }
        }]
      } as any
    ]);

    try {
      const result = await manualTriggerTool('screenshot', {});
      
      if (result && result.type === 'image') {
        setMessages(prev => prev.map(m => 
          m.id === screenshotMessageId 
            ? {
                ...m,
                parts: [{
                  type: 'tool-invocation',
                  toolInvocation: {
                    toolCallId,
                    toolName: 'computer',
                    state: 'result',
                    args: { action: 'screenshot' },
                    result: result
                  }
                }]
              } as any
            : m
        ));
      }
    } catch (err) {
      console.error("Failed to get manual screenshot:", err);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    playSendSound();
    handleSubmit(e);
  };

  const refreshDesktop = async () => {
    try {
      setIsInitializing(true);
      const { streamUrl, id } = await getDesktopURL(sandboxId || undefined);
      // console.log("Refreshed desktop connection with ID:", id);
      setStreamUrl(streamUrl);
      setSandboxId(id);
    } catch (err) {
      console.error("Failed to refresh desktop:", err);
    } finally {
      setIsInitializing(false);
    }
  };

  // Kill desktop on page close
  useEffect(() => {
    if (!sandboxId) return;

    // Function to kill the desktop - just one method to reduce duplicates
    const killDesktop = () => {
      if (!sandboxId) return;

      // Use sendBeacon which is best supported across browsers
      navigator.sendBeacon(
        `/api/kill-desktop?sandboxId=${encodeURIComponent(sandboxId)}`,
      );
    };

    // Detect iOS / Safari
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // Choose exactly ONE event handler based on the browser
    if (isIOS || isSafari) {
      // For Safari on iOS, use pagehide which is most reliable
      window.addEventListener("pagehide", killDesktop);

      return () => {
        window.removeEventListener("pagehide", killDesktop);
        // Also kill desktop when component unmounts
        killDesktop();
      };
    } else {
      // For all other browsers, use beforeunload
      window.addEventListener("beforeunload", killDesktop);

      return () => {
        window.removeEventListener("beforeunload", killDesktop);
        // Also kill desktop when component unmounts
        killDesktop();
      };
    }
  }, [sandboxId]);

  useEffect(() => {
    // Initialize desktop and get stream URL when the component mounts
    const init = async () => {
      try {
        setIsInitializing(true);

        // Use the provided ID or create a new one
        const { streamUrl, id } = await getDesktopURL(sandboxId ?? undefined);

        setStreamUrl(streamUrl);
        setSandboxId(id);
      } catch (err) {
        console.error("Failed to initialize desktop:", err);
        toast.error("Failed to initialize desktop");
      } finally {
        setIsInitializing(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-dvh relative">
      {/* Mobile/tablet banner */}
      <div className="flex items-center justify-center fixed left-1/2 -translate-x-1/2 top-5 shadow-md text-xs mx-auto rounded-lg h-8 w-fit bg-blue-600 text-white px-3 py-2 text-left z-50 xl:hidden">
        <span>Headless mode</span>
      </div>

      {/* Resizable Panels */}
      <div className="w-full hidden xl:block">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Sidebar / Sessions Panel */}
          <ResizablePanel
            defaultSize={15}
            minSize={10}
            className="flex flex-col border-r border-zinc-200 bg-zinc-50"
          >
            <div className="p-4 border-b border-zinc-200 bg-white flex items-center justify-between">
              <span className="font-bold text-sm uppercase tracking-tighter">Chats</span>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={createSession}
                className="h-8 w-8 hover:bg-zinc-100"
              >
                <PlusIcon size={16} />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setActiveSession(s.id)}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-xs",
                    activeSessionId === s.id 
                      ? "bg-white border border-zinc-200 shadow-sm font-medium" 
                      : "hover:bg-zinc-200/50 text-zinc-500"
                  )}
                >
                  <MessageSquareIcon size={14} className={activeSessionId === s.id ? "text-blue-500" : ""} />
                  <span className="flex-1 truncate">{s.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(s.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                  >
                    <TrashIcon size={12} />
                  </button>
                </div>
              ))}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Desktop Stream Panel */}
          <ResizablePanel
            defaultSize={55}
            minSize={40}
            className="bg-black relative items-center justify-center"
          >
            {streamUrl ? (
              <>
                <iframe
                  src={streamUrl}
                  className="w-full h-full"
                  style={{
                    transformOrigin: "center",
                    width: "100%",
                    height: "100%",
                  }}
                  allow="autoplay"
                />
                <Button
                  onClick={refreshDesktop}
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white px-3 py-1 rounded text-sm z-10"
                  disabled={isInitializing}
                >
                  {isInitializing ? "Creating desktop..." : "New desktop"}
                </Button>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-white">
                {isInitializing
                  ? "Initializing desktop..."
                  : "Loading stream..."}
              </div>
            )}
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Chat Interface Panel */}
          <ResizablePanel
            defaultSize={30}
            minSize={25}
            className="flex flex-col border-l border-zinc-200"
          >
            <div className="bg-white py-4 px-4 flex justify-between items-center">
              <AISDKLogo />
              <DeployButton />
            </div>

            <div
              className="flex-1 space-y-6 py-4 overflow-y-auto px-4"
              ref={desktopContainerRef}
            >
              {messages.length === 0 ? <ProjectInfo /> : null}
              {messages.map((message, i) => (
                <PreviewMessage
                  message={message}
                  key={message.id}
                  isLoading={isLoading}
                  status={status}
                  isLatestMessage={i === messages.length - 1}
                />
              ))}
              <div ref={desktopEndRef} className="pb-2" />
            </div>

            {messages.length === 0 && (
              <PromptSuggestions
                disabled={isInitializing}
                submitPrompt={(prompt: string) =>
                  append({ role: "user", content: prompt })
                }
              />
            )}
            <div className="bg-white">
              <form onSubmit={handleFormSubmit} className="p-4">
                <Input
                  handleInputChange={handleInputChange}
                  input={input}
                  isInitializing={isInitializing}
                  isLoading={isLoading}
                  status={status}
                  stop={stop}
                />
              </form>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile View (Chat Only) */}
      <div className="w-full xl:hidden flex flex-col">
        <div className="bg-white py-4 px-4 flex justify-between items-center">
          <AISDKLogo />
          <DeployButton />
        </div>

        <div
          className="flex-1 space-y-6 py-4 overflow-y-auto px-4"
          ref={mobileContainerRef}
        >
          {messages.length === 0 ? <ProjectInfo /> : null}
          {messages.map((message, i) => (
            <PreviewMessage
              message={message}
              key={message.id}
              isLoading={isLoading}
              status={status}
              isLatestMessage={i === messages.length - 1}
            />
          ))}
          <div ref={mobileEndRef} className="pb-2" />
        </div>

        {messages.length === 0 && (
          <PromptSuggestions
            disabled={isInitializing}
            submitPrompt={(prompt: string) =>
              append({ role: "user", content: prompt })
            }
          />
        )}
        <div className="bg-white">
          <form onSubmit={handleFormSubmit} className="p-4">
            <Input
              handleInputChange={handleInputChange}
              input={input}
              isInitializing={isInitializing}
              isLoading={isLoading}
              status={status}
              stop={stop}
            />
          </form>
        </div>
      </div>
    </div>
  );
}
