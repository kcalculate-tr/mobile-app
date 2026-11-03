// G11-S3 bileşen testi — PostCard "İncelemede" (pending) rozeti.
// Yalnız yazarına pending görünür (status 'pending'); yayınlanmışta rozet yok.
//
// PostCard → MediaGrid, native modülleri (core/flags→AuthContext→google-signin,
// media/video→expo-video) import eder. Taklitleri artık jest.setup.js'te (S6,
// ENTEGRASYONA — G11-S3-LOG #3) → yerel MediaGrid mock'u gerekmiyor.
import React from 'react';
import { render } from '@testing-library/react-native';
import { PostCard } from '../PostCard';
import { postCardModel } from '../format';
import type { FeedPost, PostStatus } from '../../types';

function post(status: PostStatus, isAuthor = true): FeedPost {
  return {
    id: 'p1',
    author: { id: 'a1', display_name: 'Dyt. Elif', handle: 'dyt.elif', avatar_url: null, role: 'dietitian', verified: true },
    published_at: '2026-11-03T10:00:00.000Z',
    lang: 'tr',
    body: 'Dengeli bir öğün paylaşımı.',
    media: [],
    meal_card: null,
    quote: null,
    thread: null,
    stats: { likes: 3, saves: 1, adds: 0, comments: 0, did_it: 0 },
    me: { liked: false, saved: false, is_author: isAuthor },
    post_type: 'ogun',
    status,
    activity_card: null,
  };
}

const noop = () => {};
const common = { onLike: noop, onSave: noop, onShare: noop, onAddToDay: noop, onOpenMenu: noop };

test('pending gönderide "İncelemede" rozeti çizilir', () => {
  const { queryByText } = render(
    <PostCard model={postCardModel(post('pending'), Date.parse('2026-11-03T12:00:00.000Z'), 'tr')} {...common} />,
  );
  expect(queryByText('İncelemede')).toBeTruthy();
});

test('yayınlanmış gönderide "İncelemede" rozeti YOK', () => {
  const { queryByText } = render(
    <PostCard model={postCardModel(post('published'), Date.parse('2026-11-03T12:00:00.000Z'), 'tr')} {...common} />,
  );
  expect(queryByText('İncelemede')).toBeNull();
});
