import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

interface ScreenContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
  backgroundColor?: string;
}

export default function ScreenContainer({
  children,
  style,
  edges = ['top', 'bottom'],
  backgroundColor = '#f6f6f6',
}: ScreenContainerProps) {
  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor }, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}
