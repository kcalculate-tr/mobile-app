# Data Subject Request Form and Process

> **DRAFT — for legal review (İlter Öziseven). Not published.**
> Version: `v0.1-draft` · Prepared: 2026-11-09 · Effective: `[EFFECTIVE DATE]`
> **Convenience translation.** The Turkish text (`tr/08-veri-sahibi-basvuru-formu-ve-sureci.md`) is the binding version.
> Controller: `[FULL TRADE NAME]` ("SEKULART Ltd."), MERSIS `[MERSIS]` *(value in current texts to be verified)*, address `[ADDRESS]`, KEP `[KEP]`, e-mail `[privacy@…]`.
> Scope: Kcalculate AI app (including the eatkcal module), eatkcal.com, kcalculate.ai.
> Legal basis: KVKK Art.11, 13, 14; Communiqué on the Procedures and Principles of Applications to the Data Controller (the "Application Communiqué"); GDPR Art.12, 15–22; CCPA/CPRA (Cal. Civ. Code §1798.100 et seq.) and other US state laws (where applicable).

This document has two parts: **Part 1** is the request form shown to users, **Part 2** is the internal process.

---

## PART 1 — REQUEST FORM

Use this form to exercise your rights over your personal data. We answer free of charge within **30 days** at the latest (KVKK Art.13). For users in the EU/EEA and the UK, the deadline is one month.

**How to submit**
- In the app: Profile › Privacy › **Data request** (while signed in — fastest; no separate identity check needed)
- By e-mail to `[privacy@…]` from the e-mail address registered with us
- By KEP to `[KEP]` (with secure e-signature or mobile signature)
- By signed letter to `[ADDRESS]` (by hand or via notary)
- Web form: `[eatkcal.com/legal/veri-talebi]` / `[kcalculate.ai/legal/data-request]`

### 1. Identity and contact

| Field | Required | Note |
|---|---|---|
| First and last name | Yes | |
| E-mail registered to your account | Yes (if you have an account) | To match the request to your account |
| Phone registered to your account (last 4 digits enough) | No | For additional verification |
| Turkish ID no. / for foreigners nationality and passport or ID no. | Only for written or KEP requests | **Not requested** for requests from the app or the registered e-mail |
| Address or e-mail for our reply | Yes | Where we send the answer |
| If you have no account: your relationship with us | If needed | E.g. web form, order recipient, courier delivery |

> **[Reviewer note]** Application Communiqué Art.5 requires, for written/KEP requests, name, signature, Turkish ID no. (for foreigners nationality + passport/ID no.), address, and e-mail/phone/fax if any. The app does not hold Turkish ID numbers (`VERI_ENVANTERI.md` §4); collecting them only for verification conflicts with data minimisation (KVKK Art.4(2)(ç); GDPR Art.5(1)(c)). The Communiqué also recognises "the e-mail address previously notified by the data subject and registered in the controller's system" and "software or an application developed for the purpose of applications"; since identity is verified by the account session/registered e-mail in those channels, it is recommended not to request the ID number there. Verify the Communiqué article and paragraph numbers.

### 2. Your request (select all that apply)

**All users (KVKK Art.11 / GDPR)**
- ☐ Learn whether my personal data is processed and, if so, obtain information (access)
- ☐ Receive a copy of my data — readable file; for EU/EEA/UK users in a structured, machine-readable format (**portability**, GDPR Art.20)
- ☐ Learn the purpose of processing and whether data is used accordingly
- ☐ Learn the third parties in Türkiye or abroad to whom data is transferred
- ☐ **Rectify** incomplete or inaccurate data — data to correct: ________
- ☐ **Erase / destroy** my data (including deleting my account)
- ☐ Have rectification or erasure notified to third parties who received the data
- ☐ **Restrict** processing (GDPR Art.18)
- ☐ **Object** to processing — based on legitimate interest (e.g. usage analytics) / direct marketing
- ☐ **Withdraw my explicit consent** — ☐ health data ☐ transfer abroad ☐ marketing communications ☐ ad measurement (Meta)
- ☐ Object to an adverse outcome resulting solely from automated analysis (e.g. an AI content moderation decision)
- ☐ Claim compensation for damage caused by unlawful processing

**Users residing in the US (under state laws)**
- ☐ Right to Know / access ☐ Delete ☐ Correct
- ☐ Opt out of Sale/Sharing (cross-context behavioural advertising)
- ☐ Limit Use of Sensitive Personal Information
- ☐ I am applying through an authorised agent (attach authorisation)

### 3. Scope and details

- Service concerned: ☐ Kcalculate AI (tracking, AI scan, Explore) ☐ eatkcal (orders) ☐ websites ☐ don't know / all
- Date range or order number (if any): ________
- Description: ________

### 4. Reply channel

☐ In-app notification and e-mail ☐ E-mail only ☐ KEP ☐ Post (address: ________)

