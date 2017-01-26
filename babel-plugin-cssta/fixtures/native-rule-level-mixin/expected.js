import _createMixinComponent from 'cssta/dist/native/createMixinComponent';
import _ruleLevelMixin from 'cssta/dist/native/ruleLevelMixin';

import { View } from 'react-native';

const mixin = 'color: red;';

_createMixinComponent(View, [_ruleLevelMixin(mixin, {
  'validate': function (p) {
    return !!p['attr'];
  },
  'propTypes': ['attr']
})]);