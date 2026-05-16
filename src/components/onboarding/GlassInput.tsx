import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, TextInputProps } from 'react-native';
import { Eye, EyeSlash } from 'phosphor-react-native';
import { sportive } from '../../theme/sportive';

interface Props extends TextInputProps {
  label: string;
  secure?: boolean;
  error?: string;
}

export const GlassInput: React.FC<Props> = ({ label, secure, error, ...rest }) => {
  const [hidden, setHidden] = useState(secure);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, error && styles.fieldError]}>
        <TextInput
          {...rest}
          secureTextEntry={hidden}
          style={styles.input}
          placeholderTextColor={sportive.colors.textMuted}
          selectionColor={sportive.colors.accent}
        />
        {secure && (
          <Pressable onPress={() => setHidden(h => !h)} style={styles.eye}>
            {hidden ? <EyeSlash size={18} color={sportive.colors.textTertiary} /> : <Eye size={18} color={sportive.colors.textTertiary} />}
          </Pressable>
        )}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { ...sportive.type.tactical, color: sportive.colors.textSecondary, marginBottom: 6, marginLeft: 4 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: sportive.colors.glassInputBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: sportive.colors.glassBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  fieldError: { borderColor: sportive.colors.error },
  input: { flex: 1, ...sportive.type.body, color: sportive.colors.textPrimary, paddingVertical: 14 },
  eye: { padding: 4 },
  errorText: { ...sportive.type.caption, color: sportive.colors.error, marginTop: 4, marginLeft: 4 },
});
