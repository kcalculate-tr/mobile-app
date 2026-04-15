import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type DividerProps = {
  style?: StyleProp<ViewStyle>;
};

export default function Divider({ style }: DividerProps) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
});
