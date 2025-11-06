
// Some deleted code for calling argus...

// // Dynamically import the JS loader
// const wasm = await import("argus-wasm/pkg/argus_wasm.js");

// // @ts-ignore
// import wasmfile from "../../node_modules/argus-wasm/pkg/argus_wasm_bg.wasm";

// async function initWasm() {
//   // Initialize the module with the URL to the .wasm
//   await wasm.default(wasmfile);
// }

// window.initWasm = initWasm;

// initWasm();


// let evaluation = null;
  // let propertyError: null | string = null;
  // try {
  //   if (cleanPlantStates) {
  //     // throws runtime error if Rust panics:
  //     evaluation = wasm.eval_boolean(property, {entries: cleanPlantStates});
  //   }
  // }
  // catch (e) {
  //   propertyError = "property evaluation panic'ed: " + e.message;
  //   initWasm();
  // }
  // let propertyTrace: null | {timestamp: number, satisfied: boolean}[] = null;
  // if (typeof evaluation === 'string') {
  //   propertyError = evaluation;
  // }
  // else if (evaluation !== null && Array.isArray(evaluation.entries)) {
  //   // propertyTrace = evaluation.entries.map(({satisfied}) => satisfied);
  //   propertyTrace = evaluation.entries;
  // }
