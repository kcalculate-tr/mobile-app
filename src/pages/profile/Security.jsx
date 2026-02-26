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
    <div className="min-h-screen bg-[#F0F0F0] pb-28">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-[#F0F0F0]/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="-ml-2 flex items-center gap-1 p-2 font-semibold text-gray-900"
          >
            <ChevronLeft size={18} />
            Geri
          </button>
          <h1 className="app-heading-primary text-base">Şifre ve Güvenlik</h1>
          <div className="w-16" />
        </div>
      </header>

      <form onSubmit={handleSubmit} className="mx-auto max-w-[430px] space-y-3 px-4 pt-5">
        <div className="app-card space-y-1">
          <label className="text-xs font-semibold text-gray-500">Mevcut Şifre</label>
          <input
            type="password"
            name="currentPassword"
            value={form.currentPassword}
            onChange={handleChange}
            disabled={saving}
            placeholder="••••••••"
            className="app-input"
          />
        </div>

        <div className="app-card space-y-1">
          <label className="text-xs font-semibold text-gray-500">Yeni Şifre</label>
          <input
            type="password"
            name="newPassword"
            value={form.newPassword}
            onChange={handleChange}
            disabled={saving}
            placeholder="En az 6 karakter"
            className="app-input"
          />
        </div>

        <div className="app-card space-y-1">
          <label className="text-xs font-semibold text-gray-500">Yeni Şifre Tekrar</label>
          <input
            type="password"
            name="newPasswordAgain"
            value={form.newPasswordAgain}
            onChange={handleChange}
            disabled={saving}
            placeholder="••••••••"
            className="app-input"
          />
        </div>

        {message && (
          <div
            className={`rounded-xl border px-3 py-2.5 text-sm ${
              messageType === 'error'
                ? 'border-red-100 bg-red-50 text-red-600'
                : 'border-green-100 bg-green-50 text-green-700'
            }`}
          >
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="app-btn-green disabled:opacity-70"
        >
          <LockKeyhole size={16} />
          {saving ? 'Güncelleniyor...' : 'Güncelle'}
        </button>
      </form>
    </div>
  );
}
