import cssta from 'cssta/native';
import { View } from 'react-native';

const Container = cssta(View)`
  height: 50px;
  background-color: red;
  margin: ${valueMixin};
`;
