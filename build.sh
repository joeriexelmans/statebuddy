# I could have put all of this in package.json but it would be quite unreadable.
# So here it is, as a shell script.

# clean up
rm -rf dist/*

sh genparser.sh

# build
bun --run vite build --mode production

# add immutable entry point
# we don't use the git commit hash because there may be uncommitted changes.
# instead we hash the build output's entry point.
mkdir -p dist/permalink
HASH=$(sha1sum dist/tags/latest.html)
cp dist/tags/latest.html       dist/permalink/${HASH:0:40}.html

# add/update mutable entry points
cp dist/tags/latest.html       dist/tags/mosis26.html
cp dist/tags/latest.html       dist/tags/nova01.html
