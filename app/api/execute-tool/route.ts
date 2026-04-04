import { computerTool } from "@/lib/sandbox/tool";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { sandboxId, action, ...args } = await req.json();

    if (!sandboxId) {
      return NextResponse.json({ error: "Missing sandboxId" }, { status: 400 });
    }

    const tool = computerTool(sandboxId);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!tool || !tool.execute) {
  return new Response("Tool not found", { status: 400 });
}

const result = await tool.execute({ action, ...args } as any, {
  toolCallId: `manual_${Date.now()}`,
  messages: [],
} as any);

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Manual tool execution failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
