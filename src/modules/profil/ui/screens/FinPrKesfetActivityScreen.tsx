// G57 (17 Kas) — Keşfet "Etkinliğim": Kaydedilenler · Beğendiklerim · Yorumlarım. Profil hub'ındaki
// "Kaydettiklerim ve beğendiklerim" satırından ve ilk beğeni/kaydet/yorum bildiriminin "Gör"ünden açılır.
// Satıra dokun = gönderinin ayrıntısı (SharedPost). Veri: `get_my_post_activity` (yalnız okuma).
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { useTheme, FinListSkeleton } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { getSupabaseClient } from '../../../../core/supabase';
import { Icon } from '../../../kesfet/ui/icons';
import { resolvePostMediaUrl } from '../../../kesfet/client';
import {
  TAB_KIND,
  fetchMyActivity,
  firstLine,
  type MyActivityItem,
  type MyActivityTab,
} from '../../../kesfet/myActivity';
import { FinScreen, FinHeader, FinCard, FinSegmented, FinSecondaryButton, body, bodySemibold, heading } from '../finUi';

const TABS: MyActivityTab[] = ['saved', 'liked', 'comments'];
const TAB_ICON = { saved: 'bookmark', liked: 'heart', comments: 'chat' } as const;

export default function FinPrKesfetActivityScreen({ onBack, initialTab }: { onBack: () => void; initialTab?: MyActivityTab }) {
  const t = useTheme();
  const { t: tr } = useT();
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState(Math.max(0, TABS.indexOf(initialTab ?? 'saved')));
  const [items, setItems] = useState<MyActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const current = TABS[tab];

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(false);
      try {
        setItems(await fetchMyActivity(getSupabaseClient() as never, TAB_KIND[current], resolvePostMediaUrl));
      } catch {
        setItems([]);
        setError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [current],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const thumbOf = (it: MyActivityItem): string | null => it.media_url ?? it.meal_card?.photo_url ?? null;

  return (
    <FinScreen
      scroll
      contentStyle={{ paddingTop: 0 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={t.color.ink} />}
    >
      <FinHeader title={tr('kesfet_act.title')} onBack={onBack} />
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <FinSegmented
          options={[tr('kesfet_act.tab_saved'), tr('kesfet_act.tab_liked'), tr('kesfet_act.tab_comments')]}
          index={tab}
          onChange={setTab}
        />

        {loading ? (
          <FinListSkeleton rows={4} style={{ paddingHorizontal: 0, paddingTop: 0 }} />
        ) : error ? (
          <FinCard style={{ alignItems: 'center', gap: 12, padding: 20 }}>
            <Text style={{ fontFamily: body, fontSize: 14, color: t.color.secondary, textAlign: 'center' }}>{tr('kesfet_act.error')}</Text>
            <FinSecondaryButton label={tr('kesfet_act.retry')} onPress={() => load()} />
          </FinCard>
        ) : items.length === 0 ? (
          <FinCard style={{ alignItems: 'center', padding: 24, gap: 10 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.color.line, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={TAB_ICON[current]} size={22} color={t.color.ink} />
            </View>
            <Text style={{ fontFamily: body, fontSize: 15, color: t.color.secondary, textAlign: 'center' }}>
              {tr(`kesfet_act.empty_${current}`)}
            </Text>
          </FinCard>
        ) : (
          items.map((it) => {
            const thumb = thumbOf(it);
            const title = firstLine(it.body) || it.meal_card?.name || '';
            return (
              <Pressable
                key={it.id}
                onPress={() => navigation.navigate('SharedPost', { postId: it.id })}
                accessibilityRole="button"
                accessibilityLabel={`${it.author.display_name}, ${title}`}
                testID="kesfet-activity-row"
              >
                <FinCard style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <View style={{ width: 56, height: 56, borderRadius: 14, overflow: 'hidden', backgroundColor: t.color.line, alignItems: 'center', justifyContent: 'center' }}>
                    {thumb ? (
                      <Image source={{ uri: thumb }} style={{ width: 56, height: 56 }} contentFit="cover" />
                    ) : (
                      <Icon name={TAB_ICON[current]} size={20} color={t.color.secondary} />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }} numberOfLines={1}>
                      {it.author.display_name}
                    </Text>
                    <Text style={{ fontFamily: bodySemibold, fontSize: 15, color: t.color.ink }} numberOfLines={2}>
                      {title}
                    </Text>
                    {current === 'comments' && it.my_comment ? (
                      <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }} numberOfLines={1}>
                        {tr('kesfet_act.my_comment', { text: it.my_comment })}
                      </Text>
                    ) : it.meal_card ? (
                      <Text style={{ fontFamily: heading, fontSize: 13, color: t.color.secondary }} numberOfLines={1}>
                        {`${Math.round(it.meal_card.kcal)} kcal`}
                      </Text>
                    ) : null}
                  </View>
                </FinCard>
              </Pressable>
            );
          })
        )}
      </View>
    </FinScreen>
  );
}
