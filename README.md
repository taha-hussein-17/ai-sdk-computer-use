AI Agent Dashboard (Computer Use)

Author: Taha Hussein

🚀 Overview

This project is a production-style AI Agent Dashboard built on top of the Vercel AI SDK Computer Use demo.

It simulates an AI agent capable of:

Interacting with a remote desktop (mouse, keyboard, screenshots)
Executing bash commands
Streaming actions in real-time
Tracking and visualizing tool events

The goal was to extend a simple demo into a scalable frontend architecture similar to real-world agent platforms.

🧠 Features
🖥️ Two-Panel Dashboard
Left Panel
Chat interface
Inline tool call visualization
Streaming responses
Right Panel
Live VNC desktop (noVNC iframe)
Real-time agent interaction
Panels are horizontally resizable
⚡ Event Pipeline (Core Feature)

All tool activity is tracked through a centralized event store:

Each event includes:

id
timestamp
type (computer / bash)
action
payload
status (pending / success / error)
duration
Derived State:
Total event count
Event counts per action
Agent status (idle / running)
🧾 Debug Panel
Displays all recorded events
Helps visualize agent behavior
Useful for debugging + evaluation
💬 Chat System
Streaming messages using AI SDK
Tool call rendering (computer + bash)
Error handling for malformed responses
🗂️ Multi-Session Chat
Create new sessions
Switch between sessions
Delete sessions
Persisted using localStorage
⚙️ Tool Integration
Computer Tool
mouse_move
left_click
type
screenshot
Bash Tool
Execute shell commands
⚡ Performance Optimization
VNC iframe does NOT re-render on chat updates
Message rendering memoized
Event deduplication using Set
🏗️ Architecture
User → Chat UI (React)
     → useChat (AI SDK)
     → API Route (/api/chat)
     → Tool Calls (computer / bash)
     → Vercel Sandbox (Linux Desktop)
     → noVNC Stream (iframe)

Parallel:
Tool Calls → Event Store (Zustand) → Debug Panel
🧰 Tech Stack
Next.js (App Router)
TypeScript (strict, no any)
Vercel AI SDK
Zustand (state management)
Tailwind CSS + shadcn/ui
Vercel Sandboxes
noVNC + Xvnc
🛠️ Setup
1. Install dependencies
pnpm install
2. Setup Vercel
vercel link
vercel env pull
3. Create snapshot
npx tsx lib/sandbox/create-snapshot.ts

Add to .env.local:

SANDBOX_SNAPSHOT_ID=your_snapshot_id
4. Run dev server
pnpm dev
📡 API
POST /api/chat

Handles:

Streaming responses
Tool invocation
Mock AI logic (no paid API required)
🎥 Demo

👉 Video Demo: (add your link here)

Covers:

UI walkthrough
Live agent execution
Event tracking
Session management
Code overview
🚧 Notes
Mock AI is used to avoid API costs
Tool execution is real (mouse + desktop)
Some edge cases may return fallback responses instead of crashing
Event durations are approximated (demo purpose)
🧠 Key Decisions
Used Zustand for lightweight global state
Avoided unnecessary re-renders (especially VNC)
Implemented event-driven architecture (important for scaling)
Mocked AI layer to focus on frontend/system design
✅ What’s Complete

✔ Two-panel dashboard
✔ Tool call visualization
✔ Event pipeline
✔ Session management
✔ Streaming chat
✔ Real desktop interaction

📌 Future Improvements
Replace mock AI with real model
Improve event timing accuracy
Add mobile responsiveness
Add replay/debug timeline