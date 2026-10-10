{
  description = "saerskriven: threat modelling studio";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { nixpkgs, flake-utils, ... }:
    let
      packageFor = pkgs: pkgs.callPackage ./nix/package.nix { };
    in {
      overlays.default = final: _prev: { saerskriven = packageFor final; };
    } // flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        shellEnv = {
          LANG = "C.UTF-8";
          LC_ALL = "C.UTF-8";

          # Nx sets FORCE_COLOR for child processes. Drop a host NO_COLOR so
          # Node does not warn when both variables reach those processes.
          #
          # SAERSKRIVEN_RESVG_WASM and SAERSKRIVEN_BROTLI_WASM name where the
          # rasterizer and brotli modules will be rather than store paths. The
          # `resvg-wasm` and `brotli-wasm` nx projects build them to those
          # paths and every consumer target depends on that build, so the
          # graph is what puts the file there (each project.json under nix/
          # holds the same path). The values are named here and not on the
          # consumer targets because they have to be absolute: nx strips
          # `{workspaceRoot}` out of an option value instead of expanding it,
          # so a target can only state a workspace-relative path, and most of
          # the consumer tasks run with their own project root as the working
          # directory. The CLI's build settles it either way: its executor is
          # not run-commands, which is the only kind nx passes an option's
          # environment to. The root is walked up to rather than read from
          # $PWD, so entering the shell in a subdirectory still names the one
          # path.
          #
          # The paths have to stay under the workspace root. The studio's
          # development server allows that root and no longer names a
          # module's own directory, so a module outside it would come back as
          # Vite refusing to serve a file rather than as a sentence naming the
          # cause (apps/studio/build-assets.mts).
          shellHook = ''
            unset NO_COLOR
            workspace=$PWD
            while [ ! -e "$workspace/pnpm-workspace.yaml" ] && [ "$workspace" != / ]; do
              workspace=$(dirname "$workspace")
            done
            export SAERSKRIVEN_RESVG_WASM="$workspace/dist/resvg-wasm/lib/saerskriven_resvg.wasm"
            export SAERSKRIVEN_BROTLI_WASM="$workspace/dist/brotli-wasm/lib/saerskriven_brotli.wasm"
            unset workspace
          '';

          # The build reads these pinned fonts. No font binaries live in git.
          SAERSKRIVEN_FONTS_DIR = "${pkgs.liberation_ttf}/share/fonts/truetype";
        };

        # The flake pins executable tools. JS libraries use the pnpm catalog.
        toolchainInputs = [
          pkgs.jq
          pkgs.gh
          pkgs.gnutar
          pkgs.bashInteractive
          pkgs.nodejs_24
          pkgs.pnpm
        ];

        # Node 26 turns the CLI bundle into a single executable application
        # (scripts/sea-executable.sh). It is named by path and kept off PATH,
        # where `node` stays nodejs_24, the development and test runtime.
        packagingNode = pkgs.nodejs-slim_26;

        # The official Node binary each executable is built on, one entry per
        # target scripts/package-cli.sh builds, with the hash its release's
        # SHASUMS256.txt carries. The URL version is packagingNode's, because
        # Node requires the binary that builds a single executable and the
        # binary it injects into to be one version: a nixpkgs bump moves all
        # four URLs while the hashes stay behind and the build fails on a
        # mismatch. Renovate does not know this fetch: replace the hashes by
        # hand, per docs/build.md.
        nodeRuntimeVersion = packagingNode.version;

        nodeRuntimePins = {
          "x86_64-unknown-linux-gnu" = {
            platform = "linux-x64";
            hash = "sha256-22NC0269s8vXIQPQzlzMUoYg9snfcqEfTMs4S/G+9ng=";
          };
          "aarch64-unknown-linux-gnu" = {
            platform = "linux-arm64";
            hash = "sha256-gaPMqDPQgDVCNrVBGkkAPbiEjuADsSLiEriAOGkvehE=";
          };
          "aarch64-apple-darwin" = {
            platform = "darwin-arm64";
            hash = "sha256-m6BxpYzFDm9FTv+nDeGyyehT4smMnuZeXf02AQQfwGQ=";
          };
          "x86_64-pc-windows-msvc" = {
            platform = "win-x64";
            hash = "sha256-pNCl6X7wU74C3SALpYHZzPUjMFejbJs9vk8Wxs9YZIU=";
          };
        };

        nodeDist = "https://nodejs.org/dist/v${nodeRuntimeVersion}";

        # Node publishes the Windows binary bare and every other platform's
        # inside an archive, of which the build takes bin/node alone. The bare
        # binary's URL ends in node.exe whatever the version, and a store path
        # is its name and hash alone, so the name carries the version: a hash
        # left stale after a bump then misses the store and fails the fetch,
        # where the old path would have answered with the old binary.
        nodeRuntime = { platform, hash }:
          if platform == "win-x64" then
            pkgs.fetchurl {
              name = "node-${nodeRuntimeVersion}-win-x64.exe";
              url = "${nodeDist}/win-x64/node.exe";
              inherit hash;
            }
          else
            let archive = "node-v${nodeRuntimeVersion}-${platform}";
            in pkgs.runCommand "node-${nodeRuntimeVersion}-${platform}" {
              src = pkgs.fetchurl {
                url = "${nodeDist}/${archive}.tar.xz";
                inherit hash;
              };
            } ''
              tar -xJf "$src" -O "${archive}/bin/node" > "$out"
              chmod 555 "$out"
            '';

        # One binary per target, at <target>/node.
        nodeRuntimes = pkgs.linkFarm "node-runtimes-${nodeRuntimeVersion}"
          (pkgs.lib.mapAttrsToList (target: pin: {
            name = "${target}/node";
            path = nodeRuntime pin;
          }) nodeRuntimePins);

        # What scripts/sea-executable.sh builds with, each named by path:
        # the packaging Node, the pinned binaries, rcodesign for the macOS
        # ad hoc signature, and unshare, which on PATH would bring util-linux
        # in to shadow tools coreutils already provides.
        packagingEnv = {
          SAERSKRIVEN_SEA_NODE = "${packagingNode}/bin/node";
          SAERSKRIVEN_NODE_RUNTIMES = nodeRuntimes;
          SAERSKRIVEN_RCODESIGN = "${pkgs.rcodesign}/bin/rcodesign";
          SAERSKRIVEN_UNSHARE = "${pkgs.util-linux}/bin/unshare";
        };

        wasmModule = file:
          pkgs.callPackage ./nix/wasm-module.nix { module = import file; };

        workflowLintInputs = [
          pkgs.actionlint
          pkgs.zizmor
        ];

        sastInputs = [
          pkgs.semgrep
        ];

        # Playwright browsers from the same pinned set: no playwright-managed
        # downloads at install or test time. The driver version is exported so
        # the version-equality test in apps/studio-e2e can red an unpaired
        # bump between this pin and the catalog's @playwright/test (#25).
        playwrightEnv = {
          PLAYWRIGHT_BROWSERS_PATH = pkgs.playwright-driver.browsers;
          PLAYWRIGHT_DRIVER_VERSION = pkgs.playwright-driver.version;
          PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
          # The store's browsers link against nix-provided libraries, so
          # playwright's host-distribution check does not apply.
          PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
        };

        # The store's WebKit carries libglvnd and no EGL driver, and that
        # libglvnd looks for one under /run/opengl-driver, which only NixOS
        # has. On any other host, a GitHub runner among them, WebKit launches
        # and then opens no page ("Could not create WPE EGL display"). Naming
        # Mesa's vendor file hands it a driver from the same pinned set, and
        # software rendering keeps the result off whatever GPU the host has.
        webkitEglEnv = {
          __EGL_VENDOR_LIBRARY_FILENAMES =
            "${pkgs.mesa}/share/glvnd/egl_vendor.d/50_mesa.json";
          LIBGL_ALWAYS_SOFTWARE = "1";
        };

        ciShell = shellEnv // playwrightEnv // packagingEnv // {
          name = "saerskriven-ci";
          buildInputs = toolchainInputs ++ workflowLintInputs ++ sastInputs;
        };

        saerskriven = packageFor pkgs;

        # nix/release.json names the systems a release has an executable for.
        released = builtins.elem system saerskriven.meta.platforms;
      in {
        packages = {
          node-runtimes = nodeRuntimes;
          # No dev shell carries these closures: the Rust toolchain is large
          # and entering a shell to work on the TypeScript should not pay for
          # it (issue #341). What changed with #379 is who runs the build: the
          # `resvg-wasm` and `brotli-wasm` nx projects do, each as a task every
          # consumer depends on, so a cold `nx build @saerskriven/studio` now
          # triggers the Rust compiles where it used to refuse and name the
          # command. The shell still holds neither the toolchain nor a module.
          # Each module's file under nix/ is data, and nix/wasm-module.nix, the
          # one builder, is applied to it here, so no module builds itself.
          resvg-wasm = wasmModule ./nix/resvg-wasm;
          brotli-wasm = wasmModule ./nix/brotli-wasm;
        } // pkgs.lib.optionalAttrs released { inherit saerskriven; };

        checks = pkgs.lib.optionalAttrs released {
          saerskriven =
            pkgs.callPackage ./nix/check.nix { inherit saerskriven; };
        };

        devShells = {
          # The shell every CI job enters: one closure, one cache entry.
          ci = pkgs.mkShell ciShell;

          # The shell the nightly Firefox and WebKit legs enter (#679): ci
          # plus the EGL driver WebKit needs. Mesa and its LLVM add about
          # 800 MiB to a closure, so they stay out of ci, whose closure and
          # cache entry every pull request job pays for (owner ruling,
          # 2026-10-03). It is built on ci's own attribute set, so the two
          # differ by that driver and nothing else.
          nightly = pkgs.mkShell (ciShell // webkitEglEnv // {
            name = "saerskriven-nightly";
          });

          # The shell for humans. Currently identical to ci; interactive-only
          # tooling joins here, never in ci, so CI's closure stays lean.
          default = pkgs.mkShell (shellEnv // playwrightEnv // packagingEnv // {
            name = "saerskriven";
            buildInputs = toolchainInputs ++ workflowLintInputs ++ sastInputs;
          });
        };
      });
}
