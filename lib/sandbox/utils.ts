"use server";

import type { Sandbox as SandboxType } from "@vercel/sandbox";
import os from "node:os";
import { resolution } from "./constants";

// The SDK uses 'xdg-app-paths' which can fail on Windows if HOME/XDG_* are missing.
// This must run at the top level to ensure it's set before any imports that use it.
if (process.platform === "win32") {
  const homeDir = process.env.USERPROFILE || os.homedir() || process.cwd();

  if (!process.env.HOME) process.env.HOME = homeDir;
  if (!process.env.APPDATA)
    process.env.APPDATA = `${homeDir}\\AppData\\Roaming`;
  if (!process.env.LOCALAPPDATA)
    process.env.LOCALAPPDATA = `${homeDir}\\AppData\\Local`;

  if (!process.env.XDG_CONFIG_HOME) process.env.XDG_CONFIG_HOME = process.env.APPDATA;
  if (!process.env.XDG_DATA_HOME) process.env.XDG_DATA_HOME = process.env.LOCALAPPDATA;
  if (!process.env.XDG_CACHE_HOME)
    process.env.XDG_CACHE_HOME =
      process.env.TEMP || `${homeDir}\\AppData\\Local\\Temp`;
}

const NOVNC_PORT = 6080;
const DISPLAY_ENV = { DISPLAY: ":99" };

export const getDesktop = async (id?: string) => {
  try {
    const { Sandbox } = await import("@vercel/sandbox");

    if (id) {
      const sandbox = await Sandbox.get({ sandboxId: id });
      if (sandbox.status === "running") {
        return sandbox;
      }
    }

    // Use a fallback and clean up any quotes from the environment variable
    const rawSnapshotId = process.env.SANDBOX_SNAPSHOT_ID;
    const snapshotId = (rawSnapshotId && rawSnapshotId !== 'undefined') 
      ? rawSnapshotId.replace(/['"]/g, '') 
      : 'snap_CRBYhAcOn9pFNXLkdmiRgNTG5QMM';
    
    console.log(`Creating sandbox with snapshotId: "${snapshotId}"`);
    
    const sandbox = await Sandbox.create({
      source: {
        type: "snapshot",
        snapshotId: snapshotId,
      },
      timeout: 300000,
      ports: [NOVNC_PORT],
    });

    // Start the desktop environment
    await sandbox.runCommand({
      cmd: "bash",
      args: ["/usr/local/bin/start-desktop.sh"],
      env: {
        RESOLUTION: `${resolution.x}x${resolution.y}`,
      },
      detached: true,
    });

    // Wait for noVNC to be ready
    await waitForNoVNC(sandbox);

    // Set background color (ctypes.util is missing on AL2023, load libX11 directly)
    await sandbox.runCommand({
      cmd: "python3",
      args: [
        "-c",
        `import ctypes
lib = ctypes.cdll.LoadLibrary('libX11.so.6')
d = lib.XOpenDisplay(None)
s = lib.XDefaultScreen(d)
r = lib.XRootWindow(d, s)
lib.XSetWindowBackground(d, r, 0x2D2D2D)
lib.XClearWindow(d, r)
lib.XFlush(d)
lib.XCloseDisplay(d)`,
      ],
      env: DISPLAY_ENV,
    });

    // Launch Chrome so the AI has a browser to work with immediately
    await sandbox.runCommand({
      cmd: "bash",
      args: [
        "-c",
        "google-chrome --no-sandbox --disable-gpu --no-first-run --disable-dev-shm-usage --start-maximized 'about:blank' &",
      ],
      env: DISPLAY_ENV,
      detached: true,
    });

    return sandbox;
  } catch (error) {
    console.error("Error in getDesktop:", error);
    throw error;
  }
};

async function waitForNoVNC(sandbox: SandboxType, maxRetries = 20) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await sandbox.runCommand({
        cmd: "bash",
        args: [
          "-c",
          `curl -s -o /dev/null -w "%{http_code}" http://localhost:${NOVNC_PORT}`,
        ],
      });
      const statusCode = await result.stdout();
      if (statusCode.trim() === "200") {
        return;
      }
    } catch {
      // noVNC not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.warn("noVNC health check timed out, proceeding anyway");
}

export const getDesktopURL = async (id?: string) => {
  try {
    const sandbox = await getDesktop(id);
    const baseUrl = sandbox.domain(NOVNC_PORT);
    const streamUrl = `${baseUrl}/vnc.html?autoconnect=true&resize=scale&reconnect=true`;

    return { streamUrl, id: sandbox.sandboxId };
  } catch (error) {
    console.error("Error in getDesktopURL:", error);
    throw error;
  }
};

export const killDesktop = async (id: string) => {
  try {
    const { Sandbox } = await import("@vercel/sandbox");
    const sandbox = await Sandbox.get({ sandboxId: id });
    await sandbox.stop();
  } catch (error) {
    console.error("Error killing desktop:", error);
  }
};
