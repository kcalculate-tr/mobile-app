import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronLeft, ShieldCheck } from 'lucide-react';

export default function Payment() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  const oid = params.get('oid');
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState('');

  useEffect(() => {
    if (!token) return;

    const existingScript = document.querySelector('script[data-paytr-resizer="true"]');
    if (existingScript) return;

    const script = document.createElement('script');
    script.src = 'https://www.paytr.com/js/iframeResizer.min.js';
    script.async = true;
    script.dataset.paytrResizer = 'true';
    document.body.appendChild(script);
  }, [token]);

  useEffect(() => {
    if (!token || !iframeLoading) return undefined;

    const timer = window.setTimeout(() => {
      setIframeError('Ödeme ekranı geç açıldı. Bağlantınızı kontrol edip tekrar deneyin.');
      setIframeLoading(false);
    }, 15000);

    return () => window.clearTimeout(timer);
  }, [iframeLoading, token]);

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#F0F0F0] to-[#F0F0F0] px-4 py-6 text-brand-dark">
        <div className="mx-auto w-full max-w-[430px] rounded-3xl border border-brand-white/10 bg-[#F0F0F0] p-6 text-center shadow-sm">
          <h1 className="mb-0 text-lg font-bold text-brand-dark">Ödeme Bağlantısı Bulunamadı</h1>
          <p className="mt-1.5 text-[13px] text-brand-dark/60">Lütfen ödeme adımına dönüp yeniden deneyin.</p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => navigate('/checkout')}
              className="flex-1 rounded-xl border border-brand-white bg-[#98CD00] py-2.5 text-[13px] font-bold text-[#F0F0F0]"
            >
              Ödemeye dön
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 rounded-xl border border-brand-white/20 bg-[#F0F0F0] py-2.5 text-[13px] font-bold text-brand-dark"
            >
              Ana sayfa
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F0F0F0] to-[#F0F0F0] pb-[max(1.25rem,env(safe-area-inset-bottom))] text-brand-dark">
      <div className="mx-auto min-h-screen w-full max-w-[430px]">
        <header className="sticky top-0 z-40 border-b border-brand-white/10 bg-[#F0F0F0]/95 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand-white/15 bg-[#F0F0F0]"
              aria-label="Geri"
            >
              <ChevronLeft size={17} />
            </button>
            <h1 className="mb-0 text-base font-bold text-brand-dark">Ödemeyi Tamamla</h1>
            <div className="w-9" />
          </div>
        </header>

        <div className="space-y-2.5 px-4 pt-3">
          <div className="flex items-center justify-between rounded-2xl border border-brand-white/10 bg-[#F0F0F0] p-3 text-[13px] text-brand-dark/75">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-[#98CD00]" />
              PayTR ile güvenli ödeme
            </span>
            <span className="rounded-full bg-[#F0F0F0] px-2 py-1 text-[10px] font-bold text-brand-dark">
              #{oid || '—'}
            </span>
          </div>

          {iframeError && (
            <div className="inline-flex w-full items-center gap-2 rounded-xl border border-brand-secondary/35 bg-brand-secondary/10 px-3 py-2 text-xs text-brand-dark">
              <AlertCircle size={14} />
              {iframeError}
            </div>
          )}

          <div className="relative overflow-hidden rounded-[1.25rem] border border-brand-white/10 bg-[#F0F0F0] shadow-sm">
            {iframeLoading && !iframeError && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#F0F0F0]">
                <div className="text-center">
                  <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-[#98CD00] border-t-transparent" />
                  <p className="mt-2 mb-0 text-[11px] text-brand-dark/60">Ödeme ekranı açılıyor...</p>
                </div>
              </div>
            )}
            <iframe
              id="paytriframe"
              frameBorder="0"
              scrolling="auto"
              title="PayTR Güvenli Ödeme"
              src={`https://www.paytr.com/odeme/guvenli/${token}`}
              onLoad={() => {
                setIframeLoading(false);
                setIframeError('');
              }}
              className="min-h-[656px] w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
