// G42-S1 md.7 — R1 geri dönüş: kayıtta çıkıp 7 gün içinde geri gelen kullanıcı. Açılışta kart aşağıdan gelir
// (550 ms). "Planımı kaydet" → K1 (cevaplar taslaktan geri yüklenir); "Baştan başla" → taslak silinir, P1.
// 7 gün dolunca taslak sessizce silinir (storage.readDraft) → bu ekran hiç açılmaz.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppText } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { FONT, KBackdrop, KButton, Mascot, Rise } from '../ui/parts';
import { K_MOTION, useK } from '../ui/theme';
import { draftDaysLeft, type KDraft } from '../storage';
import { computeKayitPlan, planSignature } from '../plan';
import { fmtInt } from '../format';
import { dropDraft, useKayit } from '../store';

export default function ReturnScreen() {
  const { t, lang } = useT();
  const P = useK();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const draft = ((useRoute().params ?? {}) as { draft?: KDraft }).draft;
  if (!draft?.plan) return null;
  const left = Math.max(1, draftDaysLeft(draft.savedAt, Date.now()));
  const p = draft.plan;

  const save = () => {
    const s = useKayit.getState();
    s.restore(draft);
    const plan = computeKayitPlan(s.answers, { currentYear: new Date().getFullYear(), startIso: new Date().toISOString().slice(0, 10) });
    s.setPlan(plan, planSignature(s.answers));
    s.setCalcDone(true);
    navigation.navigate('KSignup', { path: 'a' });
  };
  const restart = async () => {
    await dropDraft();
    const s = useKayit.getState();
    s.reset(s.answers.units);
    s.setPath('a');
    s.setStart(draft.start);
    navigation.replace('KQuestions');
  };

  return (
    <View style={{ flex: 1 }} testID="kayit-return">
      <StatusBar style={P.isDark ? 'light' : 'dark'} />
      <KBackdrop shift={40} />
      <View style={{ flex: 1, paddingTop: insets.top + 24, paddingHorizontal: 20, justifyContent: 'center', gap: 20 }}>
        <View style={{ alignItems: 'center' }}>
          <Mascot size={130} react="hi" />
        </View>
        <Rise duration={K_MOTION.scene} dy={80}>
          <View style={[styles.card, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
            <AppText accessibilityRole="header" maxFontSizeMultiplier={1.35} style={[styles.title, { color: P.ink }]}>
              {t('kayit.ret.title')}
            </AppText>
            <View accessible accessibilityLabel={`${t('kayit.plan.daily')}: ${fmtInt(p.calories, lang)} ${t('kayit.plan.kcal')}. ${t('kayit.plan.protein')} ${p.protein} g, ${t('kayit.plan.carbs')} ${p.carbs} g, ${t('kayit.plan.fat')} ${p.fat} g`}>
              <AppText maxFontSizeMultiplier={1.4} style={[styles.small, { color: P.sec }]}>
                {t('kayit.plan.daily')}
              </AppText>
              <AppText testID="kayit-return-kcal" maxFontSizeMultiplier={1.2} style={[styles.kcal, { color: P.ink }]}>
                {fmtInt(p.calories, lang)} {t('kayit.plan.kcal')}
              </AppText>
              <View style={styles.macros}>
                {(['protein', 'carbs', 'fat'] as const).map((k) => (
                  <View key={k} style={[styles.macro, { backgroundColor: P.infoBg }]}>
                    <AppText maxFontSizeMultiplier={1.3} style={[styles.macroV, { color: P.ink }]}>
                      {p[k]} g
                    </AppText>
                    <AppText maxFontSizeMultiplier={1.3} style={[styles.small, { color: P.sec }]}>
                      {t(`kayit.plan.${k}`)}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
            <AppText maxFontSizeMultiplier={1.4} style={[styles.small, { color: P.sec }]}>
              {t('kayit.ret.keep', { n: left })}
            </AppText>
          </View>
        </Rise>
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 8, gap: 10 }}>
        <KButton testID="kayit-return-save" label={t('kayit.ret.save')} onPress={save} />
        <KButton testID="kayit-return-restart" variant="ghost" label={t('kayit.ret.restart')} onPress={() => void restart()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 28, borderWidth: 1, padding: 22, gap: 16 },
  title: { fontFamily: FONT.display, fontSize: 26, lineHeight: 31 },
  small: { fontFamily: FONT.body, fontSize: 14, lineHeight: 20 },
  kcal: { fontFamily: FONT.display, fontSize: 40, letterSpacing: -1 },
  macros: { flexDirection: 'row', gap: 10, marginTop: 10 },
  macro: { flex: 1, borderRadius: 16, padding: 12, alignItems: 'center' },
  macroV: { fontFamily: FONT.bold, fontSize: 17 },
});
