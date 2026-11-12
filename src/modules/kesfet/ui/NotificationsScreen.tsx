// G15-S3 — Bildirimler TAM SAYFA (Final FinNotifications + FinReportNotice).
// "← Bildirimler" başlığı; bölümler Takip istekleri / Bugün / Bu hafta / Daha önce.
// Okunmamış satır: yüzey zemini + solda yeşil nokta. Avatar köşesinde tür rozeti.
// Aynı tür + aynı gönderi (yorum beğenisinde aynı yorum) aynı bölümde gruplanır:
// "Ayşe ve 12 kişi gönderini beğendi." Takip isteğinde Onayla / Sil
// (respond_follow_request). Şikayet sonucu kartı ve sistem satırları da burada.
// Yalnız `sosyal_bildirim` açıkken kayıtlı rota (AppNavigator).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { AppText, FinListSkeleton, fontFamily, haptic, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { getProfilClient } from '../../profil';

import { useNotificationsStore } from '../notificationsStore';
import type { SocialNotification } from '../types';
import { Avatar } from './Avatar';
import { relativeTime, type UiLang } from './format';
import { NotificationsError } from './NotificationsError';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';

// Final FinNotifications rozet ikonları (Phosphor fill, 256 viewBox).
const BADGE_PATH = {
  userPlus:
    'M256,136a8,8,0,0,1-8,8H232v16a8,8,0,0,1-16,0V144H200a8,8,0,0,1,0-16h16V112a8,8,0,0,1,16,0v16h16A8,8,0,0,1,256,136ZM144,157.68a68,68,0,1,0-71.9,0c-20.65,6.76-39.23,19.39-54.17,37.17A8,8,0,0,0,24,208H192a8,8,0,0,0,6.13-13.15C183.18,177.07,164.6,164.44,144,157.68Z',
  heart:
    'M240,102c0,70-103.79,126.66-108.21,129a8,8,0,0,1-7.58,0C119.79,228.66,16,172,16,102A62.07,62.07,0,0,1,78,40c20.65,0,38.73,8.88,50,23.89C139.27,48.88,157.35,40,178,40A62.07,62.07,0,0,1,240,102Z',
  plus:
    'M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z',
  check:
    'M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z',
  bubble:
    'M232,128A104,104,0,0,1,79.12,219.82L45.07,231.17a16,16,0,0,1-20.24-20.24l11.35-34.05A104,104,0,1,1,232,128Z',
  reply:
    'M232,200a8,8,0,0,1-16,0,88.1,88.1,0,0,0-88-88H51.31l34.35,34.34a8,8,0,0,1-11.32,11.32l-48-48a8,8,0,0,1,0-11.32l48-48A8,8,0,0,1,85.66,61.66L51.31,96H128A104.11,104.11,0,0,1,232,200Z',
  arrowLeft:
    'M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z',
  shield:
    'M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.27,47,25.53a8,8,0,0,0,4.2,0c1-.26,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm0,72c0,37.07-13.66,67.16-40.6,89.42A129.3,129.3,0,0,1,128,223.62a128.25,128.25,0,0,1-38.92-21.81C61.82,179.51,48,149.3,48,112l0-56,160,0ZM82.34,141.66a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32l-56,56a8,8,0,0,1-11.32,0Z',
} as const;

function Glyph({ name, size, color }: { name: keyof typeof BADGE_PATH; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" accessible={false}>
      <Path d={BADGE_PATH[name]} fill={color} />
    </Svg>
  );
}

function badgeFor(kind: SocialNotification['kind']): { icon: keyof typeof BADGE_PATH; lime: boolean } | null {
  switch (kind) {
    case 'follow':
    case 'follow_request':
    case 'follow_accept':
      return { icon: 'userPlus', lime: false };
    case 'like':
    case 'comment_like':
      return { icon: 'heart', lime: false };
    case 'add_to_day':
      return { icon: 'plus', lime: true };
    case 'did_it':
      return { icon: 'check', lime: true };
    case 'comment':
      return { icon: 'bubble', lime: false };
    case 'reply':
      return { icon: 'reply', lime: false };
    default:
      return null;
  }
}

/** Gruplanmış satır: ilk (en yeni) bildirim + aynı gruptaki diğer kişi sayısı. */
export interface NotifGroup {
  key: string;
  head: SocialNotification;
  others: number;
  ids: string[];
  unread: boolean;
}

export type NotifSection = 'requests' | 'today' | 'week' | 'earlier';

const GROUPABLE = new Set<SocialNotification['kind']>(['like', 'add_to_day', 'did_it', 'comment_like']);

