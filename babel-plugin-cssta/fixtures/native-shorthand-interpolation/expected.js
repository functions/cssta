import _csstaCreateComponent from 'cssta/lib/native/createComponent';

import { View } from 'react-native';

const font = '10 "Helvetica"';

import { default as _default } from 'css-to-react-native';
import { StyleSheet as _StyleSheet } from 'react-native';

var _csstaStyle = _StyleSheet.create({
  'style1': Object.assign({
    'marginTop': 10
  }, _default([['font', `${ font }`]])),
  'style2': Object.assign(_default([['font', `${ font }`]]), {
    'marginTop': 10
  }),
  'style3': Object.assign({
    'marginTop': 10
  }, _default([['font', `${ font }`]]), {
    'marginBottom': 10
  })
});

_csstaCreateComponent(View, ['attr1', 'attr2', 'attr3'], [{
  'validator': function (p) {
    return !!p['attr1'];
  },
  'style': _csstaStyle['style1']
}, {
  'validator': function (p) {
    return !!p['attr2'];
  },
  'style': _csstaStyle['style2']
}, {
  'validator': function (p) {
    return !!p['attr3'];
  },
  'style': _csstaStyle['style3']
}]);