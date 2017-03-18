// @flow
/*:: import type { BaseVariableWithValidator } from './types' */

module.exports.getAppliedRules = /*:: <T: BaseVariableWithValidator> */ (
  rules /*: T[] */,
  ownProps /*: Object */
) /*: T[] */ =>
  rules.filter(rule => (rule.validate ? rule.validate(ownProps) : true));
