import React, { useMemo, useState } from 'react';
import { Megaphone, Sparkles } from 'lucide-react';
import Admin from '../Admin';

const SHOWCASE_TABS = [
  { key: 'showcase', label: 'Vitrin / Banner', Icon: Megaphone },
  { key: 'campaigns', label: 'Kampanyalar', Icon: Sparkles },
];

const SHOWCASE_VISIBLE_TABS = ['showcase', 'campaigns'];

export default function BossShowcase() {
  const [activeTab, setActiveTab] = useState('showcase');

  const activeLabel = useMemo(
    () => SHOWCASE_TABS.find((item) => item.key === activeTab)?.label || 'Vitrin / Banner',
    [activeTab]
  );

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="mb-0 text-2xl font-zalando text-geex-text">Vitrin Yönetimi</h1>
            <p className="mt-1 text-sm text-slate-500">Banner ve kampanya içeriklerini buradan yönetin.</p>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-geex-border bg-geex-bg px-3 py-1 text-xs font-semibold text-slate-500">
            <Megaphone size={13} />
            Aktif Modül: {activeLabel}
          </span>
        </div>

        <div className="mt-4 inline-flex rounded-2xl border border-geex-border bg-geex-bg p-1">
          {SHOWCASE_TABS.map((tab) => {
            const Icon = tab.Icon;
            const active = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? 'bg-brand-primary text-brand-white shadow-[0_10px_24px_rgba(152,205,0,0.35)]'
                    : 'text-geex-text hover:bg-white'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-geex-border bg-geex-card shadow-geex-soft">
        <Admin
          hideAdminChrome
          disableNotifications
          forcedTab={activeTab}
          visibleTabs={SHOWCASE_VISIBLE_TABS}
          initialTab="showcase"
        />
      </section>
    </div>
  );
}
