const staticComponent = require('../staticComponent');
const dynamicComponent = require('../dynamicComponent');

const isDynamic = componentPart => componentPart.type === 'dynamic';

module.exports = (component, componentParts) => {
  const propTypes = componentParts.reduce((outerAccum, componentPart) => (
    componentPart.propTypes.reduce((innerAccum, propType) => (
      innerAccum.indexOf(propType) === -1 ? innerAccum : innerAccum.concat([propType])
    ), outerAccum)
  ), []);

  const rules = componentParts.reduce((accum, componentPart) => (
    accum.concat(componentPart.rules)
  ), []);

  if (!componentParts.some(isDynamic)) return staticComponent(component, propTypes, rules);

  const importedVariables = componentParts.reduce((outerAccum, componentPart) => {
    if (!isDynamic(componentPart)) return outerAccum;

    return componentPart.importedVariables.reduce((innerAccum, importedVariable) => (
      innerAccum.indexOf(importedVariables) === -1
        ? innerAccum
        : innerAccum.concat([importedVariable])
    ), outerAccum);
  }, []);

  return dynamicComponent(component, propTypes, importedVariables, rules);
};
