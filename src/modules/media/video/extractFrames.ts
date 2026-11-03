// Başı/ortası/sonu 3 JPEG kare — G8-S3.md m.1. expo-video-thumbnails zaman
// damgası ms cinsinden; süre pickVideo()'dan (asset.duration, ms) gelir.
import * as VideoThumbnails from 'expo-video-thumbnails';
import { frameTimestampsMs } from './rules';
import type { VideoFrame, VideoFrames } from './types';

const QUALITY = 0.7;

export async function extractFrames(uri: string, durationMs: number): Promise<VideoFrames> {
  const timestamps = frameTimestampsMs(durationMs);
  const frames = await Promise.all(
    timestamps.map(async (atMs): Promise<VideoFrame> => {
      const thumb = await VideoThumbnails.getThumbnailAsync(uri, { time: atMs, quality: QUALITY });
      return { uri: thumb.uri, atMs, width: thumb.width, height: thumb.height };
    }),
  );
  return frames as VideoFrames;
}
