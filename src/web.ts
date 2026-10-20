
import express, {type Express, type Request, type Response}  from "express";
import {existsSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const SLACK_FRAMEANCESTORS = [
  "https://*.slack.com",
  "https://*.slack-gov.com",
  "https://*.slack-mcps.com",
].join(" ");

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PUBLIC_DIR = resolve(__dirname, "..", "public");

export function buildCsp(): string {
  return [
    `frame-ancestors ${SLACK_FRAME_ANCESTORS}`,
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
  ].join("; ");
}

