// @system — Jest configuration for client-side unit tests
const path = require('path')

module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  // Feature modules: webpack defines __MODULES__ from brand.json; tests get the
  // all-enabled defaults and mock '@/config/@system/modules' to switch modules off.
  globals: { __MODULES__: {} },
  setupFilesAfterEnv: [path.resolve(__dirname, 'src/test/setup.js')],
  moduleNameMapper: {
    '^vitest$': '<rootDir>/src/test/__mocks__/vitest.js',
    '^lucide-react$': '<rootDir>/src/test/__mocks__/lucide-react.js',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@system/(.*)$': '<rootDir>/src/app/components/@system/$1',
    '^@custom/(.*)$': '<rootDir>/src/app/components/@custom/$1',
    '\\.(css|scss|sass)$': '<rootDir>/src/test/__mocks__/styleMock.js',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/src/test/__mocks__/fileMock.js',
  },
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
      ],
      plugins: [
        path.resolve(__dirname, 'src/test/babel-plugin-import-meta.js'),
      ],
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(class-variance-authority|clsx|tailwind-merge|@hookform|zod)/)',
  ],
  testMatch: ['<rootDir>/src/test/**/*.test.[jt]s?(x)'],
}
