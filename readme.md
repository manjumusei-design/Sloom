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

# Known limitations

- One game per channel; turns are serialized per channel.
- The frame store is unauthenticated by design, so anyone with the URL can upload to it which is why I had to update the .env during creation. 
- The bot token and app token are read from the environment, so on a shared machine anyone who can read the process environment can read them. So just dont share your machine xd. 
