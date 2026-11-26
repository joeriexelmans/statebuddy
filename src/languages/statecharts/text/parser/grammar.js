// Tree-sitter grammar for transition labels
//   https://tree-sitter.github.io/tree-sitter/

import actionLangGrammar from "../../../actionlang/parser/grammar";

export default grammar(actionLangGrammar, {
  name: 'text_grammar',
  // extras: ($, previous) => [...previous, $.comment],
  rules: {
    start: $ => field('text',
      choice(
        $.tag,
        $.comment,
        $.label,
        // Workaround: 'trigger' in 'label' is also optional, but then label can match the empty string, and tree-sitter doesn't allow this. So we add a separate rule where the trigger is absent and the guard must be present.
        $.triggerlesslabel,
        // Same workaround as above, for the case where there is neither a trigger nor a guard.
        $.actiononlylabel,
      )),
    label: $ => seq(
      field('trigger', $._trigger),
      optional(seq('[', field('guard', $._expression), ']')),
      optional(seq('/', field('actions', $.actions)))),
    triggerlesslabel: $ => seq(
      seq('[', field('guard', $._expression), ']'),
      optional(seq('/', field('actions', $.actions)))),
    actiononlylabel: $ => seq(
      seq('/', field('actions', $.actions))),
    _trigger: $ => choice(
      prec(1, $.afterTrigger),
      prec(2, $.entryTrigger),
      prec(3, $.exitTrigger),
      prec(4, $.eventTrigger),
    ),
    afterTrigger: $ => seq(
      field('after', 'after'),
      field('duration', $.number),
      field('unit', choice('ms', 's')),
    ),
    entryTrigger: $ => 'entry',
    exitTrigger: $ => 'exit',
    eventTrigger: $ => seq(
      field('event', $.identifier),
      optional(seq('(', field('param', $._lhs), ')')),
    ),
    actions: $ => seq(
      field('action', $._action),
      repeat(seq(';', field('action', $._action))),
      optional(';')),
    _action: $ => choice($.assignment, $.raise),
    raise: $ => seq('^',
      field('event', $.identifier),
      optional(seq('(', field('param', $._expression), ')')),
    ),
    comment: $ => seq('//', /[\s\S]*/), // comment reaches until the end of the input (not at a newline)
    tag: $ => seq('#', $.identifier),

    _atom: $ => choice(
      $.parenthesized_expression,
      $.tag,
      $._literal,
      $.identifier,
      $.dict,
      $.array,
    )
  }
});