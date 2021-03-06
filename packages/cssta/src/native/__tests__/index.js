/* eslint-disable flowtype/require-valid-file-annotation */
/* global jest it, expect */
const React = require('react');
const renderer = require('react-test-renderer'); // eslint-disable-line
const cssta = require('..');

const runTest = (csstaFactory) => {
  const Element = csstaFactory();

  const component = renderer.create(React.createElement(Element, {})).toJSON();

  expect(component.props.style).toEqual([{ color: 'red' }]);
  expect(component.children).toEqual(null);
};

it('creates a component', () => runTest(() => (
  cssta('dummy')`
    color: red;
  `
)));

it('allows value interpolation', () => runTest(() => {
  const color = 'red';
  return cssta('dummy')`
    color: ${color};
  `;
}));

it('allows rule interpolation', () => runTest(() => {
  const rule = 'color: red;';
  return cssta('dummy')`
    ${rule}
  `;
}));

it('allows non-template-literals', () => runTest(() => (
  cssta('dummy')('color: red;')
)));
