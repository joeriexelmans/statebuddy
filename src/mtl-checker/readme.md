It took me quite a long time to figure out how to run Pyodide in a Web Worker, but here it is.

 * `mtl_web_worker.ts` This is the script that will run inside the web worker. To the compiler/bundler, it is a separate entry point and will be fetched from the server as a separate JavaScript file.
 * `wheels/` The Python wheels and Pyodide lock file are no longer used. Instead I just unpack a ZIP file (`python-libs.zip`) with the MTL library and its dependencies into each Pyodide instance after it has booted.