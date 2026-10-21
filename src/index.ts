
import "dotenv/config";
import { App } from "@slack/bolt";
import { loadConfig, type Config } from "./config.js";
import { startEngine, sendTurn, stopEngine, type EngineSession } from "./engine.js";
import { readFile } from "node:fs/promises";
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
};

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
  const st = await (await import("node:fs/promises")).stat(pngPath);
  const urlRes = await client.files.getUploadURLExternal({
    filename: "frame.png",
    length: st.size,
  });
  const uploadUrl = urlRes.upload_url;
  const fileId = urlRest.file_id!;
  const buf = await readFile(pngPath);
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    body: buf,
    headers: { "Content-Type": "image/png" },
  });
  if (!uploadRes.ok) {
    throw new Error(`upload failed: ${uploadRes.status}`);
  }

  await client.files.completeUploadExternal({
    files: [{ id: fileId, title: "DOOM frame" }],
    channel_id: channel,
  });

  const res = await client.chat.postMessage({
    channel,
    text: caption,
  });
  console.log("Sloom posted the frame:", fileId, res.ts);
  return res.ts ?? "";
}

export async function start(config: Config): Promise<RunningApp> {
	const app = new App({
		token:config.slackBotToken,
		appToken: config.slackAppToken,
		socketMode: true,
	});

  app.command("/slackdoom-play", async ({ ack, respond, command }) => {
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
				await reply("No game running");
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
				const framePath = await sendTurn(engine, [], OPENING_TICS);
				const ts = await postFrame(
					app.client,
					channel,
					framePath,
          "Sloom — type `/sloom forward` to move. Commands: forward, back, left, right, fire, use, strafeleft, straferight. Multi: `forward,fire`.",
        );
				sessions.set((channel, {engine, channel});
        log(config, "info", "started game", { channel, ts });
      } catch (err) {
        const msg = (err as Error).message;
        log(config, "error", "start failed", { msg });
        await reply(`Cannot not start the game: ${msg}`);
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

		try {
			const framePath = await sendTurn(sess.engine, keys, 8);
			await postFrame(
				app.client,
				channel,
				framePath,
        `Sloom — last: ${text}. Commands: forward, back, left, right, fire, use, strafeleft, straferight.`,
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