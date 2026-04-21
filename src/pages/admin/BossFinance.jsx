import React from 'react';
import { Wallet } from 'lucide-react';
import Admin from '../Admin';

const FINANCE_VISIBLE_TABS = ['finance'];

export default function BossFinance() {
  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-geex-border bg-geex-card p-5 shadow-geex-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="mb-0 text-2xl font-zalando text-geex-text">Kasa & Finans</h1>
            <p className="mt-1 text-sm text-slate-500">Gerçek finans verilerini dönemsel olarak analiz edin.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-geex-border bg-geex-bg px-3 py-1 text-xs font-semibold text-slate-500">
            <Wallet size={13} />
            Finans Paneli
          </span>
        </div>
      </section>

      <section className="rounded-3xl border border-geex-border bg-geex-card shadow-geex-soft">
        <Admin
          hideAdminChrome
          disableNotifications
          forcedTab="finance"
          visibleTabs={FINANCE_VISIBLE_TABS}
          initialTab="finance"
        />
      </section>
    </div>
  );
}
