/* eslint-disable import/no-extraneous-dependencies */
import { vi } from 'vitest';

const storage = new Map<string, string>();

const localStorageMock: Storage = {
  get length() {
    return storage.size;
  },
  clear: vi.fn(() => {
    storage.clear();
  }),
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  key: vi.fn((index: number) => Array.from(storage.keys())[index] ?? null),
  removeItem: vi.fn((key: string) => {
    storage.delete(key);
  }),
  setItem: vi.fn((key: string, value: string) => {
    storage.set(key, String(value));
  }),
};

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: localStorageMock,
});

vi.mock('i18next', () => {
  const i18next = {
    addResourceBundle: vi.fn(),
    changeLanguage: vi.fn(),
    exists: vi.fn(() => false),
    getFixedT: vi.fn(() => (key: string) => key),
    init: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    resolvedLanguage: 'en',
    t: vi.fn((key: string) => key),
    use: vi.fn(() => i18next),
  };

  return {
    default: i18next,
  };
});

vi.mock('@/services', () => ({
  deleteAiImageAgentConversation: vi.fn(async () => undefined),
  deleteAiImageGeneration: vi.fn(async () => undefined),
  generateAiImage: vi.fn(async () => ({
    generation_id: 'test-generation',
    image_url: '',
    image_base64: '',
  })),
  getAiImageAgentConversations: vi.fn(async () => []),
  getAiImageGenerations: vi.fn(async () => []),
  getAiImageModels: vi.fn(async () => []),
  getPluginsStatus: vi.fn(async () => []),
  saveAiImageAgentConversation: vi.fn(async (params) => params),
  saveAiImageAgentGeneration: vi.fn(async () => ({
    generation_id: 'test-agent-generation',
    image_url: '',
    image_base64: '',
  })),
}));
