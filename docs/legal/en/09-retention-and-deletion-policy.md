# Personal Data Retention and Deletion Policy

> **DRAFT — for legal review (İlter Öziseven). Not published.**
> Version: `v0.1-taslak` · Date: 2026-11-09 · Source inventory: `docs/legal/VERI_ENVANTERI.md`
> The Turkish version (`tr/09-saklama-ve-imha-politikasi.md`) prevails in case of conflict.

**Data controller:** SEKULART LTD · MERSİS 0759-1148-7410-0001 · Tax ID 7591148741 · Address Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir, Türkiye · Contact `[privacy@…]`

---

## 1. Purpose

This Policy sets how long SEKULART LTD (the "Company") keeps the personal data it processes, and how that data is deleted, destroyed or anonymised when the period ends. It covers data processed through:
- the Kcalculate AI app;
- the eatkcal ordering service;
- the kcal., tera and Breaking Fast brands;
- the eatkcal.com and kcalculate.ai websites.

The Policy is based on:
- Turkish Personal Data Protection Law No. 6698 ("KVKK"), Art. 4, 7 and 12;
- the Regulation on the Deletion, Destruction or Anonymisation of Personal Data (Official Gazette 28.10.2017, No. 30224) (the "Regulation");
- where applicable, GDPR Art. 5(1)(e) (storage limitation) and Art. 17 (right to erasure).

> **[Reviewer note]** Under Regulation Art. 5, controllers that must register with VERBİS (the Turkish data controller registry) are required to have this policy. Processing special-category data (nutrition and body data that may count as health data) may be a core activity for Kcalculate AI. If so, the Company cannot rely on the VERBİS exemption (see `BOSLUKLAR.md`). Even without a registration duty, this Policy is recommended to demonstrate compliance with KVKK Art. 4(2)(d) and Art. 7.

## 2. Scope

This Policy covers all personal data the Company processes:
- fully or partly by automated means, or
- as part of a filing system.

It covers these groups of data subjects:
- users, customers and marketplace customers;
- people who submit web forms;
- partner and creator applicants;
- people who send support requests.

Employee and candidate data will be covered in a separate HR annex: `[EK-İK — out of scope]`.

## 3. Definitions

| Term | Meaning |
|---|---|
| Deletion | Making personal data inaccessible and unusable for the relevant users in any way (Regulation Art. 8) |
| Destruction | Making personal data inaccessible, irrecoverable and unusable by anyone (Art. 9) |
| Anonymisation | Making data impossible to link to an identified or identifiable natural person, even when matched with other data (Art. 10) |
| Periodic destruction | Destroying data whose retention period has expired, on the schedule set in this Policy, without a request (Art. 11) |
| Recording medium | Any medium where the data sits: database, file storage, device storage, mailbox, third-party system |
| Destruction record | A log showing what was destroyed, when, by whom and by which method |

## 4. Responsibilities (RACI by title)

R = Responsible · A = Accountable · C = Consulted · I = Informed

| Task | Data Protection Lead `[TITLE]` | Tech Lead / CTO `[TITLE]` | Legal `[TITLE]` | Operations / Branch Mgmt `[TITLE]` | Accounting `[TITLE]` |
|---|---|---|---|---|---|
| Draft and annually review the Policy | R | C | A | I | C |
| Keep the retention schedule current | R | C | A | C | C |
| Build and monitor automated deletion jobs | C | R/A | I | I | I |
| Periodic destruction and destruction record | A | R | I | I | I |
| Deletion on request (data subject request) | A | R | C | I | C (financial-record exception) |
| Deletion confirmations from processors | R | C | A | I | I |
| Retention of financial records | I | C | C | I | R/A |

## 5. Recording media

