// @flow
/* eslint-disable no-param-reassign */
const React = require('react');
/* eslint-disable */
// $FlowFixMe
const { StyleSheet, Animated, Easing } = require('react-native');
/* eslint-enable */
const { getAppliedRules } = require('../util');
const { shallowEqual } = require('../../util');
const {
  mergeStyles, interpolateValue, getDurationInMs, easingFunctions,
  durationRegExp, easingRegExp,
} = require('./animationUtil');
/*:: import type { DynamicProps } from '../../factories/types' */
/*:: import type { Args } from '../types' */
/*:: import type { Interpolation } from './animationUtil' */

const { Component } = React;

const getInitialValue = targetValue => (typeof targetValue === 'number' ? targetValue : 0);

const mergeTransitions = (props) => {
  const transitions = getAppliedRules(props.args.rules, props.ownProps)
    .map(rule => rule.transitions)
    .filter(transition => typeof transition === 'object');
  return Object.assign({}, ...transitions);
};

/*::
type AnimatedValue = {
  setValue: (value: number) => void,
}

type TransitionState = {
  styles: { [key:string]: Interpolation },
  previousStyles: { [key:string]: Interpolation },
}
*/

module.exports = class TransitionEnhancer extends Component {
  /*::
  state: TransitionState
  props: DynamicProps<Args>
  animationValues: { [key:string]: AnimatedValue }
  */

  constructor(props /*: DynamicProps<Args> */) {
    super();

    const styles = mergeStyles(props);
    const { transitionedProperties } = props.args;

    this.state = { styles, previousStyles: styles };

    this.animationValues = transitionedProperties.reduce((animationValues, transitionName) => {
      animationValues[transitionName] = new Animated.Value(getInitialValue(styles[transitionName]));
      return animationValues;
    }, {});
  }

  componentWillReceiveProps(nextProps /*: DynamicProps<Args> */) {
    const previousStyles = this.state.styles;
    const styles = mergeStyles(nextProps);
    if (!shallowEqual(previousStyles, styles)) this.setState({ styles, previousStyles });
  }

  componentDidUpdate(prevProps /*: DynamicProps<Args> */, prevState /*: TransitionState */) {
    const { styles } = this.state;

    if (prevState.styles === styles) return;

    const { animationValues } = this;

    const currentTransitions = mergeTransitions(this.props);

    const animations = Object.keys(animationValues).map((transitionProperty) => {
      const transitionValues = currentTransitions[transitionProperty] || [];

      const durationMatch = transitionValues.find(value => durationRegExp.test(value));
      const duration = durationMatch ? getDurationInMs(durationMatch) : 0;

      const easingMatch = transitionValues.find(value => easingRegExp.test(value));
      const easing = easingMatch ? easingFunctions[easingMatch] : easingFunctions.linear;

      const animation = animationValues[transitionProperty];

      const targetValue = styles[transitionProperty];
      const needsInterpolation = typeof targetValue !== 'number';
      const toValue = !needsInterpolation ? targetValue : 1;

      if (needsInterpolation) animation.setValue(0);

      return Animated.timing(animation, { toValue, duration, easing });
    });

    Animated.parallel(animations).start();
  }

  render() {
    const { args, children } = this.props;
    const { animationValues } = this;

    const animationNames = Object.keys(animationValues);

    let nextProps;
    if (animationNames.length > 0) {
      const { styles, previousStyles } = this.state;

      const fixedAnimations = animationNames.reduce((accum, animationName) => {
        accum[animationName] = interpolateValue(
          [0, 1],
          [previousStyles[animationName], styles[animationName]],
          animationValues[animationName],
          true /* interpolate numbers */
        );
        return accum;
      }, {});

      const newRule = { style: fixedAnimations };
      const nextArgs /*: Args */ = {
        transitionedProperties: args.transitionedProperties,
        keyframes: args.keyframes,
        rules: args.rules.concat(newRule),
      };
      nextProps = Object.assign({}, this.props, { args: nextArgs });
    } else {
      nextProps = this.props;
    }

    return children(nextProps);
  }
};
