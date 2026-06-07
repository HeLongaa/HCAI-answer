import path from 'path';

import yaml from 'js-yaml';
import { defineConfig } from 'vitest/config';

const yamlPlugin = () => ({
  name: 'yaml-loader',
  transform(code, id) {
    if (!/\.ya?ml$/.test(id)) {
      return null;
    }
    return {
      code: `export default ${JSON.stringify(yaml.load(code))};`,
      map: null,
    };
  },
});

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify('test'),
    __DEV_PROXY_CONFIG__: 'undefined',
  },
  plugins: [yamlPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@i18n': path.resolve(__dirname, '../i18n'),
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    restoreMocks: true,
    setupFiles: ['src/test/setup/vitest.setup.ts'],
  },
});
