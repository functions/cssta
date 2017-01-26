import _createComponent from 'cssta/dist/native/helpers/createComponent';
import _cssToReactNative from 'css-to-react-native';
import _ruleLevelMixin from 'cssta/dist/native/helpers/ruleLevelMixin';
import { StyleSheet as _StyleSheet } from 'react-native';
import _topLevelMixin from 'cssta/dist/native/helpers/topLevelMixin';

import { View } from 'react-native';

const mixin1 = 'color: red;';
const mixin2 = 'color: red;';
const padding = '0';

var _csstaStyle = _StyleSheet.create({
  0: {
    'marginTop': 1
  }
});

var _csstaStyle2 = _StyleSheet.create({
  0: {
    'marginBottom': 1
  },
  1: _cssToReactNative([['padding', `1px ${ padding }`]])
});

_createComponent(View, [_topLevelMixin(mixin1), {
  'type': 'static',
  'rules': [{
    'validate': function (p) {
      return !!p['ruleMixin'];
    },
    'style': _csstaStyle[0]
  }],
  'propTypes': ['ruleMixin', 'valueMixin']
}, _ruleLevelMixin(mixin2, {
  'validate': function (p) {
    return !!p['ruleMixin'];
  },
  'propTypes': ['ruleMixin', 'valueMixin']
}), {
  'type': 'static',
  'rules': [{
    'validate': function (p) {
      return !!p['ruleMixin'];
    },
    'style': _csstaStyle2[0]
  }, {
    'validate': function (p) {
      return !!p['valueMixin'];
    },
    'style': _csstaStyle2[1]
  }],
  'propTypes': ['ruleMixin', 'valueMixin']
}]);