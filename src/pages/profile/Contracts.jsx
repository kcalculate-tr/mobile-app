import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileText, Scale, Shield } from 'lucide-react';

const contractItems = [
  {
    key: 'terms',
    title: 'Kullanım Koşulları ve Mesafeli Satış',
    description: 'Mesafeli satış süreci, üyelik kuralları, hizmet kapsamı ve sorumluluk sınırları.',
    to: '/kullanim-kosullari',
    icon: Scale,
  },
  {
    key: 'privacy',
    title: 'KVKK ve Gizlilik Politikası',
    description: 'Kişisel verilerin işlenmesi, aktarımı ve ilgili kişi hakları.',
    to: '/gizlilik-politikasi',
    icon: Shield,
  },
  {
    key: 'refund',
    title: 'İptal, İade ve Teslimat Politikası',
    description: 'Gıda ürünlerinde cayma hakkı istisnası, ayıplı mal bildirimi ve teslimat kuralları.',
    to: '/iade-politikasi',
    icon: FileText,
  },
];

export default function Contracts() {
  const navigate = useNavigate();

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

      <div className="px-4 pt-4 space-y-3">
        <div className="rounded-2xl border border-brand-dark/10 bg-brand-white px-4 py-3 text-xs leading-relaxed text-brand-dark/65">
          Sözleşmelerin güncel tam metnini aşağıdaki başlıklardan görüntüleyebilirsiniz.
        </div>

        {contractItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              to={item.to}
              className="flex items-start gap-3 rounded-2xl border border-brand-dark/10 bg-brand-white p-4 shadow-sm transition hover:border-brand-primary/40"
            >
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-bg text-brand-primary">
                <Icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-brand-dark">{item.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-brand-dark/65">{item.description}</span>
              </span>
              <ChevronRight size={18} className="mt-1 shrink-0 text-brand-dark/45" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
