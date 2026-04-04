"use client";

import type { Message } from "ai";
import { AnimatePresence, motion } from "motion/react";
import { memo } from "react";
import equal from "fast-deep-equal";
import { Streamdown } from "streamdown";

import { ABORTED, cn } from "@/lib/utils";
import {
  Camera,
  CheckCircle,
  CircleSlash,
  Clock,
  Keyboard,
  KeyRound,
  Loader2,
  MousePointer,
  MousePointerClick,
  ScrollText,
  StopCircle,
} from "lucide-react";

const PurePreviewMessage = ({
  message,
  isLatestMessage,
  status,
}: {
  message: Message;
  isLoading: boolean;
  status: "error" | "submitted" | "streaming" | "ready";
  isLatestMessage: boolean;
}) => {
  return (
    <AnimatePresence key={message.id}>
      <motion.div
        className="w-full mx-auto px-6 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        key={`message-${message.id}`}
        data-role={message.role}
      >
        <div
          className={cn(
            "flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl",
            "group-data-[role=user]/message:w-fit",
          )}
        >
          {/* {message.role === "assistant" && (
            <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
              <div className="translate-y-px">
                <SparklesIcon size={14} />
              </div>
            </div>
          )} */}

          <div className="flex flex-col w-full">
            {message.parts?.map((part, i) => {
              switch (part.type as any) {
  case "text":
    return (
      <motion.div
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        key={`message-${message.id}-part-${i}`}
        className="flex flex-row gap-2 items-start w-full mb-4"
      >
        <div
          className={cn(
            "flex flex-col gap-3 px-4 py-3 rounded-2xl shadow-sm transition-colors",
            message.role === "user"
              ? "bg-white text-zinc-900 border border-zinc-200"
              : "bg-secondary text-secondary-foreground"
          )}
        >
          <Streamdown>{(part as any).text ?? ""}</Streamdown> 
        </div>
      </motion.div>
    );

  case "error": {
    const errorPart = part as any;
    const error = errorPart.error || errorPart.content || errorPart.message;
    let errorContent: string;

    if (typeof error === "string") {
      errorContent = error;
    } else if (error instanceof Error) {
      errorContent = error.message;
    } else {
      try {
        errorContent = JSON.stringify(error);
      } catch {
        errorContent = "Unknown error";
      }
    }

    return (
      <motion.div
        key={`message-${message.id}-part-${i}`}
        className="flex flex-row gap-2 items-start w-full mb-4"
      >
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-2xl text-sm border border-red-200 shadow-sm">
          {errorContent}
        </div>
      </motion.div>
    );
  }

  case "tool-invocation": {
    const { toolName, toolCallId, state, args } = (part as any).toolInvocation;

    if (toolName === "computer") {
      const {
        action,
        coordinate,
        text,
        duration,
        scroll_amount,
        scroll_direction,
      } = args;

      let actionLabel = "";
      let actionDetail = "";
      let ActionIcon = null;

      switch (action) {
        case "screenshot":
          actionLabel = "Taking screenshot";
          ActionIcon = Camera;
          break;
        case "left_click":
          actionLabel = "Left clicking";
          actionDetail = coordinate
            ? `at (${coordinate[0]}, ${coordinate[1]})`
            : "";
          ActionIcon = MousePointer;
          break;
        case "right_click":
          actionLabel = "Right clicking";
          actionDetail = coordinate
            ? `at (${coordinate[0]}, ${coordinate[1]})`
            : "";
          ActionIcon = MousePointerClick;
          break;
        case "double_click":
          actionLabel = "Double clicking";
          actionDetail = coordinate
            ? `at (${coordinate[0]}, ${coordinate[1]})`
            : "";
          ActionIcon = MousePointerClick;
          break;
        case "mouse_move":
          actionLabel = "Moving mouse";
          actionDetail = coordinate
            ? `to (${coordinate[0]}, ${coordinate[1]})`
            : "";
          ActionIcon = MousePointer;
          break;
        case "type":
          actionLabel = "Typing";
          actionDetail = text ? `"${text}"` : "";
          ActionIcon = Keyboard;
          break;
        case "key":
          actionLabel = "Pressing key";
          actionDetail = text ? `"${text}"` : "";
          ActionIcon = KeyRound;
          break;
        case "wait":
          actionLabel = "Waiting";
          actionDetail = duration ? `${duration} seconds` : "";
          ActionIcon = Clock;
          break;
        case "scroll":
          actionLabel = "Scrolling";
          actionDetail =
            scroll_direction && scroll_amount
              ? `${scroll_direction} by ${scroll_amount}`
              : "";
          ActionIcon = ScrollText;
          break;
        default:
          actionLabel = action;
          ActionIcon = MousePointer;
          break;
      }

      return (
        <motion.div
          initial={{ y: 5, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          key={`message-${message.id}-part-${i}`}
          className="flex flex-col gap-2 p-3 mb-4 text-sm bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
        >
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center justify-center w-8 h-8 bg-zinc-50 dark:bg-zinc-800 rounded-full shadow-xs">
              {ActionIcon && <ActionIcon className="w-4 h-4" />}
            </div>

            <div className="flex-1">
              <div className="font-medium font-mono flex items-baseline gap-2 text-zinc-800">
                {actionLabel}
                {actionDetail && (
                  <span className="text-xs text-zinc-500">
                    {actionDetail}
                  </span>
                )}
              </div>
            </div>

            <div className="w-5 h-5 flex items-center justify-center">
              {state === "call" ? (
                isLatestMessage && status !== "ready" ? (
                  <Loader2 className="animate-spin h-4 w-4 text-yellow-500" />
                ) : (
                  <StopCircle className="h-4 w-4 text-red-500" />
                )
              ) : state === "result" ? (
                (part as any).toolInvocation?.result === ABORTED ? (
                  <CircleSlash className="text-yellow-600" size={14} />
                ) : (
                  <CheckCircle className="text-green-600" size={14} />
                )
              ) : null}
            </div>
          </div>

          {state === "result" &&
          (part as any).toolInvocation?.result?.type === "image" ? (
            <div className="p-2">
              <img
                src={`data:image/png;base64,${(part as any).toolInvocation.result?.data ?? ""}`}
                alt="Generated"
                className="w-full aspect-[1024/768] rounded-xl border border-zinc-200"
              />
            </div>
          ) : action === "screenshot" ? (
            <div className="w-full aspect-[1024/768] rounded-xl bg-zinc-100 border border-zinc-200 animate-pulse"></div>
          ) : null}
        </motion.div>
      );
    }

    return (
      <div key={`message-${message.id}-part-${i}`}>
        <h3>{toolName}: {state}</h3>
        <pre>{JSON.stringify(args, null, 2)}</pre>
      </div>
    );
  }

  default:
    return (
      <pre
        key={`message-${message.id}-part-${i}`}
        className="text-xs text-gray-500"
      >
        {JSON.stringify(part, null, 2)}
      </pre>
    );
}
            })}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.status !== nextProps.status) return false;
    if (prevProps.message.annotations !== nextProps.message.annotations)
      return false;
    // if (prevProps.message.content !== nextProps.message.content) return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;

    return true;
  },
);