### 5. Declaration

☐ I declare that the information in this form is correct and that the request is my own (or that I am an authorised agent). I understand that additional information may be requested to verify my identity and that my request will be processed for that purpose.

Name / signature (for written requests): ________ · Date: ________

**Fees:** Requests are free. If the reply exceeds 10 pages, the fee in the Application Communiqué may be charged for each additional page, and the cost of the medium if provided on a data medium (`[COMMUNIQUÉ Art.7 — amount to be verified]`). Fees are refunded where the request results from our error.

**Right to complain:** If your request is refused, the answer is insufficient or not given in time, you may complain to the Personal Data Protection Board within **30 days** of learning of the answer and in any case within **60 days** of your request (KVKK Art.14). EU/EEA/UK users may contact the supervisory authority of their country.

---

## PART 2 — INTERNAL PROCESS

### 2.1 Roles

| Role | Who | Task |
|---|---|---|
| Privacy Lead | `[NAME — to be appointed]` | Process owner; register; approves replies |
| Legal | İlter Öziseven / `[LEGAL]` | Refusals, partial refusals, exemptions, transfers abroad, US requests |
| Engineering | `[ENGINEERING LEAD]` | Data export, erasure, restriction |
| Customer support | `[SUPPORT]` | Recognises the request, first reply, routing |
| EU/UK representative (GDPR Art.27) | `[REPRESENTATIVE — if appointed]` | Forwards requests from the EU/UK |

### 2.2 RACI

| Step | Privacy Lead | Legal | Engineering | Support |
|---|---|---|---|---|
| Receive and log the request | A | I | — | R |
| Identity verification | A | C | C | R |
| Scoping / system mapping | R/A | C | C | I |
| Data export (access/copy) | A | I | R | — |
| Erasure / rectification / restriction | A | C | R | I |
| Exemption, refusal, partial refusal decision | C | R/A | I | — |
| Sending the reply | R/A | C | — | C |
| Record and archive (3 years) | R/A | I | — | — |

R = responsible · A = accountable · C = consulted · I = informed

### 2.3 Timeline

| Day | Step |
|---|---|
| 0 | Request received; logged (request no., channel, date-time, request types). In-app requests are treated as identity-verified |
| ≤ 3 | Acknowledgement; additional identity information requested if needed. **The clock pauses until the information arrives** (proposal — no explicit KVKK rule; legal to confirm) |
| ≤ 20 | Export/erasure complete; legal review (if refusal/exemption) |
| ≤ 30 | **Reply sent** (KVKK Art.13: as soon as possible, at the latest 30 days). No extension |
| GDPR | One month; **extendable by 2 months** for complexity/volume, with reasons notified within the first month (Art.12(3)) |
| US (CCPA) | Acknowledge within 10 business days; respond within **45 days**; +45 days with notice. Opt-out requests within 15 business days at the latest |

### 2.4 Identity verification (proportionate)

| Channel | Verification |
|---|---|
| In-app (signed in) | Sufficient; nothing more requested |
| Registered e-mail | Sender matches `auth.users.email` → sufficient. For erasure and copy requests, confirm with a one-time code in the app or by e-mail |
| Unregistered e-mail / web form | Verification link to the account e-mail; without an account, depending on the data requested (e.g. order no. + last 4 digits of phone) |
| KEP / wet signature | Application Communiqué elements; Turkish ID no. only in this channel |
| Authorised agent | Power of attorney / written authorisation + confirmation by the data subject |

If identity cannot be verified, the request is not refused outright; additional information is requested with reasons. Extra data collected for verification is used only for that purpose and kept with the request record.

### 2.5 Per-right playbook (system mapping)

For tables and columns see `VERI_ENVANTERI.md`.

