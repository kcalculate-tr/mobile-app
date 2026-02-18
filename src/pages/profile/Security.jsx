import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, LockKeyhole } from 'lucide-react';
import { supabase } from '../../supabase';

export default function Security() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    newPasswordAgain: '',
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!form.currentPassword || !form.newPassword || !form.newPasswordAgain) {
      setMessageType('error');
      setMessage('Tüm alanları doldurmalısınız.');
      return;
    }

    if (form.newPassword !== form.newPasswordAgain) {
      setMessageType('error');
      setMessage('Yeni şifreler eşleşmiyor.');
      return;
    }

    if (form.newPassword.length < 6) {
      setMessageType('error');
      setMessage('Yeni şifre en az 6 karakter olmalıdır.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: form.newPassword });
      if (error) {
        throw error;
      }

      setMessageType('success');
      setMessage('Şifreniz başarıyla güncellendi.');
      setForm({
        currentPassword: '',
        newPassword: '',
        newPasswordAgain: '',
      });
    } catch (err) {
      setMessageType('error');
      setMessage(err?.message || 'Şifre güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F0F0] pb-28 text-brand-dark">
      <header className="sticky top-0 z-30 bg-[#F0F0F0]/95 backdrop-blur-md px-4 py-3 border-b border-brand-white/10 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-brand-dark font-bold flex items-center gap-1"
          >
            <ChevronLeft size={18} />
            Geri
          </button>
          <h1 className="text-lg font-bold text-brand-dark">Şifre ve Güvenlik</h1>
          <div className="w-10" />
        </div>
      </header>

      <form onSubmit={handleSubmit} className="px-4 pt-4 space-y-3">
        <div className="bg-[#F0F0F0] rounded-2xl border border-brand-white/10 shadow-sm p-4">
          <label className="text-xs font-bold text-brand-dark/70">Mevcut Şifre</label>
          <input
            type="password"
            name="currentPassword"
            value={form.currentPassword}
            onChange={handleChange}
            disabled={saving}
            className="mt-1 w-full py-3 px-4 rounded-xl border border-brand-white/10 bg-[#F0F0F0] text-sm outline-none focus:border-brand-white"
          />
        </div>

        <div className="bg-[#F0F0F0] rounded-2xl border border-brand-white/10 shadow-sm p-4">
          <label className="text-xs font-bold text-brand-dark/70">Yeni Şifre</label>
          <input
            type="password"
            name="newPassword"
            value={form.newPassword}
            onChange={handleChange}
            disabled={saving}
            className="mt-1 w-full py-3 px-4 rounded-xl border border-brand-white/10 bg-[#F0F0F0] text-sm outline-none focus:border-brand-white"
          />
        </div>

        <div className="bg-[#F0F0F0] rounded-2xl border border-brand-white/10 shadow-sm p-4">
          <label className="text-xs font-bold text-brand-dark/70">Yeni Şifre Tekrar</label>
          <input
            type="password"
            name="newPasswordAgain"
            value={form.newPasswordAgain}
            onChange={handleChange}
            disabled={saving}
            className="mt-1 w-full py-3 px-4 rounded-xl border border-brand-white/10 bg-[#F0F0F0] text-sm outline-none focus:border-brand-white"
          />
        </div>

        {message && (
          <div
            className={`rounded-xl px-3 py-2 text-xs border ${
              messageType === 'error'
                ? 'bg-brand-secondary/10 border-brand-secondary/40 text-brand-dark'
                : 'bg-brand-secondary/10 border-brand-secondary/40 text-brand-dark'
            }`}
          >
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full border border-brand-white bg-[#98CD00] text-[#F0F0F0] rounded-2xl py-3.5 font-bold inline-flex items-center justify-center gap-2 disabled:opacity-70"
        >
          <LockKeyhole size={16} />
          {saving ? 'Güncelleniyor...' : 'Güncelle'}
        </button>
      </form>
    </div>
  );
}
