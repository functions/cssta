/* eslint-disable no-param-reassign */
const t = require('babel-types');
const postcss = require('postcss');
const { parse } = require('babylon');
const _ = require('lodash/fp');
const { getValidatorSourceForSelector } = require('cssta/src/native/selectorTransform');
const resolveVariableDependencies = require('cssta/src/util/resolveVariableDependencies');
const { transformRoot } = require('cssta/src/util/getRoot');
const { extractRulesFromRoot } = require('cssta/src/native/extractRules');
const { default: cssToReactNative, getPropertyName } = require('css-to-react-native');
const {
  getOrCreateImportReference, jsonToNode, containsSubstitution, getSubstitutionRegExp,
} = require('../util');

const SIMPLE_OR_NO_INTERPOLATION = 0;
const TEMPLATE_INTERPOLATION = 1;

const convertValue = transform => value => t.callExpression(t.identifier(transform), [value]);

const createValidatorNodeForSelector = selector =>
  parse(getValidatorSourceForSelector(selector)).program.body[0].expression;

const stringInterpolation = value =>
  t.callExpression(t.memberExpression(convertValue('String')(value), t.identifier('trim')), []);

const numberInterpolation = convertValue('Number');

/*
All the values we can work out easily.

E.g.
fontSize: ${value} can only be a number -> { fontSize: Number(value) }
position: ${value} can only be a string -> { position: String(value).trim() }

Some values, like 'margin', have shorthands, so cannot be included.
*/
const simpleInterpolation = {
  /* View */
  backfaceVisibility: stringInterpolation,
  background: stringInterpolation,
  backgroundColor: stringInterpolation,
  borderBottomColor: stringInterpolation,
  borderBottomLeftRadius: numberInterpolation,
  borderBottomRightRadius: numberInterpolation,
  borderBottomWidth: numberInterpolation,
  borderLeftColor: stringInterpolation,
  borderLeftWidth: numberInterpolation,
  borderRightColor: stringInterpolation,
  borderRightWidth: numberInterpolation,
  borderTopColor: stringInterpolation,
  borderTopLeftRadius: numberInterpolation,
  borderTopRightRadius: numberInterpolation,
  borderTopWidth: numberInterpolation,
  opacity: numberInterpolation,
  elevation: numberInterpolation,
  /* Layout */
  alignItems: stringInterpolation,
  alignSelf: stringInterpolation,
  bottom: numberInterpolation,
  flexBasis: numberInterpolation,
  flexDirection: stringInterpolation,
  flexGrow: numberInterpolation,
  flexShrink: numberInterpolation,
  flexWrap: stringInterpolation,
  height: numberInterpolation,
  justifyContent: stringInterpolation,
  left: numberInterpolation,
  marginBottomWidth: numberInterpolation,
  marginLeftWidth: numberInterpolation,
  marginRightWidth: numberInterpolation,
  marginTopWidth: numberInterpolation,
  maxHeight: numberInterpolation,
  maxWidth: numberInterpolation,
  minHeight: numberInterpolation,
  minWidth: numberInterpolation,
  overflow: stringInterpolation,
  paddingBottomWidth: numberInterpolation,
  paddingLeftWidth: numberInterpolation,
  paddingRightWidth: numberInterpolation,
  paddingTopWidth: numberInterpolation,
  position: stringInterpolation,
  right: numberInterpolation,
  top: numberInterpolation,
  width: numberInterpolation,
  zIndex: numberInterpolation,
  /* Text */
  color: stringInterpolation,
  fontSize: numberInterpolation,
  fontStyle: stringInterpolation,
  fontWeight: stringInterpolation,
  lineHeight: numberInterpolation,
  textAlign: stringInterpolation,
  textDecorationLine: stringInterpolation,
  textShadowColor: stringInterpolation,
  textShadowRadius: numberInterpolation,
  textAlignVertical: stringInterpolation,
  letterSpacing: numberInterpolation,
  textDecorationColor: stringInterpolation,
  textDecorationStyle: stringInterpolation,
  writingDirection: stringInterpolation,
};

const getInterpolationType = (substitutionMap, [prop, value]) => {
  if (!containsSubstitution(substitutionMap, value)) {
    return SIMPLE_OR_NO_INTERPOLATION;
  } else if (getPropertyName(prop) in simpleInterpolation) {
    return SIMPLE_OR_NO_INTERPOLATION;
  }
  return TEMPLATE_INTERPOLATION;
};

