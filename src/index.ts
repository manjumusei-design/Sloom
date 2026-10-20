
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
