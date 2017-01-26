const postcss = require('postcss');
const t = require('babel-types');
const _ = require('lodash/fp');
const { getCsstaTypeForCallee } = require('../util');


const interpolationTypes = {
  ALLOW: 0,
  IGNORE: 1,
  DISALLOW: 2,
};

const csstaConstructorExpressionTypes = {
  CallExpression: node => [node.callee, node.arguments[0]],
  MemberExpression: node => [
    node.object,
    node.computed ? node.property : t.stringLiteral(node.property.name),
  ],
};

module.exports.getCsstaReferences = (path, node) => {
  if (!(node.type in csstaConstructorExpressionTypes)) return null;

  const [callee, component] = csstaConstructorExpressionTypes[node.type](node);

  const csstaTypeParts = getCsstaTypeForCallee(path, callee);
  if (!csstaTypeParts) return null;

  const { csstaType, importBinding } = csstaTypeParts;

  return { callee, importBinding, component, csstaType };
};

module.exports.interpolationTypes = interpolationTypes;

const getSubstitutionName = node => `/*${node.text}*/`;
module.exports.getSubstitutionName = getSubstitutionName;
const isMixinSubstitition = (substitutionMap, node) =>
  node.type === 'comment' && getSubstitutionName(node) in substitutionMap;
module.exports.isMixinSubstitition = isMixinSubstitition;

module.exports.extractCsstaCallParts = (stringArg, interpolationType) => {
  if (!t.isTemplateLiteral(stringArg) && !t.isStringLiteral(stringArg)) return null;

  const hasInterpolation = t.isTemplateLiteral(stringArg) && !_.isEmpty(stringArg.expressions);

  if (hasInterpolation && interpolationType === interpolationTypes.DISALLOW) {
    const ex = '`color: ${primary}`'; // eslint-disable-line
    throw new Error(`You cannot interpolation in template strings (i.e. ${ex})`);
  }

  const allowInterpolation = interpolationType === interpolationTypes.ALLOW;

  let cssText = null;
  let substitutionMap = {};

  if (t.isTemplateLiteral(stringArg) && (allowInterpolation || !hasInterpolation)) {
    const { quasis, expressions } = stringArg;
    const substitutionNames = expressions.map((value, index) => `/*cssta-substitution-${index}*/`);
    cssText =
      quasis[0].value.cooked +
      substitutionNames.map((name, index) => name + quasis[index + 1].value.cooked).join('');
    substitutionMap = _.fromPairs(_.zip(substitutionNames, expressions));
  } else if (t.isStringLiteral(stringArg)) {
    cssText = stringArg.value;
  }

  if (cssText === null) return null;

  return { cssText, substitutionMap };
};

module.exports.fixSubstitutions = (substitutionMap, root) => {
  root.walkDecls((decl) => {
    // eslint-disable-next-line
    decl.value = ((decl.raws.between || '') + (decl.raws.value ? decl.raws.value.raw : decl.value))
      .replace(/^:\s*/, '')
      .replace(/\/\*(?!cssta-substitution-)(?:[^*]|\*(?!\/))*\*\//g, '');
  });
};
