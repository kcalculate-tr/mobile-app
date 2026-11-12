// Gönderi menüsü (⋯) — Final FinPostMenu / FinPostMenuBlock / FinReport /
// FinReportDone (G15-S3).
//  - Menü (sheet): Bağlantıyı kopyala · Şikayet et · Engelle (satırlar arası ince
//    çizgi) + çerçeveli Vazgeç. Kendi gönderinde: Düzenle (varsa) · Sil.
//  - Engelle → onay sheet'i (ikon dairesi, başlık, açıklama, siyah Engelle, Vazgeç).
//  - Şikayet et → TAM SAYFA neden + not + Gönder → Teşekkürler sayfası
//    (engelle / sessize al / benzerlerini daha az göster, Tamam). ReportFlow.tsx.
//  - Sil → onay (kendi gönderin).
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, fontFamily, haptic, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { BottomSheet } from './BottomSheet';
import { Icon, type IconName } from './icons';
import { BlockConfirm, ReportModal } from './ReportFlow';
import type { ReportReason } from './format';

type SheetView = 'menu' | 'block' | 'delete';
type VitrinStep = 'menu' | 'block' | 'report' | 'reportDone';

function MenuRow({
  icon,
  label,
  last,
  onPress,
}: {
  icon: IconName;
  label: string;
  last?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: t.color.line },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Icon name={icon} size={22} color={t.color.ink} />
      <AppText variant="body" style={[styles.rowText, { color: t.color.ink }]}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function PostMenu({
  visible,
  onClose,
  authorName,
  isMine = false,
  canEdit = false,
  onCopyLink,
  onReport,
  onBlock,
  onMute,
  onLessLike,
  onDelete,
  onEdit,
  vitrinStep,
  vitrinNote,
}: {
  visible: boolean;
  onClose: () => void;
  authorName: string;
  // G8 — kendi gönderin: şikayet/engelle yerine "Sil".
  isMine?: boolean;
  // G11 — kendi gönderin + update_my_post RPC varsa "Düzenle" (yoksa gizli).
  canEdit?: boolean;
  /** Bağlantıyı kopyala. G25-S1 md.7 (A10): verilmezse (bayrak `paylasim_baglanti` kapalı) düğme çizilmez. */
  onCopyLink?: () => void;
  /** Şikayet: neden + isteğe bağlı not. false → başarısız (sayfada sakin not). */
  onReport: (reason: ReportReason, note?: string) => void | boolean | Promise<boolean | void>;
  onBlock: () => void;
  /** G15 — Teşekkürler sayfası seçenekleri; verilmezse satır görünmez. */
  onMute?: () => void;
  onLessLike?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  /** YALNIZ __DEV__ vitrini: açılış adımı + örnek not. */
  vitrinStep?: VitrinStep;
  vitrinNote?: string;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const initialSheet: SheetView = vitrinStep === 'block' ? 'block' : 'menu';
  const [view, setView] = useState<SheetView>(initialSheet);
  const [reportOpen, setReportOpen] = useState(
    vitrinStep === 'report' || vitrinStep === 'reportDone',
  );

  // Her açılışta menüden başla.
  useEffect(() => {
    if (visible) {
      setView(initialSheet);
      setReportOpen(vitrinStep === 'report' || vitrinStep === 'reportDone');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const close = () => {
    setReportOpen(false);
    onClose();
  };

  const cancelBtn = (onPress: () => void) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tr('common.cancel')}
      style={({ pressed }) => [
        styles.cancel,
        { borderColor: t.isDark ? '#48484A' : '#C3C7CC' },
        pressed && { opacity: 0.9 },
      ]}
    >
      <AppText variant="body" style={[styles.cancelText, { color: t.color.ink }]}>
        {tr('common.cancel')}
      </AppText>
    </Pressable>
  );

  return (
    <>
      <BottomSheet
        visible={visible && !reportOpen}
        onClose={close}
        accessibilityLabel={tr('kesfet.ui.a11y.post_menu')}
      >
        {view === 'menu' ? (
          <View style={styles.group}>
            {onCopyLink ? (
              <MenuRow
                icon="link"
                label={tr('kesfet.ui.menu.copy_link')}
                onPress={() => {
                  haptic('selection');
                  onCopyLink();
                  close();
                }}
              />
            ) : null}
            {isMine ? (
              <>
                {canEdit && onEdit ? (
                  <MenuRow
                    icon="pencil"
                    label={tr('kesfet.ui.menu.edit')}
                    onPress={() => {
                      haptic('selection');
                      onEdit();
                      close();
                    }}
                  />
                ) : null}
                <MenuRow icon="trash" label={tr('kesfet.ui.menu.delete')} onPress={() => setView('delete')} />
              </>
            ) : (
              <>
                <MenuRow icon="flag" label={tr('kesfet.ui.menu.report')} onPress={() => setReportOpen(true)} />
                <MenuRow icon="slash" label={tr('kesfet.ui.menu.block')} onPress={() => setView('block')} />
              </>
            )}
            {cancelBtn(close)}
          </View>
        ) : view === 'delete' ? (
          <View style={styles.group}>
            <AppText accessibilityRole="header" style={[styles.title, { color: t.color.ink }]}>
              {tr('kesfet.ui.delete_confirm_title')}
            </AppText>
            <AppText variant="body" tone="secondary" style={styles.desc}>
              {tr('kesfet.ui.delete_confirm_desc')}
            </AppText>
            <Pressable
              onPress={() => {
                haptic('medium');
                onDelete?.();
                close();
              }}
              accessibilityRole="button"
              accessibilityLabel={tr('kesfet.ui.menu.delete')}
              style={({ pressed }) => [styles.primary, { backgroundColor: t.color.ink, opacity: pressed ? 0.9 : 1 }]}
            >
              <AppText variant="body" style={[styles.cancelText, { color: t.isDark ? '#0A0A0A' : '#FFFFFF' }]}>
                {tr('kesfet.ui.menu.delete')}
              </AppText>
            </Pressable>
            {cancelBtn(() => setView('menu'))}
          </View>
        ) : (
          <BlockConfirm
            name={authorName}
            onConfirm={() => {
              onBlock();
              close();
            }}
            onCancel={() => setView('menu')}
          />
        )}
      </BottomSheet>

      <ReportModal
        visible={visible && reportOpen}
        authorName={authorName}
        onSubmit={(reason, note) => onReport(reason, note)}
        onBlock={onBlock}
        onMute={onMute}
        onLessLike={onLessLike}
        onClose={close}
        initialStep={vitrinStep === 'reportDone' ? 'done' : 'reason'}
        initialReason={vitrinStep === 'report' ? 'wrong_info' : null}
        initialNote={vitrinNote}
      />
    </>
  );
}

const styles = StyleSheet.create({
  group: { paddingBottom: 4 },
  row: { minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowText: { fontSize: 16, lineHeight: 22 },
  title: { fontFamily: fontFamily.headingBold, fontSize: 22, lineHeight: 28, marginBottom: 8 },
  desc: { marginBottom: 16, fontSize: 15, lineHeight: 21 },
  primary: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  cancel: { height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  cancelText: { fontSize: 15, fontFamily: fontFamily.bodySemibold },
});
