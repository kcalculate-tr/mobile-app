// eatkcal v2 (G13-S2 md.5) — adres formu parçaları (FinEkAddress*):
// 13 pt etiketli 44 pt giriş, Ev/İş/Diğer başlık çipleri, liste seçici sheet,
// adres kartı harita küçük resmi.
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { FinText as Text } from '../../../../../core/design/components/FinText';
import { Sheet, haptic } from '../../../../../core/design';
import { CaretDown, Check, House, MapPin, Storefront } from '../../../../../components/icons';
import { ekType, useEk } from '../kit';
import type { Option, TitleChip } from '../../model/addressModel';
import { SCROLL_KEYBOARD } from '../../../../../core/design/keyboard';

/** Etiket (13) + dolgulu giriş (44, 12 köşe) — pano `label > input`. */
export function AddressInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  style,
  testID,
  autoComplete,
  textContentType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
}) {
  const { c } = useEk();
  return (
    <View style={[styles.field, style]}>
      <Text style={[ekType.c13, { color: c.secondary }]} numberOfLines={1}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.secondary}
        keyboardType={keyboardType}
        autoComplete={autoComplete}
        textContentType={textContentType}
        autoCapitalize={autoCapitalize}
        accessibilityLabel={label}
        testID={testID}
        style={[ekType.b15, styles.input, { backgroundColor: c.line, color: c.ink }]}
      />
    </View>
  );
}

/** Seçici alan — dokununca liste sheet'i açar (ilçe/mahalle). */
export function AddressSelectField({
  label,
  value,
  placeholder,
  onPress,
  disabled,
  style,
  testID,
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { c } = useEk();
  return (
    <View style={[styles.field, style]}>
      <Text style={[ekType.c13, { color: c.secondary }]} numberOfLines={1}>
        {label}
      </Text>
      <Pressable
        onPress={() => {
          if (disabled) return;
          haptic('selection');
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        accessibilityState={{ disabled: !!disabled }}
        testID={testID}
        style={[styles.input, styles.select, { backgroundColor: c.line, opacity: disabled ? 0.5 : 1 }]}
      >
        <Text style={[ekType.b15, { color: value ? c.ink : c.secondary, flex: 1 }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <CaretDown size={16} color={c.secondary} />
      </Pressable>
    </View>
  );
}

const CHIP_ICON = { home: House, work: Storefront, other: MapPin } as const;

/** Ev · İş · Diğer (radyo grubu). Seçili = lime dolgu + koyu metin. */
export function TitleChips({
  value,
  onChange,
  labels,
  groupLabel,
}: {
  value: TitleChip;
  onChange: (v: TitleChip) => void;
  labels: Record<TitleChip, string>;
  groupLabel: string;
}) {
  const { c } = useEk();
  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={groupLabel}>
      {(['home', 'work', 'other'] as TitleChip[]).map((k) => {
        const on = value === k;
        const Icon = CHIP_ICON[k];
        return (
          <Pressable
            key={k}
            onPress={() => {
              haptic('selection');
              onChange(k);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            testID={`ek-address-chip-${k}`}
            style={[
              styles.chip,
              on ? { backgroundColor: c.accent } : { backgroundColor: c.surface, borderColor: c.line, borderWidth: 1 },
            ]}
          >
            <Icon size={16} color={on ? c.onAccent : c.ink} weight={on ? 'fill' : 'regular'} />
            <Text style={[ekType.b15s, { color: on ? c.onAccent : c.ink }]}>{labels[k]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Liste seçici (ortak Sheet) — ilçe/mahalle; seçenekler delivery_zones'tan. */
export function OptionPickerSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: Option[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  const { c } = useEk();
  return (
    <Sheet visible={visible} onClose={onClose} title={title} product="eat" maxHeightRatio={0.75}>
      <ScrollView {...SCROLL_KEYBOARD} style={{ maxHeight: 480 }}>
        {options.map((o) => {
          const on = o.value === selected;
          return (
            <Pressable
              key={o.value}
              onPress={() => {
                haptic('selection');
                onSelect(o.value);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.optionRow, { borderBottomColor: c.line }]}
            >
              <Text style={[ekType.b15m, { color: c.ink, flex: 1 }]}>{o.label}</Text>
              {on ? <Check size={18} color={c.accentLine} weight="bold" /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

/** Adres kartı küçük resmi (80×80, 14 köşe) — sabit pin; canlı harita yok. */
export function MapThumb({ label }: { label: string }) {
  const { c, theme } = useEk();
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.thumb, { backgroundColor: theme.isDark ? c.surfaceRaised : '#E6E8E3' }]}
    >
      <View style={[styles.thumbRoad, { backgroundColor: theme.isDark ? c.line : '#FFFFFF' }]} />
      <View style={[styles.thumbRoad2, { backgroundColor: theme.isDark ? c.line : '#FFFFFF' }]} />
      <MapPin size={24} color={c.ink} weight="fill" />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 3, minWidth: 0 },
  input: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12 },
  select: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRoad: { position: 'absolute', left: -10, right: -10, top: 30, height: 8, transform: [{ rotate: '-18deg' }] },
  thumbRoad2: { position: 'absolute', top: -10, bottom: -10, left: 46, width: 6, transform: [{ rotate: '12deg' }] },
});
