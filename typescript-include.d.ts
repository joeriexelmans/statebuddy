// This file is included by default by Typescript

declare module "*.svg" {
  /**
   * A path to the SVG file
   */
  const path: `${string}.svg`;
  export = path;
}

declare module "*.zip" {
  /**
   * A path to the SVG file
   */
  const path: `${string}.zip`;
  export = path;
}

declare module "*.module.css" {
  /**
   * A record of class names to their corresponding CSS module classes
   */
  const classes: { readonly [key: string]: string };
  export = classes;
}

declare module "immutable_dir:*" {
  const url: string;
  export default url;
}

declare module "virtual:git-rev" {
  const gitRev: string;
  export {gitRev};
}

declare module "*?url" {
  const url: string;
  export default url;
}

/// <reference types="vite/client" />
