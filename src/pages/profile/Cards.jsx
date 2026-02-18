import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ChevronLeft,
  CreditCard,
  Pencil,
  Plus,
} from 'lucide-react';

const initialCards = [
  {
    id: 'c1',
    holder: 'ILTER O. SEVEN',
    number: '**** **** **** 4589',
    exp: '11/29',
    scheme: 'MASTERCARD PLATINUM',
    gradient: 'from-[#7C3AED] via-[#EC4899] to-[#F97316]',
    textClass: 'text-brand-white',
  },
  {
    id: 'c2',
    holder: 'ILTER O. SEVEN',
    number: '**** **** **** 2214',
    exp: '08/28',
    scheme: 'VISA SIGNATURE',
    gradient: 'from-[#0EA5E9] via-[#14B8A6] to-[#22C55E]',
    textClass: 'text-brand-white',
  },
];

export default function Cards() {
  const navigate = useNavigate();
  const [cards, setCards] = useState(initialCards);
  const [selectedCardId, setSelectedCardId] = useState(initialCards[0]?.id || '');
  const [info, setInfo] = useState('');
  const gradientPalette = [
    'from-[#7C3AED] via-[#EC4899] to-[#F97316]',
    'from-[#0EA5E9] via-[#14B8A6] to-[#22C55E]',
    'from-[#1D4ED8] via-[#4338CA] to-[#8B5CF6]',
    'from-[#DB2777] via-[#F43F5E] to-[#FB7185]',
  ];

  const handleAddCard = () => {
    const index = cards.length + 1;
    const nextId = `new-${Date.now()}`;
    const nextGradient = gradientPalette[cards.length % gradientPalette.length];
    setCards((prev) => [
      ...prev,
      {
        id: nextId,
        holder: 'YENİ KART',
        number: '**** **** **** 0000',
        exp: '00/00',
        scheme: `CARD ${index}`,
        gradient: nextGradient,
        textClass: 'text-brand-white',
      },
    ]);
    setSelectedCardId(nextId);
    setInfo('Yeni kart taslağı eklendi.');
  };

  return (
    <div className="min-h-screen bg-[#F0F0F0] pb-36">
      <header className="sticky top-0 z-30 border-b border-brand-white/10 bg-[#F0F0F0]/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 p-2 -ml-2 font-bold text-brand-dark"
          >
            <ChevronLeft size={18} />
            Geri
          </button>
          <h1 className="text-lg font-bold text-brand-dark">Ödeme Yöntemleri</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="px-4 pt-6 space-y-7">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-widest uppercase text-brand-dark/50">Kayıtlı Kartlar</h2>
            <span className="text-xs font-bold text-brand-dark">{cards.length} Kart</span>
          </div>

        {cards.map((card) => (
          <div
            key={card.id}
            role="button"
            tabIndex={0}
            onClick={() => {
              setSelectedCardId(card.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setSelectedCardId(card.id);
              }
            }}
            className={`relative aspect-[1.6/1] w-full overflow-hidden rounded-3xl border-2 bg-gradient-to-br p-5 shadow-lg ${card.gradient} ${card.textClass} ${
              selectedCardId === card.id ? 'border-brand-white/90 ring-2 ring-brand-primary/30' : 'border-transparent'
            }`}
          >
              <div className={`absolute -top-8 -right-8 h-24 w-24 rounded-full ${card.textClass === 'text-brand-dark' ? 'bg-brand-white/10' : 'bg-[#F0F0F0]/10'}`} />
            <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className={`text-[10px] font-medium uppercase tracking-widest ${card.textClass === 'text-brand-dark' ? 'text-brand-dark/70' : 'text-brand-white/70'}`}>
                    {card.scheme}
                  </p>
                  <CreditCard size={24} className="mt-1" />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setInfo('Kart düzenleme yakında aktif olacak.');
                  }}
                  className={`rounded-xl p-2 ${card.textClass === 'text-brand-dark' ? 'bg-brand-white/10' : 'bg-[#F0F0F0]/15'}`}
                  aria-label="Kartı düzenle"
                >
                  <Pencil size={14} />
                </button>
            </div>

              <p className="mt-8 text-xl font-extrabold tracking-[0.18em]">{card.number}</p>

            <div className="mt-6 flex items-end justify-between relative z-10">
              <div>
                  <p className={`text-[10px] uppercase ${card.textClass === 'text-brand-dark' ? 'text-brand-dark/70' : 'text-brand-white/70'}`}>Kart Sahibi</p>
                <p className="text-sm font-bold mt-0.5">{card.holder}</p>
              </div>
              <div className="text-right">
                  <p className={`text-[10px] uppercase ${card.textClass === 'text-brand-dark' ? 'text-brand-dark/70' : 'text-brand-white/70'}`}>Son Kullanma</p>
                <p className="text-sm font-bold mt-0.5">{card.exp}</p>
              </div>
            </div>
          </div>
        ))}
          <button
            onClick={handleAddCard}
            className="w-full rounded-3xl border-2 border-dashed border-brand-white/40 bg-[#F0F0F0]/70 py-5"
          >
            <div className="flex flex-col items-center justify-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#98CD00]">
                <Plus size={18} className="text-brand-dark" />
              </span>
              <span className="text-sm font-bold text-brand-dark">Yeni Kart Ekle</span>
            </div>
          </button>

          {info && (
            <p className="text-center text-xs text-brand-dark/60">{info}</p>
          )}
        </section>

      </main>

      <footer className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-md bg-gradient-to-t from-[#F0F0F0] via-[#F0F0F0]/95 to-transparent px-4 pb-6 pt-2">
        <button
          onClick={() => {
            const preference = { type: 'card', cardId: selectedCardId };
            localStorage.setItem('checkout_payment_pref', JSON.stringify(preference));
            navigate(-1);
          }}
          disabled={!selectedCardId}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-white bg-[#98CD00] py-4 font-bold text-[#F0F0F0] disabled:opacity-60"
        >
          <span>Seçimi Onayla</span>
          <ArrowRight size={18} />
        </button>
        <div className="mt-4 flex justify-center">
          <div className="h-1.5 w-28 rounded-full bg-brand-white/10" />
        </div>
      </footer>
    </div>
  );
}
