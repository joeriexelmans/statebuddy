// This module exports a Vite plugin that allows importing a directory.
// This means:
//   - the full directory will become an immutable asset (and its name will include a hash).
//   - this means, upon build, the directory is copied under assets and the directory name (but not the filenames IN the directory), will include a hash based on the full directory contents.
//   - the import resolves to a path under assets (with hash) where the directory is hosted

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, lstatSync } from "node:fs";
import {basename, dirname, join} from "node:path";
import type { Plugin } from "vite";

const importPrefix = "immutable_dir:";

export function hashedDir(): Plugin {
  let isBuild = false;
  let base = "/";
  let dirsToCopy: {from: string, to: string}[] = [];

  return {
    name: `hashed-dir`,
    enforce: "pre",
    configResolved(c) {
      isBuild = c.command === "build";
      base = c.base;
    },
    resolveId(s, importer) {
      // here we are given an import statement, and we check if we need to handle it
      if (s.startsWith(importPrefix)) {
        if (importer) { // <-- not sure if `importer` is ever undefined, but TS says so...
          // there seems to be a convention in Vite/RollDown that imports of non-real paths start with a NULL-character
          const result = "\0" + importPrefix + join(dirname(importer), s.slice(importPrefix.length));
          // ^ BTW, `importer` seems to be an absolute path to the importing module.
          // Example:
          //   if we have
          //      import pyodideIndexURL from 'immutable_dir:./assets/pyodide-0.29.3';
          //   in /home/maestro/repos/statebuddy/src/mtl-checker/mtl_pyodide.ts (= importer)
          //   then result will have the form:
          //      \0immutable_dir:/home/maestro/repos/statebuddy/src/mtl-checker/assets/pyodide-0.29.3
          return result;
        }
      }
      return null;
    },
    load(s) {
      if (!s.startsWith("\0"+importPrefix)) return;
      // We strip a bunch of junk we added in `resolveId`, to obtain the absolute path to the directory to import:
      const importedDirAbsPath = s.slice(importPrefix.length+1);

      // What the import resolves to in our bundle.
      // This depends on whether we're running a dev server or a build:
      const outDirName = isBuild
        ? basename(importedDirAbsPath)+'-'+dirHash(importedDirAbsPath) // <-- build: the relative path of the copied directory. It seems Vite adds 'assets/' to this path for us.
        : `/@fs/${importedDirAbsPath}`; // <-- dev server: use the absolute filesystem path with @fs

      // in the 'generateBundle' step (comes later), we still have to copy the directory
      if (isBuild) {
        dirsToCopy.push({
          from: importedDirAbsPath,
          to: join("assets", outDirName),
        });
      }

      // What actually gets imported: a path where the browser can fetch the directory's contents
      return `export default ${JSON.stringify(outDirName)};`;
    },
    generateBundle() {
      // We cannot ask Vite to simply copy a directory for us, so we must write our own function that recursively copies all the files in the directories that need to be copied with `emitFile`.
      const fn = (to: string) => (basename: string, path: string, isDir: boolean) => {
        const filePath = join(path, basename);
        if (isDir) {
          visitDir(filePath, fn(join(to, basename)));
        }
        else {
          this.emitFile({
            type: "asset",
            fileName: join(to, basename),
            source: readFileSync(filePath),
          })
        }
      }
      for (const {from, to} of dirsToCopy) {
        visitDir(from, fn(to));
      }
    },
  };
}

// Get hash of full (recursive) directory contents
function dirHash(path: string) {
  const h = createHash("sha256");

  visitDir(path, (basename, path, isDir) => {
    h.update(basename);
    const filePath = join(path, basename);
    if (isDir) {
      h.update(dirHash(filePath));
    }
    else {
      h.update(readFileSync(filePath))
    }
  });
  return h.digest("base64url").slice(0, 16);
}

// Visit every file in a directory, non-recursively.
function visitDir(path: string, fn: (basename: string, path: string, isDir: boolean) => void) {
  for (const entry of readdirSync(path)) {
    const entryPath = join(path, entry);
    const stat = lstatSync(entryPath);
    const isDir = stat.isDirectory();
    fn(entry, path, isDir);
  }
}
