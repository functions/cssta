import _createComponent from 'cssta/dist/native/helpers/createComponent';
import _ruleLevelMixin from 'cssta/dist/native/helpers/ruleLevelMixin';

import { View } from 'react-native';

const mixin = 'color: red;';

_createComponent(View, [_ruleLevelMixin(mixin, {
  'validate': function (p) {
    return !!p['attr'];
  },
  'propTypes': ['attr']
})]);