const getStringWithSubstitutedValues = (substitutionMap, value) => {
  /* Don't attempt to optimise `${value}`: it converts to a string and we need that */
  const allValues = !_.isEmpty(substitutionMap)
    ? _.chunk(2, value.split(getSubstitutionRegExp(substitutionMap)))
    : [[value]];
  const quasiValues = _.map(0, allValues);
  const expressionValues = _.dropLast(1, _.map(1, allValues));

  if (_.isEmpty(expressionValues)) return t.stringLiteral(quasiValues[0]);

  const quasis = [].concat(
    _.map(raw => t.templateElement({ raw }), _.initial(quasiValues)),
    t.templateElement({ raw: _.last(quasiValues) }, true)
  );
  const expressions = _.map(_.propertyOf(substitutionMap), expressionValues);

  return t.templateLiteral(quasis, expressions);
};

const createStaticStyleSheetBody = (path, substitutionMap, rule) => {
  const styleGroups = _.reduce((groups, styleTuple) => {
    const interpolationType = getInterpolationType(substitutionMap, styleTuple);
    const lastGroup = _.last(groups);

    if (_.get('interpolationType', lastGroup) === interpolationType) {
      lastGroup.styleTuples.push(styleTuple);
    } else {
      groups.push({ interpolationType, styleTuples: [styleTuple] });
    }

    return groups;
  }, [], rule.styleTuples);

  const transformedGroups = _.map(({ styleTuples, interpolationType }) => {
    if (interpolationType === SIMPLE_OR_NO_INTERPOLATION) {
      const styleMap = _.reduce((accum, [prop, value]) => {
        const propertyName = getPropertyName(prop);
        const substitution = substitutionMap[value.trim()];

        if (substitution) {
          return _.set(propertyName, simpleInterpolation[propertyName](substitution), accum);
        } else if (!containsSubstitution(substitutionMap, value)) {
          const styles = cssToReactNative([[propertyName, value]]);
          const styleToValue = _.mapValues(jsonToNode, styles);
          return _.assign(accum, styleToValue);
        }

        throw new Error(`Used multiple values ${propertyName}, which accepts one value`);
      }, {}, styleTuples);

      return t.objectExpression(_.map(([key, value]) => (
        t.objectProperty(t.stringLiteral(key), value)
      ), _.toPairs(styleMap)));
    }

    const cssToReactNativeReference = getOrCreateImportReference(
      path,
      'css-to-react-native',
      'default'
    );

    const bodyPairs = t.arrayExpression(_.map(([prop, value]) => t.arrayExpression([
      t.stringLiteral(getPropertyName(prop)),
      getStringWithSubstitutedValues(substitutionMap, value),
    ]), styleTuples));

    return t.callExpression(cssToReactNativeReference, [bodyPairs]);
  }, styleGroups);

  if (_.isEmpty(transformedGroups)) {
    return null;
  } else if (transformedGroups.length === 1) {
    return transformedGroups[0];
  }
  return t.callExpression(
    t.memberExpression(t.identifier('Object'), t.identifier('assign')),
    transformedGroups
  );
};

const createStaticStylesheet = (path, substitutionMap, rules) => {
  let i = 0;
  const getStyleName = () => {
    const value = i;
    i += 1;
    return value;
  };

  const styleSheetReference = path.scope.generateUidIdentifier('csstaStyle');

  const ruleBases = _.flow(
    _.map(rule => _.set('styleBody', createStaticStyleSheetBody(path, substitutionMap, rule), rule)),
    _.filter(rule => rule.styleBody),
    _.map(_.update('styleName', getStyleName))
  )(rules);

  const rulesBody = t.arrayExpression(_.map(({ selector, styleName }) => t.objectExpression([
    t.objectProperty(
      t.stringLiteral('validate'),
      createValidatorNodeForSelector(selector)
    ),
    t.objectProperty(
      t.stringLiteral('style'),
      t.memberExpression(styleSheetReference, t.numericLiteral(styleName), true)
    ),
  ]), ruleBases));

  const reactNativeStyleSheetRef = getOrCreateImportReference(
    path,
    'react-native',
    'StyleSheet'
  );

  const styleSheetBody = t.objectExpression(_.map(({ styleName, styleBody }) => (
    t.objectProperty(t.numericLiteral(styleName), styleBody)
  ), ruleBases));

  const stylesheetIsEmpty = _.isEmpty(ruleBases);

  const value = stylesheetIsEmpty
    ? t.nullLiteral()
    : t.callExpression(
      t.memberExpression(reactNativeStyleSheetRef, t.identifier('create')),
      [styleSheetBody]
    );

  const styleSheetElement = t.variableDeclaration('var', [
    t.variableDeclarator(styleSheetReference, value),
  ]);

  return { rulesBody, styleSheetElement, stylesheetIsEmpty };
};

