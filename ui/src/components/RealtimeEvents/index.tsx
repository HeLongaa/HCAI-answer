import { FC, useEffect } from 'react';

import { useSWRConfig } from 'swr';

import { LOGGED_TOKEN_STORAGE_KEY } from '@/common/constants';
import { REACT_BASE_PATH } from '@/router/alias';
import { loggedUserInfoStore } from '@/stores';
import Storage from '@/utils/storage';

type RealtimeEvent = {
  type: string;
  user_id?: string;
  data?: Record<string, unknown>;
  at: number;
};

const refreshFragments: Record<string, string[]> = {
  'question.created': [
    '/answer/api/v1/question/page',
    '/answer/api/v1/question/recommend/page',
    '/answer/api/v1/personal/question/page',
    '/answer/api/v1/tags/page',
    '/answer/admin/api/question/page',
  ],
  'question.featured': [
    '/answer/api/v1/question/info',
    '/answer/api/v1/question/page',
    '/answer/api/v1/question/recommend/page',
    '/answer/api/v1/personal/question/page',
    '/answer/api/v1/tags/page',
    '/answer/admin/api/question/page',
    '/answer/admin/api/featured-posts',
  ],
  'featured_posts.changed': ['/answer/admin/api/featured-posts'],
  'points.changed': [
    '/answer/api/v1/points/account',
    '/answer/api/v1/points/transactions',
    '/answer/admin/api/users/page',
  ],
  'tasks.changed': [
    '/answer/api/v1/tasks',
    '/answer/api/v1/task',
    '/answer/api/v1/review/tasks',
    '/answer/admin/api/tasks',
  ],
  'admin.users.changed': ['/answer/admin/api/users/page'],
  'tag.changed': [
    '/answer/api/v1/tags/page',
    '/answer/api/v1/tag',
    '/answer/api/v1/tags',
    '/answer/api/v1/question/tags',
    '/answer/api/v1/tags/following',
    '/answer/api/v1/question/info',
    '/answer/api/v1/question/page',
    '/answer/api/v1/question/recommend/page',
    '/answer/api/v1/personal/question/page',
    '/answer/admin/api/question/page',
  ],
};

const keyToURLText = (key: unknown) => {
  if (typeof key === 'string') {
    return key;
  }
  if (Array.isArray(key) && typeof key[0] === 'string') {
    return key[0];
  }
  return '';
};

const keyMatchesFragment = (keyText: string, fragment: string) => {
  if (!keyText) {
    return false;
  }
  return (
    keyText === fragment ||
    keyText.startsWith(`${fragment}?`) ||
    keyText.startsWith(`${fragment}/`) ||
    keyText.includes(`${fragment}?`) ||
    keyText.includes(`${fragment}/`)
  );
};

const RealtimeEvents: FC = () => {
  const { cache, mutate } = useSWRConfig();
  const storeToken = loggedUserInfoStore((state) => state.user.access_token);
  const token = storeToken || Storage.get(LOGGED_TOKEN_STORAGE_KEY);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const url = new URL(
      `${REACT_BASE_PATH}/answer/api/v1/realtime/events`,
      window.location.origin,
    );
    url.searchParams.set('Authorization', token);

    const eventSource = new EventSource(url.toString(), {
      withCredentials: true,
    });

    const refreshByType = (eventType: string) => {
      const fragments = refreshFragments[eventType];
      if (!fragments?.length) {
        return;
      }

      const keys =
        typeof (cache as any).keys === 'function'
          ? Array.from((cache as any).keys())
          : [];
      keys.forEach((key) => {
        const keyText = keyToURLText(key);
        if (
          fragments.some((fragment) => keyMatchesFragment(keyText, fragment))
        ) {
          mutate(key as any);
        }
      });
    };

    const handleMessage = (evt: MessageEvent<string>) => {
      try {
        const event = JSON.parse(evt.data) as RealtimeEvent;
        window.dispatchEvent(
          new CustomEvent('hcai:realtime', { detail: event }),
        );
        refreshByType(event.type);
      } catch {
        // Ignore malformed realtime messages; the stream will continue.
      }
    };

    Object.keys(refreshFragments).forEach((eventType) => {
      eventSource.addEventListener(eventType, handleMessage);
    });

    return () => {
      eventSource.close();
    };
  }, [cache, mutate, token]);

  return null;
};

export default RealtimeEvents;
