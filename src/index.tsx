import { serve } from "bun";
import index from "./index.html";
// import webworker from "./mtl-checker/mtl_web_worker.ts";

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    "/": index,

    "/assets/*": async (req) => {
      const path = new URL(req.url).pathname;
      if (path.startsWith("/assets/mtl_web_worker-") && path.endsWith(".js")) {
        const result = await Bun.build({
          // there is only one worker:
          entrypoints: ["./src/mtl-checker/mtl_web_worker.ts"],
          target: "browser",
        });
        return new Response(await result.outputs[0].arrayBuffer(), {
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }
      else if (path.startsWith("/assets/pyodide-")) {
        return new Response(await Bun.file("./src/mtl-checker/" + path).arrayBuffer(), {
          // MIME type needs to be correct or we cannot execute it as code
          headers: {
            "Content-Type": {
              "js": "application/javascript",
              "wasm": "application/wasm",
            }[path.split('.').at(-1)!] || "text/html",
          }
        });
      }
      else if (path.startsWith("/assets/mtl-libs-") && path.endsWith(".zip")) {
        return new Response(await Bun.file("./src/mtl-checker/assets/mtl-libs.zip").arrayBuffer(), {
        });
      }
      console.log("Not found: ", path);
      return new Response("Not Found", { status: 404 });
    },

    "/*": async (req) => {
      console.log("Not found: ", new URL(req.url).pathname);
      return new Response("Not Found", { status: 404 });
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: false,

    // Echo console logs from the browser to the server
    console: false,
  },
});

console.log(`🚀 Server running at ${server.url}`);
