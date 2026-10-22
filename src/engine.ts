import {spawn, type ChildProcess } from "node:child_process";
import {createInterface} from "node:readline";
import {tmpdir} from "node:os";
import {join} from "node:path":

export const TICS_PER_TURN = 4;
export const DEGREES_PER_TIC = 7;
export const TURN_IN_FLIGHT = "turn in progress";
export const STARTUP_TIMEOUT_MS = 15000;

export interface TurnResult {
	framePath: string;
	angle: number | null;
	focus: FocusInfo | null;
  health: number | null;
  dead: boolean;
  kills: number | null;
  totalKills: number | null;
}

export interface FocusInfo {
	deg: number;
	blocks: number;
}

export interface EngineSession{
	process: ChildProcess;
	framePath: string;
  pending: { resolve: (r: TurnResult) => void; reject: (e: Error) => void } | null;
  ready: Promise<TurnResult>;
  lastAngle: number | null;
	lastFocus: FocusInfo | null;
  lastHealth: number | null;
  lastDead: boolean;
  lastKills: number | null;
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
const HEALTH_LINE = /^HEALTH (-?\d+)$/;
const DEAD_LINE = /^DEAD ([01])$/;
const STATS_LINE = /^STATS (\d+) (\d+)$/;

function stateOf(session: EngineSession): Omit<TurnResult, "focus"> {
  return {
    framePath: session.framePath,
    angle: session.lastAngle,
    health: session.lastHealth,
    dead: session.lastDead,
    kills: session.lastKills,
    totalKills: session.lastTotalKills,
  };
}

export function startEngine(): EngineSession {
  const framePath = join(tmpdir(), `sloom-frame-${Date.now()}.png`);
  const proc = spawn(ENGINE_BINARY, ["-iwad", WAD_PATH, ...STARTING_ARGS], {
    env: { ...process.env, Sloom_FRAME_PATH: framePath } as NodeJS.ProcessEnv,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let readySettled = false;
  let resolveReady: (r: TurnResult) => void = () => {};
  let rejectReady : (e: Error) => void = () => {};
  const ready = new Promise<TurnResult>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });


  const session: EngineSession = {
    process: proc,
    framePath,
    pending: null,
    ready,
    lastAngle: null,
    lastFocus: null,
    lastHealth: null,
    lastDead: false,
    lastKills: null,
    lastTotalKills: null,
  };

  const settleReady = (result: TurnResult, error?: Error) => {
    if (readySettled) return;
    readySettled = true;
    if (error) rejectReady(error);
    else resolveReady(result);
  };

  const startupTimer = setTimeout(() => {
    settleReady({ ...stateOf(session), focus: null }, new Error("engine has no startup frame"));
  }, STARTUP_TIMEOUT_MS);

  const rl = createInterface({ input: proc.stdout! });
  rl.on("line", (line) => {
    const frame = line.match(FRAME_LINE);
    if (frame && frame[1]) {
      session.framePath = frame[1];
      if (session.pending) {
        const resolve = session.pending.resolve;
        session.pending = null;
        resolve(result);
      } else if (!readySettled) {
        clearTimeout(startupTimer);
        settleReady(result);
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

    const health = DEAD_LINE.match(HEALTH_LINE)
    if (health && health[1]) {
      session.lastHealth = parseInt(health[1], 10);
    }
    const dead = DEAD_LINE.match(DEAD_LINE);
    if (dead && dead[1]) {
      session.lastDead = dead[1] === "1";
    }
    const stats = line.match(STATS_LINE);
    if (stats && stats[1] && stats[2]) {
      session.lastKills = parseInt(stats[1], 10);
      session.lastTotalKills = parseInt(stats[2], 10);
    }

  proc.on("exit", (code) => {
    clearTimeout(startupTimer);
    const err = new Error(`engine exited (code ${code})`);
    if (session.pending) {
      session.pending.reject(err);
      session.pending = null;
    }
    settleReady({ ...stateOf(session), focus: null }, err);
  });

  proc.on("error", (err) => {
    clearTimeout(startupTimer);
    if (session.pending) {
      session.pending.reject(err);
      session.pending = null;
    }
    settleReady({ ...stateOf(session), focus: null }, err);
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