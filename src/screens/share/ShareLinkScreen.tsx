// G61-S1 md.3 — l.eatkcal.com/m|d|x|r|i/<id> ve /s/<UUID> uygulamada açılınca (ShareLink rotası).
//
//  • m/d/x: herkese açık anlık görüntü (get_share_snapshot) → kartın kendisi (ShareCard, yalnız izinli alanlar)
//  • r: tarif önizlemesi (get_share_preview) → tarif kartı
//  • i: davet kodu cihaza kaydedilir (sepette "Davet kodun var mı?" açık + dolu gelir) → davet kartı
//  • s: hikâye — süresi dolmamışsa yazarın profiline gider (halka → görüntüleyici); dolmuşsa
//    "Hikâye süresi doldu" + profil
// Silinmiş / iptal / gizli içerik → "Bu içerik artık yok". Rota yalnız `paylasim_baglanti` açıkken kayıtlı.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText, FinCardSkeleton, useTheme } from '../../core/design';
import { useT } from '../../core/i18n';
import { FinHeader, FinPrimaryButton, FinScreen } from '../../modules/profil/ui/finUi';
import type { RootStackParamList } from '../../navigation/types';
import { shareKindFromParam } from '../../navigation/shareLinks';
import ShareCard from '../../components/share/cards/ShareCard';
import { sanitizeCard, type ShareCardInput } from '../../lib/share/cardModel';
import { cleanShareId, displayLink } from '../../lib/share/links';
import { getSharePreview, getShareSnapshot } from '../../lib/share/snapshotApi';
import { savePendingInvite } from '../../lib/share/pendingInvite';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ShareLink'>;
type State =
  | { s: 'loading' }
  | { s: 'gone' }
  | { s: 'card'; input: ShareCardInput; owner?: string | null; note?: string }
  | { s: 'expired'; handle: string | null; name: string | null };

export default function ShareLinkScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'ShareLink'>>();
  const theme = useTheme();
  const { t, lang } = useT();
  const { width } = useWindowDimensions();
  const kind = shareKindFromParam(route.params?.kind);
  const id = kind ? cleanShareId(kind, route.params?.id) : null;
  const [state, setState] = useState<State>({ s: 'loading' });
  // `t` ve gezinme nesnesi her çizimde yenilenebilir → efekt yalnız tür/kimlik/dil değişince koşar.
  const tRef = useRef(t);
  tRef.current = t;
  const navRef = useRef(navigation);
  navRef.current = navigation;

  useEffect(() => {
    let alive = true;
    const set = (v: State) => alive && setState(v);
    (async () => {
      if (!kind || !id) return set({ s: 'gone' });
      if (kind === 'meal' || kind === 'day' || kind === 'xray') {
        const snap = await getShareSnapshot(id);
        if (!snap || snap.kind !== kind) return set({ s: 'gone' });
        const input = { kind, data: sanitizeCard(kind, snap.payload) } as ShareCardInput;
        return set({ s: 'card', input, owner: snap.ownerHandle ? `@${snap.ownerHandle}` : snap.ownerName });
      }
      if (kind === 'invite') {
        const code = await savePendingInvite(id);
        if (!code) return set({ s: 'gone' });
        return set({ s: 'card', input: { kind: 'invite', data: { code } }, note: tRef.current('share_kit.invite_saved', { code }) });
      }
      if (kind === 'recipe') {
        const p = await getSharePreview('recipe', id);
        if (p.gone) return set({ s: 'gone' });
        const en = lang === 'en';
        const data = sanitizeCard('recipe', {
          name: en ? p.name_en : p.name_tr,
          kcalPerServing: p.kcal,
          proteinPerServing: p.protein,
          ingredients: en ? p.ings_en : p.ings_tr,
          imageUri: typeof p.image === 'string' && /^https:\/\//.test(p.image) ? p.image : null,
        });
        return set({ s: 'card', input: { kind: 'recipe', data } });
      }
      if (kind === 'story') {
        const p = await getSharePreview('story', id);
        if (p.gone) return set({ s: 'gone' });
        const handle = typeof p.handle === 'string' ? p.handle : null;
        if (!p.expired && handle) {
          navRef.current.replace('PublicProfile', { handle });
          return;
        }
        return set({ s: 'expired', handle, name: typeof p.author_name === 'string' ? p.author_name : null });
      }
      // post / profile bu rotaya gelmez (p/ u/ kendi ekranlarında).
      return set({ s: 'gone' });
    })().catch(() => set({ s: 'gone' }));
    return () => {
      alive = false;
    };
  }, [kind, id, lang]);

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Tabs' as never));
  const cardW = Math.min(width - 32, 380);

  return (
    <FinScreen scroll>
      <FinHeader title={t('share_kit.snap.title')} onBack={back} />
      <View style={styles.body} testID="share-link-screen">
        {state.s === 'loading' ? (
          <View accessibilityLabel={t('share_kit.snap.loading')}>
            <FinCardSkeleton rows={4} />
          </View>
        ) : null}
        {state.s === 'gone' ? (
          <View style={styles.center} testID="share-link-gone">
            <AppText textRole="screenTitle" style={[styles.title, { color: theme.color.ink }]}>{t('share_kit.snap.gone_title')}</AppText>
            <AppText style={[styles.sub, { color: theme.color.secondary }]}>{t('share_kit.snap.gone_body')}</AppText>
            <FinPrimaryButton label={t('share_kit.snap.back')} onPress={back} style={styles.btn} />
          </View>
        ) : null}
        {state.s === 'expired' ? (
          <View style={styles.center} testID="share-link-expired">
            <AppText textRole="screenTitle" style={[styles.title, { color: theme.color.ink }]}>{t('share_kit.snap.story_expired')}</AppText>
            {state.name ? <AppText style={[styles.sub, { color: theme.color.secondary }]}>{state.name}</AppText> : null}
            {state.handle ? (
              <FinPrimaryButton
                label={`@${state.handle}`}
                onPress={() => navigation.replace('PublicProfile', { handle: state.handle as string })}
                style={styles.btn}
              />
            ) : (
              <FinPrimaryButton label={t('share_kit.snap.back')} onPress={back} style={styles.btn} />
            )}
          </View>
        ) : null}
        {state.s === 'card' ? (
          <View style={styles.cardWrap} testID="share-link-card">
            {state.owner ? <AppText style={[styles.owner, { color: theme.color.secondary }]}>{state.owner}</AppText> : null}
            <View style={[styles.card, { width: cardW }]}>
              <ShareCard
                input={state.input}
                bg={theme.isDark ? 'dark' : 'light'}
                size="post"
                qr={false}
                lang={lang === 'en' ? 'en' : 'tr'}
                link={kind && id ? displayLink(kind, id) : 'l.eatkcal.com'}
                width={cardW}
                accessibilityLabel={t(`share_kit.names.${state.input.kind}`)}
              />
            </View>
            {state.note ? <AppText style={[styles.sub, { color: theme.color.secondary }]}>{state.note}</AppText> : null}
          </View>
        ) : null}
      </View>
    </FinScreen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingTop: 12, gap: 16 },
  center: { alignItems: 'center', gap: 10, paddingTop: 48, paddingHorizontal: 8 },
  title: { textAlign: 'center' },
  sub: { textAlign: 'center', fontSize: 15, lineHeight: 21 },
  btn: { marginTop: 12, alignSelf: 'stretch' },
  cardWrap: { alignItems: 'center', gap: 12 },
  owner: { fontSize: 15, alignSelf: 'flex-start' },
  card: { borderRadius: 20, overflow: 'hidden' },
});
