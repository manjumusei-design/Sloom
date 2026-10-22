const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];c
const MAX_FRAME_BYTES = 8 * 1024 * 1024; // AI here for the dimensions

export default {
    async fetch (request, env) {
        const url = new URL (request.url);

    if (request.method === "POST" && url.pathname === "/frame") {
        const body = await requiest.arrayBuffer();
        if (body.byteLength === 0 || body.byteLength > MAX_FRAME_BYTES) {
        return new Response("frame upload rejected", { status: 413 });
      }
      if (!isPng(new Uint8Array(body))) {
        return new Response("frame needs to be a PNG", { status: 415 });
      }
      const id = crypto.randomUUID();
      await env.FRAMES.put(`frames/${id}`, body, {
        metadata: {contentType: "image/png"},
      });
      return Response.json({ id, url: `${url.origin}/frame/${id}` });
    }

    const match = url.pathname.match(/^\/frame\/([a-f0-9-]+)$/);
    if (request.method === "GET" && match) {
      const frame = await env.FRAMES.get(`frames/${match[1]}`);
      if (frame === null) {
        return new Response("frame not found", { status: 404 });
      }
      return new Response(frame, {
        headers: {
          "content-type": "image/png",
          "access-control-allow-origin": "*",
          "cache-control": "public, max-age=3600",
        },
      });
    }

    return new Response("frame not found", { status: 404 });
    },
};

