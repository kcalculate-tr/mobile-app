import React from 'react';
import { Image, ImageContentFit } from 'expo-image';
import { StyleProp, ImageStyle } from 'react-native';

interface Props {
  uri: string;
  style?: StyleProp<ImageStyle>;
  placeholder?: string;
  priority?: 'high' | 'normal' | 'low';
  contentFit?: ImageContentFit;
  onError?: () => void;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}

export function CachedImage({ uri, style, placeholder, priority = 'normal', contentFit = 'cover', onError, pointerEvents }: Props) {
  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit={contentFit}
      transition={200}
      cachePolicy="memory-disk"
      placeholder={placeholder ?? '#F1F1F1'}
      placeholderContentFit={contentFit}
      priority={priority}
      recyclingKey={uri}
      onError={onError}
      pointerEvents={pointerEvents}
    />
  );
}
