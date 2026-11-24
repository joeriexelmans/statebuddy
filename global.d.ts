// here we tell TypeScript that it's OK to import these file types as if they were modules:

declare module '*.css';
declare module '*.png';
declare module '*.ttf';
declare module '*.wav';
declare module '*.opus';
declare module '*.webp';
declare module '*.wasm';
declare module "*.svg";
declare module "*.zip";

declare module "immutable_dir:*";
declare module "*?url";

declare module "*.module.css" {
  /**
   * A record of class names to their corresponding CSS module classes
   */
  const classes: { readonly [key: string]: string };
  export = classes;
}

declare module "virtual:git-rev" {
  const gitRev: string;
  export {gitRev};
}

/// <reference types="vite/client" />
