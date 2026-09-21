import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Star, X } from 'phosphor-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { haptic } from '../utils/haptics';

const RATING_LABELS = ['', 'Çok kötü', 'Kötü', 'İdare eder', 'İyi', 'Harika'];

interface OrderFeedbackModalProps {
  visible: boolean;
  orderCode: string | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => void;
}

/**
 * Teslimattan 30 dk sonra bir kez gösterilen değerlendirme istemi.
 * Puan zorunlu, yorum opsiyonel — tek dokunuşla kapatılabilir.
 */
export default function OrderFeedbackModal({
  visible,
  orderCode,
  submitting,
  onClose,
  onSubmit,
}: OrderFeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const handleClose = () => {
    setRating(0);
    setComment('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.centerWrap}>
          <View style={styles.sheet}>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={10}>
              <X size={18} color={COLORS.text.tertiary} weight="bold" />
            </TouchableOpacity>

            <Text style={styles.title}>Deneyimin nasıldı?</Text>
            <Text style={styles.sub}>
              Görüşlerine önem veriyoruz. Hizmet kalitemizi artırmak için önerilerini ve
              deneyimini bekliyoruz.
              {orderCode ? `\n${orderCode}` : ''}
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

            <TextInput
              style={styles.input}
              value={comment}
              onChangeText={setComment}
              placeholder="Eklemek istediğin bir şey var mı? (opsiyonel)"
              placeholderTextColor={COLORS.text.tertiary}
              multiline
              numberOfLines={3}
              maxLength={500}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitBtn, (rating === 0 || submitting) && styles.submitBtnDisabled]}
              onPress={() => onSubmit(rating, comment)}
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
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  closeBtn: { position: 'absolute', top: SPACING.md, right: SPACING.md, padding: 4, zIndex: 2 },
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
  input: {
    width: '100%',
    minHeight: 76,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
    backgroundColor: '#f6f6f6',
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
