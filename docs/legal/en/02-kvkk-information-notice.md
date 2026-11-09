# Information Notice on the Processing of Personal Data (KVKK Art. 10)

> **DRAFT for legal review (İlter Öziseven). Not published.**
> Version: `v0.1-draft` · Draft date: 2026-11-09 · Effective: `[EFFECTIVE DATE]`
> Legal basis: Turkish Personal Data Protection Law No. 6698 ("KVKK") Art. 10 and the Communiqué on the Procedures and Principles for Fulfilling the Obligation to Inform. Source inventory: `docs/legal/VERI_ENVANTERI.md`. The legally binding text is the Turkish version (`tr/02-kvkk-aydinlatma-metni.md`); this is a translation.

> **[Reviewer note]** An information notice informs; it is not consent. Do not present it with an "I have read and accept" checkbox. A link plus an "I have been informed" acknowledgement is enough. Explicit consents are collected separately, each with its own checkbox (`03-explicit-consent-forms.md`; Communiqué Art. 5(1)(ç), (f)).

## 1. Data controller

| | |
|---|---|
| Legal name | SEKULART LTD |
| MERSIS no. | 0759-1148-7410-0001 |
| Tax ID | 7591148741 |
| Trade registry no. | `[TRADE REGISTRY NO]` |
| Address | Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir, Türkiye |
| E-mail | `[privacy@…]` (currently info@eatkcal.com) |
| Phone | `[PHONE]` |
| Services | Kcalculate AI (mobile app, kcalculate.ai), eatkcal (ordering, eatkcal.com), kitchen brands kcal., tera, Breaking Fast |

## 2. Whose data?

This notice covers the following groups of data subjects. Use the table for your group; you may belong to more than one.

- **(A)** Kcalculate AI app users
- **(B)** eatkcal customers (ordering in the app)
- **(C)** Website visitors and form submitters
- **(D)** Discover posters and creator applicants
- **(E)** Customers who order via marketplaces (e.g. Trendyol Go) and whose orders we prepare

Legal-basis abbreviations:
- **5(1)** explicit consent
- **5(2)(c)** formation or performance of a contract
- **5(2)(ç)** legal obligation
- **5(2)(e)** establishing, exercising or defending a right
- **5(2)(f)** legitimate interest
- **6(3)(a)** explicit consent for special-category data (Art. 6 as amended by Law No. 7499)

## 3. (A) Kcalculate AI app users

| Data category | Purpose | Legal basis | Collection method | Recipient groups |
|---|---|---|---|---|
| Identity: name, user ID, handle, bio, profile photo | Account creation and management | 5(2)(c) | App forms; Sign in with Apple/Google (automated) | Hosting and infrastructure providers; sign-in providers (Apple, Google) |
| Contact: e-mail, phone | Sign-in (e-mail code), account messages | 5(2)(c) | App forms | Hosting provider |
| Transaction security: Apple refresh token, known-device ID, session token, deleted-account hash | Account security; revoking Apple access on deletion; coupon-abuse prevention | 5(2)(ç), 5(2)(f) | Automated | Hosting provider, Apple |
| Age confirmation (18+ declaration, calculated age) | Enforce minimum age | 5(2)(ç), 5(2)(f) | App form | — |
| **Health data** (special category): gender, age, height, weight, goal, activity level, body measurements, meal/calorie/macro logs, water, activity | Personal calorie/macro target and tracking | **6(3)(a)** | App forms | Hosting provider |
| **AI scan photo and result** (treated as special category) | Nutrition estimate from a photo | **6(3)(a)**; Art. 9 safeguard for transfer abroad | Camera / gallery | Hosting provider, AI provider (Anthropic, USA) |
| Location (only while the app is open, with permission) | Nearest kitchen and zone | 5(2)(c) | Device location service | Maps provider (Google) |
| Usage analytics: events, random device ID, session, platform, version, user ID | Service improvement | 5(2)(f) | Automated | Hosting provider |
| Attribution: UTM, deep link, QR/field code | Marketing channel measurement | 5(2)(f) | Automated | Hosting provider |
| Diagnostics: crash/performance logs, device/OS, user ID | Debugging | 5(2)(f) | Automated | Diagnostics provider (Sentry, USA) |
| Ad measurement: events, IDFA/GAID | Measure ad effectiveness | **5(1)** | Automated (consent only) | Meta Platforms |
| Notifications: push token, device name/model, send and open records, preferences | Transactional notifications, reminders | 5(2)(c) | Automated | Push infrastructure (Expo, Apple, Google) |
| Marketing communications | Campaigns and announcements | **5(1)** + Law No. 6563 Art. 6 opt-in | App settings | Push and e-mail infrastructure; İYS |
| Support and feedback: e-mail, subject, message, attached photo | Support and complaint handling | 5(2)(c), (e), (f) | App forms | Hosting and e-mail provider (Resend) |

