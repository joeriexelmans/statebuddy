# I could have put all of this in package.json but it would be quite unreadable.
# So here it is, as a shell script.

# clean up
rm -rf dist/*

COMMIT=$(git rev-parse HEAD)

# our build is aware of its own version
echo $COMMIT > src/git-rev.txt

# what follows now, is a very hacked mess, because Bun *still* doesn't properly support bundling web workers.

# make git ignore changes to mtl-meta.json (it will be overwritten but we don't want to check the changes into git)
git update-index --skip-worktree ./mtl-meta.json

# Workaround for Bun not properly supporting web workers:
# We first build our web worker script, and save its metafile.
# Our main project will then read the web worker's entry point name (a javascript file) from that metafile.

NODE_ENV=production bun build ./src/mtl-checker/mtl_web_worker.ts \
  --entry-naming='assets/[name]-[hash13].[ext]' \
  --asset-naming='assets/[name]-[hash13].[ext]' \
  --chunk-naming='assets/[name]-[hash13].[ext]' \
  --outdir=dist --target=browser --minify --sourcemap \
  --define process.env.NODE_ENV='\"production\"' --env='BUN_PUBLIC_*' \
  --metafile=./mtl-meta.json # this file is needed to build index.html !! we need it to determine the output filename of our web worker script.

# Luckily the web worker's entry point is only ~19KiB.


# We split our main entry point (index.html) into a bunch of entry points so large, infrequently updated chunks end up in separate files (that can be seperately stored and cached).
# The entry points to split off were discovered by analysis the meta-file with
#   https://esbuild.github.io/analyze/
NODE_ENV=production bun build \
  ./src/index.html \
  ./src/landing_page.html \
  ./src/404.html \
  ./node_modules/mqtt/dist/mqtt.esm.js \
  ./node_modules/react-dom/cjs/react-dom-client.production.js \
  ./src/App/Logo/Logo.tsx \
  --entry-naming='assets/[name]-[hash13].[ext]' \
  --asset-naming='assets/[name]-[hash13].[ext]' \
  --chunk-naming='assets/[name]-[hash13].[ext]' \
  --outdir=dist --target=browser --minify --splitting \
  --sourcemap  \
  --define process.env.NODE_ENV='\"production\"' --env='BUN_PUBLIC_*' \
  --metafile=./dist/commits/$COMMIT-meta.json \
  --public-path='../' # <-- we have to tell bun that all imports are relative to the parent directory

mkdir -p dist/commits
mkdir -p dist/tags

# copy pyodide
cp -r ./src/mtl-checker/assets/pyodide-* dist/assets/

mv dist/assets/landing_page-*.html  dist/index.html
mv dist/assets/404-*.html           dist/404.html

# a symlink would be better, but S3 has no notion of symlinks.
mv dist/assets/index-*.html         dist/tags/latest.html

# add immutable entry point (again no symlink)
cp dist/tags/latest.html       dist/commits/$COMMIT.html

# add mosis26 entry point (again no symlink)
cp dist/tags/latest.html       dist/tags/mosis26.html

# add nova experiment 1 entry point (again no symlink)
cp dist/tags/latest.html       dist/tags/nova01.html
