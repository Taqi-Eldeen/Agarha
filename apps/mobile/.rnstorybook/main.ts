import type { StorybookConfig } from '@storybook/react-native';

// Component stories live next to the components in @agarha/ui-native.
const main: StorybookConfig = {
  stories: ['../../../packages/ui-native/src/**/*.stories.?(ts|tsx)'],
  deviceAddons: ['@storybook/addon-ondevice-controls'],
};

export default main;
