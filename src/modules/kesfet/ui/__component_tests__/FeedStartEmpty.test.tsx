// G18-S4 md.4 — FinFeedEmpty / FinFollowingEmpty: başlık + açıklama, "Başlangıç
// için" (Marka/Editör, yalnız gerçek veri), "Davetli üreticiler" (yoksa gizli),
// "İlk paylaşımını hazırla".
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { FeedStartEmpty } from '../FeedStartEmpty';
import type { StarterItem } from '../../starters';

const STARTER: StarterItem = {
  postId: 'p1',
  label: 'brand',
  handle: 'kcal',
  authorName: 'kcal',
  avatarUrl: null,
  title: 'Haftanın tabağı: tavuk kinoa bowl',
  imageUrl: 'https://example.invalid/a.jpg',
  hasRecipe: true,
};

test('FinFollowingEmpty: başlık, başlangıç kartı (Marka), davetli üretici, ilk paylaşım', () => {
  const onOpen = jest.fn();
  const onCompose = jest.fn();
  const tree = render(
    <FeedStartEmpty
      variant="following"
      starters={[STARTER, { ...STARTER, postId: 'p2', label: 'editor', handle: 'kcal_editor', title: 'Kış için mercimek çorbası' }]}
      creators={[{ id: 'u1', display_name: 'Ayşe', handle: 'ayse', role: 'diyetisyen', verified: true, avatar_url: null }]}
      onOpenPost={onOpen}
      onFollow={() => {}}
      onCompose={onCompose}
    />,
  );
  expect(tree.getByText('Henüz kimseyi takip etmiyorsun')).toBeTruthy();
  expect(
    tree.getByText('Takip ettiklerinin paylaşımları burada görünür. Başlamak için aşağıdaki içeriklere göz at.'),
  ).toBeTruthy();
  expect(tree.getByText('Başlangıç için')).toBeTruthy();
  expect(tree.getByText('kcal ve editörler')).toBeTruthy();
  expect(tree.getByText('Marka')).toBeTruthy();
  expect(tree.getByText('Editör')).toBeTruthy();
  expect(tree.getAllByText('Tarif ve değerleri').length).toBe(2);
  expect(tree.getByText('Davetli üreticiler')).toBeTruthy();
  expect(tree.getByText('kcal’a katılanlar')).toBeTruthy();
  expect(tree.getByText('Takip et')).toBeTruthy();
  fireEvent.press(tree.getByTestId('fin-starter-p1'));
  expect(onOpen).toHaveBeenCalledWith('p1');
  fireEvent.press(tree.getByTestId('fin-first-post'));
  expect(onCompose).toHaveBeenCalled();
  expect(tree.getByText('İlk paylaşımını hazırla')).toBeTruthy();
});

test('FinFeedEmpty: gerçek içerik yoksa başlangıç ve üretici alanları GİZLİ, açıklama iki noktasız', () => {
  const tree = render(
    <FeedStartEmpty variant="for_you" starters={[]} creators={[]} onOpenPost={() => {}} onFollow={() => {}} onCompose={() => {}} />,
  );
  expect(tree.getByText('Akışın seninle şekillenecek')).toBeTruthy();
  expect(tree.getByText('Logladıkça ve takip ettikçe burada sana uygun paylaşımlar görürsün.')).toBeTruthy();
  expect(tree.queryByText('Başlangıç için')).toBeNull();
  expect(tree.queryByText('Davetli üreticiler')).toBeNull();
  expect(tree.getByText('İlk paylaşımını hazırla')).toBeTruthy();
});

test('RingStrip boş hâl (FinFeedEmpty üstü): yalnız Günüm + açıklama; akış doluyken çizilmez', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { RingStrip } = require('../RingStrip') as typeof import('../RingStrip');
  const empty = render(<RingStrip rings={[]} onOpen={() => {}} emptyHint />);
  expect(empty.getByText('Günüm')).toBeTruthy();
  expect(
    empty.getByText('İlk öğününü logladığında günün burada başlar. Takip ettiklerinin günleri yanına eklenir.'),
  ).toBeTruthy();
  const none = render(<RingStrip rings={[]} onOpen={() => {}} />);
  expect(none.toJSON()).toBeNull();
});

test('Paylaşım kapalıysa "İlk paylaşımını hazırla" kartı yok', () => {
  const tree = render(<FeedStartEmpty variant="for_you" starters={[STARTER]} creators={[]} onOpenPost={() => {}} onFollow={() => {}} />);
  expect(tree.getByText('Logladıkça ve takip ettikçe burada sana uygun paylaşımlar görürsün. Şimdilik kcal’ın seçtikleri:')).toBeTruthy();
  expect(tree.queryByTestId('fin-first-post')).toBeNull();
});
