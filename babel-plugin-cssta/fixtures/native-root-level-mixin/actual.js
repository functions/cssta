import cssta from 'cssta/native';
import { View } from 'react-native';

const mixin = 'color: red;';

cssta(View)`
  ${mixin}
`;
