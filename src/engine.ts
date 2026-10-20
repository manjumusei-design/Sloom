import {spawn, type ChildProcess } from "node:child_process";
import {createInterface} from "node:readline";

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

const ENGINE_BINARY = process.env.DOOM_ENGINE_PATH ?? "native/sloomdoom";
const WAD_PATH = process.env.DOOM_WAD_PATH ?? "";

export function startEngine(): EngineSession {
  const framePath = `/tmp/sloom-frame-${Date.now()}.png`;
  const proc = spawn(ENGINE_BINARY, ["-iwad", WAD_PATH, "-nosound", "-warp", "1", "1", "-skill", "3"], {
    env: { ...process.env, SLOOM_FRAME_PATH: framePath } as NodeJS.ProcessEnv,
    stdio: ["pipe", "pipe", "pipe"],
  });
