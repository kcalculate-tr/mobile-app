// G20-S1 — Rıza bloğundaki bağlantılar: belge Final Sözleşmeler ekranında
// (FinPrAgreements, SettingsAgreementsScreen — aynı metin kaynağı contractsData)
// tam ekran açılır. Sheet/onboarding'in ÜSTÜNDE açılsın diye kendi Modal'ı var;
// geri → kapanır, alttaki form (yazılan e-posta, anahtar) olduğu gibi kalır.
import React from 'react';
import { Modal } from 'react-native';
import SettingsAgreementsScreen from '../../profil/ui/screens/SettingsAgreementsScreen';
import type { LegalSlug } from '../../../lib/legal/slugs';

// G20-S3 md.1: canlı belge adları (kullanim-kosullari, gizlilik-politikasi, kvkk).
export type { LegalSlug };

export function LegalDocModal({ slug, onClose }: { slug: LegalSlug | null; onClose: () => void }) {
  if (!slug) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SettingsAgreementsScreen onBack={onClose} initialSlug={slug} />
    </Modal>
  );
}
