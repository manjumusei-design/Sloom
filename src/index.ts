import "dotenv/config";
import { App } from "@slack/bolt";
import { loadConfig, type Config } from "./config.js";
import {
  startEngine,
  sendTurn,
  stopEngine,
  DEGREES_PER_TIC,
  TICS_PER_TURN,
  TURN_IN_FLIGHT,
  type EngineSession,
  type TurnResult,
} from "./engine.js";
import { applyOverlay, overlayPathFor } from "./overlay.js";
import { storeFrame } from "./frame-store.js";
import type { KnownBlock } from "@slack/types";
import { applyOverlay, overlayPathFor } from "./overlay.js";
import { storeFrame } from "./frame-store.js";
//Asked AI to help me write log strings just for troubleshooting
function log(config: Config, level: string, msg: string, extra?: unknown): void {
  const order = ["debug", "info", "warn", "error"];
  if (order.indexOf(level) < order.indexOf(config.logLevel)) return;
  const line = `[sloom] ${level.toUpperCase()} ${msg}`;
  if (extra === undefined) console.log(line);
  else console.log(line, extra);
}

export interface RuningApp {
	app: App;
}

 
interface GameSession {
	engine: EngineSession;
	channel: string;
}
const sessions = new Map<string, GameSession>();
const lastButtonTime  = new Map<string, number>();
const lastCommandTime = new Map<string, number>();
const RATE_LIMIT_MS = 5000;
const BUTTON_COOLDOWN_MS = 1200;
const OPENING_TICS = 1;

interface ButtonDef {
  action_id: string;
  label: string;
}

const BLOCK_RETRY_DELAYS_MS = [400, 1200, 3000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function frameBlocks(
  imageUrl: string,
  caption: string,
): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: "image",
      image_url: imageUrl,
      alt_text: "DOOM frame",
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: caption }],
    },
  ];
  if (buttons.length > 0) {
    blocks.push({
      type: "actions",
      elements: buttons.map((b) => ({
        type: "button",
        text: { type: "plain_text", text: b.label },
        action_id: b.action_id,
      })),
    });
  }
  return blocks;
}


const ACTION_PREFIX = "sloom:";

const FRAME_BUTTONS: ButtonDef[] = [
  { action_id: `${ACTION_PREFIX}forward`, label: "Forward" },
  { action_id: `${ACTION_PREFIX}back`, label: "Back" },
  { action_id: `${ACTION_PREFIX}left`, label: "Left" },
  { action_id: `${ACTION_PREFIX}right`, label: "Right" },
  { action_id: `${ACTION_PREFIX}fire`, label: "Fire" },
  { action_id: `${ACTION_PREFIX}focusfire`, label: "Focus+Fire" },
  { action_id: `${ACTION_PREFIX}focus`, label: "Focus" },
  { action_id: `${ACTION_PREFIX}use`, label: "Use" },
  { action_id: `${ACTION_PREFIX}map`, label: "Map" },
];


const KEY_ALIASES: Record<string, string[]> = {
  forward: ["forward"],
  w: ["forward"],
  back: ["back"],
  s: ["back"],
  left: ["turnleft"],
  a: ["turnleft"],
  right: ["turnright"],
  d: ["turnright"],
  fire: ["fire"],
  f: ["fire"],
  space: ["fire"],
  use: ["use"],
  e: ["use"],
  u: ["use"],
  strafeleft: ["strafeleft"],
  straferight: ["straferight"],
  sl: ["strafeleft"],
  sr: ["straferight"],
  map: ["map"],
  tab: ["map"],
  m: ["map"],
  focus: ["focus"],
  focusfire: ["focus", "fire"],
  aimfire: ["focus", "fire"],
};

const HELP_WORDS = new Set(["help", "?"]);
const STOP_WORDS = new Set(["stop", "quit"]);
const START_WORDS = new Set(["start", ""]);
const TURN_COMMAND = /^turn\s+(-?\d+)$/i;

export function compassDir(angle: number | null): string {
  if (angle === null) return "";
  const dirs = ["E", "NE", "N", "SE", "W", "SW", "S", "NW"];
  const idx = Math.round(angle / 45) % 8;
  return dirs[idx] ?? "";
}

export function focusNote(focus: { deg: number; blocks: number } | null): string {
  if (!focus) return "";
  if (focus.deg === -1 && focus.blocks === 0) return " No target in sight.";
  if (focus.deg === 0) return " Target locked dead ahead.";
  return ` Target locked ${Math.abs(focus.deg)}° ${focus.deg > 0 ? "right" : "left"}, ~${focus.blocks} tiles away.`;
}

