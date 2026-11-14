# Sloom

This is basically DOOM but in Slack, played frame by frame like a turn based
game. TL DR: every typed command or button click advances the game by one
turn, and the bot replies with the resulting frame as an image.

## How it works

A Slack Socket Mode connection a headless doomgeneric engine built in C, so all rendering happens on the host and Slack will shows a picture.

1. The Slack client sends either `/sloom <command>` or taps a button to the Bolt bot.
2. The Bolt bot acknowledges it.
3. The bot turns the command into DOOM keypresses for example `w` is forward.
4. There is one game and one turn queue per channel for the time being.
5. The bot presses the keys in a real copy of DOOM running headless.
6. The game then advances one turn and the bot screenshots the frame.
7. The bot draws a compass and crosshair on the screenshot, because turn-based DOOM is much harder than it sounds and you will lose your bearings otherwise.
8. The picture is uploaded to a small Cloudflare Worker, because Slack only renders images it can download from a plain URL. The link is public and the frame stays stored until you clear the object.
9. The bot posts the picture in the channel with buttons for the next move.
10. When you die the game freezes and stops offering moves the only option left is to Restart.

# Requirements
- Node 22 or newer
- A Slack workspace where you can install apps
- A free Cloudflare account for the frame store (see below)
- A legally obtained WAD- the shareware `doom1.wad` from your own DOOM install or id's free release.

# Configuration

```sh
cp .env.example .env
```

| Variable | Value |
| --- | --- |
| `SLACK_BOT_TOKEN` | `xoxb-...` from the app install |
| `SLACK_APP_TOKEN` | `xapp-...` from Socket Mode |
| `FRAME_STORE_URL` | your worker URL from the frame-store step |
| `DOOM_WAD_PATH` | path to `doom1.wad` |
| `DOOM_ENGINE_PATH` | `native/sloom` unless you moved it |
| `NODE_ENV` | `development` or `production` |
| `LOG_LEVEL` | `debug`, `info`, `warn`, or `error` (default `info`) |

Never commit `.env`. The bot only makes outbound connections (Socket Mode),
so no inbound port, TLS certificate or reverse proxy is required :smile

# Quick Start

1. Slack app: open https://api.slack.com/apps and Create New App → From
   scratch. Name it whatever you like (the reference is Sloom).
   - Socket Mode: enable it and create an app-level token with the
     `connections:write` scope. That is the `xapp-...` token.
   - OAuth & Permissions: add the bot token scopes `chat:write` and
     `commands`. (`files:write` is not needed — frames are posted as image
     blocks pointing at the frame store.)
   - Slash Commands: create a command (the reference uses `/sloom`).
   - Interactivity & Shortcuts: enable it, or the buttons do nothing.
   - Install App to your workspace and copy the bot token (`xoxb-...`).


2. Native engine: the bot drives a headless build of doomgeneric.

   ```sh
   git clone https://github.com/ozkl/doomgeneric.git
   cd native
   make DG_DIR=/path/to/doomgeneric/doomgeneric
   ```

   That produces `native/sloom` in this repository. On Debian/Ubuntu install
   `build-essential` and `zlib1g-dev` first.
3. Game data: put a legally obtained WAD next to the repo and point `DOOM_WAD_PATH` at it.
4. Frame store (Cloudflare Worker): Slack cannot render the bot's own file
   uploads inline without an authenticated fetch, so frames are posted to a
   public URL instead. `src/frame-store.ts` sends each PNG to the worker in
   `frame-store/` and puts the returned URL into the Slack image block.

   ```sh
   cd frame-store
   npx wrangler login
   npx wrangler deploy
   ```

   No namespace to create because the Durable Object is provisioned by the
   migration in `frame-store/wrangler.jsonc`. The deploy prints your worker
   URL (`https://<name>.<subdomain>.workers.dev`), which is your
   `FRAME_STORE_URL`. The free plan covers this quite comfortably, as each frame is
   about 37 KB each and the store keeps them until you clear the object.
5. Run it:

   ```sh
   npm install
   npm run dev
   ```

# Known limitations

- Only one game per channel, turns are serialized per channel.
- The frame store is unauthenticated by design, so anyone with the URL can
  upload to it too.
- The bot and app tokens live in the process environment, so anyone who can
  read the process environment can read them. Thus, don't share your machine.
