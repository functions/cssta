const extractRules = require('../extractRules');
const { createValidatorForSelector } = require('../selectorTransform');
const { isDynamic, createStaticRule, createDynamicRule } = require('./util');

module.exports = (inputCss) => {
  const { rules, propTypes, importedVariables } = extractRules(inputCss);

  return isDynamic(rules, importedVariables)
    ? {
      type: 'dynamic',
      rules: rules.map(rule => createDynamicRule(rule, createValidatorForSelector(rule.selector))),
      propTypes,
      importedVariables,
    } : {
      type: 'static',
      rules: rules.map(rule => createStaticRule(rule, createValidatorForSelector(rule.selector))),
      propTypes,
    };
};
