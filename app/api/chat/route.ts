import { streamText, createDataStreamResponse } from "ai";
import { computerTool, bashTool } from "@/lib/sandbox/tool";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { messages = [], sandboxId } = await req.json();

    // 1. Get the last message and handle different roles
    const lastMessage = messages.at(-1);
    const query = typeof lastMessage?.content === "string" 
      ? lastMessage.content.toLowerCase() 
      : "";

    // 2. Define our behavior logic
    const getResponseData = () => {
      const timestamp = Date.now();
      
      // If the last message was a tool result, return a concluding message
      const isToolResult = lastMessage?.role === "tool" || 
       (lastMessage?.role === "assistant" && lastMessage.parts?.some((p: any) => p.type === 'tool-invocation' && p.toolInvocation.state === 'result'));

      if (isToolResult) {
          return {
              text: "The action has been completed. Is there anything else you'd like me to do?",
              toolCalls: []
          };
      }

      if (query.includes("hi") || query.includes("hello")) {
        return {
          text: "Welcome! I am your AI SDK assistant. I can help you control this desktop. What would you like to do?",
          toolCalls: []
        };
      }
      
      if (query.includes("chrome") || query.includes("browser") || query.includes("open")) {
        return {
          text: "Sure! Opening Google Chrome for you now...",
          toolCalls: [{
            toolCallId: `id_${timestamp}`,
            toolName: "bash",
            args: { command: "google-chrome --no-sandbox" }
          }]
        };
      }

      if (query.includes("type")) {
        const typeMatch = query.match(/type\s+(.+)/i);
        const textToType = typeMatch ? typeMatch[1] : "Hello World!";
        return {
          text: `I will type "${textToType}" for you.`,
          toolCalls: [{
            toolCallId: `id_${timestamp}`,
            toolName: "computer",
            args: { action: "type", text: textToType }
          }]
        };
      }

      // Default fallback for any other user query
      return {
        text: "I understand. I'll take a screenshot to see what's happening.",
        toolCalls: [{
          toolCallId: `id_${timestamp}`,
          toolName: "computer",
          args: { action: "screenshot" }
        }]
      };
    };

    const { text, toolCalls } = getResponseData();

    return createDataStreamResponse({
      execute: async (writer) => {
        if (text) {
          writer.writeData(text);
        }

        for (const tc of toolCalls) {
          // Execute the tool
          let result: any = "Success (Mock)";
          try {
            if (sandboxId) {
              if (tc.toolName === "computer") {
                const tool = computerTool(sandboxId);
                if (tool && tool.execute) {
                  result = await tool.execute(tc.args as any, {
                    toolCallId: tc.toolCallId,
                    messages: [],
                  } as any);
                }
              } else if (tc.toolName === "bash") {
                const tool = bashTool(sandboxId);
                if (tool && tool.execute) {
                  result = await tool.execute(tc.args as { command: string; restart?: boolean }, {
                    toolCallId: tc.toolCallId,
                    messages: [],
                  } as any);
                }
              }
            }
          } catch (err) {
            console.error(`Tool ${tc.toolName} execution failed:`, err);
            result = `Error: ${err instanceof Error ? err.message : String(err)}`;
          }

          writer.writeData({
            type: 'tool-call',
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            args: tc.args,
          });

          writer.writeData({
            type: 'tool-result',
            toolCallId: tc.toolCallId,
            result: result,
          });
        }
      },
    });
  } catch (error) {
    console.error("Critical Error:", error);
    return createDataStreamResponse({
      execute: (writer) => {
        writer.writeData(`An error occurred: ${error instanceof Error ? error.message : String(error)}`);
      },
    });
  }
}
