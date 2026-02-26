import React, { useEffect, useState } from 'react';
import { Apple, Phone, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AuthModal({
  open,
  onClose,
  onPhoneContinue,
  onGoogleContinue,
  onAppleContinue,
}) {
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!open) setPhone('');
  }, [open]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] bg-black/40 px-4 backdrop-blur-sm"
      >
        <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center">
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 330, damping: 28, mass: 0.65 }}
            className="w-full rounded-3xl bg-brand-white p-5 shadow-[0_22px_40px_rgba(32,32,32,0.26)]"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="mb-1 font-zalando text-lg font-semibold text-brand-dark">Devam Etmek İçin Giriş Yapın</h3>
                <p className="mb-0 font-google text-xs text-brand-dark/65">
                  Siparişinizi tamamlamak için giriş yapmanız gerekiyor.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-bg text-brand-dark"
                aria-label="Kapat"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-brand-secondary/40 bg-brand-bg p-2.5">
                <label className="mb-1 block px-1 font-google text-[11px] text-brand-dark/65">Telefon ile Giriş</label>
                <div className="flex items-center gap-2 rounded-xl bg-brand-white px-3 py-2.5">
                  <Phone size={14} className="text-brand-dark/65" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="05xx xxx xx xx"
                    className="w-full bg-transparent border-0 outline-none ring-0 focus:ring-0 shadow-none font-google text-sm text-brand-dark placeholder:text-brand-dark/45"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onPhoneContinue?.(phone)}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-[#98CD00] px-4 py-2.5 font-google text-sm font-medium text-[#F0F0F0]"
                >
                  Devam Et / Kod Gönder
                </button>
              </div>

              <div className="flex items-center gap-2 py-1">
                <hr className="h-px flex-1 border-0 bg-brand-dark/15" />
                <span className="font-google text-[11px] font-medium text-brand-dark/55">VEYA</span>
                <hr className="h-px flex-1 border-0 bg-brand-dark/15" />
              </div>

              <button
                type="button"
                onClick={() => onGoogleContinue?.()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-secondary/40 bg-brand-white px-4 py-3 font-google text-sm font-medium text-brand-dark"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-bg text-[11px] font-bold text-brand-dark">
                  G
                </span>
                Google ile Giriş
              </button>

              <button
                type="button"
                onClick={() => onAppleContinue?.()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-dark px-4 py-3 font-google text-sm font-medium text-brand-white"
              >
                <Apple size={15} />
                Apple ile Giriş
              </button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
