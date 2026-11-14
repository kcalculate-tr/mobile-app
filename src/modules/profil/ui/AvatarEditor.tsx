// G53-S1 md.2 — Kendi profil fotoğrafı için lime "+" rozeti + seçenek sayfası.
//
// Yalnız KENDİ profilinde kullanılır (Profil sekmesi başlığı, kendi herkese açık profil ekranı); başkasının
// profilinde çağıran bileşen çizmez. Rozet: 24 pt lime daire, beyaz/koyu (zemin rengi) kenar, 44 pt dokunma alanı,
// avatarın sağ altında. Dokununca alttan küçük sayfa: "Fotoğraf çek" · "Galeriden seç" · (foto varsa)
// "Fotoğrafı kaldır". Seçim → kare kırpma (allowsEditing + 1:1) → ANINDA yerel foto + avatar üstünde küçük dönen
// gösterge → mevcut yükleme yolu (avatars kovası → update_public_profile). Hata → eski foto + kısa uyarı.
// Akış mantığı saf: ../avatarChange.ts (node:test).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Sheet, haptic, palette, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import { CameraIcon, ImageSquare, Plus, Trash } from '../../../components/icons';
import { AddToast, type ToastState } from '../../kesfet/ui/AddToast';
import { avatarSheetOptions, runAvatarChange, runAvatarRemove, type AvatarSource } from '../avatarChange';
import { pickAvatarImage, removeAvatarUrl, saveAvatarUrl, uploadAvatarUri } from '../avatarUpload';
import { useMyProfileStore } from '../myProfileStore';

/** Sayfa kapanma geçişi bitmeden sistem seçicisi açılırsa iOS sunumu reddeder → kısa bekleme. */
const PICKER_DELAY_MS = 350;

export interface AvatarEditorState {
  /** Ekranda gösterilecek avatar (iyimser). */
  shown: string | null;
  busy: boolean;
  open: () => void;
  overlay: React.ReactNode;
}

