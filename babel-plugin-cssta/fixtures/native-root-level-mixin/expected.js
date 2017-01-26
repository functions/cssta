import _createMixinComponent from 'cssta/dist/native/createMixinComponent';
import _topLevelMixin from 'cssta/dist/native/topLevelMixin';

import { View } from 'react-native';

const mixin = 'color: red;';

_createMixinComponent(View, [_topLevelMixin(mixin)]);