// G61-S1 — Paylaşım paketi vitrini (YALNIZ __DEV__; üretim paketine girmez).
//  • g61Share: FinShareSheet hâlleri (varsayılan / kopyalandı / hazırlanıyor / hata), kart türü seçilebilir.
//  • g61Export: 8 kart × story/post × açık/koyu/foto — GERÇEK cihaz hattıyla (react-native-svg toDataURL)
//    PNG'ye çevrilir ve uygulama Documents/g61/ klasörüne yazılır (ekran görüntüleri buradan alınır;
//    fotoğraflı zeminin toDataURL'de görünüp görünmediği de böylece doğrulanır).
// Örnek veri tasarımın yer tutucu fotoğrafları (src/dev/assets). Gerçek veri / ağ YOK.
import React, { useEffect, useRef, useState } from 'react';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../core/design';
import { ShareSheet, type SharePhase } from '../components/share/ShareSheet';
import ShareCard from '../components/share/cards/ShareCard';
import type { CardBg, CardSize } from '../components/share/cards/cardTheme';
import { captureSvgToPngBase64, type SvgCaptureRef } from '../lib/shareCard';
import type { ShareCardInput } from '../lib/share/cardModel';
import { displayLink, shareLink, type ShareKind } from '../lib/share/links';
import { VITRIN_PHOTO } from './vitrinKesfet';

const STORY_ID = '3f2a9c1e-7b44-4d2a-9a51-0c8e2d1f6b77';
const POST_ID = '8b1d2c3e-4f50-4a61-9b72-0c8d9e0f1a2b';

export function g61Sample(kind: ShareKind, en: boolean): { input: ShareCardInput; linkId: string } {
  switch (kind) {
    case 'meal':
      return { linkId: 'aB3dE5fG7h', input: { kind, data: { mealLabel: en ? 'Lunch' : 'Öğle yemeği', name: en ? 'Chicken and quinoa bowl' : 'Tavuklu kinoa kasesi', kcal: 540, protein: 42, carbs: 48, fat: 16, photoUri: VITRIN_PHOTO.tavukKinoa } } };
    case 'day':
      return { linkId: 'Kp7Lm2Nq9R', input: { kind, data: { pct: 76, meals: 3, protein: 98, waterL: 1.8, steps: 8420, dateLabel: en ? '18 November' : '18 Kasım', photoUri: VITRIN_PHOTO.yogurt } } };
    case 'post':
      return { linkId: POST_ID, input: { kind, data: { authorName: 'Ayşe K.', handle: 'aysek', text: en ? 'Post-workout chicken and quinoa bowl. I made the sauce with yogurt, lemon and dill; the recipe is in the post.' : 'Antrenman sonrası tavuklu kinoa kasesi. Sosu yoğurt, limon ve dereotuyla yaptım; tarifi gönderide.', imageUri: VITRIN_PHOTO.tavukKinoa } } };
    case 'profile':
      return { linkId: 'aysek', input: { kind, data: { name: 'Ayşe K.', handle: 'aysek', bio: en ? 'Meal prep, running and simple recipes.' : 'Meal prep, koşu ve sade tarifler.', avatarUri: VITRIN_PHOTO.somon } } };
    case 'recipe':
      return { linkId: 'mercimek_corbasi', input: { kind, data: { name: en ? 'Red lentil soup' : 'Mercimek çorbası', minutes: 35, servings: 4, kcalPerServing: 210, proteinPerServing: 12, ingredients: en ? ['Red lentils', 'Carrot', 'Onion'] : ['Kırmızı mercimek', 'Havuç', 'Soğan'], imageUri: VITRIN_PHOTO.mercimek } } };
    case 'invite':
      return { linkId: 'K7M2QX', input: { kind, data: { code: 'K7M2QX' } } };
    case 'xray':
      return { linkId: 'Xr4Yt6Uv8W', input: { kind, data: { name: 'Menemen', totalKcal: 410, protein: 22, carbs: 12, fat: 28, items: en ? [{ name: 'Eggs', kcal: 180 }, { name: 'Tomato, pepper', kcal: 60 }, { name: 'Olive oil', kcal: 170 }] : [{ name: 'Yumurta', kcal: 180 }, { name: 'Domates, biber', kcal: 60 }, { name: 'Zeytinyağı', kcal: 170 }], photoUri: VITRIN_PHOTO.menemen } } };
    case 'story':
      return { linkId: STORY_ID, input: { kind, data: { photoUri: VITRIN_PHOTO.somon, text: en ? 'Today’s lunch' : 'Bugünün öğle yemeği', mealName: en ? 'Baked salmon' : 'Fırında somon', mealKcal: 520, mealImageUri: VITRIN_PHOTO.thTavukKinoa } } };
  }
}

