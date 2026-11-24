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
          buildInputs = [
            pkgs.bun # for dev server and building the web app
            pkgs.awscli2 # for deploying web app onto S3
            pkgs.tree-sitter # for generating the action language parser
          ];

          shellHook = ''
            echo "bun $(bun --version)"
            aws --version
            tree-sitter --version
          '';
        };
      });
    };
}
