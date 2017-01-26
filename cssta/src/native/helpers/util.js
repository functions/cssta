const cssToReactNative = require('css-to-react-native').default;

module.exports.isDynamic = (rules, importedVariables) =>
  Object.keys(importedVariables).length !== 0 &&
  rules.some(rule => Object.keys(rule.exportedVariables).length !== 0);

module.exports.createStaticRule = (rule, validate) => ({
  validate,
  style: cssToReactNative(rule.styleTuples),
});

module.exports.createDynamicRule = (rule, validate) => ({
  validate,
  styleTuples: rule.styleTuples,
  exportedVariables: rule.exportedVariables,
});
