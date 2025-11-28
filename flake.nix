{
  description = "StateBuddy";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { nixpkgs, flake-utils, ... }:
    flake-utils.simpleFlake {
      inherit nixpkgs;
      packages = pkgs: {
        default = pkgs.bun;

        project = pkgs.stdenv.mkDerivation {
          pname = "statebuddy";
          version = "1.0.0";
          src = ./.;

          buildInputs = [ pkgs.bun ];

          buildPhase = ''
            bun install
            bun run build
          '';

          installPhase = ''
            mkdir -p $out
            cp -r dist/* $out/
          '';
        };
      };

      devShell = pkgs: pkgs.mkShell {
        buildInputs = [ pkgs.bun ];
      };
    };
}
