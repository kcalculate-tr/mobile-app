import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, Lock, Mail, Phone, User, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../supabase';

const LEGAL_CONTENT = {
  refund: {
    title: 'İptal ve İade Politikası',
    subtitle: 'Gıda ürünlerinde cayma hakkı istisnası ve iade koşulları',
    paragraphs: [
      'KCAL üzerinden satılan ürünler siparişe özel hazırlanan taze gıda ürünleridir. Mesafeli Sözleşmeler Yönetmeliği 15/1-c gereği teslim alınan bu ürünlerde cayma hakkı bulunmaz.',
      'Tekil siparişler yalnızca “Hazırlanıyor / Üretimde” aşamasına geçmeden iptal edilebilir. Üretime giren siparişlerde gıda güvenliği ve operasyon planlaması nedeniyle iptal kabul edilmez.',
      'Ayıplı mal bildirimi, teslim anında veya paketin ilk açılışında ve tüketimden önce; fotoğraf/video ile “Hesabım > Destek Talebi Oluştur” üzerinden yapılmalıdır.',
      'Haklı ayıp tespitinde KCAL; ürün değişimi, bedel iadesi veya müşteri hesabına bakiye tanımlama seçeneklerinden birini uygular.',
    ],
  },
  kvkk: {
    title: 'KVKK Aydınlatma Metni',
    subtitle: 'Kişisel verilerin işlenmesi ve aktarımı',
    paragraphs: [
      'Veri sorumlusu, 7591148741 VKN’li SEKÜLART SAĞLIKLI GIDA ÜRÜNLERİ SAN. VE TİC. LTD. ŞTİ. (KCAL)’dır.',
      'Ad-soyad, telefon, e-posta, adres, sipariş geçmişi, cihaz/log verileri; üyelik, siparişin ifası, teslimat, faturalandırma ve destek süreçleri için işlenir.',
      'Boy, kilo, yaş, cinsiyet ve hedef gibi fiziksel veriler yalnızca açık rıza verilmesi halinde kişiselleştirilmiş takip amacıyla işlenir.',
      'Kişisel veriler; ödeme/lojistik/bilişim sağlayıcıları ve yetkili kamu kurumlarıyla hukuki sınırlar dahilinde paylaşılabilir. KVKK m.11 kapsamındaki haklar info@eatkcal.com üzerinden kullanılabilir.',
    ],
  },
  consent: {
    title: 'Açık Rıza Beyanı',
    subtitle: 'Kişiselleştirilmiş takip için sağlık/fiziksel veri işleme onayı',
    paragraphs: [
      'Kcal Tracker özelliğinin günlük kalori ve makro hedeflerini hesaplayabilmesi için yaş, boy, kilo, cinsiyet ve diyet hedefi verilerimin işlenmesine açık rıza veriyorum.',
      'Bu veriler yalnızca kişiselleştirilmiş kullanıcı deneyimi ve algoritmik analiz amacıyla kullanılacaktır.',
      'Onayım opsiyoneldir; dilediğim zaman hesap ayarları veya destek kanalları üzerinden geri çekebilirim.',
      'Rızanın geri çekilmesi, temel üyelik ve sipariş hizmetlerinden yararlanmama engel değildir.',
    ],
  },
  marketing: {
    title: 'Ticari Elektronik İleti İzni',
    subtitle: 'Kampanya ve indirim bilgilendirmeleri',
    paragraphs: [
      '6563 sayılı mevzuat kapsamında; kampanya, indirim, promosyon ve sadakat programı bilgilendirmelerinin SMS, e-posta, arama ve uygulama içi bildirim ile tarafıma iletilmesine onay veriyorum.',
      'Bu onay opsiyoneldir ve iletişim verilerimin yalnızca bilgilendirme amaçlı işlenmesini kapsar.',
      'Dilediğim zaman iletilerdeki yönlendirmeler veya İYS üzerinden ücretsiz şekilde ret hakkımı kullanarak onayı geri çekebilirim.',
    ],
  },
};

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isRefundAccepted, setIsRefundAccepted] = useState(false);
  const [isKvkkAccepted, setIsKvkkAccepted] = useState(false);
  const [isConsentAccepted, setIsConsentAccepted] = useState(false);
  const [isMarketingAccepted, setIsMarketingAccepted] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const modalContentRef = useRef(null);

  const activeModalContent = useMemo(
    () => (activeModal ? LEGAL_CONTENT[activeModal] : null),
    [activeModal]
  );

  const hasRequiredLegalApprovals = isRefundAccepted && isKvkkAccepted;

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  };

  const handleSocialClick = (provider) => {
    setError('');
    setInfo(`${provider} ile hızlı kayıt yakında aktif olacak.`);
  };

  const openLegalModal = (modalKey) => {
    setActiveModal(modalKey);
    setIsScrolledToBottom(false);
  };

  useEffect(() => {
    if (!activeModalContent) return;

    const frame = requestAnimationFrame(() => {
      const el = modalContentRef.current;
      if (!el) return;
      const fitsWithoutScroll = el.scrollHeight <= el.clientHeight + 2;
      if (fitsWithoutScroll) {
        setIsScrolledToBottom(true);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [activeModalContent]);

  const handleLegalCheckboxClick = (modalKey) => {
    if (modalKey === 'refund') {
      if (isRefundAccepted) {
        setIsRefundAccepted(false);
        return;
      }
      openLegalModal(modalKey);
      return;
    }

    if (modalKey === 'kvkk') {
      if (isKvkkAccepted) {
        setIsKvkkAccepted(false);
        return;
      }
      openLegalModal(modalKey);
      return;
    }

    if (modalKey === 'marketing') {
      if (isMarketingAccepted) {
        setIsMarketingAccepted(false);
        return;
      }
      openLegalModal(modalKey);
      return;
    }

    if (isConsentAccepted) {
      setIsConsentAccepted(false);
      return;
    }
    openLegalModal(modalKey);
  };

  const handleModalClose = () => {
    setActiveModal(null);
    setIsScrolledToBottom(false);
  };

  const handleLegalScroll = (e) => {
    const reachedBottom = e.target.scrollHeight - e.target.scrollTop <= e.target.clientHeight + 2;
    if (reachedBottom) {
      setIsScrolledToBottom(true);
    }
  };

  const handleAcceptLegal = () => {
    if (!activeModal || !isScrolledToBottom) return;

    if (activeModal === 'refund') setIsRefundAccepted(true);
    if (activeModal === 'kvkk') setIsKvkkAccepted(true);
    if (activeModal === 'consent') setIsConsentAccepted(true);
    if (activeModal === 'marketing') setIsMarketingAccepted(true);

    handleModalClose();
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');

    const trimmedName = formData.fullName.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedPhone = formData.phone.trim();

    if (!trimmedName) {
      setError('Ad soyad alanını doldurun.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Şifre en az 6 karakter olmalı.');
      return;
    }

    if (!hasRequiredLegalApprovals) {
      setError('Devam etmek için İptal/İade Politikası ve KVKK onaylarını tamamlayın.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: formData.password,
        options: {
          data: {
            full_name: trimmedName,
            phone: trimmedPhone,
            legal_approval_at: new Date().toISOString(),
            refund_policy_approved: isRefundAccepted,
            kvkk_approved: isKvkkAccepted,
            health_data_consent: isConsentAccepted,
            marketing_consent: isMarketingAccepted,
          },
        },
      });

      if (authError) {
        setError(authError.message || 'Hesap oluşturulamadı.');
        return;
      }

      if (data?.session) {
        navigate('/');
        return;
      }

      setInfo('Hesabın oluşturuldu. Giriş ekranına yönlendiriliyorsun.');
      setTimeout(() => navigate('/login'), 1200);
    } catch {
      setError('Kayıt tamamlanamadı. Lütfen yeniden dene.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg font-google text-brand-dark">
      <main className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-5 pb-[max(1.8rem,env(safe-area-inset-bottom))] pt-4">
        <header className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand-dark/10 bg-brand-white/80"
            aria-label="Geri"
          >
            <ArrowLeft size={17} />
          </button>
          <div className="w-9" />
        </header>

        <section className="mt-5 rounded-[28px] bg-gradient-to-br from-brand-primary/20 via-brand-secondary/20 to-brand-white p-1.5 shadow-sm">
          <div className="overflow-hidden rounded-[22px] bg-brand-white">
            <img
              src="/images/kcal-banner-log.jpg"
              alt="Sağlıklı yemek"
              className="h-[158px] w-full object-cover sm:h-[176px]"
            />
          </div>
        </section>

        <form onSubmit={handleRegister} className="mt-5 space-y-3.5 font-google">
          <div className="flex justify-center overflow-visible pb-1">
            <img
              src="/images/kcal-logo-head.png"
              alt="Kcal"
              className="h-28 w-auto origin-center object-contain scale-[1.7] sm:h-32 sm:scale-[1.9]"
            />
          </div>

          <label className="block space-y-1.5">
            <span className="ml-1 font-google text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-dark/45">Ad Soyad</span>
            <span className="relative block rounded-2xl border border-brand-dark/30">
              <User size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-dark/45" />
              <input
                type="text"
                required
                value={formData.fullName}
                placeholder="Ad Soyad"
                onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
                className="w-full bg-transparent py-[0.82rem] pl-11 pr-4 text-[13px] text-brand-dark outline-none ring-0 placeholder:text-brand-dark/55 focus:ring-0 font-google"
              />
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="ml-1 font-google text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-dark/45">E-posta</span>
            <span className="relative block rounded-2xl border border-brand-dark/30">
              <Mail size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-dark/45" />
              <input
                type="email"
                required
                value={formData.email}
                placeholder="E-postanızı girin"
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full bg-transparent py-[0.82rem] pl-11 pr-4 text-[13px] text-brand-dark outline-none ring-0 placeholder:text-brand-dark/55 focus:ring-0 font-google"
              />
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="ml-1 font-google text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-dark/45">Telefon (İsteğe Bağlı)</span>
            <span className="relative block rounded-2xl border border-brand-dark/30">
              <Phone size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-dark/45" />
              <input
                type="tel"
                value={formData.phone}
                placeholder="05xx xxx xx xx"
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full bg-transparent py-[0.82rem] pl-11 pr-4 text-[13px] text-brand-dark outline-none ring-0 placeholder:text-brand-dark/55 focus:ring-0 font-google"
              />
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="ml-1 font-google text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-dark/45">Şifre</span>
            <span className="relative block rounded-2xl border border-brand-dark/30">
              <Lock size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-dark/45" />
              <input
                type="password"
                required
                value={formData.password}
                placeholder="En az 6 karakter"
                onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                className="w-full bg-transparent py-[0.82rem] pl-11 pr-4 text-[13px] text-brand-dark outline-none ring-0 placeholder:text-brand-dark/55 focus:ring-0 font-google"
              />
            </span>
          </label>

          {error && (
            <div className="inline-flex w-full items-center gap-2 rounded-xl border border-brand-secondary/40 bg-brand-secondary/10 px-3 py-2 text-xs text-brand-dark">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
          {info && !error && (
            <div className="rounded-xl border border-brand-secondary/30 bg-brand-secondary/10 px-3 py-2 text-xs text-brand-dark">
              {info}
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-brand-dark/10 bg-brand-white px-3 py-3">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                readOnly
                checked={isRefundAccepted}
                onClick={(e) => {
                  e.preventDefault();
                  handleLegalCheckboxClick('refund');
                }}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-[#98CD00]"
              />
              <div className="flex-1 space-y-1">
                <button
                  type="button"
                  onClick={() => handleLegalCheckboxClick('refund')}
                  className="text-left font-google text-xs leading-relaxed text-brand-dark"
                >
                  İptal ve İade Politikası&apos;nı okudum, onaylıyorum. <span className="font-medium text-brand-primary">(Zorunlu)</span>
                </button>
                <Link to="/iade-politikasi" className="inline-block text-[11px] font-medium text-brand-primary underline underline-offset-2">
                  Tam metni oku
                </Link>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                readOnly
                checked={isKvkkAccepted}
                onClick={(e) => {
                  e.preventDefault();
                  handleLegalCheckboxClick('kvkk');
                }}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-[#98CD00]"
              />
              <div className="flex-1 space-y-1">
                <button
                  type="button"
                  onClick={() => handleLegalCheckboxClick('kvkk')}
                  className="text-left font-google text-xs leading-relaxed text-brand-dark"
                >
                  KVKK Aydınlatma Metni&apos;ni okudum ve anladım. <span className="font-medium text-brand-primary">(Zorunlu)</span>
                </button>
                <Link to="/gizlilik-politikasi" className="inline-block text-[11px] font-medium text-brand-primary underline underline-offset-2">
                  Tam metni oku
                </Link>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                readOnly
                checked={isConsentAccepted}
                onClick={(e) => {
                  e.preventDefault();
                  handleLegalCheckboxClick('consent');
                }}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-[#98CD00]"
              />
              <div className="flex-1">
                <button
                  type="button"
                  onClick={() => handleLegalCheckboxClick('consent')}
                  className="text-left font-google text-xs leading-relaxed text-brand-dark/70"
                >
                  Boy, kilo ve benzeri verilerin kişiselleştirme amacıyla işlenmesine açık rıza veriyorum. (Opsiyonel)
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                readOnly
                checked={isMarketingAccepted}
                onClick={(e) => {
                  e.preventDefault();
                  handleLegalCheckboxClick('marketing');
                }}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-[#98CD00]"
              />
              <div className="flex-1">
                <button
                  type="button"
                  onClick={() => handleLegalCheckboxClick('marketing')}
                  className="text-left font-google text-xs leading-relaxed text-brand-dark/70"
                >
                  Kampanya ve indirimler için Ticari Elektronik İleti izni veriyorum. (Opsiyonel)
                </button>
              </div>
            </div>

            <p className="mb-0 pt-1 font-google text-[11px] leading-relaxed text-brand-dark/60">
              Üyelik ve hizmet koşulları için{' '}
              <Link to="/kullanim-kosullari" className="font-medium text-brand-primary underline underline-offset-2">
                Kullanım Koşulları
              </Link>{' '}
              metnini inceleyebilirsiniz.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !hasRequiredLegalApprovals}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary py-[0.82rem] text-[15px] font-semibold text-brand-white shadow-[0_10px_24px_rgba(152,205,0,0.35)] transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 font-google"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                İşleniyor...
              </>
            ) : (
              <>
                Hesap Oluştur
                <ArrowRight size={17} />
              </>
            )}
          </button>

          <div className="flex items-center gap-3 py-0.5">
            <div className="h-px flex-1 bg-brand-white/10" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-brand-dark/40">Hızlı Kayıt</span>
            <div className="h-px flex-1 bg-brand-white/10" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleSocialClick('Google')}
              className="rounded-xl border border-brand-dark/10 bg-brand-white py-2.5 text-[13px] font-semibold text-brand-dark font-google"
            >
              Google
            </button>
            <button
              type="button"
              onClick={() => handleSocialClick('Apple')}
              className="rounded-xl border border-brand-dark/10 bg-brand-white py-2.5 text-[13px] font-semibold text-brand-dark font-google"
            >
              Apple
            </button>
          </div>
        </form>

        <div className="mt-auto pt-6 text-center">
          <p className="mb-0 text-[13px] text-brand-dark/60">
            Zaten hesabın var mı?
            <Link to="/login" className="ml-1 font-bold text-brand-dark hover:underline">
              Giriş yap
            </Link>
          </p>
        </div>
      </main>

      <AnimatePresence>
        {activeModalContent && (
          <motion.div
            key={activeModal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] bg-black/40 px-4 py-6 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 24, opacity: 0.96, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0.94, scale: 0.985 }}
              transition={{ type: 'spring', stiffness: 330, damping: 28, mass: 0.65 }}
              className="mx-auto flex h-full w-full max-w-[430px] flex-col rounded-3xl bg-brand-white shadow-[0_22px_40px_rgba(32,32,32,0.25)]"
            >
              <div className="flex items-center justify-between border-b border-brand-dark/10 px-5 py-4">
                <div>
                  <h3 className="mb-0 font-zalando text-lg font-semibold text-brand-dark">{activeModalContent.title}</h3>
                  <p className="mb-0 mt-0.5 font-google text-xs text-brand-dark/60">{activeModalContent.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-bg text-brand-dark"
                  aria-label="Kapat"
                >
                  <X size={16} />
                </button>
              </div>

              <div
                ref={modalContentRef}
                onScroll={handleLegalScroll}
                className="flex-1 space-y-3 overflow-y-auto px-5 py-4"
              >
                {activeModalContent.paragraphs.map((paragraph, idx) => (
                  <p key={`${activeModal}-paragraph-${idx}`} className="mb-0 font-google text-xs leading-relaxed text-brand-dark/75">
                    {paragraph}
                  </p>
                ))}
              </div>

              <div className="border-t border-brand-dark/10 px-5 py-4">
                {!isScrolledToBottom && (
                  <p className="mb-3 font-google text-xs text-brand-dark/60">
                    Devam etmek için metni en aşağıya kadar kaydırın.
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleAcceptLegal}
                  disabled={!isScrolledToBottom}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-brand-primary px-4 py-3.5 font-google text-sm font-semibold text-brand-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Kabul Et
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
