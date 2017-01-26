// We generate babel nodes that represent a validation function
// In prod, we use the babel nodes to make a function
// In dev, we eval to generate a function

const selectorParser = require('postcss-selector-parser');

const propArg = 'p';

const createLogicalValidator = (nodes, operator) => {
  if (nodes.length === 0) throw new Error('Cannot construct logical validaton');
  const nodeValidators = nodes
    .map(createValidator) // eslint-disable-line
    .filter(validator => validator !== null);
  if (nodeValidators.length === 0) return null;
  return nodeValidators.slice(1).reduce((accum, validator) => (
    `(${accum} ${operator} ${validator})`
  ), nodeValidators[0]);
};

const createNestingValidator = () => null;

const createAttributeValidator = (node) => {
  const { attribute, raws, value } = node;

  const memberExpression = `${propArg}['${attribute.trim()}']`;

  if (!value) return `!!${memberExpression}`;

  const unquoted = raws.unquoted.trim();
  return `(${memberExpression} === '${unquoted}')`;
};

const createPseudoValidator = (node) => {
  const { value, nodes } = node;

  if (value === ':matches') {
    return createLogicalValidator(nodes, '||');
  } else if (value === ':not') {
    const baseValidator = createLogicalValidator(nodes, '||');
    return `!${baseValidator}`;
  }
  throw new Error(`Invalid selector part: ${node}`);
};

const createSelectorValidator = node => createLogicalValidator(node.nodes, '&&');

const validators = {
  nesting: createNestingValidator,
  attribute: createAttributeValidator,
  pseudo: createPseudoValidator,
  selector: createSelectorValidator,
  root: createSelectorValidator,
};

const createValidator = (node) => {
  if (!(node.type in validators)) throw new Error(`Invalid selector part: ${node}`);
  return validators[node.type](node);
};

const getBaseValidatorSourceForSelector = (selector) => {
  let selectorNode;
  selectorParser((node) => { selectorNode = node; }).process(selector);
  const validatorNode = createValidator(selectorNode) || 'true';
  const returnNode = `return ${validatorNode};`;
  return returnNode;
};

module.exports.getValidatorSourceForSelector = selector =>
  `(function(${propArg}) {${getBaseValidatorSourceForSelector(selector)}})`;

module.exports.createValidatorForSelector = (selector) => {
  if (selector === '&') return () => true; // optimisation
  const source = getBaseValidatorSourceForSelector(selector);
  return new Function(propArg, source); // eslint-disable-line
};
