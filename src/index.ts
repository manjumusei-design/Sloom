
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


export async function start(config: Config): Promise<RunningApp> {
	const app = new App({
		token:config.slackBotToken,
		appToken: config.slackAppToken,
		socketMode: true,
	});

  app.command("/slackdoom-play", async ({ ack, respond, command }) => {
    await ack();

		const text = (command.text ?? "").trim();
		if (text !== "start") {
			await respond({
				response_type: "ephemeral",
        text: "Usage: `/slackdoom-play start`",
			});
			return;
		}

		const launchId = newLaunchId();
		const args = buildPostMessageArgs(
			command.channel_id,
			launchId,
			config.publicBaseUrl,
		);

		try {
			await app.client.chat.postMessage(args);
			log(config, "info", "posted card", {launchId});
		} catch (err) {
			const code = (err as {data?: {error?: string } })?.data?.error ?? "unknown";
      log(config, "error", "chat.post Message failed", { code });
			await respond ({
				response_type: "ephemeral",
				text:
					code === "not_in_channel"
            ? "I need to be invited to this channel before I can post. Use `/invite @sloom`."
            : "Could not launch the DOOM card. Check logs.",
      });
    }
  });

  app.event("entity_details_requested", async ({ body, event, client }) => {
		const externalRef = event.external_ref as
      | { id?: string; type?: string }
      | undefined;
		const launchId = externalRef?.id ?? "unknown":
		const triggerId = 
		body.trigger_id ?? (event as {trigger_id?: string}).trigger_id;

		if (!triggerId) {
			log(config, "error", "entity_details_requested missing trigger_id");
			return;
		}

		const entityUrl = 
      (event as { entity_url?: string }).entity_url ??
      (event as { app_unfurl_url?: string }).app_unfurl_url ??
      `${config.publicBaseUrl}/doom/${launchId}`;

    try {
      await client.apiCall("entity.presentDetails", {
        trigger_id: triggerId,
        metadata: {
          entities: [buildDetailsEntity(launchId, entityUrl, config.publicBaseUrl)],
        },
      });
      log(config, "info", "presented details", { launchId });
    } catch (err) {
      const code = (err as { data?: { error?: string } })?.data?.error ?? "unknown";
      log(config, "error", "entity.presentDetails failed", { code });
    }
  });

  app.error(async (error) => {
    log(config, "error", "bolt error", { message: error.message });
  });

	const web = createWebApp();
	const server = web.listen(config.port, "0.0.0.0", () => {
		log(config, "info", 'web listening on 0.0.0.0:${config.port}`);
	});

	await app.start();
	log(config, "info", "socket mode is connected");

	return { app, server, web };
}

export async function stop(running: RunningApp): Promise<void> {
	await running.app.stop();
	await new Promise<void>((resolve) => running.server.close(() => resolve()));
}

const isMain = 
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;

if (isMain){
	const config = loadConfig();
  start(config).catch((err: unknown) => {
    console.error("[sloom] FATAL failed to start:", (err as Error).message);
    process.exit(1);
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
		process.on(signal, () => {
      console.log(`[sloom] ${signal} received, shutting down`);
			process.exit(0);
		});
	}
}

export {EXTERNAL_REF_TYPE};