import React from 'react';
import { Image } from 'expo-image';
import { StyleProp, ImageStyle } from 'react-native';

interface Props {
  uri: string;
  style?: StyleProp<ImageStyle>;
  placeholder?: string;
  onError?: () => void;
}

export function CachedImage({ uri, style, placeholder, onError }: Props) {
  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit="cover"
      transition={200}
      cachePolicy="memory-disk"
      placeholder={placeholder ?? '#f0f0f0'}
      onError={onError}
    />
  );
}
