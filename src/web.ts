
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

export interface WebServerOptions {
	publicDir?: string;
}
//had to use some AI here as i was not sure of how bot headers work 
export function createWebApp(options: WebServerOptions = {}): Express {
	const publicDir = options.publicDir ?? DEFAULT_PUBLIC_DIR;
	const app = express();

  app.disable("x-powered-by");

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true, service: "sloom", uptime: process.uptime() });
  });

  app.get("/embed/doom", (_req: Request, res: Response) => {
    res.setHeader("Content-Security-Policy", buildCsp());
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.type("html");
    res.sendFile(join(publicDir, "embed", "doom.html"), (err) => {
      if (err && !res.headersSent) {
        res.status(500).type("text").send("Embed page not built.");
      }
    });
  });

  app.use(
    "/assets",
    (req: Request, res: Response, next) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("X-Content-Type-Options", "nosniff");
      next();
    },
    express.static(join(publicDir, "assets"), {
      setHeaders(res, path) {
        if (path.endsWith(".wasm")) {
          res.setHeader("Content-Type", "application/wasm");
        } else if (path.endsWith(".wad")) {
          res.setHeader("Content-Type", "application/octet-stream");
        }
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      },
    }),
  );

