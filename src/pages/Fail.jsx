import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CreditCard,
  Home,
  Info,
  RefreshCw,
  Wallet,
  WifiOff,
} from 'lucide-react';

export default function Fail() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F0F0F0] px-4 py-4">
      <main className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[2rem] border border-brand-white/10 bg-[#F0F0F0]">
        <div className="flex-1 overflow-y-auto px-6 pb-8 pt-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="relative mb-6 flex h-28 w-28 items-center justify-center rounded-full border border-brand-white/10 bg-[#F0F0F0] shadow-sm">
              <div className="absolute inset-0 animate-pulse rounded-full bg-brand-secondary/10" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-brand-secondary/20">
                <AlertTriangle size={42} className="text-brand-dark" />
              </div>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-brand-dark">Ödeme Başarısız</h1>
            <p className="max-w-[280px] text-sm text-brand-dark/60">
              İşlem tamamlanamadı. Lütfen ödeme yönteminizi kontrol edip tekrar deneyin.
            </p>
          </div>

          <section className="mb-6 rounded-2xl border border-brand-white/10 bg-[#F0F0F0] p-5">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-brand-dark/50">Olası Nedenler</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-white/10 bg-[#F0F0F0]">
                  <Wallet size={18} className="text-brand-dark/50" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-brand-dark">Yetersiz bakiye</p>
                  <p className="text-xs text-brand-dark/50">Kart veya hesabınızda yeterli limit olmayabilir.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-white/10 bg-[#F0F0F0]">
                  <CreditCard size={18} className="text-brand-dark/50" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-brand-dark">Kart bilgileri hatalı</p>
                  <p className="text-xs text-brand-dark/50">CVV veya son kullanma tarihi yanlış olabilir.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-white/10 bg-[#F0F0F0]">
                  <WifiOff size={18} className="text-brand-dark/50" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-brand-dark">Banka bağlantı hatası</p>
                  <p className="text-xs text-brand-dark/50">Anlık teknik kesinti nedeniyle işlem reddedilmiş olabilir.</p>
                </div>
              </div>
            </div>
          </section>

          <div className="mb-4 flex items-center justify-center gap-2 text-xs text-brand-dark/50">
            <Info size={14} className="text-brand-dark" />
            <span>Yardım mı gerekiyor? Destek ekibiyle iletişime geçin.</span>
          </div>
        </div>

        <div className="space-y-3 border-t border-brand-white/10 bg-[#F0F0F0] px-6 pb-[max(1.6rem,env(safe-area-inset-bottom))] pt-4">
          <button
            onClick={() => navigate('/checkout')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-white bg-[#98CD00] py-4 text-sm font-bold text-[#F0F0F0] active:scale-[0.98]"
          >
            <RefreshCw size={16} />
            TEKRAR DENE
          </button>
          <button
            onClick={() => navigate('/cart')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-white/20 bg-[#F0F0F0] py-4 text-sm font-bold text-brand-dark active:scale-[0.98]"
          >
            <CreditCard size={16} />
            ÖDEME YÖNTEMİNİ DEĞİŞTİR
          </button>
          <button
            onClick={() => navigate('/')}
            className="inline-flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-brand-dark/50"
          >
            <Home size={15} />
            Ana Sayfaya Dön
          </button>
          <button
            onClick={() => navigate('/cart')}
            className="inline-flex w-full items-center justify-center gap-2 py-1 text-xs font-semibold text-brand-dark/50"
          >
            <ArrowLeft size={14} />
            Sepete Geri Dön
          </button>
          <div className="mx-auto mt-2 h-1.5 w-28 rounded-full bg-brand-white/10" />
        </div>
      </main>
    </div>
  );
}
