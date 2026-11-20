# NOW=$(date +%s)

bun run build

# copy assets (browsers should cache these pretty much indefinitely)
aws s3 sync \
  --storage-class ONEZONE_IA \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude '*.js.map' \
  --no-overwrite \
  dist/assets s3://statebuddy/assets

# commits *should* be immutable, but only if our git tree is clean (no uncommitted changes) ...
# since this involves not a lot of data, let's always overwrite it.
aws s3 sync \
  --storage-class ONEZONE_IA \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude '*-meta.json' \
  dist/commits s3://statebuddy/commits

# tags are mutable
aws s3 cp \
  --recursive \
  --storage-class ONEZONE_IA \
  --cache-control "public, max-age=30" \
  dist/tags s3://statebuddy/tags

# landing page is also mutable
aws s3 cp \
  --storage-class ONEZONE_IA \
  --cache-control "public, max-age=30" \
  dist/index.html s3://statebuddy/index.html
