import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useStaggerAnimation } from '../../hooks/useStaggerAnimation';
import { useNavigation } from '@react-navigation/native';
import { CaretLeft, Headset, ChatText, WarningCircle, PhoneCall, Plus, X as XIcon } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme';

const TOPIC_OPTIONS = [
  'Sipariş Sorunu',
  'İade Talebi',
  'Bozuk/Eksik Ürün',
  'Teslimat Gecikmesi',
  'Fatura Talebi',
  'Diğer',
];

const STATUS_LABELS: Record<string, string> = {
  open: 'Açık',
  answered: 'Cevaplandı',
  closed: 'Kapalı',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open: { bg: '#FEF3C7', text: '#92400E' },
  answered: { bg: '#D1FAE5', text: '#065F46' },
  closed: { bg: '#F3F4F6', text: '#6B7280' },
};

function formatDate(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatShortId(value: string) {
  return String(value || '').substring(0, 8).toUpperCase() || '—';
}

type Ticket = {
  id: string;
  subject: string;
  message: string;
  admin_reply: string | null;
  status: string;
  order_code: string | null;
  created_at: string;
};

export default function SupportScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [subject, setSubject] = useState(TOPIC_OPTIONS[0]);
  const [orderCode, setOrderCode] = useState('');
  const [message, setMessage] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formInfo, setFormInfo] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const { getStyle: getTicketStyle } = useStaggerAnimation(tickets.length);
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false);
  const [ticketsError, setTicketsError] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const [images, setImages] = useState<{ uri: string; fileName: string; type: string }[]>([]);

  const pickImage = async () => {
    if (images.length >= 3) {
      Alert.alert('Uyarı', 'En fazla 3 görsel ekleyebilirsiniz.');
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('İzin Gerekli', 'Galeriye erişim izni gerekiyor.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Uyarı', 'Görsel boyutu 5 MB\'ı aşamaz.');
        return;
      }
      setImages(prev => [...prev, {
        uri: asset.uri,
        fileName: asset.fileName || `image_${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      }]);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const fetchTickets = useCallback(async () => {
    if (!user?.id) return;
    setTicketsLoading(true);
    setTicketsError('');
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('support_tickets')
        .select('id,subject,message,admin_reply,status,order_code,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTickets(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Talepler alınamadı.';
      setTicketsError(msg);
    } finally {
      setTicketsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === 'history') fetchTickets();
  }, [activeTab, fetchTickets]);

  const handleSubmit = async () => {
    setFormError('');
    setFormInfo('');
    const trimmedMessage = message.trim();
    if (!trimmedMessage) { setFormError('Lütfen mesajınızı yazın.'); return; }
    if (!user?.id || !user?.email) { setFormError('Kullanıcı bilgisi bulunamadı.'); return; }

    setSubmitLoading(true);
    try {
      const supabase = getSupabaseClient();
      const uploadedUrls: string[] = [];

      for (const img of images) {
        try {
          const response = await fetch(img.uri);
          const blob = await response.blob();
          const path = `tickets/${user.id}/${Date.now()}_${img.fileName}`;
          const { error: uploadError } = await supabase.storage
            .from('support-attachments')
            .upload(path, blob, { contentType: img.type, upsert: false });
          if (uploadError) {
            if (__DEV__) console.warn('[support] storage upload error:', uploadError.message);
            continue;
          }
          const { data: pub } = supabase.storage.from('support-attachments').getPublicUrl(path);
          if (pub?.publicUrl) uploadedUrls.push(pub.publicUrl);
        } catch (e) {
          if (__DEV__) console.warn('[support] image upload failed:', e);
        }
      }

      const messageWithImages = uploadedUrls.length > 0
        ? `${trimmedMessage}\n\n--- Ekli Görseller ---\n${uploadedUrls.join('\n')}`
        : trimmedMessage;

      const { error } = await supabase.from('support_tickets').insert([{
        user_id: user.id,
        user_email: user.email,
        order_code: orderCode.trim() || null,
        subject,
        message: messageWithImages,
        admin_reply: null,
        status: 'open',
        updated_at: new Date().toISOString(),
      }]);
      if (error) throw error;
      setMessage('');
      setOrderCode('');
      setImages([]);
      setFormInfo('Destek talebiniz oluşturuldu. En kısa sürede yanıtlanacaktır.');
      setActiveTab('history');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Talep oluşturulamadı.';
      setFormError(msg);
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <CaretLeft size={18} color="#000000" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Destek Talepleri</Text>
          <Text style={styles.headerSub}>Talep oluşturun, yanıtları buradan takip edin.</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchTickets(); setRefreshing(false); }} tintColor={COLORS.brand.green} />} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {/* Badge + Phone */}
          <View style={styles.headerRow}>
            <View style={styles.badge}>
              <Headset size={14} color={COLORS.brand.green} />
              <Text style={styles.badgeText}>Destek Merkezi</Text>
            </View>
            <TouchableOpacity
              style={styles.phoneBtn}
              onPress={() => Linking.openURL('tel:02323322100')}
              activeOpacity={0.7}
            >
              <PhoneCall size={16} color="#A3E635" />
              <Text style={styles.phoneText}>(0232) 33 22 100</Text>
            </TouchableOpacity>
          </View>

          {/* Info */}
          <View style={styles.infoRow}>
            <WarningCircle size={14} color={COLORS.brand.green} style={{ marginTop: 1 }} />
            <Text style={styles.infoText}>Numarayı arayarak sadece siparişinizin güncel durumu ve satış hakkında bilgi alabilirsiniz. İade, şikayet, bozuk/eksik ürün, teslimat gecikmesi ve fatura talebi için lütfen aşağıdaki formu doldurunuz.</Text>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'new' && styles.tabActive]}
              onPress={() => setActiveTab('new')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'new' && styles.tabTextActive]}>Yeni Talep</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'history' && styles.tabActive]}
              onPress={() => setActiveTab('history')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>Geçmiş Taleplerim</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'new' ? (
            <View style={styles.form}>
              {/* Konu */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Konu</Text>
                <View style={styles.pickerWrap}>
                  {TOPIC_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.topicBtn, subject === opt && styles.topicBtnActive]}
                      onPress={() => setSubject(opt)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.topicBtnText, subject === opt && styles.topicBtnTextActive]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Sipariş kodu */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Sipariş Kodu (Opsiyonel)</Text>
                <TextInput
                  style={styles.input}
                  value={orderCode}
                  onChangeText={(v) => setOrderCode(v.toUpperCase())}
                  placeholder="Örn: KCAL-AB12CD"
                  placeholderTextColor={COLORS.text.tertiary}
                  autoCapitalize="characters"
                />
              </View>

              {/* Mesaj */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Mesaj</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Talebinizi detaylı şekilde yazın..."
                  placeholderTextColor={COLORS.text.tertiary}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />
              </View>

              {/* Görseller */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Görseller (Opsiyonel)</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {images.map((img, i) => (
                    <View key={i} style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden' }}>
                      <Image source={{ uri: img.uri }} style={{ width: 80, height: 80 }} />
                      <TouchableOpacity
                        onPress={() => removeImage(i)}
                        style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <XIcon size={12} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {images.length < 3 && (
                    <TouchableOpacity
                      onPress={pickImage}
                      style={{ width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderColor: '#DDD', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Plus size={24} color="#999" />
                      <Text style={{ fontSize: 11, color: '#999', marginTop: 4, fontFamily: 'PlusJakartaSans_500Medium' }}>Ekle</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                  Maksimum 3 görsel, her biri en fazla 5 MB
                </Text>
              </View>

              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
              {formInfo ? <Text style={styles.infoGreen}>{formInfo}</Text> : null}

              <TouchableOpacity
                style={[styles.submitBtn, submitLoading && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitLoading}
                activeOpacity={0.85}
              >
                {submitLoading
                  ? <ActivityIndicator color="#000000" size="small" />
                  : <>
                      <ChatText size={16} color="#000000" />
                      <Text style={styles.submitBtnText}>Talebi Oluştur</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ marginTop: 12 }}>
              {ticketsLoading ? (
                <ActivityIndicator color={COLORS.brand.green} style={{ marginTop: 20 }} />
              ) : ticketsError ? (
                <View style={{ alignItems: 'center', paddingVertical: 48, gap: 12 }}>
                  <WarningCircle size={48} color="#EF4444" weight="thin" />
                  <Text style={{ fontSize: 16, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000' }}>Bir Hata Oluştu</Text>
                  <Text style={{ fontSize: 14, color: COLORS.text.tertiary, textAlign: 'center' }}>{ticketsError}</Text>
                </View>
              ) : tickets.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 48, gap: 12 }}>
                  <ChatText size={48} color="#e0e0e0" weight="thin" />
                  <Text style={{ fontSize: 16, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000' }}>Destek Talebiniz Yok</Text>
                  <Text style={{ fontSize: 14, color: COLORS.text.tertiary, textAlign: 'center', lineHeight: 21 }}>Henüz bir destek talebi oluşturmadınız.</Text>
                </View>
              ) : (
                tickets.map((ticket, index) => {
                  const isExpanded = expandedId === ticket.id;
                  const status = (ticket.status || 'open').toLowerCase();
                  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.open;
                  return (
                    <Animated.View key={ticket.id} style={getTicketStyle(index)}>
                    <TouchableOpacity
                      style={styles.ticketItem}
                      onPress={() => setExpandedId(isExpanded ? '' : ticket.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.ticketHeader}>
                        <Text style={styles.ticketSubject}>{ticket.subject}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                          <Text style={[styles.statusText, { color: statusColor.text }]}>
                            {STATUS_LABELS[status] || 'Açık'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.ticketMeta}>
                        <Text style={styles.ticketMetaText}>#{formatShortId(ticket.id)}</Text>
                        <Text style={styles.ticketMetaText}>{formatDate(ticket.created_at)}</Text>
                        {ticket.order_code ? <Text style={styles.ticketMetaText}>{ticket.order_code}</Text> : null}
                      </View>
                      {isExpanded && (
                        <View style={styles.ticketBody}>
                          <Text style={styles.ticketBodyLabel}>Talebiniz</Text>
                          <View style={styles.ticketBodyBox}>
                            <Text style={styles.ticketBodyText}>{ticket.message}</Text>
                          </View>
                          <Text style={[styles.ticketBodyLabel, { marginTop: 10 }]}>Admin Yanıtı</Text>
                          <View style={styles.ticketBodyBox}>
                            <Text style={styles.ticketBodyText}>
                              {ticket.admin_reply?.trim() || 'Henüz yanıtlanmadı.'}
                            </Text>
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                    </Animated.View>
                  );
                })
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  headerTitle: { fontSize: 18, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },
  headerSub: { fontSize: 12, color: COLORS.text.secondary, marginTop: 1 },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 20, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#000000', borderRadius: 100,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  phoneBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'transparent',
  },
  phoneText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#999999',
  },
  badgeText: { fontSize: 12, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.brand.green },
  infoRow: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: COLORS.background, borderRadius: 12,
    padding: 10, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(198,240,79,0.3)',
  },
  infoText: { flex: 1, fontSize: 12, color: '#555555', lineHeight: 17 },
  tabs: {
    flexDirection: 'row', backgroundColor: COLORS.background,
    borderRadius: 12, padding: 4, marginBottom: 4,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.brand.green },
  tabText: { fontSize: 13, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.secondary },
  tabTextActive: { color: COLORS.text.primary },
  form: { marginTop: 12, gap: 14 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.secondary },
  input: {
    backgroundColor: COLORS.background, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: COLORS.text.primary,
    borderWidth: 1, borderColor: COLORS.border.medium,
  },
  textarea: { height: 120, textAlignVertical: 'top' },
  pickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topicBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 100, backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.border.medium,
  },
  topicBtnActive: { backgroundColor: '#000000', borderColor: '#000000' },
  topicBtnText: { fontSize: 12, fontWeight: '500',
fontFamily: 'PlusJakartaSans_500Medium', color: '#555555' },
  topicBtnTextActive: { color: COLORS.brand.green },
  submitBtn: {
    backgroundColor: COLORS.brand.green, borderRadius: 100, height: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  submitBtnText: { fontSize: 15, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },
  errorText: { fontSize: 12, color: '#EF4444' },
  infoGreen: { fontSize: 12, color: '#065F46' },
  emptyText: { fontSize: 13, color: COLORS.text.secondary, textAlign: 'center', marginTop: 20, marginBottom: 10 },
  ticketItem: {
    backgroundColor: COLORS.background, borderRadius: 14, padding: 12, marginBottom: 8,
  },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  ticketSubject: { flex: 1, fontSize: 13, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.primary },
  statusBadge: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold'},
  ticketMeta: { flexDirection: 'row', gap: 10, marginTop: 4, flexWrap: 'wrap' },
  ticketMetaText: { fontSize: 11, color: COLORS.text.secondary },
  ticketBody: { marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', paddingTop: 12 },
  ticketBodyLabel: { fontSize: 12, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.primary, marginBottom: 6 },
  ticketBodyBox: { backgroundColor: COLORS.white, borderRadius: 10, padding: 10 },
  ticketBodyText: { fontSize: 13, color: '#555555', lineHeight: 19 },
});
