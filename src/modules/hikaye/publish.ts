// G59-S1 — Paylaş akışı (gönderilerdeki sıra): medya yükle → create_story → (metin katmanı varsa) moderate-content
// (ateşle-unut; hata sunucuda 'pending' kalır, pg_cron yeniden dener). Yükleyici enjekte edilir → saf test.
import { hasModeratedText, serializeOverlays } from './overlays';
import type { StoryBg, StoryClient, StoryOverlay, StoryStatus } from './types';

export interface PublishMedia {
  kind: 'image' | 'video' | 'none';
  uri?: string | null;
  width?: number;
  height?: number;
  durationMs?: number;
  fileSizeBytes?: number;
  mimeType?: string | null;
  mealPhotoPath?: string | null;
}

export interface Uploader {
  photo: (uid: string, uri: string, w: number, h: number) => Promise<{ mediaUrl: string; thumbUrl: string | null; width: number; height: number; durationS: number | null }>;
  video: (uid: string, v: { uri: string; width: number; height: number; durationMs: number; fileSizeBytes?: number; mimeType?: string | null }) => Promise<{ mediaUrl: string; thumbUrl: string | null; width: number; height: number; durationS: number | null }>;
  mealPhoto: (uid: string, path: string) => Promise<{ mediaUrl: string; thumbUrl: string | null; width: number; height: number; durationS: number | null } | null>;
}

export type PublishResult = { ok: true; storyId: string; status: StoryStatus } | { ok: false; reason: 'rate_limited' | 'failed' };

export async function publishStory(params: {
  client: StoryClient;
  uploader: Uploader;
  userId: string;
  media: PublishMedia;
  overlays: StoryOverlay[];
  bg: StoryBg | null;
  idempotencyKey: string;
}): Promise<PublishResult> {
  const { client, uploader, userId, media, bg, idempotencyKey } = params;
  try {
    let up: Awaited<ReturnType<Uploader['photo']>> | null = null;
    if (media.kind === 'image') {
      if (media.mealPhotoPath) up = await uploader.mealPhoto(userId, media.mealPhotoPath);
      else if (media.uri) up = await uploader.photo(userId, media.uri, media.width ?? 1080, media.height ?? 1920);
      if (!up) return { ok: false, reason: 'failed' };
    } else if (media.kind === 'video') {
      if (!media.uri || !media.durationMs) return { ok: false, reason: 'failed' };
      up = await uploader.video(userId, {
        uri: media.uri,
        width: media.width ?? 720,
        height: media.height ?? 1280,
        durationMs: media.durationMs,
        fileSizeBytes: media.fileSizeBytes,
        mimeType: media.mimeType,
      });
    }
    const overlays = serializeOverlays(params.overlays);
    const res = await client.createStory({
      mediaUrl: up?.mediaUrl ?? null,
      mediaType: media.kind,
      thumbUrl: up?.thumbUrl ?? null,
      durationS: up?.durationS ?? null,
      width: up?.width ?? null,
      height: up?.height ?? null,
      overlays,
      bg: media.kind === 'none' ? bg : null,
      idempotencyKey,
    });
    if ('error' in res) return { ok: false, reason: 'rate_limited' };
    if (res.status === 'pending' && hasModeratedText(overlays)) {
      void client.moderate({ story: res.story_id }).catch(() => undefined);
    }
    return { ok: true, storyId: res.story_id, status: res.status };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
