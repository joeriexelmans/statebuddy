# NOW=$(date +%s)

bun run build

# copy assets (browsers should cache these pretty much indefinitely)
aws s3 cp \
  --recursive \
  --storage-class ONEZONE_IA \
  --cache-control "public, max-age=31536000, immutable" \
  dist/assets s3://statebuddy/assets

# commits are also immutable
aws s3 cp \
  --recursive \
  --storage-class ONEZONE_IA \
  --cache-control "public, max-age=31536000, immutable" \
  dist/commits s3://statebuddy/commits

# tags are mutable
aws s3 cp \
  --recursive \
  --storage-class ONEZONE_IA \
  --cache-control "public, max-age=30" \
  dist/tags s3://statebuddy/tags

# landing page is also mutable
aws s3 cp \
  --recursive \
  --storage-class ONEZONE_IA \
  --cache-control "public, max-age=30" \
  dist/index.html s3://statebuddy/index.html

