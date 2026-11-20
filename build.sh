# clean up
rm -rf dist/*

# our build is aware of its own version
git rev-parse HEAD > src/git-rev.txt

# what follows now, is a very hacked mess, because Bun *still* doesn't properly support bundling web workers.

# first we must build our web worker script
NODE_ENV=production bun build ./src/mtl-checker/mtl_web_worker.ts \
  --entry-naming='assets/[name]-[hash13].[ext]' \
  --asset-naming='assets/[name]-[hash13].[ext]' \
  --chunk-naming='assets/[name]-[hash13].[ext]' \
  --outdir=dist --target=browser --minify \
  --define process.env.NODE_ENV='\"production\"' --env='BUN_PUBLIC_*' \
  --metafile=./mtl-meta.json # this file is needed to build index.html !! we need it to determine the output filename of our web worker script.

# then we can build our index.html
NODE_ENV=production bun build ./src/index.html \
  --entry-naming='versions/latest.html' \
  --asset-naming='assets/[name]-[hash13].[ext]' \
  --chunk-naming='assets/[name]-[hash13].[ext]' \
  --outdir=dist --target=browser --minify \
  --define process.env.NODE_ENV='\"production\"' --env='BUN_PUBLIC_*' \
  --metafile=./dist/versions/$(git rev-parse HEAD)-meta.json

# copy pyodide
cp -r ./src/mtl-checker/assets/pyodide-* dist/assets/

# add immutable entry point
cp dist/versions/latest.html dist/versions/$(git rev-parse HEAD).html

cp src/landing_page.html dist/index.html
