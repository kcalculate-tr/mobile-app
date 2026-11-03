// Gönderi medyası kova + yol — SAF (native yok), `tsx --test` altında doğrudan
// test edilir. media.ts (expo-image-picker native bağımlılığı) bunu kullanır.
// G9-3a: gönderi medyası herkese açık `post-media` kovasında `posts/{uid}/...`
// altında olmalı — hem akışta/takipçide görünür, hem de post-media yazma politikası
// (foldername[1]='posts', foldername[2]=uid) ile eşleşir.

export const POST_MEDIA_BUCKET = 'post-media';

/** `posts/{userId}/{index}-{w}x{h}.{ext}` — post-media yazma politikasıyla uyumlu. */
export function buildPostMediaPath(
  userId: string,
  index: number,
  width: number,
  height: number,
  ext: string,
): string {
  return `posts/${userId}/${index}-${width}x${height}.${ext}`;
}
