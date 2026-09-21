import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  ScrollView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Star, ThumbsDown, ThumbsUp, X } from 'phosphor-react-native';
import { COLORS, RADIUS, SPACING, SURFACE, TYPOGRAPHY } from '../constants/theme';
import { haptic } from '../utils/haptics';
import { animateListChange } from '../utils/layoutAnimation';
import { fetchReviewBannerUrl } from '../lib/orderFeedback';
import type { FeedbackItem, ItemFeedbackMap } from '../lib/orderFeedback';
import { fetchBrand } from '../lib/brands';

const RATING_LABELS = ['', 'Çok kötü', 'Kötü', 'İdare eder', 'İyi', 'Harika'];

// Serit, sheet'in TAM genisligini kaplar.
//
// Daha once sheet'in kendi padding'i vardi ve serit negatif margin +
// Dimensions'tan hesaplanan sabit bir genislikle disari tasitiliyordu;
// iki ayri kaynaktan gelen olcu birbirini tutmayinca kenarlarda beyaz
// seritler kaliyordu. Artik padding sheet'te degil icerik sarmalayicida:
// serit width:'100%' ile dogal olarak kenara oturuyor, hesap yok.
// Marka gorseli 1200x400 = tam 3:1.
const BANNER_ASPECT = 3;

interface OrderFeedbackModalProps {
  visible: boolean;
  /** Siparişteki ürünler; her biri için ayrı beğeni sorulur. */
  items: FeedbackItem[];
  /** Görsel şeridi için dışarıdan URL; verilmezse kcalculate marka görseli çekilir. */
  bannerUrl?: string | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string, itemFeedback: ItemFeedbackMap) => void;
}

/**
 * Teslimattan 30 dk sonra bir kez gösterilen değerlendirme istemi.
 * Puan zorunlu, yorum opsiyonel — tek dokunuşla kapatılabilir.
 */
