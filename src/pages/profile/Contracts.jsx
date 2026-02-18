import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronLeft } from 'lucide-react';

const contractItems = [
  {
    key: 'user-contract',
    title: 'Kullanıcı Sözleşmesi',
  },
  {
    key: 'privacy',
    title: 'Gizlilik Politikası',
  },
  {
    key: 'kvkk',
    title: 'KVKK',
  },
];

const loremText =
  'Bu metin bilgilendirme amaçlıdır. Uygulamayı kullanırken üyelik, gizlilik ve kişisel verilerin korunmasına ilişkin şartları kabul etmiş olursunuz. Güncel sürüm her zaman bu sayfada yayınlanır.';

export default function Contracts() {
  const navigate = useNavigate();
  const [openKey, setOpenKey] = useState('user-contract');

  const toggleItem = (key) => {
    setOpenKey((prev) => (prev === key ? '' : key));
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
          <h1 className="text-lg font-bold text-brand-dark">Sözleşmeler</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="px-4 pt-4 space-y-2">
        {contractItems.map((item) => {
          const isOpen = openKey === item.key;
          return (
            <div key={item.key} className="bg-[#F0F0F0] rounded-2xl border border-brand-white/10 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleItem(item.key)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <span className="text-sm font-bold text-brand-dark">{item.title}</span>
                <ChevronDown
                  size={18}
                  className={`text-brand-dark/50 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 border-t border-brand-white/10">
                  <p className="pt-3 text-xs text-brand-dark/70 leading-relaxed">{loremText}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