/** Saf: bölümle + grupla (test edilebilir). `nowMs` dışarıdan. */
export function groupNotifications(
  items: SocialNotification[],
  nowMs: number,
): Array<{ section: NotifSection; groups: NotifGroup[] }> {
  const startOfToday = new Date(nowMs);
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const weekMs = todayMs - 6 * 24 * 60 * 60 * 1000;
  const sectionOf = (n: SocialNotification): NotifSection => {
    if (n.kind === 'follow_request') return 'requests';
    const at = Date.parse(n.created_at);
    if (Number.isNaN(at) || at >= todayMs) return 'today';
    if (at >= weekMs) return 'week';
    return 'earlier';
  };
  const order: NotifSection[] = ['requests', 'today', 'week', 'earlier'];
  const buckets = new Map<NotifSection, NotifGroup[]>();
  const index = new Map<string, NotifGroup>();
  for (const n of items) {
    const section = sectionOf(n);
    const target = n.kind === 'comment_like' ? n.comment_id : n.post_id;
    const gkey = GROUPABLE.has(n.kind) && target ? `${section}|${n.kind}|${target}` : `${section}|${n.id}`;
    const existing = index.get(gkey);
    if (existing) {
      if (!existing.ids.includes(n.id) && existing.head.actor.id !== n.actor.id) existing.others += 1;
      existing.ids.push(n.id);
      existing.unread = existing.unread || n.read_at == null;
      continue;
    }
    const g: NotifGroup = { key: gkey, head: n, others: 0, ids: [n.id], unread: n.read_at == null };
    index.set(gkey, g);
    const list = buckets.get(section) ?? [];
    list.push(g);
    buckets.set(section, list);
  }
  return order.filter((s) => (buckets.get(s) ?? []).length > 0).map((s) => ({ section: s, groups: buckets.get(s)! }));
}

function Row({
  group,
  nowMs,
  onPress,
  onRespond,
}: {
  group: NotifGroup;
  nowMs: number;
  onPress: () => void;
  onRespond: (accept: boolean) => void;
}) {
  const t = useTheme();
  const { t: tr, lang } = useT();
  const n = group.head;
  const time = relativeTime(n.created_at, nowMs, lang as UiLang);
  const badge = badgeFor(n.kind);
  const isSystem = n.kind === 'system';
  const isKcal = n.actor.handle === 'kcal';
  const excerpt = n.excerpt?.trim() ? n.excerpt.trim() : null;

  let line: string;
  if (isSystem) {
    line = excerpt ?? '';
  } else if (excerpt && (n.kind === 'comment' || n.kind === 'reply')) {
    line = tr(`kesfet.notif.line.${n.kind}_x`, { text: excerpt });
  } else if (excerpt && n.kind === 'did_it') {
    line = tr('kesfet.notif.line.did_it_x', { text: excerpt });
  } else {
    line = tr(`kesfet.notif.line.${n.kind}`);
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: t.color.line },
        group.unread && { backgroundColor: t.color.surface },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: group.unread ? t.color.accentLine : 'transparent' }]} />
      <View style={styles.avatarWrap}>
        <Avatar name={n.actor.display_name} url={n.actor.avatar_url} official={isKcal} size={44} />
        {badge ? (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: badge.lime ? t.color.accent : t.color.surface,
                borderColor: t.color.bg,
              },
            ]}
          >
            <Glyph name={badge.icon} size={12} color={badge.lime ? t.color.onAccent : t.color.ink} />
          </View>
        ) : null}
      </View>
      <AppText variant="body" style={styles.rowText}>
        {isSystem ? null : (
          <>
            <AppText variant="body" style={[styles.rowText, styles.bold]}>
              {n.actor.display_name}
            </AppText>
            {group.others > 0 ? (
              <>
                {` ${tr('kesfet.notif.and')} `}
                <AppText variant="body" style={[styles.rowText, styles.bold]}>
                  {tr('kesfet.notif.n_people', { count: group.others })}
                </AppText>
              </>
            ) : null}{' '}
          </>
        )}
        {line}
        {time ? <AppText variant="body" tone="secondary" style={styles.rowText}>{` ${time}`}</AppText> : null}
      </AppText>
      {n.kind === 'follow_request' ? (
        <View style={styles.reqBtns}>
          <Pressable
            onPress={() => onRespond(true)}
            accessibilityRole="button"
            accessibilityLabel={tr('kesfet.notif.approve')}
            hitSlop={6}
            style={({ pressed }) => [styles.pill, { backgroundColor: t.color.ink, opacity: pressed ? 0.85 : 1 }]}
          >
            <AppText variant="caption" style={[styles.pillText, { color: t.isDark ? '#0A0A0A' : '#FFFFFF' }]}>
              {tr('kesfet.notif.approve')}
            </AppText>
          </Pressable>
          <Pressable
            onPress={() => onRespond(false)}
            accessibilityRole="button"
            accessibilityLabel={tr('kesfet.notif.decline')}
            hitSlop={6}
            style={({ pressed }) => [styles.pill, styles.pillOutline, { borderColor: t.isDark ? '#48484A' : '#C3C7CC', opacity: pressed ? 0.85 : 1 }]}
          >
            <AppText variant="caption" style={styles.pillText}>
              {tr('kesfet.notif.decline')}
            </AppText>
          </Pressable>
        </View>
      ) : n.post_thumb_url ? (
        <View style={[styles.thumb, { backgroundColor: t.isDark ? '#3A3A3C' : '#CFD2D7' }]}>
          <Image source={{ uri: n.post_thumb_url }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
        </View>
      ) : null}
    </Pressable>
  );
}