| Medium | Content | Location | Evidence |
|---|---|---|---|
| Supabase Postgres (`public`, `tracking` and `auth` schemas) | Account, profile, address, order, health, social, analytics and notification data | Supabase; EU region per the brief (to be confirmed) | VERI_ENVANTERI §1 |
| Supabase Storage `user-media` (private) | AI scan photos, day-card images | Supabase EU | `supabase/migrations/20261104000700_user_media_bucket.sql:17-19` |
| Supabase Storage `post-media` (public) | Explore post photos, videos and frames | Supabase EU | `supabase/migrations/20261104000400_post_media_storage.sql:9-20` |
| Supabase Storage `avatars` | Profile photos (`{uid}.{ext}`) | Supabase EU | `src/modules/profil/avatarUpload.ts:24-35` |
| Supabase Storage `support-attachments` (public) | Support ticket attachments | Supabase EU | `supabase/migrations/20261021132735_storage_public_assets_and_support_attachments.sql:26-44` |
| Supabase backups (PITR / daily) | Full database copy | Supabase EU | Supabase plan setting, to be confirmed |
| User device (AsyncStorage, documents directory) | Session, selected address, offline queues, preference keys | User's device | VERI_ENVANTERI §1.10 |
| Sentry | Crash and performance logs, user UUID | US or Sentry region (to be confirmed) | `src/lib/sentry.ts:33-68` |
| Meta | Ad-measurement events | Ireland / US | `src/lib/analytics.ts:107-199` |
| Expo (push, EAS Update) | Push token; notification content (transient) | US | `supabase/functions/send-notification/index.ts:234-252` |
| Anthropic | AI scan image and moderation input (transient) | US | `supabase/functions/analyze-ai-scan/index.ts:233`; `supabase/functions/moderate-content/index.ts:246` |
| Vercel | Web access logs, form requests | US / edge | web repository |
| Resend and mailboxes (`info@`, branch addresses) | Order alerts, support correspondence | US / mail provider | `supabase/functions/order-alert/index.ts:19,95-151,209-216` |
| Adisyo | Order data sent to the POS (name, phone, address) | Türkiye (to be confirmed) | `supabase/functions/adisyo-save-order/index.ts:336-350` |
| Accounting / e-invoice system | Invoices and financial records | Türkiye | none in code (accountant's system) |
| Paper | Delivery slips, branch printouts (if any) | Branches | `[to be defined]` |

## 6. Technical and organisational measures (KVKK Art. 12)

### 6.1 Technical
- **Row-level security (RLS):** RLS is enabled on user tables, so each user reaches only their own rows (`user_id = auth.uid()`).
- **Service-role separation:** sensitive tables such as `user_card_secrets` are reachable only by the server-side service role. Clients have no access (`supabase/migrations/20261103000100_security_rls_policies.sql:62`).
- **Card data:** full card numbers and CVV never enter Company systems. They are entered on the licensed payment institution's hosted page (`supabase/functions/paynkolay-payment-init/index.ts:5`).
- **Encryption in transit:** all traffic uses TLS/HTTPS. Encryption at rest is provided by Supabase infrastructure (to be confirmed).
- **Minimisation:**
  - Analytics properties are allow-listed, and values that look like personal data are dropped (`src/lib/metrics/sanitize.ts`; server filter at `supabase/migrations/20261109100300_d_s1_kpi.sql:137-141`).
  - No user ID is sent to the AI provider.
- **Monitoring:** Supabase logs and security advisors; Sentry alerts.
- **Photos:** the scan camera has EXIF off, and images are resized to at most 1600 px.

### 6.2 Organisational
- **Access matrix:**
  - Admin access is limited by `admin_allowlist`.
  - Branch staff see only profiles of customers who ordered from their own branch (`supabase/migrations/20260916200000_profiles_branch_scope.sql:7-17`).
  - Moderator access is role-limited.
- **Confidentiality undertakings:** signed by staff with access to personal data `[template TBD]`.
- **Training:** annual data protection training.
- **Processor agreements (DPAs):**
  - A DPA with every processor, meeting KVKK Art. 12(2) and GDPR Art. 28.
  - For transfers abroad: the Board's standard contractual clauses, notified to the Authority within 5 business days (KVKK Art. 9(5)).
- **Offboarding:** accounts and sessions of departing staff are closed the same day.

## 7. Retention schedule

Periods start when the reason for keeping the data ends. In most cases that is account deletion, consent withdrawal or the end of the contract. For financial records, the period starts at the beginning of the year after the record's calendar year.

| # | Data category | Table / location | Retention basis | Period | Method | Evidence |
|---|---|---|---|---|---|---|
| 1 | Account and profile (name, e-mail, phone, handle, bio, avatar) | `auth.users`, `profiles`, `avatars` | KVKK 5(2)(c) contract | Life of account + 30 days (backup cycle) | Deletion (DELETE + cascade); avatar destruction; backups roll off | `supabase/functions/delete-account/index.ts:229-233` |
| 2 | Delivery addresses and coordinates | `addresses` | 5(2)(c) | Until the user deletes the address or the account + 30 days | Deletion | `supabase/migrations/20260918130000_addresses_geo_verification.sql:6-8` |
| 3 | Data that may count as health data (nutrition profile, body measurements, meals/calories, water, activity) | `user_nutrition_profiles`, `body_measurements`, `meal_consumptions`, `meal_logs`, `water_daily`, `activity_logs`, `tracking.*` | KVKK 6(3)(a) explicit consent; GDPR 9(2)(a) | Life of account or until consent is withdrawn, + 30 days | Deletion | `src/modules/onboarding/takibe/save.ts:32-58` |
| 4 | AI scan photo | `user-media/<uid>/scans/` | 6(3)(a) | **30 days** after analysis | Destruction (object removal) | `src/modules/ai/scan/client.ts:63-67` |
| 5 | AI estimate result, quota rows | `ai_scan_reservations`, `ai_scan_usage` | 6(3)(a); 5(2)(c) | 30 days after the result is copied to the user's log | Deletion | `supabase/migrations/20261109190100_g19_ai_scan_hardening.sql:32-34` |
| 6 | Day-card file | `user-media`, `day_shares` | 6(3)(a) | Visible for 24 h; file and row kept 24 h + 7 days | Destruction + deletion | `supabase/migrations/20261104000500_day_shares.sql:20-26` |
| 7 | Orders and accounting | `orders`, `order_items`, `order_modifications`, `macro_transactions`, `user_credits`, `campaign_uses`, `refunds`, `failed_payments` | 5(2)(ç) legal obligation: Turkish Commercial Code Art. 82 (10 years); Tax Procedure Law Art. 253 (5 years) | **10 years**, de-identified once the account is deleted | Anonymisation on account deletion (§8.2), then deletion | `supabase/functions/delete-account/index.ts:210-222` |
| 8 | Raw payment provider responses | `failed_payments.order_data`, `refunds.provider_response`, `card_verifications.refund_response` | 5(2)(ç); 5(2)(e) | Financial part 10 years; personal fields in raw responses cleared after 2 years | Partial anonymisation | `supabase/migrations/20260624000000_paynkolay_refund_infra.sql:30-43` |
| 9 | Saved card (last 4, brand, bank, alias) and token | `user_cards`, `user_card_secrets` | 5(2)(c) | Until the user deletes the card or the account | Deletion, plus card removal at the provider | `supabase/functions/delete-account/index.ts:181-207` |
| 10 | Distance-sales and pre-contract confirmation records (text version, acceptance time, order no.) | `legal_acceptances` (proposed, see `ENTEGRASYON.md`) | 5(2)(ç), 5(2)(e); Distance Contracts Regulation | **3 years** from the contract | Deletion | None today (`src/components/checkout/CheckoutFooter.tsx:153-176`) |
| 11 | Commercial e-message consent and opt-out records | `notification_preferences` + proposed consent history; web `web_leads.marketing_consent*` | Law 6563; Regulation on Commercial Communications | **3 years** from the end of the consent's validity | Deletion | `web:packages/ui/src/lead-contract.ts:3-16` |
| 12 | Support tickets and attachments | `support_tickets`, `support-attachments`, `info@` mailbox | 5(2)(c), 5(2)(e) (proof of consumer complaints) | **3 years** | Deletion + file destruction | `supabase/migrations/20260309000000_support_tickets.sql:1-12` |
| 13 | Feedback and order reviews | `feedback`, `reviews`, `review_item_feedback`, `review_reports` | 5(2)(f) | Feedback 2 years; reviews 3 years | Deletion or anonymisation | `src/lib/orderFeedback.ts:105-133` |
| 14 | Explore content (posts, comments, reactions, follows) | `posts`, `post_media`, `post_comments`, `post_reactions`, `follows`, `post-media` | 5(2)(c) | Until the user deletes it or the account | Deletion (cascade) + media destruction | `supabase/migrations/20261104000200_feed_tables.sql:21-128` |
| 15 | Content reports | `content_reports` | 5(2)(f); 5(2)(ç) | **1 year** | Deletion | `supabase/migrations/20261104000200_feed_tables.sql:95` |
| 16 | Moderation decisions (incl. AI) | `moderation_queue`, `moderation_actions` | 5(2)(f); 5(2)(ç) (appeals; EU DSA Art. 20) | **6 months** after the appeal closes | Deletion | `supabase/functions/moderate-content/index.ts:103-125,306` |
| 17 | First-party analytics | `analytics_events` | 5(2)(f) | Raw rows **24 months**, then aggregated | Anonymisation (aggregation) + raw deletion | `supabase/migrations/20260916094149_analytics_events.sql:1-11` |
| 18 | Attribution (UTM, deep link) | `analytics_events.props`, device `@kcal_attr_*` | 5(2)(f) | 90 days | Deletion | `src/lib/metrics/attribution.ts:31-33` |
| 19 | Crash and performance logs | Sentry | 5(2)(f) | **90 days** | Automatic, via Sentry retention setting | `src/lib/sentry.ts:33-68` |
| 20 | Raw Adisyo API and webhook logs | `adisyo_api_log`, `adisyo_webhook_events` | 5(2)(f) (integration debugging) | **30 days** | Deletion | `supabase/migrations/20260508000000_adisyo_phase1.sql:14` |
| 21 | Personal fields of marketplace orders | `orders` (`external_channel`), `external_payload` | 5(2)(c) | **30 days** after delivery; financial record 10 years | Anonymise personal fields | `supabase/functions/trendyolgo-poll/index.ts:217-258` |
| 22 | Push tokens | `push_tokens`, `profiles.push_token`, `support_tickets.push_token` | 5(2)(c) | **90 days** after deactivation | Deletion | `src/core/notifications.ts:131-144,177-181` |
| 23 | Notification send logs | `notification_sends`, `push_notifications`, `notifications` | 5(2)(c); 5(2)(f) | **12 months** | Deletion | `CANLI_SEMA:54,56,74` |
| 24 | Campaign target lists | `campaign_targets`, `campaigns.user_email` | Consent + Law 6563 consent | 12 months after the campaign ends | Deletion | `CANLI_SEMA:26,28` |
| 25 | Deleted-account fingerprints (SHA-256 of phone and e-mail) | `deleted_account_fingerprints` | 5(2)(f) (coupon-abuse prevention) | **2 years** | Deletion | `supabase/migrations/20260917294000_coupon_guard_fingerprint_and_phone_normalize.sql:8-12` |
| 26 | Known devices | `user_known_devices` | 5(2)(f) | After 12 months of inactivity | Deletion | `supabase/migrations/20260916250000_user_known_devices.sql:5-10` |
| 27 | Web forms (newsletter, partnership, restaurant, support, notify, creator) | `web_leads` | 5(2)(c) pre-contract, 5(2)(f); marketing: consent + Law 6563 | Until the purpose is met, at most **12 months**. The marketing consent record follows row 11 | Deletion | `supabase/migrations/20261107000100_web_leads.sql:7-34` |
| 28 | eatkcal waitlist | `eatkcal_waitlist_requests` | 5(2)(f) / consent | Until the area launches + 30 days, at most 12 months | Deletion | `supabase/migrations/20261108000300_g18_eatkcal_waitlist.sql:8-20` |
| 29 | Traffic logs (as hosting provider) | Vercel, Supabase logs | Law 5651 Art. 5 and its regulation | **1–2 years** (current period to be confirmed) | Automatic, via provider setting | none in code |
| 30 | Data subject requests and replies | Proposed `dsr_requests` / `[privacy@…]` | 5(2)(ç), 5(2)(e) | **3 years** from the reply | Deletion | `en/08-…` |
| 31 | Breach records | Breach register | KVKK 12(5); GDPR 33(5) | **5 years** (proposal) | Deletion | `en/10-data-breach-response-plan.md` |
| 32 | Destruction records | Destruction log | Regulation Art. 7 | At least **3 years** | Deletion | none |
| 33 | Local device data | AsyncStorage, documents dir | — | Clear on account deletion and on sign-out; scan queue at most 24 h | In-app deletion | VERI_ENVANTERI §1.10 |

> **[Reviewer note — financial records]** Current web and app texts base the 10-year period on "VUK Art. 253" (Tax Procedure Law). That article sets **5 years**. The 10-year period comes from Turkish Commercial Code Art. 82. The new texts cite both.

> **[Reviewer note — distance-sales records]** The 3-year period relies on the seller's duty under the Distance Contracts Regulation to keep information and confirmation records. Confirm the article number against the official text. The seller bears the burden of proof in disputes, so the period may be extended to match limitation periods for consumer disputes.

> **[Reviewer note — Law 5651]** The traffic-data retention period for hosting providers is set at 1–2 years in Law 5651 Art. 5 and its regulation. Confirm two points:
> - whether the Company counts as a hosting provider because of user content in Explore, or only as a content provider;
> - the current period.

## 8. Methods

### 8.1 Deletion
- **Database:** rows are removed with `DELETE`. Deleting `auth.users` cascades via `ON DELETE CASCADE`.
- **Backups:** backup copies roll off with the backup cycle (at most 30 days on the Supabase plan; to be confirmed). If a backup is ever restored, deletions are re-applied for accounts deleted before the restore, using a tombstone list.
- **Processors:** data held by Sentry, Expo, Anthropic, Resend and Adisyo is deleted at the end of the contractual period, with deletion confirmation requested where needed.

### 8.2 Anonymisation

**Orders** are de-identified on account deletion. The table shows what `delete-account/index.ts:210-222` does today and the target state.

| Field | Today | Target |
|---|---|---|
| `user_id`, `address_id`, `customer_id` | null | null |
| `customer_name` | "Silinen Kullanıcı" ("Deleted User") | same |
| `customer_email`, `phone`, `address`, `note` | null | null |
| `city`, `district` | **kept** | may be kept (financial reporting) |
| `neighbourhood` | **kept** | null (neighbourhood plus order time can make a person identifiable) |
| `items` | kept | kept (product data, financial record) |
| `external_payload` (raw marketplace package) | **kept** | personal fields (name, phone, address, note) stripped |
| `order_modifications.new_address_text`, `customer_note` | **kept** | null |
| order-alert e-mails | remain in branch mailboxes | mailbox retention rule: 12 months |

**Analytics:** after 24 months, raw events are rolled up into daily totals without `anon_id`, `session_id` or `user_id`, and the raw rows are deleted.

### 8.3 Destruction
- **Storage objects:** files in `user-media`, `post-media`, `avatars` and `support-attachments` are removed via the Storage API. For public buckets, the CDN cache is purged as well.
- **Physical media:** paper is shredded. Retired devices are securely wiped.

## 9. Periodic destruction

- **The periodic destruction interval is 6 months** (Regulation Art. 11 sets 6 months as the maximum). It runs every January and July and is recorded.
- Proposed **monthly automated jobs** (pg_cron + edge functions; see `ENTEGRASYON.md`):

| Job | What it removes or changes |
|---|---|
| `purge_ai_scan_photos` | AI scan photos and reservation rows older than 30 days |
| `purge_day_share_files` | Day-card files expired more than 7 days ago |
| `purge_adisyo_logs` | Adisyo API and webhook logs older than 30 days |
| `purge_push_tokens` | Push tokens inactive for more than 90 days |
| `purge_notification_sends` | Send logs older than 12 months |
| `aggregate_analytics` | Rolls up `analytics_events` older than 24 months |
| `purge_fingerprints` | Deleted-account fingerprints older than 2 years |
| `purge_content_reports` | Content reports older than 1 year |
| `purge_moderation` | Moderation decisions older than 6 months |
| `mask_marketplace_pii` | Marketplace personal fields, 30 days after delivery |

- Each job writes the number of rows removed to a destruction log. That log is attached to the 6-monthly record.

## 10. Deletion on request

- Erasure requests (KVKK Art. 7 and 11; GDPR Art. 17) are completed within **30 days** (KVKK Art. 13).
- Data with a continuing legal basis is not deleted, for example financial records kept for 10 years. The data subject is told why, and that data is de-identified.
- In-app account deletion (Profile › Security › Delete My Account) is the automated route for this request.

## 11. Destruction record

Each destruction records:
- date;
- category;
- medium;
- number of records;
- method;
- trigger (periodic, request or expiry);
- performer and approver.

Records are kept for at least **3 years** (Regulation Art. 7).

## 12. Implementation gaps (current code)

| # | Gap | Impact | Evidence |
|---|---|---|---|
| U-1 | Account deletion does not remove Storage files (avatar, AI scan, post media, support attachments) | Erasure right not fully met | VERI_ENVANTERI §3; `supabase/functions/delete-account/index.ts` |
| U-2 | Raw Adisyo logs (name, phone, address) are kept indefinitely and not anonymised on deletion | Storage limitation | `supabase/migrations/20260508000000_adisyo_phase1.sql:14`; `supabase/functions/adisyo-save-order/index.ts:405` |
| U-3 | Deleted-account fingerprints are kept indefinitely | Proportionality | `supabase/migrations/20260917294000_coupon_guard_fingerprint_and_phone_normalize.sql:8-12` |
| U-4 | Push tokens are only deactivated, never deleted | Storage limitation | `src/core/notifications.ts:177-181` |
| U-5 | `support_tickets.user_id` FK has no `ON DELETE`, so deleting a user with tickets may fail | Erasure request may fail | `supabase/migrations/20260309000000_support_tickets.sql:3` |
| U-6 | Order anonymisation misses `neighbourhood`, `external_payload` and `order_modifications.new_address_text` | Incomplete anonymisation | `supabase/functions/delete-account/index.ts:210-222` |
| U-7 | `feedback.user_email` and `campaign_targets.user_email` are not cleared | Incomplete erasure | `CANLI_SEMA:26,40` |
| U-8 | No deletion job for AI scan photos or day-card files | Storage limitation | `supabase/migrations/20261104000500_day_shares.sql:26` |
| U-9 | No purge for `analytics_events`, `notification_sends` or `failed_payments` | Storage limitation | VERI_ENVANTERI §1.7, §1.9 |
| U-10 | Local device data (anon_id, attribution, queues) is not cleared on deletion or sign-out | Residual data on shared devices | `src/core/AuthContext.tsx:194,201` |
| U-11 | The `support-attachments` bucket is public | Security (Art. 12) | `supabase/migrations/20261021132735_storage_public_assets_and_support_attachments.sql:26-44` |

The code and migration work required is listed in `ENTEGRASYON.md`. **None of it is implemented** under this Policy.

## 13. Review and effect

- Reviewed **at least yearly**, and whenever a new data category, medium or processor is added.
- Effective `[DATE]` upon management approval. Prior versions are archived for at least 3 years.

| Version | Date | Change | Approved by |
|---|---|---|---|
| v0.1-taslak | 2026-11-09 | First draft (inventory from code) | — |
