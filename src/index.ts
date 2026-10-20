
import "dotenv/config";
import {App} from "@slack/bolt";
import type {Express} from "express";
import type {Server} from "node:http";
import { loadConfig, type Config } from "./config.js";
import {
 buildDetailsEntity,
 buildPostMessageArgs,
 EXTERNAL_REF_TYPE,   
} from "./work-objects.js";
import {createWebApp} from "./web.js"
//Asked AI to help me write a log string just for troubleshooting
function log(config: Config, level: string, msg: string, extra?: unknown): void {
  const order = ["debug", "info", "warn", "error"];
  if (order.indexOf(level) < order.indexOf(config.logLevel)) return;
  const line = `[sloom] ${level.toUpperCase()} ${msg}`;
  if (extra === undefined) console.log(line);
  else console.log(line, extra);
}

function newLaunchId(): string {
  return `launch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface RuningApp {
	app: App;
	server: Server;
	web: Express;
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