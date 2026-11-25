# script to re-generate and re-build parser for action language
# only needs to be run after making changes to the grammar.js file

cd src/languages/actionlang/parser

tree-sitter generate --js-runtime bun

wasm32-unknown-wasip1-clang -shared -fPIC -Os -nostdlib \
  -I src \
  -Wl,--no-entry \
  -Wl,--allow-undefined \
  -Wl,--export=tree_sitter_action_language \
  -o parser.wasm \
  src/parser.c