export function buildCaption(
  cmd: string,
  angle: number | null,
  focus: { deg: number; blocks: number } | null = null,
): string {
  const dir = compassDir(angle);
  const dirStr = dir ? ` Facing ${dir} (${angle}°).` : "";
  return `Sloom — last: ${cmd}.${dirStr}${focusNote(focus)} Commands: forward, back, left, right, fire, use, strafeleft, straferight, map, focus. Combine with commas.`;
}

export function resolveKeys(text: string): string[] | null {
  const t = text.trim().toLowerCase();
  if (t in KEY_ALIASES) return KEY_ALIASES[t]!;
  if (t.includes(",")) {
    const parts = t.split(",").map((p) => p.trim());
    const keys: string[] = [];
    for (const p of parts) {
      if (p in KEY_ALIASES) keys.push(...KEY_ALIASES[p]!);
      else return null;
    }
    return keys.length > 0 ? keys : null;
  }
  return null;
}

type Responder = (payload: {
  response_type?: "in_channel" | "ephemeral";
  text: string;
}) => Promise<unknown>;

async function runGameTurn(
  client: App["client"],
  channel: string,
  cmd: string,
  keys: string[],
  respond: Responder,
): Promise<void> {}
  const reply = (msg: string) => respond({ response_type: "ephemeral", text: msg });
  const sess = sessions.get(channel);
  if (!sess) {
    await reply("No game running. Start one with `/sloom start`.");
    return;
  }
  try {
    const result: TurnResult = await sendTurn(sess.engine, keys, TICS_PER_TURN);
    const overlayPath = overlayPathFor(result.framePath);
    await applyOverlay(result.framePath, overlayPath, { angle: result.angle });
    const caption = buildCaption(cmd, result.angle, result.focus);
    await postFrame(client, channel, overlayPath, caption, FRAME_BUTTONS);
  } catch (err) {
    const msg = (err as Error).message;
    const text = msg.includes(TURN_IN_FLIGHT)
      ? "Wait for frame to load."
      : `Failed: ${msg}`;
    await reply(text);
  }
}


async function postFrame(
  client: App["client"],
  channel: string,
  pngPath: string,
  caption: string,
  buttons?: ButtonDef[],
): Promise<string> {
  const imageUrl = await storeFrame(pngPath);

  const blocks: KnownBlock[] = [
    {
        type: "image",
        image_url: imageUrl,
        alt_text: "DOOM frame",
      },
      {
      type: "context",
      elements: [{ type: "mrkdwn", text: caption }],
    },
  ];
  if (buttons && buttons.length > 0) {
    blocks.push({
      type: "actions",
      elements: buttons.map((b) => ({
        type: "button",
        text: { type: "plain_text", text: b.label,},
        action_id: b.action_id,
      })),
    });
  }

  const res = await client.chat.postMessage({
    channel,
    text: caption,
    blocks,
  });
  console.log("Sloom posted frame:", imageUrl, res.ts);
  return res.ts ?? "";
}

