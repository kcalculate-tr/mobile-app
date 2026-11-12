// `/p/<post_id>` derin bağlantı hedefi (G7-S1).
//
// G5-S4'teki yer tutucu karşılama ekranının YERİNE: gönderiyi `get_post` ile
// çekip tek bir PostCard olarak gösterir. Görünürlük (gizlilik + engel) SUNUCUDA
// denetlenir; erişilemeyen/bulunamayan gönderide hafif karşılama (DeepLinkLanding)
// gösterilir — ham kimlik/sağlık verisi yok, yalnız opak post_id.
import React, { useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ForkKnife } from '../../components/icons';
import DeepLinkLanding from '../../components/share/DeepLinkLanding';
import { AppText, useTheme, FinListSkeleton, FinSkeletonBlock } from '../../core/design';
import { useT } from '../../core/i18n';
import { getKesfetClient } from '../../modules/kesfet';
import type { FeedPost } from '../../modules/kesfet/types';
// G15-S3 — bayrak kapalı yol: dondurulmuş kart (Keşfet kartı Final'e giydirildi).
import { PostCard } from './legacy/LegacyPostCard';
import { postCardModel, postLink } from '../../modules/kesfet/ui/format';
import { RootStackParamList } from '../../navigation/types';
import { useFeature } from '../../core/flags';
import { PostDetailScreen } from '../../modules/kesfet/ui/PostDetailScreen';
import { track } from '../../lib/analytics';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SharedPost'>;

function LegacySharedPostScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'SharedPost'>>();
  const postId = (route.params?.postId ?? '').toString().trim();
  const theme = useTheme();
  const { t: tr, lang } = useT();
  // G25-S1 md.7 (A10): l.eatkcal.com hazır olana kadar Paylaş gizli.
  const paylasimBaglanti = useFeature('paylasim_baglanti');

  const [post, setPost] = useState<FeedPost | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading');

  useEffect(() => {
    if (!postId) {
      setState('notfound');
      return;
    }
    let alive = true;
    getKesfetClient()
      .getPost({ post: postId })
      .then((p) => {
        if (!alive) return;
        if (p) {
          setPost(p);
          setState('ready');
        } else {
          setState('notfound');
        }
      })
      .catch(() => {
        if (alive) setState('notfound');
      });
    return () => {
      alive = false;
    };
  }, [postId]);

  const goHome = () => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });

  if (state === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: theme.color.bg }]}>
        {/* G22-S2 md.7: FinMoLoad iskeleti. */}
        <View style={{ alignSelf: 'stretch', paddingHorizontal: 16, gap: 14 }}>
          <FinListSkeleton rows={1} style={{ paddingHorizontal: 0 }} testID="post-skeleton" />
          <FinSkeletonBlock height={280} radius={16} />
        </View>
      </View>
    );
  }

  if (state === 'notfound' || !post) {
    // Erişilemeyen/silinmiş/gizli gönderi → hafif karşılama (uydurma içerik yok).
    return (
      <DeepLinkLanding
        IconComponent={ForkKnife}
        eyebrow={tr('kesfet.share.post_eyebrow')}
        title={tr('kesfet.share.post_unavailable')}
        subtitle={tr('kesfet.share.post_subtitle')}
        primaryLabel={tr('kesfet.share.open_app')}
        onPrimary={goHome}
      />
    );
  }

  const model = postCardModel(post, Date.now(), lang);
  const refresh = () => {
    void getKesfetClient()
      .getPost({ post: postId })
      .then((p) => p && setPost(p))
      .catch(() => {});
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.color.bg }]}>
      <View style={styles.header}>
        <AppText variant="title">{tr('kesfet.share.post_eyebrow')}</AppText>
      </View>
      <PostCard
        model={model}
        onLike={() => {
          void getKesfetClient()
            .reactPost({ post: post.id, kind: 'like', on: !post.me.liked })
            .then(refresh)
            .catch(() => {});
        }}
        onSave={() => {
          void getKesfetClient()
            .reactPost({ post: post.id, kind: 'save', on: !post.me.saved })
            .then(refresh)
            .catch(() => {});
        }}
        onShare={
          paylasimBaglanti
            ? () => {
                void Share.share({ message: postLink(post.id), url: postLink(post.id) })
                  .then((r) => { if (r?.action !== Share.dismissedAction) track('share', { target: 'post', surface: 'shared_post' }); })
                  .catch(() => {});
              }
            : undefined
        }
        onQuickLog={goHome}
        onOpenSheet={goHome}
        onOpenMenu={goHome}
      />
    </View>
  );
}

// G15-S3 — `kesfet` açıkken Final FinDetail gönderi detayı; kapalıyken yukarıdaki
// derin bağlantı ekranı AYNEN (bayt bayt) çizilir.
function KesfetPostDetail() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'SharedPost'>>();
  const postId = (route.params?.postId ?? '').toString().trim();
  const onBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };
  // G21-S1 md.8: yazar → açık profil (takip/geri dönüş yığında).
  const onOpenAuthor = (handle: string) => navigation.navigate('PublicProfile', { handle: handle.replace(/^@/, '') });
  return <PostDetailScreen postId={postId} onBack={onBack} onOpenAuthor={onOpenAuthor} />;
}

export default function SharedPostScreen() {
  const kesfet = useFeature('kesfet');
  return kesfet ? <KesfetPostDetail /> : <LegacySharedPostScreen />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
});
