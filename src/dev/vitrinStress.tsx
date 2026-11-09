// G15-S2 — Stres panoları (FinStressLong / FinStressXL / FinStressEN /
// FinStressDark) için kabul sahnesi. YALNIZ __DEV__ vitrini.
//
// Final'in stres panoları tek ekran değil, bileşen kabul matrisi: uzun metin,
// en büyük yazı, EN +%30, koyu tema durum matrisi. Bu sahne aynı bölümleri
// uygulamanın GERÇEK Final bileşenleriyle (eatkcal ürün kartı, EkCard/EkKV/
// EkButton, boş/hata kartı, Chip, mürekkep toast) uç verilerle çizer —
// kırpılma/taşma görsel olarak denetlenir.
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Chip, EmptyErrorCard, useTheme } from '../core/design';
import { useT } from '../core/i18n';
import { ArrowLeft, Check, Minus, Plus, Trash, PencilSimple, MapPin, Ticket, Package } from '../components/icons';
import { ProductCard } from '../modules/eatkcal/v2/ui/home/cards';
import { EkButton, EkCard, EkKV, money } from '../modules/eatkcal/v2/ui/kit';
import { HomeInkToast } from '../screens/tracker/HomeInkToast';

const LONG = 'Izgara Tavuk Bonfile, Basmati Pilav ve Maş Fasulyeli Kase · Ekstra Sos';
const PRICE = 12345.5;

function Label({ children }: { children: string }) {
  const t = useTheme();
  return (
    <View style={[styles.label, { borderColor: t.color.secondary }]}>
      <AppText tone="secondary" style={styles.labelText}>
        {children}
      </AppText>
    </View>
  );
}

function Header({ title }: { title: string }) {
  const t = useTheme();
  return (
    <View style={styles.header}>
      <ArrowLeft size={22} color={t.color.ink} />
      <AppText style={styles.headerTitle} numberOfLines={1}>
        {title}
      </AppText>
      <View style={{ width: 22 }} />
    </View>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <View style={styles.toastBox}>
      <HomeInkToast visible message={message} bottom={0} onUndo={() => {}} onView={() => {}} onDismiss={() => {}} autoHideMs={0} />
    </View>
  );
}

function Long() {
  const t = useTheme();
  const p = { id: 's1', name: LONG, price: 13580, discount_type: 'fixed', discount_value: 1234.5, calories: null } as any;
  return (
    <>
      <Header title="Stres · uzun metin" />
      <Label>Ürün kartı · 60 karakter ad · 12345,50 TL</Label>
      <View style={styles.row2}>
        <View style={styles.flex}>
          <ProductCard product={p} photoHeight={170} onPress={() => {}} />
        </View>
        <View style={styles.flex}>
          <ProductCard product={{ ...p, id: 's2' }} photoHeight={170} onPress={() => {}} />
        </View>
      </View>
      <Label>Sepet satırı</Label>
      <EkCard>
        <View style={styles.cartRow}>
          <View style={[styles.thumb, { backgroundColor: t.color.line }]} />
          <View style={styles.flex}>
            <View style={styles.cartHead}>
              <AppText style={styles.b15} numberOfLines={3}>
                {LONG}
              </AppText>
              <Trash size={20} color={t.color.secondary} />
            </View>
            <AppText tone="secondary" style={styles.cap} numberOfLines={1}>
              Basmati · Izgara Tavuk 150 g · Maş Fasulye
            </AppText>
            <View style={styles.chips}>
              {['[N] kcal', 'P [N] g', 'K [N] g', 'Y [N] g'].map((c) => (
                <View key={c} style={[styles.macroChip, { backgroundColor: t.color.line }]}>
                  <AppText style={styles.cap}>{c}</AppText>
                </View>
              ))}
            </View>
            <View style={styles.stepRow}>
              <View style={[styles.stepper, { borderColor: t.color.line }]}>
                <Minus size={18} color={t.color.ink} />
                <AppText style={styles.b15}>12</AppText>
                <Plus size={18} color={t.color.ink} />
              </View>
              <AppText style={styles.b15}>{money(PRICE)}</AppText>
            </View>
          </View>
        </View>
      </EkCard>
      <Label>Sipariş özeti · CTA kesilmez</Label>
      <EkCard>
        <View style={styles.cartRow}>
          <View style={[styles.thumbSm, { backgroundColor: t.color.line }]} />
          <AppText style={[styles.b15, styles.flex]} numberOfLines={3}>
            {`${LONG} ×12`}
          </AppText>
          <AppText style={styles.b15}>{money(PRICE)}</AppText>
        </View>
        <EkKV label="Ara toplam" value={money(PRICE)} />
        <EkKV label="Teslimat" value="Ücretsiz" />
        <EkKV label="Toplam" value={money(PRICE)} strong />
      </EkCard>
      <EkButton label={`Siparişi ver · ${money(PRICE)}`} onPress={() => {}} />
      <Label>Adres kartı · 120 karakter</Label>
      <EkCard>
        <View style={styles.cartRow}>
          <View style={[styles.map, { backgroundColor: t.color.line }]}>
            <MapPin size={26} color={t.color.ink} weight="fill" />
          </View>
          <View style={styles.flex}>
            <AppText style={styles.b15}>Ev</AppText>
            <AppText tone="secondary" style={styles.cap}>
              Kıbrıs Şehitleri Caddesi No: 128 Daire 14, Alsancak Mahallesi, Konak, İzmir · Pasaport İskelesi karşısı, mavi kapılı bina
            </AppText>
          </View>
          <View style={styles.icons}>
            <PencilSimple size={20} color={t.color.ink} />
            <Trash size={20} color={t.color.secondary} />
          </View>
        </View>
      </EkCard>
    </>
  );
}