| Right | Action | Systems |
|---|---|---|
| Access / copy | Export the user's rows (JSON + readable summary PDF/HTML). Includes: profile, addresses, orders, nutrition profile, measurements, meal/water/activity logs, posts/comments/reactions/follows, support tickets, feedback, reviews, notification preferences, push token records, saved card **summary** (last 4), analytics events (by `user_id`), Storage files | Supabase: `profiles`, `addresses`, `orders`/`order_items`, `user_nutrition_profiles`, `body_measurements`, `meal_consumptions`, `meal_logs`, `water_daily`, `activity_logs`, `posts`/`post_media`/`post_comments`/`post_reactions`/`follows`, `support_tickets`, `feedback`, `reviews`, `notification_preferences`, `push_tokens`, `user_cards`, `analytics_events`; Storage: `avatars`, `user-media`, `post-media`, `support-attachments` |
| Portability (GDPR) | Data **provided** by the user and based on consent/contract, machine-readable (JSON/CSV) | Subset of the above (excluding derived KPIs) |
| Rectification | Users can correct most data in the app; others (e.g. name on an order record) are corrected in the record; for financial documents a note is added instead of altering | `profiles`, `addresses`, `user_nutrition_profiles`; invoices → accounting |
| Erasure | Run in-app "Delete my account" (`delete-account`) + **manually clean what it currently misses**: Storage files, `feedback.user_email`, `campaign_targets.user_email`, personal fields in Adisyo raw logs, city/district/neighbourhood and `external_payload` in `orders`; Sentry events by user UUID (Sentry deletion API); data deletion request to Meta (`[META DATA DELETION ROUTE — Data Deletion Request Callback / Events Manager]`); Expo push token (delete row) | `supabase/functions/delete-account/index.ts`; `adisyo_api_log`, `adisyo_webhook_events`; Sentry; Meta; `push_tokens` |
| Erasure exceptions | Orders and financial records kept de-identified for **10 years** (TCC Art.82, Tax Procedure Law Art.253); where a legal claim/dispute exists, relevant records for the limitation period; abuse-prevention fingerprint (SHA-256) `[PERIOD]`; distance-sales confirmation records 3 years | `orders`, `deleted_account_fingerprints`, acceptance records |
| Restriction (GDPR) | Mark records as "restricted"; stored only, not processed (proposal: `profiles.processing_restricted` — see `ENTEGRASYON.md`) | — (no mechanism today) |
| Objection — usage analytics | Turn off first-party analytics; delete or anonymise past events by `user_id` | `@kcal_consent_first_party`; `analytics_events` |
| Objection / withdrawal — marketing | `notification_preferences.marketing_enabled=false`; remove from e-mail/SMS lists; record refusal in İYS (if registered) | `notification_preferences`, `web_leads.marketing_consent`, İYS |
| Withdrawal — ad measurement | In-app ad consent "denied"; sending to Meta stops; deletion request to Meta | `@kcal_consent_ads` (server record proposal: `ENTEGRASYON.md`) |
| Withdrawal — health data | Tracking features switched off; nutrition profile, measurements, meal/water/activity logs and scan photos deleted **within 30 days**; ordering continues | `user_nutrition_profiles`, `body_measurements`, `meal_*`, `water_daily`, `activity_logs`, `user-media` |
| Withdrawal — transfer abroad | Legal assessment: if the transfer rests on standard contracts, withdrawing consent does not stop it; only incidental (Art.9(6)) consent-based transfers stop. Reasoned explanation to the user | — |
| Objection to automated decision | A human moderator re-reviews the AI moderation decision; outcome notified to the user | `moderation_queue`, `moderation_actions`, `content_reports` |
| US — opt out of sale/sharing | Same as ad consent "denied"; Global Privacy Control (GPC) signal treated as opt-out on the web | Meta SDK; web |
| US — limit sensitive PI | Health data used only to provide the service (already not used for ads); record the request | — |
| Compensation | Route to legal | — |

### 2.6 Response templates

**(a) Acknowledgement**
> Hello {{NAME}}, your personal data request dated {{DATE}} has been logged as no. {{REQUEST_NO}}. We will reply by {{DEADLINE}} at the latest. — SEKULART Ltd. Privacy Team

**(b) Identity information request**
> To verify that this request is yours, we need {{REQUESTED_INFO}}. It will be used only for verification. We cannot complete your request until we receive it.

**(c) Completed**
> Your request no. {{REQUEST_NO}} has been completed: {{ACTION_TAKEN}}. {{OPTIONAL: data copy link — valid 7 days}}. Due to legal retention obligations, the following records will continue to be kept in de-identified form: {{RETAINED}}. If you find this reply insufficient, you may complain to the Personal Data Protection Board within 30 days of learning of it and in any case within 60 days of your request.

**(d) Refusal / partial refusal**
> We cannot fulfil the {{PART}} part of your request no. {{REQUEST_NO}}. Reason: {{REASON — e.g. KVKK Art.28(2), legal retention obligation (TCC Art.82), identity could not be verified, would infringe others' rights}}. Under KVKK Art.14 you may complain to the Personal Data Protection Board within 30 days of learning of this reply and in any case within 60 days of your request. If you are in the EU/EEA/UK you may also contact your local supervisory authority.

### 2.7 Record keeping

- **Request register** (proposal: `privacy_requests` table — see `ENTEGRASYON.md`): request no., user ID (if any), channel, date, request types, verification method, assignee, deadline, status, outcome, copy of the reply sent.
- Retention: **3 years** from closure (proposal — for Board audits and complaint/litigation periods).
- Export files are deleted **7 days** after delivery to the user.

### 2.8 Escalation

- Risk of missing the 30-day deadline (not complete by day 20) → Privacy Lead + legal.
- Bulk/repetitive or abusive requests → legal (GDPR Art.12(5) "manifestly unfounded or excessive").
- If a request points to a data breach → `en/10-data-breach-response-plan.md`.
- Requests from public authorities (Board, prosecutors) go to legal outside this process.
