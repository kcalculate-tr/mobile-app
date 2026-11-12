// G21-S1 md.8 (akış denetimi) — Keşfet'te yazara dokununca açık profil.
// Önce PostCard / FinDetail yazar satırı dokunulmazdı → açık profile (ve takip
// düğmesine) yalnız bildirimden ulaşılıyordu.
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PostCard } from '../PostCard';
import { postCardModel } from '../format';
import type { FeedPost } from '../../types';

const post: FeedPost = {
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
  me: { liked: false, saved: false, is_author: false },
  post_type: 'ogun',
  status: 'published',
  activity_card: null,
};

const noop = () => {};
const common = { onLike: noop, onSave: noop, onShare: noop, onOpenMenu: noop };
const model = postCardModel(post, Date.parse('2026-11-03T12:00:00.000Z'), 'tr');

test('avatar ve ad dokunuşu onOpenAuthor çağırır', () => {
  const onOpenAuthor = jest.fn();
  const { getByTestId, getByText } = render(<PostCard model={model} {...common} onOpenAuthor={onOpenAuthor} />);
  fireEvent.press(getByTestId('post-card-author'));
  fireEvent.press(getByText('Dyt. Elif'));
  expect(onOpenAuthor).toHaveBeenCalledTimes(2);
});

test('onOpenAuthor verilmezse avatar pasif (eski davranış, çökme yok)', () => {
  const { getByTestId } = render(<PostCard model={model} {...common} />);
  expect(() => fireEvent.press(getByTestId('post-card-author'))).not.toThrow();
});
