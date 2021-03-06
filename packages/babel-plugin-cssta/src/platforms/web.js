/* eslint-disable no-param-reassign */
const t = require('babel-types');
const _ = require('lodash/fp');
const extractRules = require('cssta/src/web/extractRules');
const cssNameGenerator = require('css-class-generator');
const { jsonToNode, getOrCreateImportReference } = require('../util');
const { startEndMarkers, fileStartEndCommentMarkers } = require('../webUtil');


// Make sure we don't somehow generate an animation name that's a keyword
// This is almost impossible anyway, but whatever
const animationKeywords = `
  alternate alternate-reverse backwards both ease ease-in ease-in-out ease-out forwards infinite
  linear none normal paused reverse running step-end step-start initial inherit unset
`.split(/[^\s]+/g);

let classGenerator = null;
let animationGenerator = null;

const resetGenerators = () => {
  classGenerator = cssNameGenerator();
  animationGenerator = (function* gen() {
    for (const value of cssNameGenerator()) { // eslint-disable-line
      if (!_.includes(value, animationKeywords)) yield value;
    }
  }());
};

resetGenerators();

module.exports = (path, state, component, cssText, substititionMap) => {
  if (!_.isEmpty(substititionMap)) {
    throw new Error('You cannot use interpolation in template strings (i.e. `color: ${primary}`)'); // eslint-disable-line
  }

  const isInjectGlobal = t.isStringLiteral(component) && component.value === 'injectGlobal';

  const { commentStartMarker, commentEndMarker } = isInjectGlobal
    ? startEndMarkers('Injected Globals')
    : fileStartEndCommentMarkers(state);

  let { currentWebCss } = state;
  let newElement = null;

  if (!isInjectGlobal) {
    const { css: output, args } = extractRules(cssText, {
      generateClassName: () => classGenerator.next().value,
      generateAnimationName: () => animationGenerator.next().value,
    });

    const cssBefore = _.endsWith(commentEndMarker, currentWebCss)
      ? currentWebCss.slice(0, -commentEndMarker.length)
      : `${currentWebCss}\n${commentStartMarker}`;
    currentWebCss = `${cssBefore}\n${output}\n${commentEndMarker}`;

    const createComponent = getOrCreateImportReference(
      path,
      'cssta/lib/web/createComponent',
      'default'
    );

    newElement = t.callExpression(createComponent, [
      component,
      t.nullLiteral(), // Gets replaced with Object.keys(classNameMap)
      jsonToNode(args),
    ]);
  } else {
    currentWebCss = `${commentStartMarker}${cssText}\n${commentEndMarker}${currentWebCss}`;
  }

  state.currentWebCss = currentWebCss;

  if (newElement) {
    path.replaceWith(newElement);
  } else {
    path.remove();
  }
};

module.exports.resetGenerators = resetGenerators;
