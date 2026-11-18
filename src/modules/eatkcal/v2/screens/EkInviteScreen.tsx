// G56-S1 md.6 — Arkadaşını davet et (EkScr scr="davet" · "davetBos" · "davetKopya").
// Veri: my_referral() (kod yoksa üretir + geçmiş). Paylaşım: sistem paylaşımı (kod + mağaza bağlantıları).
// `davet` bayrağı kapalı / misafir / ödül tanımsızsa giriş zaten yok; yine de açılırsa boş hâl.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { CachedImage } from '../../../../components/CachedImage';
import { inviteBannerUrl, INVITE_BANNER_RATIO } from '../growth/inviteBanner';
import * as Clipboard from 'expo-clipboard';
import { useRoute } from '@react-navigation/native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { CaretLeft, Copy, Export, Check } from '../../../../components/icons';
import { EmptyErrorCard, fontFamily, haptic } from '../../../../core/design';
import { useAuth } from '../../../../core/AuthContext';
import { useFeature } from '../../../../core/flags';
import type { FlagKey } from '../../../../core/flags/registry';
import { track } from '../../../../lib/analytics';
import { EkScreen, EkSkeleton, EkToastLayer, ekType, useEk } from '../ui/kit';
import { useEkNav } from '../nav';
import { useGrowthTokens } from '../ui/growth/tokens';
import { fetchMyReferral } from '../growth/growthApi';
import { referralShareText, visibleHistory, type MyReferral } from '../growth/referral';

const SCALE = 1.3;

type Params = { vitrin?: MyReferral; vitrinCopied?: boolean } | undefined;