export function useAvatarEditor({ current, onChanged }: { current: string | null; onChanged?: (url: string | null) => void }): AvatarEditorState {
  const { t: tr } = useT();
  const { user } = useAuth();
  // undefined = çağıranın değerini izle; bir değişimden sonra (başarı ya da geri alma) yerel değer.
  const [local, setLocal] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const shown = local !== undefined ? local : current;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  const safe = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => {
    if (alive.current) fn(...a);
  };

  const choose = useCallback(
    async (source: AvatarSource) => {
      const uid = user?.id;
      if (!uid || busy) return;
      setSheet(false);
      await new Promise((r) => setTimeout(r, PICKER_DELAY_MS));
      const prev = shownRef.current;
      let last: string | null = prev;
      const res = await runAvatarChange(source, prev, {
        pick: pickAvatarImage,
        upload: (uri) => uploadAvatarUri(uid, uri),
        save: saveAvatarUrl,
        apply: (u) => {
          last = u;
          safe(setLocal)(u);
        },
        setBusy: safe(setBusy),
      });
      if (res === 'updated') {
        haptic('success');
        const url = last;
        useMyProfileStore.getState().setAvatar(url);
        onChanged?.(url);
      } else if (res === 'failed') {
        haptic('warning');
        safe(setToast)({ message: tr('avatar_edit.failed'), actionLabel: tr('avatar_edit.retry'), onAction: () => void choose(source) });
      } else if (res === 'denied') {
        safe(setToast)({ message: tr('avatar_edit.camera_denied') });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, busy, onChanged, tr],
  );

  const remove = useCallback(async () => {
    const uid = user?.id;
    if (!uid || busy) return;
    setSheet(false);
    const res = await runAvatarRemove(shownRef.current, { remove: () => removeAvatarUrl(uid), apply: safe(setLocal), setBusy: safe(setBusy) });
    if (res === 'removed') {
      useMyProfileStore.getState().setAvatar(null);
      onChanged?.(null);
    } else if (res === 'remove_failed') {
      haptic('warning');
      safe(setToast)({ message: tr('avatar_edit.remove_failed') });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, busy, onChanged, tr]);

  const overlay = (
    <>
      <AvatarOptionsSheet
        visible={sheet}
        hasPhoto={Boolean(shown)}
        onClose={() => setSheet(false)}
        onTake={() => void choose('camera')}
        onLibrary={() => void choose('library')}
        onRemove={() => void remove()}
      />
      <AddToast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );

  return {
    shown,
    busy,
    open: () => {
      if (busy) return;
      haptic('selection');
      setSheet(true);
    },
    overlay,
  };
}

export function AvatarOptionsSheet({
  visible,
  hasPhoto,
  onClose,
  onTake,
  onLibrary,
  onRemove,
}: {
  visible: boolean;
  hasPhoto: boolean;
  onClose: () => void;
  onTake: () => void;
  onLibrary: () => void;
  onRemove: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const rows = avatarSheetOptions(hasPhoto).map((k) =>
    k === 'take'
      ? { k, label: tr('avatar_edit.take'), icon: <CameraIcon size={22} color={t.color.ink} />, onPress: onTake }
      : k === 'library'
        ? { k, label: tr('avatar_edit.library'), icon: <ImageSquare size={22} color={t.color.ink} />, onPress: onLibrary }
        : { k, label: tr('avatar_edit.remove'), icon: <Trash size={22} color={t.color.ink} />, onPress: onRemove },
  );
  return (
    <Sheet visible={visible} onClose={onClose} title={tr('avatar_edit.sheet_title')} testID="avatar-edit-sheet">
      <View style={[styles.group, { backgroundColor: t.color.surface }]}>
        {rows.map((r, i) => (
          <Pressable
            key={r.k}
            onPress={r.onPress}
            accessibilityRole="button"
            accessibilityLabel={r.label}
            testID={`avatar-edit-${r.k}`}
            style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.color.line }, pressed && { opacity: 0.6 }]}
          >
            {r.icon}
            <AppText style={styles.rowText}>{r.label}</AppText>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={onClose} accessibilityRole="button" style={styles.cancel} testID="avatar-edit-cancel">
        <AppText tone="secondary" style={styles.rowText}>
          {tr('avatar_edit.cancel')}
        </AppText>
      </Pressable>
    </Sheet>
  );
}

/**
 * Avatar çerçevesi: çocuk (avatar) + yüklenirken üstünde küçük dönen gösterge + sağ altta "+" rozeti.
 * `ringColor`: rozet kenarı = avatarın oturduğu zemin rengi (açıkta beyaz, koyuda koyu).
 */
export function AvatarEditFrame({
  size,
  editor,
  ringColor,
  children,
  testID = 'avatar-edit',
}: {
  size: number;
  editor: AvatarEditorState;
  ringColor: string;
  children: React.ReactNode;
  testID?: string;
}) {
  const { t: tr } = useT();
  return (
    <View style={{ width: size, height: size }} testID={`${testID}-frame`}>
      {children}
      {editor.busy ? (
        <View
          style={[StyleSheet.absoluteFill, styles.busy, { borderRadius: size / 2 }]}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={tr('avatar_edit.uploading')}
          testID={`${testID}-busy`}
        >
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      ) : null}
      <Pressable
        onPress={editor.open}
        disabled={editor.busy}
        accessibilityRole="button"
        accessibilityLabel={tr('avatar_edit.badge_a11y')}
        accessibilityState={{ disabled: editor.busy }}
        style={styles.hit}
        testID={`${testID}-badge`}
      >
        <View style={[styles.badge, { borderColor: ringColor }]}>
          <Plus size={14} color={palette.limeInk} weight="bold" />
        </View>
      </Pressable>
    </View>
  );
}

const BADGE = 24;
const HIT = 44;

const styles = StyleSheet.create({
  busy: { backgroundColor: 'rgba(10,10,10,0.38)', alignItems: 'center', justifyContent: 'center' },
  // 44 pt dokunma alanı, ortasında 24 pt rozet; rozet avatar kutusunun sağ alt köşesine oturur.
  hit: { position: 'absolute', right: -(HIT - BADGE) / 2, bottom: -(HIT - BADGE) / 2, width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  badge: { width: BADGE, height: BADGE, borderRadius: BADGE / 2, borderWidth: 2, backgroundColor: palette.lime, alignItems: 'center', justifyContent: 'center' },
  group: { borderRadius: 16, overflow: 'hidden' },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  rowText: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  cancel: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
