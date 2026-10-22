import { readFile } from "node:fs/promises";

export async function storeFrame(pngPath: string): Promise<string> {
  const base = (process.env.FRAME_STORE_URL ?? "").replace(/\/+$/, "");
  if (!base) {
    throw new Error(
      "FRAME_STORE_URL is not set to prevent abuse of the cloudflare server. Point it at a frame-store worker (see frame-store/README.md).",
    );
  }
  const frame = await readFile(pngPath);
  const res = await fetch(`${base}/frame`, {
    method: "POST",
    body: frame,
    headers: { "Content-Type": "image/png" },
  });
  if (!res.ok) {
    throw new Error(`frame upload failed: ${res.status}`);
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}