function formatDay(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function EkInviteScreen() {
  const { t, lang, insets } = useEk();
  const k = useGrowthTokens();
  const navigation = useEkNav();
  const params = useRoute().params as Params;
  const { session } = useAuth();
  const flag = useFeature('davet' as FlagKey);
  const [data, setData] = useState<MyReferral | null | undefined>(__DEV__ && params?.vitrin ? params.vitrin : undefined);
  const [copied, setCopied] = useState(__DEV__ && !!params?.vitrinCopied);

  const load = useCallback(() => {
    if (__DEV__ && params?.vitrin) return;
    setData(undefined);
    fetchMyReferral().then((r) => setData(r));
  }, [params?.vitrin]);
  useEffect(() => {
    if (session && flag) load();
  }, [session, flag, load]);
  useEffect(() => {
    if (!copied || (__DEV__ && params?.vitrinCopied)) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied, params?.vitrinCopied]);


  const copy = async () => {
    if (!data) return;
    haptic('success');
    await Clipboard.setStringAsync(data.code).catch(() => {});
    track('referral_share', { method: 'copy' });
    setCopied(true);
  };
  const share = () => {
    if (!data) return;
    haptic('light');
    track('referral_share', { method: 'share' });
    void Share.share({ message: referralShareText(t, data.code) }).catch(() => {});
  };

  const header = (
    <View style={styles.nav}>
      <Pressable
        onPress={() => {
          haptic('selection');
          navigation.goBack();
        }}
        accessibilityRole="button"
        accessibilityLabel={t('ek56.list.back')}
        style={styles.back}
      >
        <CaretLeft size={22} color={k.ink} weight="bold" />
      </Pressable>
      <Text style={[styles.h1, { color: k.ink, flex: 1 }]} accessibilityRole="header" maxFontSizeMultiplier={SCALE}>
        {t('ek56.invite.title')}
      </Text>
    </View>
  );

  const allowed = (!!session && flag) || (__DEV__ && !!params?.vitrin);
  const history = data ? visibleHistory(data.history) : [];

  return (
    <EkScreen
      header={header}
      testID="ek56-invite-screen"
      overlay={
        copied ? (
          <EkToastLayer bottom={Math.max(insets.bottom, 12) + 36}>
            <View style={[styles.toast, { backgroundColor: k.glass, borderColor: k.glassEdge, shadowColor: k.glassSh }]} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="ek56-invite-copied">
              <View style={[styles.check, { backgroundColor: k.lime }]}>
                <Check size={14} color={k.limeInk} weight="bold" />
              </View>
              <Text style={[styles.toastText, { color: k.ink }]} maxFontSizeMultiplier={SCALE}>
                {t('ek56.invite.copied')}
              </Text>
            </View>
          </EkToastLayer>
        ) : null
      }
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 10 }}>
        {!allowed || data === null ? (
          <EmptyErrorCard
            tone="error"
            title={t('ek56.invite.load_error')}
            actionLabel={allowed ? t('ek56.invite.retry') : undefined}
            onAction={allowed ? load : undefined}
          />
        ) : data === undefined ? (
          <View style={{ gap: 10 }} accessible accessibilityLabel={t('ek56.loading')}>
            <EkSkeleton height={124} radius={20} style={{ backgroundColor: k.skel }} />
            <EkSkeleton height={160} radius={20} style={{ backgroundColor: k.skel }} />
            <EkSkeleton width={160} height={22} radius={8} style={{ backgroundColor: k.skel }} />
            <EkSkeleton height={180} radius={20} style={{ backgroundColor: k.skel }} />
          </View>
        ) : (
          <>
            {/* 18 Kas (İlter): sayfanın başında kampanya banner'ı net, tam genişlikte. */}
            <CachedImage uri={inviteBannerUrl(lang)} style={[styles.banner, { backgroundColor: k.skel }]} contentFit="cover" />
            <Text style={[styles.heroTitle, { color: k.ink }]} accessibilityRole="header" maxFontSizeMultiplier={SCALE}>
              {t('ek56.invite.hero')}
            </Text>
            <View style={[styles.hero, { backgroundColor: k.card, borderColor: k.line }]}>
              <View style={[styles.codeBox, { backgroundColor: k.nest }]}>
                <View style={{ flex: 1 }} accessible accessibilityLabel={`${t('ek56.invite.code_label')}: ${data.code.split('').join(' ')}`}>
                  <Text style={[styles.c12, { color: k.sec }]} maxFontSizeMultiplier={SCALE}>
                    {t('ek56.invite.code_label')}
                  </Text>
                  <Text style={[styles.code, { color: k.ink }]} maxFontSizeMultiplier={SCALE} selectable testID="ek56-invite-code">
                    {data.code}
                  </Text>
                </View>
                <Pressable onPress={copy} accessibilityRole="button" accessibilityLabel={t('ek56.invite.copy')} style={styles.copy} testID="ek56-invite-copy">
                  <Copy size={22} color={k.ink} />
                </Pressable>
              </View>
              <Pressable
                onPress={share}
                accessibilityRole="button"
                style={({ pressed }) => [styles.share, { backgroundColor: k.lime }, pressed && { opacity: 0.85 }]}
                testID="ek56-invite-share"
              >
                <Export size={18} color={k.limeInk} weight="bold" />
                <Text style={[styles.shareText, { color: k.limeInk }]} maxFontSizeMultiplier={SCALE}>
                  {t('ek56.invite.share')}
                </Text>
              </Pressable>
            </View>

            <Text style={[styles.h2, { color: k.ink }]} accessibilityRole="header" maxFontSizeMultiplier={SCALE}>
              {t('ek56.invite.how')}
            </Text>
            <View style={[styles.rows, { backgroundColor: k.card, borderColor: k.line }]}>
              {[t('ek56.invite.step1'), t('ek56.invite.step2'), t('ek56.invite.step3')].map((label, i) => (
                <View key={i} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: k.line }]}>
                  <View style={[styles.num, { backgroundColor: i === 2 ? k.lime : k.nest }]} accessible={false}>
                    <Text style={[styles.numText, { color: i === 2 ? k.limeInk : k.ink }]} maxFontSizeMultiplier={1.15}>
                      {i + 1}
                    </Text>
                  </View>
                  <Text style={[styles.rowText, { color: k.ink, flex: 1 }]} maxFontSizeMultiplier={SCALE}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={[styles.h2, { color: k.ink }]} accessibilityRole="header" maxFontSizeMultiplier={SCALE}>
              {t('ek56.invite.history')}
            </Text>
            {history.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: k.card, borderColor: k.line }]} testID="ek56-invite-empty">
                <Text style={[styles.emptyTitle, { color: k.ink }]} maxFontSizeMultiplier={SCALE}>
                  {t('ek56.invite.empty_title')}
                </Text>
                <Text style={[styles.emptyBody, { color: k.sec }]} maxFontSizeMultiplier={SCALE}>
                  {t('ek56.invite.empty_body')}
                </Text>
              </View>
            ) : (
              <View style={[styles.rows, { backgroundColor: k.card, borderColor: k.line }]} accessibilityRole="list" testID="ek56-invite-history">
                {history.map((h, i) => {
                  const earned = h.status === 'earned';
                  const name = h.name ?? t('ek56.invite.friend');
                  const date = formatDay(earned && h.earnedAt ? h.earnedAt : h.createdAt, lang);
                  const pill = earned ? t('ek56.invite.earned') : t('ek56.invite.pending');
                  return (
                    <View key={h.id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: k.line }]} accessible accessibilityLabel={[name, date, pill].filter(Boolean).join(', ')}>
                      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                        <Text style={[styles.rowText, { color: k.ink }]} maxFontSizeMultiplier={SCALE}>
                          {name}
                        </Text>
                        {date ? (
                          <Text style={[ekType.c13, ekType.num, { color: k.sec }]} maxFontSizeMultiplier={SCALE}>
                            {date}
                          </Text>
                        ) : null}
                      </View>
                      <View style={[styles.pill, { backgroundColor: earned ? k.lime : k.nest }]}>
                        <Text style={[styles.pillText, { color: earned ? k.limeInk : k.ink }]} maxFontSizeMultiplier={SCALE}>
                          {pill}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </View>
    </EkScreen>
  );
}

const styles = StyleSheet.create({
  nav: { minHeight: 44, paddingTop: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fontFamily.headingBold, fontSize: 24, lineHeight: 29 },
  h2: { fontFamily: fontFamily.headingBold, fontSize: 20, lineHeight: 24, minHeight: 24 },
  hero: { padding: 16, borderRadius: 20, borderWidth: 1, gap: 12 },
  banner: { width: '100%', aspectRatio: INVITE_BANNER_RATIO, borderRadius: 20, overflow: 'hidden' },
  heroTitle: { fontFamily: fontFamily.headingBold, fontSize: 20, lineHeight: 24 },
  codeBox: { minHeight: 64, paddingLeft: 16, paddingRight: 6, borderRadius: 16, flexDirection: 'row', alignItems: 'center' },
  c12: { fontFamily: fontFamily.bodyMedium, fontSize: 12, lineHeight: 16 },
  code: { fontFamily: fontFamily.headingBold, fontSize: 22, lineHeight: 28, letterSpacing: 1.3 },
  copy: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  share: { minHeight: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareText: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
  rows: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: { minHeight: 60, paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  num: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  numText: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  rowText: { fontFamily: fontFamily.bodySemibold, fontSize: 15, lineHeight: 19.5 },
  pill: { height: 28, paddingHorizontal: 10, borderRadius: 14, justifyContent: 'center' },
  pillText: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  empty: { paddingVertical: 22, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, alignItems: 'center', gap: 4 },
  emptyTitle: { fontFamily: fontFamily.bodyBold, fontSize: 15, textAlign: 'center' },
  emptyBody: { fontFamily: fontFamily.bodyRegular, fontSize: 14, textAlign: 'center', maxWidth: 300 },
  toast: { minHeight: 48, paddingLeft: 12, paddingRight: 18, borderRadius: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10, shadowOpacity: 1, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toastText: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
});
