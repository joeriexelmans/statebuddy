{
  description = "StateBuddy";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forEachSystem = f:
        nixpkgs.lib.genAttrs systems (system:
          f {
            pkgs = import nixpkgs { inherit system; };
          });
    in
    {
      devShells = forEachSystem ({ pkgs }: {
        default = pkgs.mkShell {
          buildInputs = with pkgs; [
            bun # for dev server and building the web app
            awscli2 # for deploying web app onto S3
            tree-sitter # for generating the action language parser (as C code)
            # clang # to compile C code generated from our grammar
            # binaryen # gives us the `warm-opt` command, which we need to build our parser
            # pkgsCross.wasi32.wasilibc # wasm libc
            pkgsCross.wasi32.stdenv.cc # nixpkgs' properly wrapped clang compiler for WASM output
          ];

          shellHook = ''
            echo "bun $(bun --version)"
            aws --version
            tree-sitter --version
            wasm32-unknown-wasip1-clang --version
          '';
        };
      });
    };
}
