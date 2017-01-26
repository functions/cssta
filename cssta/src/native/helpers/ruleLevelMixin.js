const extractRules = require('../extractRules');
const { isDynamic, createStaticRule, createDynamicRule } = require('./util');

module.exports = (inputCss, { validate, propTypes }) => {
  const { rules, importedVariables } = extractRules(inputCss);

  const isValidRuleLevelMixin = rules.every(rule => rule.selector === '&');
  if (!isValidRuleLevelMixin) throw new Error('Incorrect use of mixin');

  rules.forEach((rule) => {
    rule.validate = validate; // eslint-disable-line
  });

  return isDynamic(rules, importedVariables)
    ? {
      type: 'dynamic',
      rules: rules.map(rule => createDynamicRule(rule, validate)),
      propTypes,
      importedVariables,
    } : {
      type: 'static',
      rules: rules.map(rule => createStaticRule(rule, validate)),
      propTypes,
    };
};
