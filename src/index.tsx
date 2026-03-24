import { serve } from "bun";
import index from "./index.html";

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    "/": index,

    "/mtl_web_worker.js": async () => {
      // const source = await Bun.file("./src/mtl-checker/mtl_web_worker.ts").text();
      // const code = transpiler.transformSync(source);
      const result = await Bun.build({
        entrypoints: ["./src/mtl-checker/mtl_web_worker.ts"],
        target: "browser",
      });
      return new Response(await result.outputs[0].arrayBuffer(), {
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    },

    // HACK because otherwise strangely it no longer serves this file ??
    "/python-libs-h32n6y5c.zip": async () => {
      return new Response(await Bun.file("./src/mtl-checker/assets/python-libs.zip").arrayBuffer());
    },

    "/*": new Response("Not Found", { status: 404 }),
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: false,

    // Echo console logs from the browser to the server
    console: false,
  },
});

console.log(`🚀 Server running at ${server.url}`);
