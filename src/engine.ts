import {spawn, type ChildProcess } from "node:child_process";
import {createInterface} from "node:readline";
import {tmpdir} from "node:os";
import {join} from "node:path":

export const TICS_PER_TURN = 4;
export const DEGREES_PER_TIC = 7;
export const TURN_IN_FLIGHT = "turn in progress";

export interface TurnResult {
	framePath: string;
	angle: number | null;
	focus: FocusInfo | null;
}

export interface FocusInfo {
	deg: number;
	blocks: number;
}

export interface EngineSession{
	process: ChildProcess;
	framePath: string;
  pending: { resolve: (r: TurnResult) => void; reject: (e: Error) => void } | null;
  lastAngle: number | null;
	lastFocus: FocusInfo | null;
}

const ENGINE_BINARY = process.env.DOOM_ENGINE_PATH ?? "native/sloom";
const WAD_PATH = process.env.DOOM_WAD_PATH ?? "";
const STARTING_ARGS = [
  "-nosound",
  "-warp",
  "1",
  "1",
  "-skill",
  "3",
];

const FRAME_LINE = /^FRAME (\S+) (\d+)$/;
const FOCUS_LINE = /^FOCUS (-?\d+) (\d+)$/;
const ANGLE_LINE = /^ANGLE (\d+)$/;

export function startEngine(): EngineSession {
  const framePath = join(tmpdir(), `sloom-frame-${Date.now()}.png`);
  const proc = spawn(ENGINE_BINARY, ["-iwad", WAD_PATH, ...STARTING_ARGS], {
    env: { ...process.env, Sloom_FRAME_PATH: framePath } as NodeJS.ProcessEnv,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const session: EngineSession = {
    process: proc,
    framePath,
    pending: null,
    lastAngle: null,
    lastFocus: null,
  };

  const rl = createInterface({ input: proc.stdout! });
  rl.on("line", (line) => {
    const frame = line.match(FRAME_LINE);
    if (frame && frame[1]) {
      session.framePath = frame[1];
      if (session.pending) {
        const resolve = session.pending.resolve;
        session.pending = null;
        resolve({
          framePath: frame[1],
          angle: session.lastAngle,
          focus: session.lastFocus,
        });
        session.lastFocus = null;
      }
    }
    const focus = line.match(FOCUS_LINE);
    if (focus && focus[1] && focus[2]) {
      session.lastFocus = {
        deg: parseInt(focus[1], 10),
        blocks: parseInt(focus[2], 10),
      };
    }
    const angle = line.match(ANGLE_LINE);
    if (angle && angle[1]) {
      session.lastAngle = parseInt(angle[1], 10);
    }
  });

  proc.on("exit", (code) => {
    if (session.pending) {
      session.pending.reject(new Error(`engine exited (code ${code})`));
      session.pending = null;
    }
  });

  proc.on("error", (err) => {
    if (session.pending) {
      session.pending.reject(err);
      session.pending = null;
    }
  });

  return session;
}

export function sendTurn(
  session: EngineSession,
  keys: string[],
  tics = 8,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (session.pending) {
      reject(new Error("turn already in flight"));
      return;
    }
    session.pending = { resolve, reject };
    const cmd = JSON.stringify({ keys, tics }) + "\n";
    session.process.stdin!.write(cmd, (err) => {
      if (err) {
        session.pending = null;
        reject(err);
      }
    });
  });
}

export function stopEngine(session: EngineSession): void {
  try {
    session.process.stdin!.end();
  } catch {
  }
  try {
    session.process.kill("SIGTERM");
  } catch {
  }
}