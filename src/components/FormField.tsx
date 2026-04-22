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
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';

export interface FormFieldOption {
  label: string;
  value: string;
}

type FormFieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  onChangeText: (value: string) => void;
  error?: string;
  editable?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  type?: 'input' | 'textarea' | 'select';
  options?: FormFieldOption[];
  onFocus?: () => void;
};

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('screen');

const FormField = React.forwardRef<TextInput, FormFieldProps>(function FormField({
  label,
  value,
  placeholder,
  onChangeText,
  error,
  editable = true,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  type = 'input',
  options = [],
  onFocus: onFocusProp,
}: FormFieldProps, ref) {
  const [focused, setFocused] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const selectedLabel = useMemo(() => {
    if (type !== 'select') return '';
    return options.find((option) => option.value === value)?.label || '';
  }, [options, type, value]);

  const openSheet = () => {
    if (!editable) return;
    setFocused(true);
    setSheetOpen(true);
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        damping: 28,
        stiffness: 120,
        mass: 1,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: SCREEN_HEIGHT,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSheetOpen(false);
      setFocused(false);
    });
  };

  const containerStyle = [
    styles.input,
    focused && styles.inputFocused,
    Boolean(error) && styles.inputError,
    !editable && styles.inputDisabled,
  ];

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>

      {type === 'select' ? (
        <>
          <Pressable style={containerStyle} onPress={openSheet}>
            <Text style={[styles.inputText, !selectedLabel && styles.placeholderText]}>
              {selectedLabel || placeholder || 'Seçiniz'}
            </Text>
          </Pressable>

          {sheetOpen && (
            <Portal>
              <View
                style={[
                  styles.portalRoot,
                  { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
                ]}
                pointerEvents="box-none"
              >
                <TouchableWithoutFeedback onPress={closeSheet}>
                  <Animated.View
                    style={[styles.backdrop, { opacity: backdropOpacity }]}
                  />
                </TouchableWithoutFeedback>

                <Animated.View
                  style={[
                    styles.sheetCard,
                    { transform: [{ translateY: sheetTranslateY }] },
                  ]}
                >
                  <View style={styles.sheetHandle} />
                  <Text style={styles.sheetTitle}>{label}</Text>
                  <ScrollView
                    style={styles.sheetScroll}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {options.map((option) => {
                      const isActive = option.value === value;
                      return (
                        <Pressable
                          key={`${option.value}-${option.label}`}
                          style={styles.optionItem}
                          onPress={() => {
                            onChangeText(option.value);
                            closeSheet();
                          }}
                        >
                          <Text
                            style={[
                              styles.optionText,
                              isActive && styles.optionTextActive,
                            ]}
                          >
                            {option.label}
                          </Text>
                          {isActive && <View style={styles.optionDot} />}
                        </Pressable>
                      );
                    })}
                    <View style={{ height: 40 }} />
                  </ScrollView>
                </Animated.View>
              </View>
            </Portal>
          )}
        </>
      ) : (
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.text.disabled}
          style={[containerStyle, type === 'textarea' && styles.textarea]}
          editable={editable}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={type === 'textarea'}
          onFocus={() => { setFocused(true); onFocusProp?.(); }}
          onBlur={() => setFocused(false)}
          textAlignVertical={type === 'textarea' ? 'top' : 'center'}
        />
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
});

export default FormField;

const styles = StyleSheet.create({
  fieldContainer: {
    marginBottom: SPACING.lg,
  },
  label: {
    color: COLORS.text.primary,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginBottom: SPACING.sm,
  },
  input: {
    minHeight: 52,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border.strong,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
  },
  inputFocused: {
    borderColor: COLORS.brand.green,
    shadowColor: COLORS.brand.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  inputDisabled: {
    backgroundColor: COLORS.gray[100],
  },
  inputText: {
    color: COLORS.text.primary,
    fontSize: TYPOGRAPHY.size.md,
  },
  placeholderText: {
    color: COLORS.text.disabled,
  },
  textarea: {
    minHeight: 96,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    fontSize: TYPOGRAPHY.size.md,
  },
  errorText: {
    marginTop: SPACING.xs,
    color: COLORS.error,
    fontSize: TYPOGRAPHY.size.sm,
  },

  // Portal sheet
  portalRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 9999,
    elevation: 9999,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000',
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sheetScroll: {
    paddingHorizontal: 24,
    maxHeight: 400,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  optionText: {
    color: COLORS.text.primary,
    fontSize: TYPOGRAPHY.size.md,
  },
  optionTextActive: {
    color: COLORS.text.primary,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  optionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.brand.green,
  },
});