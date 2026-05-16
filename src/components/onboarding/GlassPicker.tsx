import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Portal } from '@gorhom/portal';
import { CaretDown, MagnifyingGlass } from 'phosphor-react-native';
import { sportive } from '../../theme/sportive';

export interface PickerOption {
  label: string;
  value: string;
}

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('screen');

export const GlassPicker: React.FC<Props> = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Seç',
  error,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? '',
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return options;
    return options.filter((o) => o.label.toLocaleLowerCase('tr').includes(q));
  }, [options, query]);

  const openSheet = () => {
    if (disabled) return;
    setOpen(true);
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(sheetTranslateY, { toValue: 0, damping: 28, stiffness: 120, mass: 1, useNativeDriver: true }),
    ]).start();
  };

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: SCREEN_HEIGHT, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setOpen(false);
      setQuery('');
    });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={openSheet}
        style={[
          styles.field,
          error && styles.fieldError,
          disabled && styles.fieldDisabled,
        ]}
      >
        <Text style={[styles.valueText, !selectedLabel && styles.placeholderText]} numberOfLines={1}>
          {selectedLabel || placeholder}
        </Text>
        <CaretDown size={16} color={sportive.colors.textTertiary} weight="bold" />
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {open && (
        <Portal>
          <View
            style={[styles.portalRoot, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}
            pointerEvents="box-none"
          >
            <TouchableWithoutFeedback onPress={closeSheet}>
              <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
            </TouchableWithoutFeedback>

            <Animated.View style={[styles.sheetCard, { transform: [{ translateY: sheetTranslateY }] }]}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>{label}</Text>

              <View style={styles.searchBox}>
                <MagnifyingGlass size={16} color={sportive.colors.textTertiary} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Ara…"
                  placeholderTextColor={sportive.colors.textMuted}
                  selectionColor={sportive.colors.accent}
                  style={styles.searchInput}
                  autoCorrect={false}
                />
              </View>

              <ScrollView
                style={styles.sheetScroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {filtered.length === 0 ? (
                  <Text style={styles.emptyText}>Sonuç bulunamadı</Text>
                ) : (
                  filtered.map((option) => {
                    const isActive = option.value === value;
                    return (
                      <Pressable
                        key={`${option.value}-${option.label}`}
                        style={styles.optionItem}
                        onPress={() => {
                          onChange(option.value);
                          closeSheet();
                        }}
                      >
                        <Text style={[styles.optionText, isActive && styles.optionTextActive]}>
                          {option.label}
                        </Text>
                        {isActive && <View style={styles.optionDot} />}
                      </Pressable>
                    );
                  })
                )}
                <View style={{ height: 40 }} />
              </ScrollView>
            </Animated.View>
          </View>
        </Portal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { ...sportive.type.tactical, color: sportive.colors.textSecondary, marginBottom: 6, marginLeft: 4 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: sportive.colors.glassInputBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: sportive.colors.glassBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fieldError: { borderColor: sportive.colors.error },
  fieldDisabled: { opacity: 0.4 },
  valueText: { flex: 1, ...sportive.type.body, color: sportive.colors.textPrimary },
  placeholderText: { color: sportive.colors.textMuted },
  errorText: { ...sportive.type.caption, color: sportive.colors.error, marginTop: 4, marginLeft: 4 },

  portalRoot: { position: 'absolute', top: 0, left: 0, zIndex: 9999, elevation: 9999, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetCard: {
    backgroundColor: sportive.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: sportive.colors.glassBorder,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: sportive.colors.glassBorder,
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  sheetTitle: {
    ...sportive.type.h3,
    color: sportive.colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingBottom: 14,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 14,
    backgroundColor: sportive.colors.glassInputBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: sportive.colors.glassBorder,
    borderRadius: 12,
  },
  searchInput: { flex: 1, ...sportive.type.body, color: sportive.colors.textPrimary, paddingVertical: 12 },
  sheetScroll: { paddingHorizontal: 20, maxHeight: 420 },
  emptyText: { ...sportive.type.body, color: sportive.colors.textTertiary, textAlign: 'center', paddingVertical: 28 },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: sportive.colors.glassBorder,
  },
  optionText: { ...sportive.type.body, color: sportive.colors.textSecondary },
  optionTextActive: { color: sportive.colors.textPrimary, fontFamily: 'PlusJakartaSans_700Bold' },
  optionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: sportive.colors.accent },
});
