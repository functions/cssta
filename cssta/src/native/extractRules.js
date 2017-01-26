/* eslint-disable no-param-reassign */
const getRoot = require('../util/getRoot');
const { varRegExp, varRegExpNonGlobal } = require('../util');

const variableRegExp = /^--/;

const getStyleDeclarations = nodes => nodes
  .filter(node => node.type === 'decl' && !variableRegExp.test(node.prop));

/*
In the babel plugin, we replace all interpolations in template strings with comments indicating
a substitution:

`border: 1px solid ${color};` => `border: 1px solid /*cssta-substitution-1*\/;

(Note I had to escape the comment close)

If a comment is present, it can be picked up in `node.raws.value.raw`, which in the case above
gives,

`: 1px solid /*cssta-substitution-1*\/`;

We have replace all non-cssta-substitution comments if we use the raw value. The RegExp is awful.
*/
const defaultGetValue = node => node.value;

const getStyleTuples = (nodes, getValue) => getStyleDeclarations(nodes)
  .map(node => [node.prop, getValue(node)]);

const getExportedVariables = (nodes, getValue) => nodes
  .filter(node => node.type === 'decl' && variableRegExp.test(node.prop))
  .reduce((accum, node) => {
    accum[node.prop.substring(2)] = getValue(node);
    return accum;
  }, {});

const getImportedVariables = (nodes, getValue) => getStyleDeclarations(nodes)
  .reduce((accum, decl) => {
    const referencedVariableMatches = getValue(decl).match(varRegExp);
    if (!referencedVariableMatches) return accum;

    const referencedVariables = referencedVariableMatches
      .map(match => match.match(varRegExpNonGlobal)[1]);

    return accum.concat(referencedVariables);
  }, []);

// We have to be able to customise getValue in babel-plugin-cssta
const extractRulesFromRoot = (root, getValue = defaultGetValue) => {
  const rules = [];

  root.walkRules((node) => {
    rules.push({
      selector: node.selector,
      styleTuples: getStyleTuples(node.nodes, getValue),
      exportedVariables: getExportedVariables(node.nodes, getValue),
      importedVariables: getImportedVariables(node.nodes, getValue),
    });
  });

  const importedVariables = rules.reduce((outerAccum, rule) => (
    rule.importedVariables.reduce((innerAccum, importedVariable) => (
      innerAccum.indexOf(importedVariable) === -1
        ? innerAccum.concat([importedVariable])
        : innerAccum
    ), outerAccum)
  ), []);

  return { rules, importedVariables };
};

module.exports = (inputCss) => {
  const { root, propTypes } = getRoot(inputCss);
  const { rules, importedVariables } = extractRulesFromRoot(root);
  return { rules, propTypes, importedVariables };
};
module.exports.extractRulesFromRoot = extractRulesFromRoot;