export default function OrderFeedbackModal({
  visible,
  items,
  bannerUrl,
  submitting,
  onClose,
  onSubmit,
}: OrderFeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [itemFeedback, setItemFeedback] = useState<ItemFeedbackMap>({});
  // Gorsel serit: once settings.review_banner_url (pop-up'a ozel, boss
  // panelinden degistirilebilir), o bossa kcalculate marka banner'i.
  // Ayri alan olmasinin sebebi: markalar bolumundeki gorsel degisince
  // pop-up'in gorseli de degisiyordu.
  const [remoteBanner, setRemoteBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || bannerUrl || remoteBanner) return;
    let mounted = true;
    fetchReviewBannerUrl()
      .then((url) => (url ? url : fetchBrand('kcalculate').then((b) => b?.hero_image_url ?? null)))
      .then((url) => { if (mounted) setRemoteBanner(url); })
      .catch(() => { /* gorsel kozmetik: hata yutulur, yesil zemin kalir */ });
    return () => { mounted = false; };
  }, [visible, bannerUrl, remoteBanner]);

  const heroUri = bannerUrl || remoteBanner;

  const handleClose = () => {
    setRating(0);
    setComment('');
    setItemFeedback({});
    onClose();
  };

  // Aynı butona tekrar basmak oyu GERİ ALIR — yanlışlıkla dokunan kullanıcı
  // kilitlenmesin.
  const toggleItem = (productId: number, liked: boolean) => {
    haptic.selection();
    setItemFeedback((prev) => {
      const next = { ...prev };
      if (next[productId] === liked) delete next[productId];
      else next[productId] = liked;
      return next;
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.centerWrap}>
          <View style={styles.sheet}>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={10}>
              <X size={18} color={COLORS.text.primary} weight="bold" />
            </TouchableOpacity>

            {/* Görsel şerit — ÜZERİNDE yazı yok. Başlık beyaz alana alındı:
                fotoğrafın üstüne yazı bindirmek her kampanyada farklı bir
                kontrast sorunu üretiyordu. Görsel yüklenemezse marka yeşili
                zemin kalır, pop-up hiçbir durumda boş açılmaz. */}
            <ImageBackground
              source={heroUri ? { uri: heroUri } : undefined}
              style={styles.brandBanner}
              imageStyle={styles.brandBannerImg}
              resizeMode="cover"
            />

            <View style={styles.body}>
            <Text style={styles.title}>Deneyimin nasıldı?</Text>
            <Text style={styles.sub}>
              Görüşlerine önem veriyoruz. Hizmet kalitemizi artırmak için önerilerini ve
              deneyimini bekliyoruz.
            </Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => { haptic.selection(); setRating(n); }}
                  activeOpacity={0.7}
                  hitSlop={6}
                >
                  <Star
                    size={36}
                    weight={n <= rating ? 'fill' : 'regular'}
                    color={n <= rating ? '#F8C90E' : '#d4d4d4'}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.ratingLabel}>{rating > 0 ? RATING_LABELS[rating] : ' '}</Text>

            {items.length > 0 ? (
              <View style={styles.itemsBlock}>
                <Text style={styles.itemsTitle}>Ürünler nasıldı?</Text>
                <ScrollView
                  style={styles.itemsScroll}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {items.map((it) => {
                    const vote = itemFeedback[it.productId];
                    return (
                      <View key={it.productId} style={styles.itemRow}>
                        <Text style={styles.itemName} numberOfLines={2}>{it.name}</Text>
                        <TouchableOpacity
                          style={[styles.voteBtn, vote === true && styles.voteBtnUp]}
                          onPress={() => toggleItem(it.productId, true)}
                          activeOpacity={0.7}
                          hitSlop={6}
                        >
                          <ThumbsUp
                            size={17}
                            weight={vote === true ? 'fill' : 'regular'}
                            color={vote === true ? '#000000' : COLORS.gray[500]}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.voteBtn, vote === false && styles.voteBtnDown]}
                          onPress={() => toggleItem(it.productId, false)}
                          activeOpacity={0.7}
                          hitSlop={6}
                        >
                          <ThumbsDown
                            size={17}
                            weight={vote === false ? 'fill' : 'regular'}
                            color={vote === false ? '#ffffff' : COLORS.gray[500]}
                          />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <TextInput
              style={styles.input}
              value={comment}
              onChangeText={setComment}
              placeholder="Yorumlarını duymak için sabırsızlanıyoruz, görüşlerin bizim için çok önemli."
              placeholderTextColor={COLORS.text.tertiary}
              multiline
              numberOfLines={3}
              maxLength={500}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitBtn, (rating === 0 || submitting) && styles.submitBtnDisabled]}
              onPress={() => onSubmit(rating, comment, itemFeedback)}
              disabled={rating === 0 || submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator size="small" color="#000000" />
                : <Text style={styles.submitBtnText}>Gönder</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
              <Text style={styles.laterText}>Şimdi değil</Text>
            </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  centerWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.xl },
  sheet: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    // Serit sheet'in tam genisligini kapliyor; kirpilmazsa yuvarlak
    // koselerin disina sizar.
    overflow: 'hidden',
  },
  // Padding sheet'te DEGIL burada: serit kenara tam otursun diye.
  body: {
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  closeBtn: { position: 'absolute', top: SPACING.md, right: SPACING.md, padding: 4, zIndex: 2 },
  brandBanner: {
    width: '100%',
    aspectRatio: BANNER_ASPECT,
    backgroundColor: COLORS.brand.green,
  },
  brandBannerImg: {
    // Kutu ne olursa olsun bosluk birakmadan doldur.
    width: '100%',
    height: '100%',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  itemsBlock: {
    alignSelf: 'stretch',
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  itemsTitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
  // Cok urunlu siparislerde pop-up ekrani asmasin diye liste kendi icinde kayar.
  itemsScroll: { maxHeight: 168 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  itemName: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.primary,
    lineHeight: 18,
  },
  voteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SURFACE.unselectedBorder,
    backgroundColor: SURFACE.unselectedBg,
  },
  voteBtnUp: { backgroundColor: COLORS.brand.green, borderColor: 'transparent' },
  voteBtnDown: { backgroundColor: COLORS.text.primary, borderColor: 'transparent' },
  title: {
    fontSize: TYPOGRAPHY.size['2xl'],
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text.primary,
    marginTop: SPACING.xs,
  },
  sub: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  starsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  ratingLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
    minHeight: 18,
  },
  // Gri dolgu kaldirildi: pasif yuzey dili beyaz zemin + net kenarlik
  // (bkz. SURFACE, constants/theme). Gri dolgu alani "devre disi" gosteriyordu.
  input: {
    width: '100%',
    minHeight: 76,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: SURFACE.inputBorder,
    backgroundColor: SURFACE.inputBg,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.primary,
    marginTop: SPACING.xs,
  },
  submitBtn: {
    width: '100%',
    height: 50,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.brand.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xs,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  laterText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.tertiary,
    paddingVertical: SPACING.xs,
  },
});
