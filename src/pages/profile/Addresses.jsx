import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BriefcaseBusiness,
  ChevronLeft,
  House,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '../../supabase';
import useDeliveryZones from '../../hooks/useDeliveryZones';
import { AnimatePresence, motion } from 'framer-motion';

function formatAddress(address) {
  const parts = [address.full_address, address.district, address.city].filter(Boolean);
  return parts.join(', ');
}

function getAddressIcon(title) {
  const text = String(title || '').toLocaleLowerCase('tr-TR');
  if (text.includes('ev') || text.includes('home')) return House;
  if (text.includes('iş') || text.includes('work') || text.includes('ofis')) return BriefcaseBusiness;
  return MapPin;
}

function isMissingRequiredValue(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  const normalized = text.toLocaleLowerCase('tr-TR');
  return normalized === 'seçiniz' || normalized === 'seciniz';
}

function composeFullAddress(fullAddress, neighborhood) {
  const baseText = String(fullAddress || '').trim();
  const neighborhoodText = String(neighborhood || '').trim();
  if (!neighborhoodText) return baseText;
  if (!baseText) return neighborhoodText;

  const normalizedBase = baseText.toLocaleLowerCase('tr-TR');
  const normalizedNeighborhood = neighborhoodText.toLocaleLowerCase('tr-TR');
  if (normalizedBase.includes(normalizedNeighborhood)) {
    return baseText;
  }
  return `${neighborhoodText}, ${baseText}`;
}

function extractNeighborhoodFromAddress(address, neighborhoods = []) {
  const directValue = String(
    address?.neighborhood || address?.neighbourhood || address?.mahalle || ''
  ).trim();
  if (directValue) return directValue;

  const firstSegment = String(address?.full_address || '').split(',')[0]?.trim() || '';
  if (!firstSegment) return '';

  const normalized = firstSegment.toLocaleLowerCase('tr-TR');
  const matched = neighborhoods.find(
    (item) => String(item?.neighborhood || '').trim().toLocaleLowerCase('tr-TR') === normalized
  );
  return matched?.neighborhood || '';
}

const initialForm = {
  title: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  full_address: '',
  city: 'İzmir',
  district: '',
  neighborhood: '',
};

