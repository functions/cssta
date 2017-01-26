import _createComponent from 'cssta/dist/native/helpers/createComponent';
import _topLevelMixin from 'cssta/dist/native/helpers/topLevelMixin';

import { View } from 'react-native';

const mixin = 'color: red;';

_createComponent(View, [_topLevelMixin(mixin)]);