# script to re-generate and re-build parser for action language
# only needs to be run after making changes to the grammar.js file

cd src/languages/actionlang/parser

echo "actionlang ..."

echo "generate parser ..."
tree-sitter generate --js-runtime bun

echo "compile parser ..."
wasm32-unknown-wasip1-clang -shared -fPIC -Os -nostdlib \
  -I src \
  -Wl,--no-entry \
  -Wl,--allow-undefined \
  -Wl,--export=tree_sitter_actionlang \
  -o parser.wasm \
  src/parser.c

cd -

cd src/languages/statecharts/text/parser

echo "transitionlabel ..."

echo "generate parser ..."
tree-sitter generate --js-runtime bun

echo "compile parser ..."
wasm32-unknown-wasip1-clang -shared -fPIC -Os -nostdlib \
  -I src \
  -Wl,--no-entry \
  -Wl,--allow-undefined \
  -Wl,--export=tree_sitter_sctext \
  -o parser.wasm \
  src/parser.c
