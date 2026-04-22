import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, Pressable, ScrollView, Animated,
  Dimensions, StyleSheet, TouchableOpacity,
  type DimensionValue, type ViewStyle, type StyleProp,
} from 'react-native';
import { X as XIcon } from 'phosphor-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: DimensionValue;
  showCloseButton?: boolean;
  footer?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  handleColor?: string;
  titleColor?: string;
  titleSeparatorColor?: string;
}

export default function BottomSheet({
  visible, onClose, title, children,
  maxHeight = '85%', showCloseButton = false, footer,
  contentStyle, containerStyle,
  handleColor = '#E0E0E0',
  titleColor = '#000',
  titleSeparatorColor = '#F0F0F0',
}: BottomSheetProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const runCloseAnimation = (onDone?: () => void) => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setModalVisible(false);
      onDone?.();
    });
  };

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(SCREEN_HEIGHT);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 1, duration: 300, useNativeDriver: true,
          }),
          Animated.spring(sheetTranslateY, {
            toValue: 0, damping: 28, stiffness: 120, mass: 1, useNativeDriver: true,
          }),
        ]).start();
      });
    } else if (modalVisible) {
      runCloseAnimation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleBackdropPress = () => {
    runCloseAnimation(onClose);
  };

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={handleBackdropPress}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
      </Animated.View>
      <View style={styles.sheetWrapper} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheetContainer,
            { maxHeight, transform: [{ translateY: sheetTranslateY }] },
            containerStyle,
          ]}
        >
          <View style={[styles.handle, { backgroundColor: handleColor }]} />
          {showCloseButton && (
            <TouchableOpacity onPress={handleBackdropPress} style={styles.closeBtn} activeOpacity={0.7}>
              <XIcon size={16} color="#666" weight="bold" />
            </TouchableOpacity>
          )}
          {title ? (
            <Text style={[styles.title, { color: titleColor, borderBottomColor: titleSeparatorColor }]}>
              {title}
            </Text>
          ) : null}
          <ScrollView
            style={[styles.scroll, contentStyle]}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheetWrapper: { flex: 1, justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  closeBtn: {
    position: 'absolute', top: 16, right: 16,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 10,
  },
  title: {
    fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold',
    textAlign: 'center',
    paddingHorizontal: 24, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  scroll: { paddingHorizontal: 24 },
  footer: {
    paddingHorizontal: 24, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
  },
});
