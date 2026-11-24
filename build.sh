# I could have put all of this in package.json but it would be quite unreadable.
# So here it is, as a shell script.

# clean up
rm -rf dist/*

# build
bun --run vite build --mode production

# add immutable entry point
mkdir -p dist/commits
cp dist/tags/latest.html       dist/commits/$(git rev-parse HEAD).html

# add/update mutable entry points
cp dist/tags/latest.html       dist/tags/mosis26.html
cp dist/tags/latest.html       dist/tags/nova01.html