export default function Addresses() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(initialForm);
  const [userEmail, setUserEmail] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const {
    districts,
    getNeighborhoodsByDistrict,
    deliveryZonesLoading,
    deliveryZonesError,
  } = useDeliveryZones();
  const neighborhoodOptions = useMemo(
    () => getNeighborhoodsByDistrict(form.district),
    [form.district, getNeighborhoodsByDistrict]
  );

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          navigate('/login');
          return;
        }

        setUserId(user.id);
        setUserEmail(String(user.email || '').trim());

        const { data, error: addressError } = await supabase
          .from('addresses')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (addressError) throw addressError;
        setAddresses(data || []);
      } catch (err) {
        const message = err?.message || 'Adresler yüklenemedi.';
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [navigate]);

  useEffect(() => {
    if (!Array.isArray(addresses) || addresses.length === 0) {
      setSelectedAddressId('');
      return;
    }

    if (!selectedAddressId || !addresses.some((item) => String(item.id) === String(selectedAddressId))) {
      setSelectedAddressId(String(addresses[0].id));
    }
  }, [addresses, selectedAddressId]);

  const formTitle = useMemo(() => (editingId ? 'Adresi Düzenle' : 'Yeni Adres Ekle'), [editingId]);

  const openCreate = () => {
    setEditingId('');
    setForm((prev) => ({ ...initialForm, contact_email: userEmail || prev.contact_email || '' }));
    setError('');
    setInfo('');
    setFormOpen(true);
  };

  const openEdit = (address) => {
    const districtNeighborhoods = getNeighborhoodsByDistrict(address?.district || '');
    setEditingId(address.id);
    setForm({
      title: address.title || '',
      contact_name: address.contact_name || '',
      contact_phone: address.contact_phone || '',
      contact_email: address.contact_email || userEmail || '',
      full_address: address.full_address || '',
      city: 'İzmir',
      district: address.district || '',
      neighborhood: extractNeighborhoodFromAddress(address, districtNeighborhoods),
    });
    setError('');
    setInfo('');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId('');
    setForm(initialForm);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'district') {
      setForm((prev) => ({ ...prev, district: value, neighborhood: '' }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (!form.neighborhood) return;

    const existsInDistrict = neighborhoodOptions.some(
      (item) => String(item?.neighborhood || '').trim() === String(form.neighborhood || '').trim()
    );
    if (!existsInDistrict) {
      setForm((prev) => ({ ...prev, neighborhood: '' }));
    }
  }, [form.neighborhood, neighborhoodOptions]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!userId) {
      setError('Kullanıcı oturumu bulunamadı.');
      return;
    }

    const nameMissing = isMissingRequiredValue(form.contact_name);
    const phoneMissing = isMissingRequiredValue(form.contact_phone);
    const emailMissing = isMissingRequiredValue(form.contact_email);
    const districtMissing = isMissingRequiredValue(form.district);
    const neighborhoodMissing = isMissingRequiredValue(form.neighborhood);

    if (nameMissing || phoneMissing || emailMissing || districtMissing || neighborhoodMissing) {
      setError('Lütfen Ad Soyad, Telefon, E-posta, İlçe ve Mahalle alanlarının tamamını doldurduğunuzdan emin olun.');
      return;
    }

    if (!form.title || !form.full_address) {
      setError('Lütfen tüm alanları doldurun.');
      return;
    }

    setSaving(true);
    try {
      const normalizedFullAddress = composeFullAddress(form.full_address, form.neighborhood);

      if (editingId) {
        const updatePayload = {
          title: form.title.trim(),
          contact_name: form.contact_name.trim(),
          contact_phone: form.contact_phone.trim(),
          full_address: normalizedFullAddress,
          city: 'İzmir',
          district: form.district.trim(),
        };
        const { data: nextData, error: updateError } = await supabase
          .from('addresses')
          .update(updatePayload)
          .eq('id', editingId)
          .eq('user_id', userId)
          .select('*')
          .single();
        if (updateError) throw updateError;

        setAddresses((prev) => prev.map((item) => (item.id === nextData.id ? nextData : item)));
        setInfo('Adres güncellendi.');
      } else {
        const insertPayload = {
          user_id: userId,
          title: form.title.trim(),
          contact_name: form.contact_name.trim(),
          contact_phone: form.contact_phone.trim(),
          full_address: normalizedFullAddress,
          city: 'İzmir',
          district: form.district.trim(),
        };
        const { data: nextData, error: insertError } = await supabase
          .from('addresses')
          .insert([insertPayload])
          .select('*')
          .single();
        if (insertError) throw insertError;

        setAddresses((prev) => [nextData, ...prev]);
        setInfo('Adres kaydedildi.');
      }

      closeForm();
    } catch (err) {
      setError(err?.message || 'Adres kaydı başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const approved = window.confirm('Bu adresi silmek istediğinize emin misiniz?');
    if (!approved) return;

    setError('');
    setInfo('');
    try {
      const { error: deleteError } = await supabase
        .from('addresses')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (deleteError) throw deleteError;
      setAddresses((prev) => prev.filter((item) => item.id !== id));
      setInfo('Adres silindi.');
    } catch (err) {
      setError(err?.message || 'Adres silinemedi.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F0F0] pb-36">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-[#F0F0F0]/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-100 bg-white shadow-sm"
          >
            <ChevronLeft size={18} className="text-gray-700" />
          </button>
          <h1 className="app-heading-primary text-base">Adreslerim</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[430px] px-4 pt-4">
        <section className="mb-6">
          <div className="relative h-52 w-full overflow-hidden rounded-3xl border-4 border-brand-white shadow-sm">
            <img
              src="https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200&q=80"
              alt="Harita"
              className="h-full w-full object-cover grayscale"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <div className="absolute -inset-4 rounded-full bg-[#98CD00]/40 animate-ping" />
                <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-4 border-brand-white bg-[#98CD00] text-[#F0F0F0] shadow-lg">
                  <MapPin size={18} />
                </div>
              </div>
            </div>
            <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full border border-brand-white/10 bg-[#F0F0F0]/95 px-3 py-1.5 backdrop-blur">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#98CD00]" />
              <span className="text-xs font-semibold text-brand-dark">Mevcut Konum</span>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-3 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">
            {info}
          </div>
        )}

        <section className="space-y-3">
          <p className="ml-0.5 text-xs font-bold uppercase tracking-widest text-gray-400">Kayıtlı Konumlar</p>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => (
                <div key={`address-skeleton-${item}`} className="app-skeleton h-[116px]" />
              ))}
            </div>
          ) : addresses.length === 0 ? (
            <div className="app-card p-6 text-center text-sm text-gray-400">
              Kayıtlı adresiniz bulunmuyor.
            </div>
          ) : (
            addresses.map((address, index) => {
              const Icon = getAddressIcon(address.title);
              const isSelected = String(selectedAddressId) === String(address.id);

              return (
                <div
                  key={address.id}
                  onClick={() => setSelectedAddressId(String(address.id))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedAddressId(String(address.id));
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`w-full cursor-pointer rounded-2xl border p-4 text-left shadow-sm transition-all ${
                    isSelected
                      ? 'border-[#98CD00]/50 bg-white ring-2 ring-[#98CD00]/30'
                      : 'border-gray-100 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${isSelected ? 'bg-[#98CD00]/15 text-[#98CD00]' : 'bg-gray-100 text-gray-400'}`}>
                      <Icon size={18} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-900">{address.title || 'Adres'}</p>
                        {index === 0 && (
                          <span className="rounded-full bg-[#98CD00] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                            Varsayılan
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-gray-500">{formatAddress(address)}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {address.contact_name || '-'} • {address.contact_phone || '-'}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openEdit(address)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600"
                        aria-label="Düzenle"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(address.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-500"
                        aria-label="Sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <button
            onClick={openCreate}
            className="mt-1 w-full rounded-2xl border-2 border-dashed border-gray-200 bg-white p-5 transition-colors hover:border-[#98CD00]/40"
          >
            <div className="flex flex-col items-center justify-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#98CD00] text-white">
                <Plus size={18} />
              </span>
              <span className="text-sm font-bold text-gray-700">Yeni Adres Ekle</span>
            </div>
          </button>
        </section>
      </main>

      <AnimatePresence>
      {formOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: 42, opacity: 0.96 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0.96 }}
            transition={{ type: 'spring', stiffness: 330, damping: 28, mass: 0.7 }}
            className="w-full rounded-t-3xl border-t border-gray-100 bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">{formTitle}</h2>
              <button
                onClick={closeForm}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500"
                aria-label="Kapat"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-2.5">
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Başlık (Ev, İş)"
                className="app-input"
                required
              />
              <input
                type="text"
                name="contact_name"
                value={form.contact_name}
                onChange={handleChange}
                placeholder="İletişim Ad Soyad"
                className="app-input"
                required
              />
              <input
                type="tel"
                name="contact_phone"
                value={form.contact_phone}
                onChange={handleChange}
                placeholder="İletişim Telefon"
                className="app-input"
                required
              />
              <input
                type="email"
                name="contact_email"
                value={form.contact_email}
                onChange={handleChange}
                placeholder="İletişim E-posta"
                className="app-input"
                required
              />
              <textarea
                name="full_address"
                value={form.full_address}
                onChange={handleChange}
                rows={3}
                placeholder="Açık adres"
                className="app-input resize-none"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  name="city"
                  value="İzmir"
                  readOnly
                  disabled
                  className="app-input opacity-60"
                />
                <select
                  name="district"
                  value={form.district}
                  onChange={handleChange}
                  className="app-input"
                  required
                >
                  <option value="">İlçe Seçiniz</option>
                  {districts.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
              </div>
              <select
                name="neighborhood"
                value={form.neighborhood}
                onChange={handleChange}
                disabled={!form.district}
                className="app-input disabled:opacity-60"
                required
              >
                <option value="">{form.district ? 'Mahalle Seçiniz' : 'Önce İlçe Seçiniz'}</option>
                {neighborhoodOptions.map((zone) => (
                  <option key={zone.id} value={zone.neighborhood}>
                    {zone.neighborhood}
                  </option>
                ))}
              </select>
              {(deliveryZonesLoading || deliveryZonesError) && (
                <p className="text-xs text-gray-400">
                  {deliveryZonesLoading ? 'Teslimat bölgeleri yükleniyor...' : deliveryZonesError}
                </p>
              )}
              <button
                type="submit"
                disabled={saving}
                className="app-btn-green disabled:opacity-70"
              >
                {saving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    İşleniyor...
                  </>
                ) : 'Kaydet'}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <footer className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-md bg-gradient-to-t from-[#F0F0F0] via-[#F0F0F0]/90 to-transparent px-4 pb-6 pt-2">
        <button
          onClick={() => {
            if (selectedAddressId) {
              localStorage.setItem('checkout_selected_address_id', String(selectedAddressId));
            }
            navigate(-1);
          }}
          disabled={addresses.length === 0}
          className="app-btn-green py-4 font-bold disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>Konumu Onayla</span>
        </button>
      </footer>
    </div>
  );
}
