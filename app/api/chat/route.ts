import { streamText } from "ai";
import { computerTool, bashTool } from "@/lib/sandbox/tool";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { messages = [], sandboxId } = body;
    const simplifiedMessages = messages
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      }));

    // A helper to safely extract query from user messages
    const getQuery = (msgs: any[]) => {
      const lastUser = msgs.filter((m) => m.role === 'user').at(-1);
      if (!lastUser) return "";
      if (typeof lastUser.content === 'string') return lastUser.content.toLowerCase();
      if (Array.isArray(lastUser.content)) {
        return lastUser.content
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join(" ")
          .toLowerCase();
      }
      return "";
    };

    // Helper to determine if we should execute a tool or just stop
    const getResponseForQuery = (msgs: any[]) => {
      const query = getQuery(msgs);
      const isArabic = query.includes("أهلا") || query.includes("مرحبا") || query.includes("اكتب") || query.includes("افتح") || query.includes("اضغط") || query.includes("حرك") || query.includes("صور");
      
      // Check if the last assistant message already has a tool result
      const isFinished = msgs.some((m) => 
        (m.role === 'assistant' && m.parts?.some((p: any) => p.type === 'tool-invocation' && p.toolInvocation.state === 'result')) ||
        (m.role === 'assistant' && Array.isArray(m.content) && m.content.some((p: any) => p.type === 'tool-result')) ||
        (m.role === 'tool')
      );

      if (isFinished) {
        return {
          responseText: isArabic ? "لقد انتهيت من تنفيذ الأمر." : "I've finished executing the command.",
          toolCalls: []
        };
      }

      let responseText = "";
      let toolCalls: any[] = [];
      const timestamp = Date.now();

      if (!sandboxId) {
        return { responseText: "Desktop is not ready. Please wait a moment.", toolCalls: [] };
      }

      if (query.includes("hello") || query.includes("hi") || query.includes("أهلا") || query.includes("مرحبا")) {
        responseText = isArabic ? "أهلاً! أنا جاهز لمساعدتك في استخدام الكمبيوتر. ماذا تريد مني أن أفعل؟" : "Hello! I am ready to help you with the computer. What would you like me to do?";
      } else if (query.includes("type") || query.includes("write") || query.includes("اكتب")) {
        const match = query.match(/(?:type|write|اكتب)\s+(.+)/i);
        const textToType = match ? match[1] : "Hello World";
        responseText = isArabic ? `بالتأكيد، سأقوم بكتابة "${textToType}" لك.` : `Sure, I will type "${textToType}" for you.`;
        
        toolCalls.push({
          toolCallId: `move_${timestamp}`,
          toolName: "computer",
          args: JSON.stringify({ action: "left_click", coordinate: [512, 384] })
        });
        toolCalls.push({
          toolCallId: `type_${timestamp + 1}`,
          toolName: "computer",
          args: JSON.stringify({ action: "type", text: textToType })
        });
        toolCalls.push({
          toolCallId: `shot_${timestamp + 2}`,
          toolName: "computer",
          args: JSON.stringify({ action: "screenshot" })
        });
      } else if (query.includes("open") || query.includes("chrome") || query.includes("افتح")) {
        responseText = isArabic ? "أقوم بفتح جوجل كروم من أجلك." : "I'm opening Google Chrome for you.";
        toolCalls.push({
          toolCallId: `move_${timestamp}`,
          toolName: "computer",
          args: JSON.stringify({ action: "mouse_move", coordinate: [20, 748] })
        });
        toolCalls.push({
          toolCallId: `bash_${timestamp + 1}`,
          toolName: "bash",
          args: JSON.stringify({ command: "google-chrome --no-sandbox &" })
        });
        toolCalls.push({
          toolCallId: `shot_${timestamp + 2}`,
          toolName: "computer",
          args: JSON.stringify({ action: "screenshot" })
        });
      } else if (query.includes("click") || query.includes("اضغط")) {
        responseText = isArabic ? "أقوم بالضغط على الشاشة." : "I'm clicking on the screen.";
        toolCalls.push({
          toolCallId: `move_${timestamp}`,
          toolName: "computer",
          args: JSON.stringify({ action: "mouse_move", coordinate: [500, 300] })
        });
        toolCalls.push({
          toolCallId: `click_${timestamp + 1}`,
          toolName: "computer",
          args: JSON.stringify({ action: "left_click", coordinate: [500, 300] })
        });
        toolCalls.push({
          toolCallId: `shot_${timestamp + 2}`,
          toolName: "computer",
          args: JSON.stringify({ action: "screenshot" })
        });
      } else if (query.includes("move") || query.includes("mouse") || query.includes("حرك")) {
        responseText = isArabic ? "أقوم بتحريك مؤشر الماوس." : "Moving the mouse pointer.";
        toolCalls.push({
          toolCallId: `move_${timestamp}`,
          toolName: "computer",
          args: JSON.stringify({ action: "mouse_move", coordinate: [400, 400] })
        });
        toolCalls.push({
          toolCallId: `shot_${timestamp + 1}`,
          toolName: "computer",
          args: JSON.stringify({ action: "screenshot" })
        });
      } else if (query.includes("screenshot") || query.includes("capture") || query.includes("صور")) {
        responseText = isArabic ? "أقوم بالتقاط صورة لسطح المكتب." : "Taking a fresh screenshot of the desktop.";
        toolCalls.push({
          toolCallId: `move_${timestamp}`,
          toolName: "computer",
          args: JSON.stringify({ action: "mouse_move", coordinate: [0, 0] })
        });
        toolCalls.push({
          toolCallId: `shot_${timestamp + 1}`,
          toolName: "computer",
          args: JSON.stringify({ action: "screenshot" })
        });
      }

      return { responseText, toolCalls };
    };

    const result = streamText({
      model: {
        provider: "mock",
        modelId: "mock-model",
        specificationVersion: "v1",
        doGenerate: async (): Promise<any> => {
          const { responseText, toolCalls } = getResponseForQuery(simplifiedMessages as any);
          return {
            text: responseText,
            toolCalls: toolCalls,
            finishReason: toolCalls.length > 0 ? "tool-calls" : "stop",
            usage: { promptTokens: 0, completionTokens: 0 },
            rawCall: { rawPrompt: null, rawResponse: null },
          };
        },
        doStream: async (): Promise<any> => {
          const { responseText, toolCalls } = getResponseForQuery(simplifiedMessages as any);
          return {
            stream: new ReadableStream({
              start(controller) {
                if (responseText) {
                  controller.enqueue({ type: "text-delta", textDelta: responseText });
                }
                for (const tc of toolCalls) {
                  controller.enqueue({ type: "tool-call", ...tc });
                }
                controller.enqueue({
                  type: "finish",
                  finishReason: toolCalls.length > 0 ? "tool-calls" : "stop",
                  usage: { promptTokens: 0, completionTokens: 0 },
                });
                controller.close();
              },
            }),
            rawCall: { rawPrompt: null, rawResponse: null },
          };
        },
      } as any,
      messages: simplifiedMessages as any,
      tools: sandboxId ? {
        computer: computerTool(sandboxId),
        bash: bashTool(sandboxId),
      } : {},
      maxSteps: 10,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Chat API Error:", error);
    return new Response(JSON.stringify({ error: "Something went wrong" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
