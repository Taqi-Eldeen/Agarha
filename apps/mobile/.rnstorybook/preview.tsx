import type { Preview } from '@storybook/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const preview: Preview = {
  decorators: [(Story) => <SafeAreaProvider>{Story()}</SafeAreaProvider>],
};

export default preview;
