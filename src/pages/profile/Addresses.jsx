import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BriefcaseBusiness,
  ChevronLeft,
  House,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '../../supabase';

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

const initialForm = {
  title: '',
  contact_name: '',
  contact_phone: '',
  full_address: '',
  city: '',
  district: '',
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
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

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
    setForm(initialForm);
    setError('');
    setInfo('');
    setFormOpen(true);
  };

  const openEdit = (address) => {
    setEditingId(address.id);
    setForm({
      title: address.title || '',
      contact_name: address.contact_name || '',
      contact_phone: address.contact_phone || '',
      full_address: address.full_address || '',
      city: address.city || '',
      district: address.district || '',
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
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!userId) {
      setError('Kullanıcı oturumu bulunamadı.');
      return;
    }

    if (
      !form.title
      || !form.contact_name
      || !form.contact_phone
      || !form.full_address
      || !form.city
      || !form.district
    ) {
      setError('Lütfen tüm alanları doldurun.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { data, error: updateError } = await supabase
          .from('addresses')
          .update({
            title: form.title.trim(),
            contact_name: form.contact_name.trim(),
            contact_phone: form.contact_phone.trim(),
            full_address: form.full_address.trim(),
            city: form.city.trim(),
            district: form.district.trim(),
          })
          .eq('id', editingId)
          .eq('user_id', userId)
          .select('*')
          .single();

        if (updateError) throw updateError;
        setAddresses((prev) => prev.map((item) => (item.id === data.id ? data : item)));
        setInfo('Adres güncellendi.');
      } else {
        const payload = {
          user_id: userId,
          title: form.title.trim(),
          contact_name: form.contact_name.trim(),
          contact_phone: form.contact_phone.trim(),
          full_address: form.full_address.trim(),
          city: form.city.trim(),
          district: form.district.trim(),
        };

        const { data, error: insertError } = await supabase
          .from('addresses')
          .insert([payload])
          .select('*')
          .single();

        if (insertError) throw insertError;
        setAddresses((prev) => [data, ...prev]);
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
    <div className="min-h-screen bg-[#F0F0F0] text-brand-dark pb-36">
      <header className="sticky top-0 z-30 border-b border-brand-white/10 bg-[#F0F0F0]/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-white/10 bg-[#F0F0F0]"
          >
            <ChevronLeft size={18} className="text-brand-dark" />
          </button>
          <h1 className="text-lg font-bold text-brand-dark">Adreslerim</h1>
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
          <div className="mb-3 rounded-xl border border-brand-secondary/40 bg-brand-secondary/10 px-3 py-2 text-xs text-brand-dark">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-3 rounded-xl border border-brand-secondary/40 bg-brand-secondary/10 px-3 py-2 text-xs text-brand-dark">
            {info}
          </div>
        )}

        <section className="space-y-3">
          <h2 className="ml-1 text-xs font-bold uppercase tracking-wider text-brand-dark/50">Kayıtlı Konumlar</h2>

          {loading ? (
            <div className="rounded-2xl border border-brand-white/10 bg-[#F0F0F0] p-6 text-center text-sm text-brand-dark/50 shadow-sm">
              Yükleniyor...
            </div>
          ) : addresses.length === 0 ? (
            <div className="rounded-2xl border border-brand-white/10 bg-[#F0F0F0] p-6 text-center text-sm text-brand-dark/50 shadow-sm">
              Kayıtlı adresiniz bulunmuyor.
            </div>
          ) : (
            addresses.map((address, index) => {
              const Icon = getAddressIcon(address.title);
              const isSelected = String(selectedAddressId) === String(address.id);

              return (
                <button
                  key={address.id}
                  onClick={() => setSelectedAddressId(String(address.id))}
                  className={`w-full rounded-2xl border p-4 text-left shadow-sm transition-all ${
                    isSelected
                      ? 'border-brand-white bg-[#F0F0F0] ring-2 ring-[#98CD00]/80'
                      : 'border-brand-white/10 bg-[#F0F0F0]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isSelected ? 'bg-[#98CD00]/40 text-brand-dark' : 'bg-[#F0F0F0] text-brand-dark/50'}`}>
                      <Icon size={18} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-brand-dark">{address.title || 'Adres'}</p>
                        {index === 0 && (
                          <span className="rounded-full bg-[#98CD00] px-2 py-0.5 text-[10px] font-bold uppercase text-[#F0F0F0]">
                            Varsayılan
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-brand-dark/60">{formatAddress(address)}</p>
                      <p className="mt-1 text-xs text-brand-dark/50">
                        {address.contact_name || '-'} • {address.contact_phone || '-'}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openEdit(address)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F0F0F0] text-brand-dark"
                        aria-label="Düzenle"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(address.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-secondary/15 text-brand-dark"
                        aria-label="Sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </button>
              );
            })
          )}

          <button
            onClick={openCreate}
            className="mt-1 w-full rounded-2xl border-2 border-dashed border-brand-white/30 bg-[#F0F0F0]/90 p-5"
          >
            <div className="flex flex-col items-center justify-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#98CD00] text-[#F0F0F0]">
                <Plus size={18} />
              </span>
              <span className="text-sm font-bold text-brand-dark">Yeni Adres Ekle</span>
            </div>
          </button>
        </section>
      </main>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-[#F0F0F0]/30">
          <div className="w-full rounded-t-3xl border-t border-brand-white/10 bg-[#F0F0F0] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-brand-dark">{formTitle}</h2>
              <button
                onClick={closeForm}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F0F0F0] text-brand-dark"
                aria-label="Kapat"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Başlık (Ev, İş)"
                className="w-full rounded-xl border border-brand-white/10 bg-[#F0F0F0] px-4 py-3 text-sm outline-none focus:border-brand-white"
              />
              <input
                type="text"
                name="contact_name"
                value={form.contact_name}
                onChange={handleChange}
                placeholder="İletişim Ad Soyad"
                className="w-full rounded-xl border border-brand-white/10 bg-[#F0F0F0] px-4 py-3 text-sm outline-none focus:border-brand-white"
              />
              <input
                type="tel"
                name="contact_phone"
                value={form.contact_phone}
                onChange={handleChange}
                placeholder="İletişim Telefon"
                className="w-full rounded-xl border border-brand-white/10 bg-[#F0F0F0] px-4 py-3 text-sm outline-none focus:border-brand-white"
              />
              <textarea
                name="full_address"
                value={form.full_address}
                onChange={handleChange}
                rows={3}
                placeholder="Açık adres"
                className="w-full resize-none rounded-xl border border-brand-white/10 bg-[#F0F0F0] px-4 py-3 text-sm outline-none focus:border-brand-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="Şehir"
                  className="w-full rounded-xl border border-brand-white/10 bg-[#F0F0F0] px-4 py-3 text-sm outline-none focus:border-brand-white"
                />
                <input
                  type="text"
                  name="district"
                  value={form.district}
                  onChange={handleChange}
                  placeholder="İlçe"
                  className="w-full rounded-xl border border-brand-white/10 bg-[#F0F0F0] px-4 py-3 text-sm outline-none focus:border-brand-white"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl border border-brand-white bg-[#98CD00] py-3.5 font-bold text-[#F0F0F0] disabled:opacity-70"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </form>
          </div>
        </div>
      )}

      <footer className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-md bg-gradient-to-t from-[#F0F0F0] via-[#F0F0F0]/95 to-transparent px-4 pb-6 pt-2">
        <button
          onClick={() => {
            if (selectedAddressId) {
              localStorage.setItem('checkout_selected_address_id', String(selectedAddressId));
            }
            navigate(-1);
          }}
          disabled={addresses.length === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-white bg-[#98CD00] py-4 font-bold text-[#F0F0F0] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>Konumu Onayla</span>
        </button>
        <div className="mt-4 flex justify-center">
          <div className="h-1.5 w-28 rounded-full bg-brand-white/10" />
        </div>
      </footer>
    </div>
  );
}
