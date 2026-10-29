#Sloom

This is basically doom but in slack and played frame by frame, which plays like a turn based game. Tldr every typed command or button click advances the game by one turn, where the headless engine posts the resulting frame as an image. 

## How it works 
I used the Slack Socket mode connection to drive the doomgeneric engine which is built from C to offload rendering from Slack or any browser. 


1.Slack client sends either a /sloom <command> or a button reaction 
2. Bolt bot acknowledges it
3. Bot turns the commands into a keypress, IE "forwards" means the W key in doom or any combinations containing X amount of commands  will be converted to X amount of keypresses in quick succession
4. The request system has one game and one queue for the time being
5. Bot presses the key in a real copy of doom running on the headless server
6. Game moves a tiny step forwards then the bot takes a screenshot of it
7. Bot draws a compass, crosshair on the screenshot so you can navigate the game since playing turn based doom is a lot harder than it may seem since you may lose your direction
8. Picture is put on a small public webpage because slack will only show an image it can download from a lin kor a CDN. The bot does this on purpose and the link is temporary ish (ephemeral)
9: Bot posts the picture in the channel with buttons 
10: When you die the game will freeze and not give you any options and you need to restart with the restart option offered.


# Requirements
- Node 22 or newer
- Slack workspace + perms
- Free cloudflre account for the frame store (look at .env)
- A legally obtained WAD. The shareware `doom1.wad` (  [doomgeneric](https://github.com/ozkl/doomgeneric) source.)


# Configuration

```sh
cp .env.example .env
```

| Variable | Value |
| --- | --- |
| `SLACK_BOT_TOKEN` | `xoxb-...` from the app install |
| `SLACK_APP_TOKEN` | `xapp-...` from Socket Mode |
| `FRAME_STORE_URL` | your worker URL from the previous step |
| `DOOM_WAD_PATH` | path to `doom1.wad` |
| `DOOM_ENGINE_PATH` | `native/sloom` unless you moved it |

Never commit `.env`. The bot only needs outbound connections (Socket Mode),
so no inbound port, TLS certificate or reverse proxy is required.


# Quick Start
1. Slack app
Open https://api.slack.com/apps and choose Create New App then From scratch. Name it whatever you like (the reference is sloom).
Socket Mode: enable it. When asked for a token, create an app-level token with the connections:write scope. This is the xapp-... token.
OAuth & Permissions: add bot token scopes chat:write, commands, files:write.
Slash Commands: create a command (the reference uses /sloom) with the usage hint start. Socket Mode is on by default afaik, so no Request URL is needed.
Interactivity & Shortcuts: enable interactivity as without this the tap buttons do nothing.
Install App: install it to your workspace and copy the bot token (xoxb-...).


3. Native engine
The bot drives a headless build of doomgeneric.

git clone https://github.com/ozkl/doomgeneric.git
cd native
make DG_DIR=/path/to/doomgeneric/doomgeneric
That produces native/sloom in this repository. On Debian/Ubuntu install build-essential libpng-dev zlib1g-dev first.

3. Game data
Put a "legally" obtained WAD next to the repo and point DOOM_WAD_PATH at it. WADs are ignored by git and are distributed under their own license, never commit commercial WADs in your version.

4. Frame store (Cloudflare Worker)
Slack cannot render the bot's own file uploads inline without an authenticated fetch, and Slack's own file URLs require auth headers, so frames are posted to a public URL instead: src/frame-store.ts sends each PNG to the worker in frame-store/ and puts the returned URL into the Slack image_url block.


Deploy it:
cd frame-store
npx wrangler login
npx wrangler deploy
No namespace to create: the Durable Object is provisioned by the migration in frame-store/wrangler.jsonc. The command prints your worker URL (https://<name>.<subdomain>.workers.dev), which is your FRAME_STORE_URL. The free plan from cloudflare covers this comfortably as frames are about 37 to 40 KB each, and the store keep them until you clear the object.

# Known limitations

- One game per channel; turns are serialized per channel.
- The frame store is unauthenticated by design, so anyone with the URL can upload to it which is why I had to update the .env during creation. 
- The bot token and app token are read from the environment, so on a shared machine anyone who can read the process environment can read them. So just dont share your machine xd. 