## 4. (B) eatkcal customers

| Data category | Purpose | Legal basis | Collection method | Recipient groups |
|---|---|---|---|---|
| Identity and contact: name, surname, e-mail, phone | Order, delivery, order communication | 5(2)(c) | App forms | Hosting provider; kitchen order management (Adisyo); couriers; branch e-mail alert (Resend) |
| Delivery address, recipient details, address coordinates | Delivery | 5(2)(c) | App forms, map pin, location (with permission) | Adisyo, couriers, maps provider (Google) |
| Order: items, amount, coupon, delivery time, note | Contract formation and performance | 5(2)(c) | App | Adisyo, couriers |
| Financial records: order and payment records, invoice details | Tax and commercial-law obligations | 5(2)(ç) | Automated | Accountant, e-invoice provider, competent authorities |
| Payment: saved card's last 4 digits, brand, bank, alias, card token, IP at payment | Payment, saved-card payment, fraud prevention | 5(2)(c), (ç), (f) | Payment institution page (card details never reach us) | Payment institution (PaynKolay) |
| Macro (Macro Coin) balance, coupon use | Prepaid package performance | 5(2)(c), (ç) | Automated | Hosting provider |
| Order reviews: rating, comment | Service quality; display of reviews | 5(2)(c), (f) | App form | Hosting provider; reviews may be shown to other users |
| Distance-sales and pre-information acceptance record | Burden of proof | 5(2)(ç), (e) | Automated | — |

## 5. (C) Website visitors and form submitters

| Data category | Purpose | Legal basis | Collection method | Recipient groups |
|---|---|---|---|---|
| Form data: name, e-mail, phone, company, district, message, form type (newsletter, partnership, add restaurant, support, notify me, creator waitlist) | Respond according to the form's purpose | 5(2)(c) (pre-contract), 5(2)(f) | Web forms | Hosting providers (Vercel, Supabase) |
| Marketing opt-in (newsletter etc.) and consent-text version | Sending commercial electronic messages | **5(1)** + Law 6563 Art. 6 | Web form checkbox | E-mail infrastructure; İYS |
| Browser info, page of submission | Abuse prevention | 5(2)(f) | Automated | Hosting providers |
| Access logs (IP, browser) | Hosting, security, Law No. 5651 obligations | 5(2)(ç), (f) | Automated (server) | Hosting provider (Vercel), competent authorities |
| Browser storage (cookie preference, theme) | Remember preference | 5(2)(f) (strictly necessary) | Automated | — (your browser only) |

Our websites use no cookies, analytics or advertising pixels (`04-cookie-policy.md`).

## 6. (D) Discover posters and creator applicants

| Data category | Purpose | Legal basis | Collection method | Recipient groups |
|---|---|---|---|---|
| Posts (text, photo, video), comments, likes, follows, blocks | Discover service | 5(2)(c) | App | Hosting provider; other users depending on the audience you choose |
| Meal and activity cards, day cards | Social sharing | **6(3)(a)**; for public posts Art. 6(3)(ç) (made public) to be assessed | App | Other users |
| Automated pre-check input (text, up to 6 images/frames; author identity not sent) and result | Enforce Community Guidelines, platform safety | 5(2)(f); Art. 9 safeguard for transfer | Automated | AI provider (Anthropic, USA) |
| Reports, moderation decisions, appeals | Moderation, legal obligations, protection of rights | 5(2)(f), (ç), (e) | App, automated | Hosting provider; competent authorities on request |
| Creator application: name, e-mail, handle, role, audience, links, message, file name | Assess the application | 5(2)(c) (pre-contract) | Web form | Hosting providers |

## 7. (E) Customers arriving via marketplaces

| Data category | Purpose | Legal basis | Collection method | Recipient groups |
|---|---|---|---|---|
| Name, surname, phone, address, order note, order contents | Prepare and deliver the order | 5(2)(c), (f) | Automated transfer from the marketplace (API) | Adisyo, couriers, marketplace (status updates) |
| Financial records | Tax and commercial law | 5(2)(ç) | Automated | Accountant, competent authorities |

