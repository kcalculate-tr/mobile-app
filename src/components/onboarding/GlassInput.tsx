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

  // QuickType predictive bar'ı ("Ben/Tamam/Sen") tüm alanlarda kapat; ama email,
  // şifre (Keychain) ve telefon autofill'ini KORU. Caller bir prop verdiyse (??)
  // ona saygı gösterilir — sadece eksik olanlara güvenli default uygulanır.
  const isSecureField = secure === true;
  const isEmailField = rest.keyboardType === 'email-address' || rest.autoComplete === 'email';
  const isPhoneField = rest.keyboardType === 'phone-pad' || rest.autoComplete === 'tel';
  const resolvedAutoCorrect = rest.autoCorrect ?? false;
  const resolvedSpellCheck = rest.spellCheck ?? false;
  const resolvedAutoComplete =
    rest.autoComplete ??
    (isSecureField ? 'password' : isEmailField ? 'email' : isPhoneField ? 'tel' : 'off');
  const resolvedTextContentType =
    rest.textContentType ??
    (isSecureField
      ? (rest.autoComplete === 'password-new' ? 'newPassword' : 'password')
      : isEmailField
        ? 'emailAddress'
        : isPhoneField
          ? 'telephoneNumber'
          : 'none');

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, error && styles.fieldError]}>
        <TextInput
          {...rest}
          secureTextEntry={hidden}
          autoCorrect={resolvedAutoCorrect}
          spellCheck={resolvedSpellCheck}
          autoComplete={resolvedAutoComplete}
          textContentType={resolvedTextContentType}
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
