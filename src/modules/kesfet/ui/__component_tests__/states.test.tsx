// G11-S3 bileşen testi — durum görünümleri (boş / hata / Takip boş / çevrimdışı).
import React from 'react';
import { render } from '@testing-library/react-native';
import { FeedEmpty, FeedError, FollowingEmpty, FeedOffline } from '../states';

test('FeedEmpty: Sana Özel boş metni', () => {
  const { getByText } = render(<FeedEmpty />);
  expect(getByText('Henüz gönderi yok.')).toBeTruthy();
});

test('FeedEmpty: Takip boş metni', () => {
  const { getByText } = render(<FeedEmpty following />);
  expect(getByText('Takip ettiklerinden henüz gönderi yok.')).toBeTruthy();
});

test('FeedError: mesaj + Tekrar dene', () => {
  const { getByText } = render(<FeedError message="Akış yüklenemedi." onRetry={() => {}} />);
  expect(getByText('Akış yüklenemedi.')).toBeTruthy();
  expect(getByText('Tekrar dene')).toBeTruthy();
});

test('FollowingEmpty: başlık + açıklama (öneri yoksa liste yok)', () => {
  const { getByText, queryByText } = render(<FollowingEmpty suggestions={[]} onFollow={() => {}} />);
  expect(getByText('Henüz kimseyi takip etmiyorsun')).toBeTruthy();
  expect(queryByText('Önerilen hesaplar')).toBeNull();
});

test('FollowingEmpty: öneri varsa "Önerilen hesaplar" + Takip et', () => {
  const { getByText } = render(
    <FollowingEmpty
      suggestions={[{ id: 'a1', display_name: 'kcal', handle: 'kcal', role: 'kurum', verified: true, avatar_url: null }]}
      onFollow={() => {}}
    />,
  );
  expect(getByText('Önerilen hesaplar')).toBeTruthy();
  expect(getByText('Takip et')).toBeTruthy();
});

test('FeedOffline: sakin çevrimdışı hâli', () => {
  const { getByText } = render(<FeedOffline onRetry={() => {}} />);
  expect(getByText('Çevrimdışısın')).toBeTruthy();
  expect(getByText('Tekrar dene')).toBeTruthy();
});
