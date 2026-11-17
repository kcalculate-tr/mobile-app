// G58-S2 md.1 — "Devamını gör" aynı kartta metni tam açar; ayrıntı sayfasına GİTMEZ.
// Açık durum ekran düzeyinde tutulabilir (bodyExpanded) → yeniden çizimde kapanmaz.
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PostCard } from '../PostCard';
import { postCardModel } from '../format';
import { FEED_BODY_LINES } from '../../myActivity';
import type { FeedPost } from '../../types';

const LONG = Array.from({ length: 12 }, (_, i) => `Satır ${i + 1} — uzun bir gönderi metni.`).join('\n');

function post(body: string): FeedPost {
  return {
    id: 'p-long',
    author: { id: 'a1', display_name: 'Ada', handle: 'ada', avatar_url: null, role: 'user', verified: false },
    published_at: '2026-11-17T10:00:00.000Z',
    lang: 'tr',
    body,
    media: [],
    meal_card: null,
    quote: null,
    thread: null,
    stats: { likes: 0, saves: 0, adds: 0, comments: 0, did_it: 0 },
    me: { liked: false, saved: false, is_author: false },
    post_type: 'serbest',
    status: 'published',
    activity_card: null,
  } as FeedPost;
}

const noop = () => {};
const model = postCardModel(post(LONG), Date.parse('2026-11-17T12:00:00.000Z'), 'tr');

test('devamını gör → navigate (onOpen) çağrılmaz, metin tam görünür', () => {
  const onOpen = jest.fn();
  const onExpandBody = jest.fn();
  const { getByTestId, queryByTestId, getByText } = render(
    <PostCard model={model} onLike={noop} onSave={noop} onOpenMenu={noop} onOpen={onOpen} onExpandBody={onExpandBody} />,
  );
  const body = getByText(LONG);
  expect(body.props.numberOfLines).toBe(FEED_BODY_LINES);
  fireEvent.press(getByTestId('kesfet-read-more'));
  expect(onOpen).not.toHaveBeenCalled();
  expect(onExpandBody).toHaveBeenCalledTimes(1);
  expect(getByText(LONG).props.numberOfLines).toBeUndefined();
  expect(queryByTestId('kesfet-read-more')).toBeNull();
});

test('metne dokunmak ayrıntıyı açmaya devam eder', () => {
  const onOpen = jest.fn();
  const { getByText } = render(<PostCard model={model} onLike={noop} onSave={noop} onOpenMenu={noop} onOpen={onOpen} />);
  fireEvent.press(getByText(LONG));
  expect(onOpen).toHaveBeenCalledTimes(1);
});

test('ekran düzeyinde açık (bodyExpanded) → yeniden çizimde (yeni bileşen) açık kalır', () => {
  const first = render(<PostCard model={model} onLike={noop} onSave={noop} onOpenMenu={noop} bodyExpanded />);
  expect(first.getByText(LONG).props.numberOfLines).toBeUndefined();
  expect(first.queryByTestId('kesfet-read-more')).toBeNull();
  first.unmount();
  const again = render(<PostCard model={model} onLike={noop} onSave={noop} onOpenMenu={noop} bodyExpanded />);
  expect(again.getByText(LONG).props.numberOfLines).toBeUndefined();
});