/** Paylaş sayfası hâli — arkada sade bir ekran iskeleti (tasarımdaki gibi). */
export function G61ShareScene({ state = 'default', kind = 'meal', en = false }: { state?: SharePhase; kind?: ShareKind; en?: boolean }) {
  const t = useTheme();
  const { input, linkId } = g61Sample(kind, en);
  const ph = t.isDark ? '#1C1C1E' : '#E9EBEE';
  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg }}>
      <View style={{ position: 'absolute', left: 16, right: 16, top: 70, gap: 12 }}>
        <View style={{ height: 44, width: 140, borderRadius: 12, backgroundColor: ph }} />
        <View style={{ height: 220, borderRadius: 20, backgroundColor: ph }} />
        <View style={{ height: 120, borderRadius: 20, backgroundColor: ph }} />
      </View>
      <ShareSheet
        visible
        onClose={() => {}}
        input={input}
        linkId={kind === 'meal' || kind === 'day' || kind === 'xray' ? null : linkId}
        presetSnapshotId={linkId}
        linkEnabled
        surface="vitrin"
        forcePhase={state}
      />
    </View>
  );
}

const KINDS: ShareKind[] = ['meal', 'day', 'post', 'profile', 'recipe', 'invite', 'xray', 'story'];
const SIZES: CardSize[] = ['story', 'post'];
const BGS: CardBg[] = ['light', 'dark', 'photo'];

/** 48 kartı cihazda PNG'ye çevirip Documents/g61/ altına yazar. */
export function G61ExportScene({ en = false }: { en?: boolean }) {
  const jobs = useRef(KINDS.flatMap((k) => SIZES.flatMap((z) => BGS.map((b) => ({ k, z, b }))))).current;
  const [i, setI] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const ref = useRef<SvgCaptureRef | null>(null);
  const job = jobs[i];

  useEffect(() => {
    if (!job) return;
    let alive = true;
    const dir = `${FileSystem.documentDirectory}g61/`;
    const name = `G61-Kart-${job.k}-${job.z}-${job.b}${en ? '-EN' : ''}`;
    // Görseller (yerel Metro varlıkları) yüklensin diye kısa bekleme.
    const timer = setTimeout(async () => {
      try {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
        const b64 = await captureSvgToPngBase64(ref.current);
        await FileSystem.writeAsStringAsync(`${dir}${name}.png`, b64, { encoding: FileSystem.EncodingType.Base64 });
        if (alive) setLog((l) => [...l, `ok ${name}`]);
      } catch (e) {
        if (alive) setLog((l) => [...l, `HATA ${name}: ${e instanceof Error ? e.message : String(e)}`]);
      }
      if (alive) setI((x) => x + 1);
    }, 900);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [job, en]);

  const s = job ? g61Sample(job.k, en) : null;
  return (
    <View style={styles.export}>
      <Text style={styles.exportText} testID="g61-export-status">
        {job ? `G61 dışa aktarım ${i + 1}/${jobs.length}` : `G61 dışa aktarım BİTTİ (${jobs.length})`}
      </Text>
      <Text style={styles.exportLog}>{log.slice(-6).join('\n')}</Text>
      {job && s ? (
        <View style={styles.host}>
          <View style={{ transform: [{ scale: 0.9 }], transformOrigin: 'top left' }}>
            <ShareCard
              ref={(r) => {
                ref.current = r as unknown as SvgCaptureRef | null;
              }}
              input={s.input}
              bg={job.b}
              size={job.z}
              qr={job.k === 'invite' || job.b === 'dark'}
              lang={en ? 'en' : 'tr'}
              link={displayLink(job.k, s.linkId)}
              qrValue={shareLink(job.k, s.linkId)}
              width={1080 / PixelRatio.get()}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  export: { flex: 1, backgroundColor: '#000', paddingTop: 70, paddingHorizontal: 16 },
  exportText: { color: '#B9EF14', fontSize: 18, fontWeight: '700' },
  exportLog: { color: '#FFF', fontSize: 11, marginTop: 8 },
  host: { marginTop: 16, width: 330, height: 580, overflow: 'hidden' },
});