> **[Reviewer note]** This data comes from a third party (the marketplace). Under Communiqué Art. 6, the notice must be given at the latest at first contact with the data subject (e.g. at delivery). Practical options:
> - the marketplace contract requires the marketplace to link this notice;
> - a QR code or short link on the package.
>
> The marketplace's role as independent controller for its own customers should be set out in the contract.

## 8. Transfers abroad

Several of our providers are outside Türkiye:
- hosting: Supabase, hosted in the EU, company in the USA;
- AI: Anthropic, USA;
- diagnostics: Sentry, USA;
- push: Expo, USA, plus Apple and Google push infrastructure;
- maps and sign-in: Google and Apple, USA/Ireland;
- web hosting: Vercel, USA;
- e-mail: Resend, USA;
- ad measurement, if you consent: Meta, Ireland/USA.

Part of the data above is therefore transferred abroad.

- For regular transfers to countries **without an adequacy decision**, we sign the Board's **standard contracts** without changes (KVKK Art. 9(4)(c)).
- We notify each contract to the Personal Data Protection Authority within **5 business days** of signing (Art. 9(5)).
- For incidental transfers, the cases in Art. 9(6) apply. Explicit consent under Art. 9(6)(a) is collected separately, after you are informed of the risks: `03-explicit-consent-forms.md` §2.

> **[Reviewer note]** The current website statement "not transferred abroad" is inaccurate and must be removed. Standard contracts do not appear to have been signed yet (BOSLUKLAR B-01).

## 9. Collection method (summary)

We collect personal data electronically, by automated or partly automated means, through the following channels:
- the mobile app and the websites;
- the payment institution's page;
- sign-in providers (Apple, Google);
- marketplace integrations;
- device sensors (camera, location), with your permission;
- support channels.

## 10. Your rights (KVKK Art. 11)

You may apply to the controller to:

- **(a)** learn whether your personal data is processed;
- **(b)** request information if it is;
- **(c)** learn the purpose of processing and whether data is used accordingly;
- **(ç)** know the third parties in Türkiye or abroad to whom data is transferred;
- **(d)** request correction of incomplete or inaccurate data;
- **(e)** request deletion or destruction under the conditions in Art. 7;
- **(f)** request that actions under (d) and (e) be notified to the third parties who received the data;
- **(g)** object to a result against you that arises solely from analysis by automated systems;
- **(ğ)** claim compensation for damage caused by unlawful processing.

You may withdraw consent at any time. Withdrawal does not affect the lawfulness of processing carried out before it.

## 11. How to apply

Under Art. 5 of the Communiqué on the Procedures and Principles of Application to the Data Controller, you can apply:

1. **in writing**, with a wet-signed letter delivered by hand or post to Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir, Türkiye;
2. with a **secure electronic or mobile signature** to `[privacy@…]`;
3. from the **e-mail address registered** in our system to `[privacy@…]`;
4. through the **in-app request form** at `[Settings › Privacy › Data request]`.

**Your application must include:**
- your name, surname, and signature (for written applications);
- your Turkish ID number, or for foreigners your nationality and passport/ID number;
- your residence or business address for notification;
- your e-mail, phone or fax for notification, if any;
- the subject of your request.

Form: `08-data-subject-request-form-and-process.md`.

**Response:**
- We conclude your request free of charge as soon as possible and **within 30 days at the latest** (KVKK Art. 13).
- If the response exceeds 10 pages, the fee in Communiqué Art. 7 may be charged for each extra page. If the response is provided on a storage medium such as a CD or flash drive, the fee may not exceed the cost of that medium.

**Complaints to the Board (KVKK Art. 14):**
- You can complain to the Personal Data Protection Board if your request is rejected, you find the response insufficient, or we do not respond in time.
- The deadline is **30 days** from learning of the response and in any case **60 days** from your application date.

Personal Data Protection Authority: `[current KVK Authority address — verify at kvkk.gov.tr]` · www.kvkk.gov.tr

> **[Reviewer note]** The Authority address in the current website text ("Nasuh Akar Mah. Ziyabey Cad. No:1272 Balgat / Ankara") must be verified against the contact page on kvkk.gov.tr.

## 12. Related texts

- Privacy Policy: `01-privacy-policy.md`
- Explicit Consent Forms: `03-explicit-consent-forms.md`
- Cookie Policy: `04-cookie-policy.md`
- Retention and Destruction Policy: `09-retention-and-deletion-policy.md`
