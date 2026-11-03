// Gönderi düzenleme alt-sayfası (G11-S3) — kendi gönderinde PostMenu "Düzenle"
// açar. Gövdeyi düzenle → update_my_post. Yayındaki gönderinin gövdesi değişince
// sunucu status='pending' döner → kartta "İncelemede". Sade: metin + Kaydet.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText, useTheme, haptic } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { BottomSheet } from './BottomSheet';
import { MAX_BODY } from '../composer';

export function EditPostSheet({
  visible,
  initialBody,
  onClose,
  onSave,
}: {
  visible: boolean;
  initialBody: string;
  onClose: () => void;
  onSave: (body: string) => void;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const [body, setBody] = useState(initialBody);

  useEffect(() => {
    if (visible) setBody(initialBody);
  }, [visible, initialBody]);

  const trimmed = body.trim();
  const canSave = trimmed.length > 0 && trimmed.length <= MAX_BODY && trimmed !== initialBody.trim();

  return (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel={tr('kesfet.ui.edit_title')}>
      <View style={styles.group}>
        <AppText variant="heading" style={styles.title}>
          {tr('kesfet.ui.edit_title')}
        </AppText>
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={MAX_BODY}
          placeholder={tr('kesfet.compose.body_placeholder')}
          placeholderTextColor={t.color.secondary}
          style={[styles.input, { color: t.color.ink, backgroundColor: t.color.surface, borderColor: t.color.line }]}
          accessibilityLabel={tr('kesfet.ui.edit_title')}
          autoFocus
        />
        <Pressable
          onPress={() => {
            if (!canSave) return;
            haptic('light');
            onSave(trimmed);
          }}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityLabel={tr('kesfet.ui.edit_save')}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: canSave ? t.color.ink : t.color.line, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <AppText variant="body" style={{ color: canSave ? t.color.surface : t.color.secondary, fontWeight: '700' }}>
            {tr('kesfet.ui.edit_save')}
          </AppText>
        </Pressable>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={tr('common.cancel')}
          style={({ pressed }) => [styles.cancel, { borderColor: t.color.line }, pressed && { opacity: 0.9 }]}
        >
          <AppText variant="body" style={{ fontWeight: '600' }}>
            {tr('common.cancel')}
          </AppText>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  group: { gap: 10, paddingBottom: 4 },
  title: { marginBottom: 2 },
  input: { minHeight: 120, borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 16, textAlignVertical: 'top' },
  saveBtn: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  cancel: { minHeight: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