/** FinReportNotice — şikayet sonucu kartı. excerpt: 'removed' | 'kept'. */
function ReportResultCard({ n, nowMs, onDetails }: { n: SocialNotification; nowMs: number; onDetails?: () => void }) {
  const t = useTheme();
  const { t: tr, lang } = useT();
  const kept = n.excerpt === 'kept';
  const time = relativeTime(n.created_at, nowMs, lang as UiLang);
  return (
    <View style={[styles.reportCard, { backgroundColor: t.color.surface, borderColor: t.color.line }]}>
      <View style={[styles.reportIcon, { backgroundColor: t.color.ink }]}>
        <Glyph name="shield" size={20} color={t.isDark ? '#0A0A0A' : '#FFFFFF'} />
      </View>
      <View style={styles.reportBody}>
        <AppText variant="body" style={[styles.reportTitle, styles.bold]}>
          {tr(kept ? 'kesfet.notif.report.kept_title' : 'kesfet.notif.report.removed_title')}
        </AppText>
        <AppText variant="body" tone="secondary" style={styles.reportDesc}>
          {tr(kept ? 'kesfet.notif.report.kept_desc' : 'kesfet.notif.report.removed_desc')}
        </AppText>
        <View style={styles.reportFoot}>
          <AppText variant="caption" tone="secondary" style={styles.caption13}>
            {time ? time.charAt(0).toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US') + time.slice(1) : ''}
          </AppText>
          {onDetails ? (
            <Pressable onPress={onDetails} accessibilityRole="link" hitSlop={6} style={styles.detailsBtn}>
              <AppText variant="caption" style={[styles.caption13, styles.details]}>
                {tr('kesfet.notif.report.details')}
              </AppText>
            </Pressable>
          ) : (
            <View style={styles.detailsBtn} />
          )}
        </View>
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { t: tr } = useT();
  const items = useNotificationsStore((s) => s.items);
  const loading = useNotificationsStore((s) => s.loading);
  const error = useNotificationsStore((s) => s.error);
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const nowMs = Date.now();

  const loadAndMark = useCallback(() => {
    void useNotificationsStore
      .getState()
      .load()
      .then(() => {
        // Açılışta okundu işaretle (rozet sıfırlanır). Vurgu bu oturumda kalır
        // (ilk yükleme anındaki okunmamışlar) — bkz. `unreadAtOpen`.
        void useNotificationsStore.getState().markAllRead();
      });
  }, []);

  useEffect(() => {
    loadAndMark();
  }, [loadAndMark]);

  // İlk görüldüğü andaki okunmamışları sakla → markAllRead sonrası vurgu kaybolmasın.
  const [unreadAtOpen, setUnreadAtOpen] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (unreadAtOpen == null && items.length > 0) {
      setUnreadAtOpen(new Set(items.filter((n) => n.read_at == null).map((n) => n.id)));
    }
  }, [items, unreadAtOpen]);

  const visible = useMemo(() => {
    const seen = unreadAtOpen ?? new Set<string>();
    return items
      .filter((n) => !handled.has(n.id))
      .map((n) => (seen.has(n.id) ? { ...n, read_at: null } : n));
  }, [items, handled, unreadAtOpen]);

  const report = visible.filter((n) => n.kind === 'report_result');
  const sections = useMemo(
    () => groupNotifications(visible.filter((n) => n.kind !== 'report_result'), nowMs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible],
  );

  const open = useCallback(
    (n: SocialNotification) => {
      if (n.kind === 'system' || n.kind === 'report_result') return;
      if (n.post_id) navigation.navigate('SharedPost', { postId: n.post_id });
      else if (n.actor.handle) navigation.navigate('PublicProfile', { handle: n.actor.handle });
    },
    [navigation],
  );

  const respond = useCallback(async (n: SocialNotification, accept: boolean) => {
    haptic('selection');
    setHandled((prev) => new Set(prev).add(n.id));
    try {
      await getProfilClient().respondFollowRequest({ requester: n.actor.id, accept });
    } catch {
      // Olumsuz an sessiz: satırı geri getir, kullanıcı yeniden dener.
      setHandled((prev) => {
        const next = new Set(prev);
        next.delete(n.id);
        return next;
      });
    }
  }, []);

  const sectionTitle = (s: NotifSection) => tr(`kesfet.notif.section.${s}`);
  // G22-S2 md.5 (FinNotificationsError): ilk yükleme başarısız + gösterilecek satır yok
  // → "Bildirimler yüklenemedi" + Tekrar dene. Yeniden denerken satır iskeleti.
  const failed = !loading && error != null && visible.length === 0;
  const skeleton = loading && visible.length === 0;
  const empty = !loading && !failed && report.length === 0 && sections.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: t.color.bg, paddingTop: insets.top }]}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={tr('kesfet.notif.back')}
          style={styles.backBtn}
        >
          <Glyph name="arrowLeft" size={22} color={t.color.ink} />
        </Pressable>
        <AppText textRole="section" accessibilityRole="header" style={styles.headerTitle}>
          {tr('kesfet.notif.title')}
        </AppText>
      </View>
      {failed ? (
        <NotificationsError onRetry={loadAndMark} />
      ) : skeleton ? (
        <View accessibilityLabel={tr('notif_error.loading')} style={styles.skeleton}>
          <FinListSkeleton rows={6} testID="notif-skeleton" />
        </View>
      ) : empty ? (
        <View style={styles.center}>
          <AppText variant="body" tone="secondary">
            {tr('kesfet.notif.empty')}
          </AppText>
        </View>
      ) : (
        <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
          {report.length > 0 ? (
            <>
              <AppText variant="caption" tone="secondary" style={styles.sectionTitle}>
                {sectionTitle('today')}
              </AppText>
              {report.map((n) => (
                <ReportResultCard
                  key={n.id}
                  n={n}
                  nowMs={nowMs}
                  onDetails={n.post_id ? () => navigation.navigate('SharedPost', { postId: n.post_id }) : undefined}
                />
              ))}
            </>
          ) : null}
          {sections.map(({ section, groups }, si) =>
            report.length > 0 && section === 'today' && si === 0 ? (
              <View key={section}>
                {groups.map((g) => (
                  <Row key={g.key} group={g} nowMs={nowMs} onPress={() => open(g.head)} onRespond={(a) => void respond(g.head, a)} />
                ))}
              </View>
            ) : (
              <View key={section}>
                <AppText variant="caption" tone="secondary" style={styles.sectionTitle}>
                  {sectionTitle(section)}
                </AppText>
                {groups.map((g) => (
                  <Row key={g.key} group={g} nowMs={nowMs} onPress={() => open(g.head)} onRespond={(a) => void respond(g.head, a)} />
                ))}
              </View>
            ),
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20, lineHeight: 26 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  skeleton: { paddingTop: 8 },
  sectionTitle: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 6, fontSize: 13, fontFamily: fontFamily.bodyBold },
  row: {
    minHeight: 68,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  avatarWrap: { width: 44, height: 44 },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 19 },
  bold: { fontFamily: fontFamily.bodyBold },
  reqBtns: { flexDirection: 'row', gap: 6 },
  pill: { height: 32, paddingHorizontal: 12, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pillOutline: { borderWidth: 1 },
  pillText: { fontSize: 13, fontFamily: fontFamily.bodySemibold },
  thumb: { width: 44, height: 44, borderRadius: 10, overflow: 'hidden' },
  reportCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
  },
  reportIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  reportBody: { flex: 1, gap: 2 },
  reportTitle: { fontSize: 15, lineHeight: 21 },
  reportDesc: { fontSize: 14, lineHeight: 19 },
  reportFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  caption13: { fontSize: 13 },
  detailsBtn: { minHeight: 44, justifyContent: 'center' },
  details: { fontFamily: fontFamily.bodySemibold, textDecorationLine: 'underline' },
});