function PortionSheet({ en }: { en?: boolean }) {
  const t = useTheme();
  const { t: tt } = useT();
  return (
    <EkCard>
      <View style={[styles.handle, { backgroundColor: t.color.line }]} />
      <AppText textRole="sheetTitle">Tavuk kinoa bowl</AppText>
      <AppText tone="secondary" style={styles.sec}>
        {tt('gun.manual_meal')}
      </AppText>
      <View style={styles.chips}>
        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((m) => (
          <Chip key={m} label={tt(`meal.${m}`)} selected={m === 'lunch'} />
        ))}
      </View>
      <AppText tone="secondary" style={styles.sec}>
        {tt('gun.portion_label')}
      </AppText>
      <View style={styles.chips}>
        {(en ? ['0.5', '1', '1.5', '2'] : ['½', '1', '1½', '2']).map((p) => (
          <Chip key={p} label={p} selected={p === '1'} />
        ))}
      </View>
      <EkButton label={tt('gun.log_to_lunch')} onPress={() => {}} style={{ marginTop: 12 }} />
    </EkCard>
  );
}

function XL() {
  const t = useTheme();
  const { t: tt } = useT();
  return (
    <>
      <Header title="Stres · en büyük yazı" />
      <Label>Sipariş özeti · alt bar</Label>
      <EkCard>
        <AppText tone="secondary" style={styles.b15}>
          Teslimat ücretsiz
        </AppText>
        <View style={styles.terms}>
          <View style={[styles.box, { borderColor: t.color.secondary }]} />
          <AppText style={[styles.b15, styles.flex]}>Kullanım Koşulları ve Mesafeli Satış Sözleşmesi’ni okudum, onaylıyorum.</AppText>
        </View>
        <EkButton label="Siparişi ver · [N] TL" onPress={() => {}} />
      </EkCard>
      <Label>Porsiyon sheet'i</Label>
      <PortionSheet />
      <Label>Toast</Label>
      <Toast message={tt('gun.logged_lunch')} />
    </>
  );
}

function EN() {
  const t = useTheme();
  return (
    <>
      <Header title="Stress · EN +30%" />
      <Label>Order summary</Label>
      <EkCard>
        {[
          ['Delivery method · Time', 'Home delivery · Right away · 30–55 min'],
          ['Delivery address', 'Home · Kıbrıs Şehitleri Ave. [No], Alsancak, Konak'],
          ['Contact details', 'İlter [Surname] · +90 5[N]'],
          ['Payment method', 'Card •••• [last 4] · secured by PaynKolay · 3D Secure'],
        ].map(([k, v]) => (
          <View key={k} style={styles.sumRow}>
            <View style={styles.flex}>
              <AppText tone="secondary" style={styles.cap}>
                {k}
              </AppText>
              <AppText style={styles.b15}>{v}</AppText>
            </View>
            <AppText style={styles.b15}>Change</AppText>
          </View>
        ))}
      </EkCard>
      <View style={styles.terms}>
        <View style={[styles.box, { borderColor: t.color.secondary }]} />
        <AppText style={[styles.cap, styles.flex]}>I have read and accept the Terms of Use and the Distance Sales Agreement.</AppText>
      </View>
      <EkButton label="Place order · [N] TL" onPress={() => {}} />
      <Label>Add address</Label>
      <EkCard>
        <View style={[styles.okBand, { backgroundColor: t.color.accent }]}>
          <AppText tone="onAccent" style={styles.cap}>
            We deliver to this address · Right away 30–55 min · Free
          </AppText>
        </View>
        <View style={styles.chips}>
          <Chip label="Home" selected />
          <Chip label="Work" />
          <Chip label="Other" />
        </View>
        <EkButton label="Save address" onPress={() => {}} />
      </EkCard>
      <Label>Toast</Label>
      <Toast message="Logged to lunch" />
      <Label>Error cards</Label>
      <EmptyErrorCard
        tone="error"
        icon={<Package size={22} color={t.color.ink} />}
        title="This option just sold out"
        description="You can choose Soy Sauce Chicken Sauté 250 g instead."
        actionLabel="Choose the alternative"
        onAction={() => {}}
      />
      <EmptyErrorCard
        tone="error"
        icon={<MapPin size={22} color={t.color.ink} />}
        title="We couldn’t save the address"
        description="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => {}}
      />
    </>
  );
}

