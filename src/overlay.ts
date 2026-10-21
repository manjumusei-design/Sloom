import sharp from "sharp";

export interface OverlayOptions {
    angle: number | null;
}

export function overlayPathFor(framePath: string): string {
    return framePath.replace(".png", "-overlay.png");
}

const DOOM_WIDTH = 320;
const DOOM_HEIGHT = 200;
const FRAME_SCALE = 2;
const FRAME_WIDTH = DOOM_WIDTH * FRAME_SCALE;
const FRAME_HEIGHT = DOOM_HEIGHT * FRAME_SCALE;

const COMPASS_MARGIN_X = 52;
const COMPASS_MARGIN_Y = 46;
const COMPASS_RADIUS = 32;
const COMPASS_ORBIT = 23;

const CROSSHAIR_REACH = 18;
const CROSSHAIR_GAP = 10;

const COLOR_RED = "#ff3333";
const COLOR_WHITE = "#ffffff";
const COLOR_NORTH = "#ff5555";
const COLOR_FACING = "#ffcc00";

const DEG_TO_RAD = Math.PI / 180;

const DIRS = [ //used ai here for plotting the coordinates because I was lazy :/
  {
    label: "N",
    a: 90,
    path: "M -3,5 L -3,-5 L 3,5 L 3,-5",
    color: COLOR_NORTH,
  },
  {
    label: "E",
    a: 0,
    path: "M 3,-5 L -3,-5 L -3,5 L 3,5 M -3,0 L 1,0",
    color: COLOR_WHITE,
  },
  {
    label: "S",
    a: 270,
    path: "M 3,-5 L -3,-5 L -3,0 L 3,0 L 3,5 L -3,5",
    color: COLOR_WHITE,
  },
  {
    label: "W",
    a: 180,
    path: "M -3,-5 L -1.5,5 L 0,-2 L 1.5,5 L 3,-5",
    color: COLOR_WHITE,
  },
] as const;

export async function applyOverlay(
  framePath: string,
  outPath: string,
  opts: OverlayOptions,
): Promise<string> {
  const angle = opts.angle ?? 0;
}
  const svg = `
<svg width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}" xmlns="http://www.w3.org/2000/svg"> //thank god for w3 schools
  <g transform="translate(${FRAME_WIDTH - COMPASS_MARGIN_X}, ${COMPASS_MARGIN_Y})">
    ${compassRose(angle)}
  </g>
  <g transform="translate(${FRAME_WIDTH / 2}, ${FRAME_HEIGHT / 2})" stroke="${COLOR_RED}" stroke-width="2"
     stroke-linecap="round" opacity="0.85">
    <line x1="0" y1="${-CROSSHAIR_REACH}" x2="0" y2="${-CROSSHAIR_GAP}"/>
    <line x1="0" y1="${CROSSHAIR_GAP}" x2="0" y2="${CROSSHAIR_REACH}"/>
    <line x1="${-CROSSHAIR_REACH}" y1="0" x2="${-CROSSHAIR_GAP}" y2="0"/>
    <line x1="${CROSSHAIR_GAP}" y1="0" x2="${CROSSHAIR_REACH}" y2="0"/>
  </g>
</svg>`;

  await sharp(framePath)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(outPath);

  console.log("[Sloom] overlay applied:", outPath);
  return outPath;
}

function compassRose(angle: number): string {
  let out = "";
  out += `<circle cx="0" cy="0" r="${COMPASS_RADIUS}" fill="rgba(0,0,0,0.55)"`;
  out += ` stroke="rgba(255,255,255,0.35)" stroke-width="1"/>`;

  for (const d of DIRS) {
    const r = d.a * DEG_TO_RAD;
    const x = Math.round(Math.cos(r) * COMPASS_ORBIT);
    const y = Math.round(-Math.sin(r) * COMPASS_ORBIT);
    out += `<g transform="translate(${x},${y})">`;
    out += `<path d="${d.path}" fill="none" stroke="${d.color}"`;
    out += ` stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
    out += `</g>`;
  }

  out += `<g transform="rotate(${90 - angle})">`;
  out += `<polygon points="0,-22 5,-12 -5,-12" fill="${COLOR_FACING}"/>`;
  out += `</g>`;

  return out;
}