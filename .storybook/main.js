import { dirname, join } from 'path';

/** @type { import('@storybook/react-vite').StorybookConfig } */
const config = {
  stories: [
    '../client/src/**/*.stories.mdx',
    '../client/src/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  viteFinal: async (config) => {
    // Add custom Vite config
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': join(dirname(__dirname), './client/src'),
      '@shared': join(dirname(__dirname), './shared'),
    };
    
    return config;
  },
};

export default config;