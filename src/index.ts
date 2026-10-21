import "dotenv/config";
import { App } from "@slack/bolt";
import { loadConfig, type Config } from "./config.js";
import { startEngine, sendTurn, stopEngine, type EngineSession } from "./engine.js";
//Asked AI to help me write a log string just for troubleshooting
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
  space: ["fire"],
  use: ["use"],
  e: ["use"],
  strafeleft: ["strafeleft"],
  straferight: ["straferight"],
  sl: ["strafeleft"],
  sr: ["straferight"],
  map: ["tab"],
  tab: ["tab"],
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

export function buildCaption(cmd: string, angle: number | null): string {
  const dir = compassDir(angle);
  const dirStr = dir ? ` Facing ${dir} (${angle}°).` : "";
  return `Sloom — last: ${cmd}.${dirStr} Commands: forward, back, left, right, fire, use, strafeleft, straferight, map. Combine with commas.`;
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

async function postFrame(
  client: App["client"],
  channel: string,
  pngPath: string,
  caption: string,
): Promise<string> {
  const imageUrl = await storeFrame(pngPath);

  const res = await client.chat.postMessage({
    channel,
    text: caption,
    blocks: [
      {
        type: "image",
        image_url: imageUrl,
        alt_text: "DOOM frame",
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: caption }],
      },
    ],
  });
  console.log("[Sloom] posted frame:", imageUrl, res.ts);
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
        const caption = buildCaption("start", result.angle);
        await postFrame(
          app.client,
          channel,
          result.framePath,
          caption,
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

		const keys = resolveKeys(text);
		if (!keys) {
      await reply(`Unknown command: \`${text}\`. Try: forward, back, left, right, fire, use, strafeleft, straferight. Combine with commas.`);
      return;
    }

    if (text.toLowerCase() === "map") {
		try {
        const result = await sendTurn(sess.engine, ["map"], 4);
        const caption = buildCaption("map", result.angle);
        await postFrame(app.client, channel, result.framePath, caption);
    } catch (err) {
      const msg = (err as Error).message;
      log(config, "error", "mapping failed", {msg});
        await reply(`Map failed: ${msg}`);
      }
      return;
    }

    try {
      const result = await sendTurn(sess.engine, keys, TICS_PER_TURN);
      const caption = buildCaption(text, result.angle);
			await postFrame(
				app.client,
        channel,
        result.framePath,
        caption,
      );
		} catch (err) {
			const msg = (err as Error).message;
			log(config, "error", "turn failed", {msg});
			await reply('Turn failed: ${msg}');
		}
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