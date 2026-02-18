import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, ChevronLeft, Sparkles } from 'lucide-react';

export default function Subscription() {
  const navigate = useNavigate();
  const [info, setInfo] = useState('');

  const handleNotify = () => {
    localStorage.setItem('subscription_notify_requested', '1');
    setInfo('Abonelik paketleri yayına girince sana bildirim göndereceğiz.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F0F0F0] to-[#F0F0F0] px-4 pb-[max(1.8rem,env(safe-area-inset-bottom))] pt-4 text-brand-dark">
      <main className="mx-auto w-full max-w-[430px]">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-brand-white/10 bg-[#F0F0F0]/90 py-2.5 backdrop-blur-md">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-white/10 bg-[#F0F0F0] text-brand-dark shadow-sm"
          >
            <ChevronLeft size={17} />
          </button>
          <h1 className="text-base font-bold text-brand-dark">Abonelik</h1>
          <div className="w-9" />
        </header>

        <section className="mt-5 rounded-3xl border border-brand-white/10 bg-[#F0F0F0] p-[1.125rem] shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#98CD00]/50 text-brand-dark">
            <Sparkles size={21} />
          </div>
          <h2 className="mt-3.5 text-[28px] font-extrabold leading-[1.04] text-brand-dark">Paketler Çok Yakında</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-brand-dark/60">
            Haftalık planlar ve düzenli teslimat seçenekleri yakında bu ekranda olacak.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-brand-white/10 bg-[#F0F0F0] px-2 py-2">
              <p className="mb-0 text-[18px] font-extrabold leading-none text-brand-dark">7</p>
              <p className="mb-0 mt-1 text-[10px] text-brand-dark/50">7 Gün Plan</p>
            </div>
            <div className="rounded-xl border border-brand-white/10 bg-[#F0F0F0] px-2 py-2">
              <p className="mb-0 text-[18px] font-extrabold leading-none text-brand-dark">14</p>
              <p className="mb-0 mt-1 text-[10px] text-brand-dark/50">14 Gün Plan</p>
            </div>
            <div className="rounded-xl border border-brand-white/10 bg-[#F0F0F0] px-2 py-2">
              <p className="mb-0 text-[18px] font-extrabold leading-none text-brand-dark">30</p>
              <p className="mb-0 mt-1 text-[10px] text-brand-dark/50">30 Gün Plan</p>
            </div>
          </div>
        </section>

        <section className="mt-3.5 rounded-2xl border border-brand-white/10 bg-[#F0F0F0] p-4">
          <h3 className="mb-2 text-[13px] font-bold text-brand-dark">Neler Gelecek?</h3>
          <ul className="space-y-1.5 text-[12px] text-brand-dark/65">
            <li>• Hedefine göre kişiselleştirilmiş menüler</li>
            <li>• Sabit gün ve saatte otomatik teslimat</li>
            <li>• Abonelere özel fiyat ve kuponlar</li>
          </ul>
        </section>

        {info && (
          <div className="mt-3 rounded-xl border border-brand-secondary/35 bg-brand-secondary/10 px-3 py-2 text-xs text-brand-dark">
            {info}
          </div>
        )}

        <section className="mt-4 space-y-2">
          <button
            onClick={handleNotify}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-white bg-[#98CD00] py-3.5 text-[14px] font-bold text-[#F0F0F0]"
          >
            <BellRing size={16} />
            Yayına Çıkınca Bildir
          </button>
          <button
            onClick={() => navigate('/offers')}
            className="inline-flex w-full items-center justify-center rounded-2xl border border-brand-white/20 bg-[#F0F0F0] py-3.5 text-[14px] font-bold text-brand-dark"
          >
            Teklifleri İncele
          </button>
        </section>
      </main>
    </div>
  );
}
