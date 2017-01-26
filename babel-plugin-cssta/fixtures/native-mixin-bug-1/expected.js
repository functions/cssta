import _staticComponent from 'cssta/dist/native/staticComponent';
import { StyleSheet as _StyleSheet } from 'react-native';
import _cssToReactNative from 'css-to-react-native';

import { View } from 'react-native';

var _csstaStyle = _StyleSheet.create({
  0: Object.assign({
    'height': 50,
    'backgroundColor': 'red'
  }, _cssToReactNative([['margin', `${ valueMixin }`]]))
});

const Container = _staticComponent(View, [], [{
  'validate': function (p) {
    return true;
  },
  'style': _csstaStyle[0]
}]);