function Dark() {
  const t = useTheme();
  return (
    <>
      <Header title="Koyu tema · durum matrisi" />
      <Label>Hata</Label>
      <EmptyErrorCard
        tone="error"
        icon={<Ticket size={22} color={t.color.ink} />}
        title="Kupon geçersiz"
        description="Kodun süresi dolmuş ya da yanlış yazılmış."
        actionLabel="Kuponlarımı gör"
        onAction={() => {}}
      />
      <Label>Pasif</Label>
      <EkButton label="Sepete ekle" disabled onPress={() => {}} />
      <View style={styles.chips}>
        <Chip label="Normal" />
        <Chip label="Pasif çip" disabled />
      </View>
      <Label>Seçili</Label>
      <View style={styles.chips}>
        <Chip label="Öğle" selected />
        <Chip label="Akşam" />
        <View style={[styles.option, { backgroundColor: t.color.accent }]}>
          <View style={styles.flex}>
            <AppText tone="onAccent" style={styles.b15}>
              Basmati
            </AppText>
            <AppText tone="onAccent" style={styles.cap}>
              [N] g · [N kcal]
            </AppText>
          </View>
          <View style={styles.optCheck}>
            <Check size={12} color={t.color.accent} weight="bold" />
          </View>
        </View>
      </View>
      <Label>Scrim + sheet</Label>
      <View style={[styles.scrimBox, { backgroundColor: t.color.surface }]}>
        <View style={[styles.scrim]} />
        <View style={[styles.sheetMini, { backgroundColor: t.color.surfaceRaised }]}>
          <View style={[styles.handle, { backgroundColor: t.color.line }]} />
          <AppText textRole="sheetTitle">Hangi öğüne?</AppText>
          <AppText style={styles.b15}>Öğle</AppText>
        </View>
      </View>
      <Label>Fotoğraf üstü metin · opak etiket + degrade</Label>
      <View style={[styles.photoCard, { backgroundColor: '#3A3A3C' }]}>
        <View style={styles.photoChip}>
          <AppText style={[styles.cap, { color: '#FFFFFF' }]}>Kalori hedefine uyar</AppText>
        </View>
        <View>
          <AppText style={[styles.photoTitle, { color: '#FFFFFF' }]}>Tavuk kinoa bowl</AppText>
          <AppText style={[styles.cap, { color: '#E5E5EA' }]}>540 kcal · P 42 · K 48 · Y 18</AppText>
        </View>
      </View>
    </>
  );
}

export function StressScene({ kind }: { kind?: 'long' | 'xl' | 'en' | 'dark' }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.color.bg }} contentContainerStyle={[styles.wrap, { paddingTop: insets.top }]}>
      {kind === 'xl' ? <XL /> : kind === 'en' ? <EN /> : kind === 'dark' ? <Dark /> : <Long />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 60, gap: 10 },
  header: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 18, flexShrink: 1, textAlign: 'center' },
  label: { alignSelf: 'flex-start', borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 2 },
  labelText: { fontSize: 13, fontWeight: '600' },
  row2: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1, minWidth: 0 },
  cartRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cartHead: { flexDirection: 'row', gap: 8 },
  thumb: { width: 76, height: 76, borderRadius: 14 },
  thumbSm: { width: 48, height: 48, borderRadius: 12 },
  map: { width: 80, height: 80, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  icons: { gap: 18 },
  b15: { fontSize: 15, fontWeight: '600' },
  cap: { fontSize: 13 },
  sec: { fontSize: 15, marginTop: 10, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  macroChip: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  stepRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { height: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 18 },
  handle: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: 8 },
  terms: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginVertical: 8 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, marginTop: 2 },
  sumRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  okBand: { borderRadius: 14, padding: 12 },
  toastBox: { height: 52 },
  option: { minWidth: 150, borderRadius: 16, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  optCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' },
  scrimBox: { height: 220, borderRadius: 16, overflow: 'hidden', justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetMini: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, gap: 8 },
  photoCard: { height: 260, borderRadius: 20, padding: 14, justifyContent: 'space-between' },
  photoChip: { alignSelf: 'flex-start', backgroundColor: 'rgba(10,10,10,0.82)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  photoTitle: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 20 },
});
