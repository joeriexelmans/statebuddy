# Manual - StateBuddy

## Editor

### Mouse

 * left mouse button to *select, move, resize*
 * right mouse button to *insert* new states, transitions, etc.
 * middle mouse button only to *select*

### Syntax

 * transition labels always have the form `trigger [guard] / action0; action1; action2`
    * example: `buttonPressed [t == 0] / t=3; ^start`
    * example: `after 2s / ^ringBell`
 * action language
    * expressions
       * literals
          * `3` numbers
          * `true`, `false` booleans
          * `"hello world"` strings
       * `x` variable references
       * unary operators
          * `!` logical not
          * `-` numerical negate
       * binary operators
          * `==` equals
          * `!=` not equals
          * `>`, `<`, `<=`, `>=` comparison
          * `+`, `-` sum, difference
    * actions
      * `x = 5` variable assignment
      * `^o` raise output event
 * internal event names start with `_` (underscore)
