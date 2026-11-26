// Tree-sitter grammar for action language
//    https://tree-sitter.github.io/tree-sitter/
//
// Supports expressions (binary, unary operators, literals), variable assignment (including destructuring assignment)
//
// Examples of text that can be parsed:
//     x = 1 + 2 * y;
//     {a, b: [c, d]} = f(x);
//     [first, second] = items

const PREC = {
  compare: 1,
  sum: 2,
  product: 3,
  unary: 4,
  call: 5,
};

const commaSep = (rule) =>
  optional(seq(rule, repeat(seq(',', rule)), optional(',')));

export default grammar({
  name: 'actionlang',
  // extras: (_) => [/\s/],
  rules: {
    // zero or more assignments separated by ';' (trailing ';' allowed)
    start: ($) =>
      optional(seq($.assignment, repeat(seq(';', $.assignment)), optional(';'))),

    assignment: ($) =>
      seq(field('left', $._lhs), '=', field('right', $._expression)),

    // ───────────── left-hand side of an assignment ─────────────

    _lhs: ($) =>
      choice($.lhs_dict, $.lhs_array, $.identifier, $._literal),

    lhs_dict: ($) => seq('{', commaSep($.dict_field), '}'),

    // `{x}` is shorthand for `{x: x}`
    dict_field: ($) =>
      seq(
        field('key', $.identifier),
        optional(seq(':', field('value', $._lhs))),
      ),

    lhs_array: ($) => seq('[', commaSep($._lhs), ']'),

    // ───────────── expressions ─────────────

    _expression: ($) => choice(
      $.binary_expression,
      $.unary_expression,
      $.call_expression,
      $._atom,
    ),

    binary_expression: ($) => {
      /** @type {[number, string[]][]} */
      const table = [
        [PREC.compare, ['==', '!=', '<=', '>=', '<', '>']],
        [PREC.sum, ['+', '-', '||', '++']],
        [PREC.product, ['*', '/', '%', '&&']],
      ];
      return choice(
        ...table.map(([precedence, operators]) =>
          prec.left(
            precedence,
            seq(
              field('left', $._expression),
              field('operator', choice(...operators)),
              field('right', $._expression),
            ),
          ),
        ),
      );
    },

    // one prefix operator applied to an atom
    unary_expression: ($) =>
      prec(
        PREC.unary,
        seq(field('operator', choice('!', '-')), field('operand', $._atom)),
      ),

    _atom: ($) =>
      choice(
        $.parenthesized_expression,
        $._literal,
        $.identifier,
        $.dict,
        $.array,
      ),

    call_expression: ($) =>
      seq(
        field('function', $._expression),
        field('argument', $.parenthesized_expression),
      ),

    parenthesized_expression: ($) => seq('(', $._expression, ')'),

    // `{x}` is shorthand for `{x: x}`
    dict: ($) => seq('{', commaSep($.dict_field), '}'),

    dict_field: ($) =>
      seq(
        field('key', $.identifier),
        optional(seq(':', field('value', $._expression))),
      ),

    array: ($) => seq('[', commaSep($._expression), ']'),

    // ───────────── lexical ─────────────

    _literal: ($) => choice($.number, $.boolean, $.string),

    number: (_) => /[0-9]+/,

    boolean: (_) => choice('True', 'False'),

    string: (_) => token(seq('"', /[^"]*/, '"')),

    identifier: (_) => /[a-z_][a-zA-Z0-9_]*/,
  },
});