export async function start(config: Config): Promise<RunningApp> {
	const app = new App({
		token:config.slackBotToken,
		appToken: config.slackAppToken,
		socketMode: true,
	});

  app.command("/sloom", async ({ ack, respond, command }) => {
    await ack();

    const text = (command.text ?? "").trim();
    const channel = command.channel_id;
    const reply = (msg: string) => respond({ response_type: "ephemeral", text: msg });

    if (!HELP_WORDS.has(text.toLowerCase())){
      const now = Date.now();
      const last = lastCommandTime.get(channel) ?? 0;
      if (now - last <RATE_LIMIT_MS) {
        const remaining = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000);
        await reply(`Please wait ${remaining}s before sending another command.`);
        return;
      }
      lastCommandTime.set(channel, now);
    }

    if (HELP_WORDS.has(text.toLowerCase())) {
      await reply([
          "*Sloom commands*",
          "`/sloom start` — start a new game",
          "`/sloom stop` — stop the game",
          "`/sloom help` — help message",
          "",
          "*Movement*",
          "`w` / `forward` — Move forward",
          "`s` / `back` — Move backward",
          "`a` / `left` — Turn left",
          "`d` / `right` — Turn right",
          "`sl` / `strafeleft` — Strafe left",
          "`sr` / `straferight` — Strafe right",
          "",
          "*Action*",
          "`f` / `fire` — shoot",
          "`u` / `use` — open doors or interact",
          "`m` / `map` — toggle automap",
          "`focus` — snap aim to the nearest enemy in sight",
          "",
          "*Fine-Tuned Turning*", // This is for the sweats but I dont think it will be widely used at all
          "`turn 90` — turn right 90°",
          "`turn -90` — turn left 90°",
          "`turn 45` — turn right 45°",
          "",
          "*Combos* (comma-separated)",
          "`w,fire` — move and shoot in one turn",
          "`focus,fire` — lock on and shoot",
          "",
          "*Buttons*",
          "Every frame has one-tap buttons that you can react to such as (Forward / Back / Left / Right / Fire / Focus+Fire / Focus / Use / Map).",
          "Clicking will send a new frame that you can continue off of.",
          "Map toggles: Click to open and then click again to close.",
        ].join("\n"));
      return;
    }

    if (STOP_WORDS.has(text.toLowerCase())) {
      const sess = sessions.get(channel);
      if (sess) {
        stopEngine(sess.engine);
        sessions.delete(channel);
        await reply("Game stopped.");
      } else {
        await reply("No game running.");
      }
      return;
    }
		
		if(START_WORDS.has(text.toLowerCase())){
			if (sessions.has(channel)) {
				await reply("A game is already running. Use '/sloom stop' first.");
				return;
			}
      try {
        const engine = startEngine();
        const result = await sendTurn(engine, [], OPENING_TICS);
        const overlayPath = overlayPathFor(result.framePath);
        await applyOverlay(result.framePath, overlayPath, { angle: result.angle });
        const caption = buildCaption("start", result.angle);
        await postFrame(
          app.client,
          channel,
          overlayPath,
          caption,
          FRAME_BUTTONS,
        );
        sessions.set(channel, { engine, channel });
        log(config, "info", "started game", { channel });
      } catch (err) {
        const msg = (err as Error).message;
        log(config, "error", "start failed", { msg });
        await reply(`Could not start the game: ${msg}`);
      }
      return;
    }

		const sess = sessions.get(channel);
		if (!sess) {
			await reply("No game is running. Start one with '/sloom start'.");
			return;
		}

    const turnMatch = text.match(TURN_COMMAND);
    if (turnMatch && turnMatch[1]) {
      const deg = parseInt(turnMatch[1], 10);
      const tics = Math.max(1, Math.round(Math.abs(deg) / DEGREES_PER_TIC));
      const dir = deg >= 0 ? "turnright" : "turnleft";
      const keys = [dir];
      try {
        const result = await sendTurn(sess.engine, keys, tics);
        const overlayPath = overlayPathFor(result.framePath);
        await applyOverlay(result.framePath, overlayPath, { angle: result.angle });
        const caption = buildCaption(`turn ${deg}`, result.angle);
        await postFrame(app.client, channel, overlayPath, caption, FRAME_BUTTONS);
      } catch (err) {
        const msg = (err as Error).message;
        log(config, "error", "turn failed", { msg });
        await reply(`Turn failed: ${msg}`);
      }
      return;
    }


		const keys = resolveKeys(text);
		if (!keys) {
      await reply(`Unknown command: \`${text}\`. Try: forward, back, left, right, fire, use, strafeleft, straferight, focus. Combine with commas to chain.`);
      return;
    }

    await runGameTurn(app.client, channel, text, keys, respond);
  });

  app.action(new RegExp(`^${ACTION_PREFIX}`), async ({ ack, respond, body, action }) => {
    await ack();

    const channel = (body as { channel?: { id?: string } }).channel?.id;
    const actionId = (action as { action_id: string }).action_id;
    const reply = (msg: string) => respond({ response_type: "ephemeral", text: msg });
    const cmd = actionId.slice(ACTION_PREFIX.length);

    if (!channel || !cmd) {
      await reply("Could not read that button.");
      return;
    }

    const now = Date.now();
    const last = lastButtonTime.get(channel) ?? 0;
    if (now - last < BUTTON_COOLDOWN_MS) {
      return;
    }
    lastButtonTime.set(channel, now);

    const keys = resolveKeys(cmd);
    if (!keys) {
      await reply(`Unknown button: ${cmd}`);
      return;
    }
    await runGameTurn(app.client, channel, cmd, keys, respond);
  });
  app.error(async (error) => {
    log(config, "error", "bolt error", { message: error.message });
  });


  await app.start();
  log(config, "info", "socket mode connected");

  return { app };
}

export async function stop(running: RunningApp): Promise<void> {
	for (const sess of sessions.values()) {
		stopEngine(sess.engine);
	}
	sessions.clear();
	await running.app.stop();
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
	const config = loadConfig();
	start(config).catch((err:unknown) => {
    console.error("FATAL Sloom failed to start:", (err as Error).message);
    process.exit(1);
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
		process.on(signal, () => {
      console.log(`${signal} received, shutting down`);
      process.exit(0);
    });
  }
}