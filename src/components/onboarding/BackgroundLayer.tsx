import React from 'react';
import { View, ImageBackground, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { sportive } from '../../theme/sportive';

interface Props {
  mode: 'sharp' | 'blur';
  children: React.ReactNode;
}

const HERO = require('../../../assets/onboarding-hero.jpg');

export const BackgroundLayer: React.FC<Props> = ({ mode, children }) => {
  return (
    <ImageBackground
      source={HERO}
      style={styles.bg}
      resizeMode="cover"
      blurRadius={mode === 'blur' ? 40 : 0}
    >
      {mode === 'sharp' ? (
        <LinearGradient
          colors={['transparent', 'transparent', sportive.colors.overlayLight, sportive.colors.overlayHeavy]}
          locations={[0, 0.28, 0.65, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: sportive.colors.blurTint }]} />
      )}
      {children}
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bg: { flex: 1 },
});