const createStyleTuples = (substitutionMap, { styleTuples }) => (
  t.arrayExpression(_.map(([prop, value]) => (
    t.arrayExpression([
      t.stringLiteral(getPropertyName(prop)),
      getStringWithSubstitutedValues(substitutionMap, value),
    ])
  ), styleTuples))
);

const createDynamicRulesBody = (substitutionMap, rules) => (
  t.arrayExpression(_.map(rule => t.objectExpression([
    t.objectProperty(
      t.stringLiteral('validate'),
      createValidatorNodeForSelector(rule.selector)
    ),
    t.objectProperty(
      t.stringLiteral('styleTuples'),
      createStyleTuples(substitutionMap, rule)
    ),
    t.objectProperty(
      t.stringLiteral('exportedVariables'),
      jsonToNode(rule.exportedVariables)
    ),
  ]), rules))
);

const getSubstitutionName = node => `/*${node.text}*/`;

const isMixinSubstitition = (substitutionMap, node) =>
  node.type === 'comment' && getSubstitutionName(node) in substitutionMap;

module.exports = (path, state, component, cssText, substitutionMap) => {
  const { singleSourceOfVariables } = state;
  const root = postcss.parse(cssText);

  const INTERMEDIATE_ROOT_WITH_DECLS = 0;
  const INTERMEDIATE_ROOT_STATIC_OR_DYNAMIC = 1;

  const RESOLVED_STATIC_ROOT = 2;
  const RESOLVED_DYNAMIC_ROOT = 3;
  const TOP_LEVEL_MIXIN = 4;
  const RULE_LEVEL_MIXIN = 5;

  const rootParts = _.flow(
    _.reduce((accum, node) => {
      if (isMixinSubstitition(substitutionMap, node)) {
        accum.push({
          type: TOP_LEVEL_MIXIN,
          data: { substitution: getSubstitutionName(node) },
          propTypes: null,
        });
      } else if (_.get('type', _.last(accum)) !== INTERMEDIATE_ROOT_WITH_DECLS) {
        accum.push({
          type: INTERMEDIATE_ROOT_WITH_DECLS,
          data: { nodes: [node] },
          propTypes: null,
        });
      } else {
        _.last(accum).data.nodes.push(node);
      }
      return accum;
    }, []),
    _.flatMap((rootPart) => {
      if (rootPart.type !== INTERMEDIATE_ROOT_WITH_DECLS) return rootPart;

      const RESOLVED_RULE = 0;
      const RULE_MIXIN = 1;

      const nextRuleParts = [];

      // FIXME: All the decls don't have a root associated with them
      // We just reparse to fix this, but this is a hack
      const rootPartRoot = postcss.parse(String(postcss.root({ nodes: rootPart.data.nodes })));
      const { root: nextRoot, propTypes: nextPropTypes } = transformRoot(rootPartRoot);
      nextRoot.walkRules((ruleNode) => {
        ruleNode.nodes.forEach((node) => {
          if (isMixinSubstitition(substitutionMap, node)) {
            nextRuleParts.push({
              type: RULE_MIXIN,
              selector: ruleNode.selector,
              data: { substitution: getSubstitutionName(node) },
            });
          } else if (
            _.get('type', _.last(nextRuleParts)) !== RESOLVED_RULE ||
            _.get('selector', _.last(nextRuleParts)) !== node.selector
          ) {
            nextRuleParts.push({
              type: RESOLVED_RULE,
              selector: ruleNode.selector,
              data: { nodes: [node] },
            });
          } else {
            _.last(nextRuleParts).data.nodes.push(node);
          }
        });
      });

      const nextRootParts = _.reduce((accum, rulePart) => {
        const lastRootPartRule = _.last(_.get(['data', 'rules'], _.last(accum)));

        if (rulePart.type === RULE_MIXIN) {
          accum.push({
            type: RULE_LEVEL_MIXIN,
            data: { selector: rulePart.selector, substitution: rulePart.data.substitution },
            propTypes: nextPropTypes,
          });
        } else if (_.get('type', _.last(accum)) !== INTERMEDIATE_ROOT_STATIC_OR_DYNAMIC) {
          accum.push({
            type: INTERMEDIATE_ROOT_STATIC_OR_DYNAMIC,
            data: { rules: [{ selector: rulePart.selector, nodes: rulePart.data.nodes }] },
            propTypes: nextPropTypes,
          });
        } else if (_.get('selector', lastRootPartRule) !== rulePart.selector) {
          _.last(accum).data.rules.push({
            selector: rulePart.selector,
            nodes: rulePart.data.nodes,
          });
        } else {
          lastRootPartRule.nodes = lastRootPartRule.nodes.concat(rulePart.data.nodes);
        }
        return accum;
      }, [], nextRuleParts);

      return nextRootParts;
    }),
    _.map((rootPart) => {
      if (rootPart.type !== INTERMEDIATE_ROOT_STATIC_OR_DYNAMIC) return rootPart;

      const ruleNodes = _.map(rule => (
        postcss.rule({ selector: rule.selector, nodes: rule.nodes })
      ), rootPart.data.rules);

      const rootPartRoot = postcss.root({ nodes: ruleNodes });
      // We have to do this to preserve comments from substitions
      const { rules, importedVariables } = extractRulesFromRoot(rootPartRoot, node => (
        ((node.raws.between || '') + (node.raws.value ? node.raws.value.raw : node.value))
          .replace(/^:\s*/, '')
          .replace(/\/\*(?!cssta-substitution-)(?:[^*]|\*(?!\/))*\*\//g, '')
      ));

      const exportedVariables = _.reduce(_.assign, {}, _.map('exportedVariables', rules));
      const exportsVariables = !_.isEmpty(exportedVariables);

      const resolvedVariables = (singleSourceOfVariables && exportsVariables)
        ? resolveVariableDependencies(exportedVariables, {})
        : null;
      if (resolvedVariables && !_.isEqual(resolvedVariables, singleSourceOfVariables)) {
        throw new Error('When using singleSourceOfVariables, only one component can define variables');
      }

      const type = (singleSourceOfVariables || (!exportsVariables && _.isEmpty(importedVariables)))
        ? RESOLVED_STATIC_ROOT
        : RESOLVED_DYNAMIC_ROOT;

      const propTypes = rootPart.propTypes;
      return { type, data: { rules, importedVariables }, propTypes };
    })
  )(root.nodes);

  if (_.isEmpty(rootParts)) {
    const staticComponent = getOrCreateImportReference(
      path,
      'cssta/dist/native/staticComponent',
      'default'
    );

    const newElement = t.callExpression(staticComponent, [
      component,
      t.arrayExpression([]),
      t.arrayExpression([]),
    ]);

    path.replaceWith(newElement);
  } else if (rootParts.length === 1 && rootParts[0].type === RESOLVED_STATIC_ROOT) {
    const { data: { rules }, propTypes } = rootParts[0];
    const {
      rulesBody, styleSheetElement, stylesheetIsEmpty,
    } = createStaticStylesheet(path, substitutionMap, rules);

    const staticComponent = getOrCreateImportReference(
      path,
      'cssta/dist/native/staticComponent',
      'default'
    );

    const newElement = t.callExpression(staticComponent, [
      component,
      jsonToNode(Object.keys(propTypes)),
      rulesBody,
    ]);

    path.replaceWith(newElement);
    if (!stylesheetIsEmpty) path.insertBefore(styleSheetElement);
  } else if (rootParts.length === 1 && rootParts[0].type === RESOLVED_DYNAMIC_ROOT) {
    const { data: { rules, importedVariables }, propTypes } = rootParts[0];
    const rulesBody = createDynamicRulesBody(substitutionMap, rules);

    const dynamicComponent = getOrCreateImportReference(
      path,
      'cssta/dist/native/dynamicComponent',
      'default'
    );

    const newElement = t.callExpression(dynamicComponent, [
      component,
      jsonToNode(Object.keys(propTypes)),
      jsonToNode(importedVariables),
      rulesBody,
    ]);

    path.replaceWith(newElement);
  } else {
    const parts = _.map((rootPart) => {
      if (rootPart.type === RESOLVED_STATIC_ROOT) {
        const { data: { rules }, propTypes } = rootPart;
        const {
          rulesBody, styleSheetElement, stylesheetIsEmpty,
        } = createStaticStylesheet(path, substitutionMap, rules);

        if (!stylesheetIsEmpty) path.insertBefore(styleSheetElement);

        return t.objectExpression([
          t.objectProperty(
            t.stringLiteral('type'),
            t.stringLiteral('static')
          ),
          t.objectProperty(
            t.stringLiteral('rules'),
            rulesBody
          ),
          t.objectProperty(
            t.stringLiteral('propTypes'),
            jsonToNode(Object.keys(propTypes))
          ),
        ]);
      } else if (rootPart.type === RESOLVED_DYNAMIC_ROOT) {
        const { data: { rules, importedVariables }, propTypes } = rootPart;

        const rulesBody = createDynamicRulesBody(substitutionMap, rules);
        return t.objectExpression([
          t.objectProperty(
            t.stringLiteral('type'),
            t.stringLiteral('dynamic')
          ),
          t.objectProperty(
            t.stringLiteral('rules'),
            rulesBody
          ),
          t.objectProperty(
            t.stringLiteral('propTypes'),
            jsonToNode(Object.keys(propTypes))
          ),
          t.objectProperty(
            t.stringLiteral('importedVariables'),
            jsonToNode(importedVariables)
          ),
        ]);
      } else if (rootPart.type === RULE_LEVEL_MIXIN) {
        const selector = rootPart.data.selector;
        const ruleLevelMixinArg = t.objectExpression([
          t.objectProperty(
            t.stringLiteral('validate'),
            createValidatorNodeForSelector(selector)
          ),
          t.objectProperty(
            t.stringLiteral('propTypes'),
            jsonToNode(Object.keys(rootPart.propTypes))
          ),
        ]);

        const ruleLevelMixin = getOrCreateImportReference(
          path,
          'cssta/dist/native/helpers/ruleLevelMixin',
          'default'
        );

        return t.callExpression(ruleLevelMixin, [
          substitutionMap[rootPart.data.substitution],
          ruleLevelMixinArg,
        ]);
      } else if (rootPart.type === TOP_LEVEL_MIXIN) {
        const topLevelMixin = getOrCreateImportReference(
          path,
          'cssta/dist/native/helpers/topLevelMixin',
          'default'
        );

        return t.callExpression(topLevelMixin, [
          substitutionMap[rootPart.data.substitution],
        ]);
      }
      throw new Error('Could not resolve root part');
    }, rootParts);

    const createMixinParts = t.arrayExpression(parts);
    const createMixinComponent = getOrCreateImportReference(
      path,
      'cssta/dist/native/helpers/createComponent',
      'default'
    );

    const newElement = t.callExpression(createMixinComponent, [
      component,
      createMixinParts,
    ]);

    path.replaceWith(newElement);
  }
};

//
// EXAMPLE OF TRANSFORM
//

// `
//   ${'padding: 5px 0;'}

//   --color: red;
//   color: var(--color);

//   [setBg] {
//     background-color: var(--color),
//   }

//   [large] {
//     font-size: 18px;
//     ${'' /* no rules */}
//   }

//   [expanded] {
//     ${'margin: 5px 0'}
//   }
// `
// createMixinComponent([
//   mixinTopLevel(`
//     padding: 5px 0;
//   `),
//   {
//     type: 'DYNAMIC',
//     rules: [{
//       walidate: () => true,
//       styleTuples: [['color', 'var(--color)']],
//       exportedVariables: [{
//         color: 'red',
//       }],
//     }, {
//       walidate: p => !!p.setBg,
//       styleTuples: [['background-color', 'var(--color)']],
//       exportedVariables: [],
//     }],
//     propTypes: ['setBg'],
//     importedVariables: ['color'],
//   }, {
//     type: 'STATIC',
//     rules: [{
//       walidate: p => !!p.large,
//       style: <StyleSheet ref to> { fontSize: 18 },
//     }],
//     propTypes: ['large'],
//   },
//   mixinRule('' /* no rules */, {
//     walidate: p => !!p.large,
//     propTypes: ['large'],
//   }),
//   mixinRule(`
//     margin: 5px 0;
//   `, {
//     walidate: p => p.expanded,
//     propTypes: ['expanded'],
//   }),
// ]);
