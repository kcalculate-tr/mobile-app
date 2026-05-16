import React, { useRef, useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { sportive } from '../../theme/sportive';

interface Props {
  length?: number;
  onComplete: (code: string) => void;
  error?: boolean;
}

export const OTPInput: React.FC<Props> = ({ length = 6, onComplete, error }) => {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const refs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (values.every(v => v.length === 1)) {
      onComplete(values.join(''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  const handleChange = (text: string, idx: number) => {
    if (text.length > 1) {
      const pasted = text.replace(/\D/g, '').slice(0, length).split('');
      const next = [...values];
      pasted.forEach((c, i) => { if (idx + i < length) next[idx + i] = c; });
      setValues(next);
      const nextFocus = Math.min(idx + pasted.length, length - 1);
      refs.current[nextFocus]?.focus();
      return;
    }

    const cleaned = text.replace(/\D/g, '');
    const next = [...values];
    next[idx] = cleaned;
    setValues(next);

    if (cleaned && idx < length - 1) refs.current[idx + 1]?.focus();
  };

  const handleKeyPress = (e: any, idx: number) => {
    if (e.nativeEvent.key === 'Backspace' && !values[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  };

  return (
    <View style={styles.row}>
      {values.map((v, i) => (
        <Pressable key={i} onPress={() => refs.current[i]?.focus()} style={styles.cellWrap}>
          <TextInput
            ref={el => { refs.current[i] = el; }}
            value={v}
            onChangeText={t => handleChange(t, i)}
            onKeyPress={e => handleKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={length}
            style={[
              styles.cell,
              v && styles.cellFilled,
              error && styles.cellError,
            ]}
            selectionColor={sportive.colors.accent}
            textContentType={i === 0 ? 'oneTimeCode' : 'none'}
            autoComplete={i === 0 ? 'sms-otp' : 'off'}
          />
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cellWrap: { flex: 1, aspectRatio: 3 / 4 },
  cell: {
    flex: 1,
    backgroundColor: sportive.colors.glassInputBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: sportive.colors.glassBorder,
    borderRadius: 10,
    textAlign: 'center',
    color: sportive.colors.textPrimary,
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  cellFilled: {
    backgroundColor: sportive.colors.glassActive,
    borderColor: sportive.colors.borderActive,
  },
  cellError: { borderColor: sportive.colors.error },
});
