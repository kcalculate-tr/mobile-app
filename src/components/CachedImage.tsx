import React from 'react';
import { Image } from 'expo-image';
import { StyleProp, ImageStyle } from 'react-native';

interface Props {
  uri: string;
  style?: StyleProp<ImageStyle>;
  placeholder?: string;
  priority?: 'high' | 'normal' | 'low';
  onError?: () => void;
}

export function CachedImage({ uri, style, placeholder, priority = 'normal', onError }: Props) {
  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit="cover"
      transition={200}
      cachePolicy="memory-disk"
      placeholder={placeholder ?? '#F1F1F1'}
      placeholderContentFit="cover"
      priority={priority}
      recyclingKey={uri}
      onError={onError}
    />
  );
}
