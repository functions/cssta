import cssta from 'cssta/native';
import { View } from 'react-native';

const mixin1 = 'color: red;';
const mixin2 = 'color: red;';
const padding = '0';

cssta(View)`
  ${mixin1}

  [ruleMixin] {
    margin-top: 1px;
    ${mixin2}
    margin-bottom: 1px;
  }

  [valueMixin] {
    padding: 1px ${padding};
  }
`;
