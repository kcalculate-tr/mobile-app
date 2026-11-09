# Explicit Consent Forms

> **DRAFT for legal review (İlter Öziseven). Not published.**
> Version: `v0.1-draft` · Draft date: 2026-11-09 · Effective: `[EFFECTIVE DATE]`
> Controller: `[FULL LEGAL NAME]` (SEKULART Ltd.) · `[ADDRESS]` · `[KEP]` · `[privacy@…]`
> Translation of `tr/03-acik-riza-metinleri.md`. For users in Türkiye the Turkish text prevails.

## Common principles

- **The four consents are separate.** You give, refuse and withdraw each one on its own. There is no "accept all" box.
- Checkboxes are **unticked by default**.
- Consents are shown separately from the information notice (`02-kvkk-information-notice.md`) and from contract acceptance.
- Refusing consent blocks no service, except where stated expressly below.
- Withdrawal is free and as easy as giving consent. It does not affect the lawfulness of processing before withdrawal.
- **Record:** for each consent we store:
  - the text ID and version;
  - the time it was given or withdrawn (UTC);
  - the channel (app/web);
  - the device platform (iOS/Android/web);
  - the app version.

  We keep this record for **3 years** after withdrawal as proof.

> **[Reviewer note]** The Turkish Board expects consent not to be made a condition of a product or service. Only the health-data consent here is a precondition for a feature, because:
> - calorie tracking cannot technically work without that data;
> - there is no other suitable basis under KVKK Art. 6(3) (or GDPR Art. 9(2)).
>
> eatkcal ordering and all other features work without it. Assess this distinction against Board practice.

---

## 1. Explicit Consent to the Processing of Health Data

**Purpose.** In Kcalculate AI, to calculate your personal calorie and macro targets, track your meals and progress, and estimate nutrition from photos.

**Data.**
- gender, age, height, weight, target weight/goal, activity level;
- waist, hip and chest measurements and their history;
- meal, calorie and macro logs; water and activity logs;
- AI plate-scan photos, your optional note, and the estimated results.

**Recipients.**
- **Supabase Inc.** hosts the data in the EU.
- **Anthropic PBC (USA)** receives data for the AI plate scan only: the photo and your note. Your name, e-mail and user ID are not sent.
- These transfers are covered by standard contracts under KVKK Art. 9 (SCCs under the GDPR).
- Health data is **never used for advertising and never sent to Meta**.

**Sharing.** If you choose to share a meal or activity card as a post, or as a 24-hour day card, it becomes visible to the audience you pick (followers or everyone). You make this choice separately each time.

**Retention.**
- Kept while your account is open and your consent stands.
- Destroyed within **30 days** of withdrawal or account deletion.
- Scan photos are deleted within 30 days of analysis at the latest.

**If you do not consent.** Calorie/macro tracking and AI plate scan do not work. You can still order from eatkcal and use Discover and the other features.

**How to withdraw.** In `[Settings › Privacy › Health data]`, or by writing to `[privacy@…]`.

**Legal basis.**
- KVKK Art. 6(3)(a);
- GDPR Art. 9(2)(a);
- (USA, Washington/Nevada) consent to collect consumer health data.

**Checkbox text:**
> ☐ I give my explicit consent to the processing of my health data, such as my height, weight, measurements, meal logs and plate photos, for calorie tracking and AI nutrition estimates as described above, and to its transfer to service providers abroad for this purpose.

> **[Reviewer note]**
> 1. The current in-app checkbox (`src/core/i18n/dictionaries.ts:227`) is **not recorded**, so the burden of proof cannot be met (BOSLUKLAR).
> 2. Washington MHMDA requires separate consent for sharing. For a US launch, add a separate box below this one: "I consent to my consumer health data being shared with third parties other than the processors above."

---

## 2. Explicit Consent to Transfer Personal Data Abroad (incidental transfers)

> **[Reviewer note — why a blanket transfer consent is not recommended]** Under KVKK Art. 9 as amended by Law No. 7499, the regular and primary routes for transfers abroad are:
> - an adequacy decision (Art. 9(1));
> - or, without one, appropriate safeguards (Art. 9(4)): standard contracts, binding corporate rules, or an undertaking plus Board authorisation.
>
> Explicit consent (Art. 9(6)(a)) is available only for **incidental** transfers, and only after the person has been informed of the risks. Continuous transfers (hosting, AI, diagnostics, push) must therefore run on **standard contracts plus notification to the Authority within 5 business days**. This consent does not replace them.
>
> It is proposed only for:
> - a single, non-regular transfer not covered by a standard contract (e.g. a one-off transfer to a foreign service at the user's request, or an unavoidable single operation before a new provider's contract is complete);
> - a stop-gap until contract processes are finished.
>
> Even the stop-gap use is debatable. Not deploying this consent at all is also a reasonable option.

**Purpose.** Where a single, non-regular transfer is needed and standard-contract safeguards cannot be applied.

**Data and recipient.** Shown to you at the time of the transfer: the data category, the recipient's name and country, and the purpose. This consent covers only that single transfer.

**Risks (information required by Art. 9(6)(a)).**
- The Board has issued **no adequacy decision** for the recipient country. The level of protection there may not equal the level in Türkiye.
- **No appropriate safeguard** (such as a standard contract) is in place for this transfer.
- Public authorities in the recipient country may access the data under local law.
- It may be harder to exercise your KVKK Art. 11 rights against the recipient and to seek legal remedies.

**Duration.** Valid only for the single transfer concerned.

**If you do not consent.** The single operation you requested cannot be carried out. Other services are unaffected.

**How to withdraw.** Write to `[privacy@…]`. Withdrawal stops any transfer not yet made.

**Legal basis.**
- KVKK Art. 9(6)(a);
- Regulation on the Procedures and Principles for the Transfer of Personal Data Abroad;
- GDPR Art. 49(1)(a), for incidental transfers only.

**Checkbox text:**
> ☐ Having been informed of the risks arising from the absence of an adequacy decision and of appropriate safeguards, I give my explicit consent to the one-time transfer of the personal data stated above to the stated recipient and country, for the stated purpose.

---

## 3. Marketing Communications Opt-in and Explicit Consent

**Purpose.** To send campaigns, discounts, new-product and menu announcements, and personalised recommendations based on segmentation of order history, preferences and app usage.

**Channels (choose each separately):**
- ☐ E-mail
- ☐ SMS
- ☐ Phone calls
- ☐ App notifications (push)

**Data.**
- name, e-mail, phone, push token;
- order history and preferences;
- usage-analytics summaries, for segmentation.
- **Health data is not used for marketing segmentation.**

**Recipients.**
- e-mail infrastructure (Resend, USA) and push infrastructure (Expo, USA; Apple, Google);
- İYS A.Ş., for registration in Türkiye's Message Management System (İYS);
- SMS/call provider `[PROVIDER — none yet]`.
- Transfers abroad are covered by standard contracts.

**Retention.**
- Messages are sent until you withdraw.
- Opt-in and opt-out records are kept for **3 years** after the consent ends (Regulation on Commercial Communications and Commercial Electronic Messages).

**If you do not consent.** You receive no marketing messages. Transactional messages (orders, account, security) are unaffected.

**How to withdraw.**
- Use the opt-out link or instruction in any message.
- Go to `[Settings › Notifications › Marketing]`.
- Use İYS (iys.org.tr).
- Write to `[privacy@…]`.
- We act on your request within **3 business days** at the latest.

**Legal basis.**
- Turkish Law No. 6563 on the Regulation of Electronic Commerce, Art. 6, and the related Regulation (prior opt-in);
- KVKK Art. 5(1) (explicit consent for segmentation/profiling);
- GDPR Art. 6(1)(a) and ePrivacy Directive Art. 13.

**Checkbox text:**
> ☐ I agree to receive commercial electronic messages about campaigns, discounts and announcements from `[FULL LEGAL NAME]` through the channels I selected, and to the processing of my order history and preferences for personalisation for this purpose.

> **[Reviewer note]**
> 1. SMS, call and e-mail opt-ins must be uploaded to İYS. An opt-in not in İYS is not valid, and no message may be sent to a recipient without an İYS record.
> 2. Whether push counts as a "commercial electronic message" is debated. Collecting opt-in anyway is the cautious choice. Push is outside İYS.
> 3. Today `marketing_enabled` defaults to on, and campaigns also reach users with no preference row (`supabase/functions/send-notification/index.ts:183-186`). Fix this before the text takes effect.
> 4. The web newsletter consent record (text, version, time) is designed in `web_leads`, but the table is not applied to production.

---

## 4. Explicit Consent to Ad Measurement (Meta)

**Purpose.** To measure how many people our Meta (Facebook/Instagram) ads bring to the app and how many place an order, and to improve ad delivery based on that measurement.

**Data.** Meta's software development kit (SDK) sends Meta these in-app events:
- product view (product ID, name, price);
- add to cart;
- checkout start;
- purchase (amount, order number);
- registration (method).

It also sends device and app information and the advertising identifier: IDFA on iOS, the advertising ID (GAID) on Android.

Health data, meal logs, addresses and location are **not** sent.

**Recipients.**
- Meta Platforms Ireland Ltd. and Meta Platforms Inc. (USA). Meta also processes this data as an independent controller under its own terms.
- Transfers abroad are covered by standard contracts under KVKK Art. 9.

**iOS App Tracking Transparency (ATT).** On iPhone, Apple also asks for tracking permission in a separate system prompt. That permission and this consent are **separate**. If either is missing, no events or advertising ID are sent to Meta.

**Retention.** Events are sent until you withdraw consent. Retention at Meta follows Meta's policy.

**If you do not consent.** Every feature of the app works the same; only ad measurement is off.

**How to withdraw.**
- `[Settings › Privacy › Ad measurement]`.
- On iOS, also device Settings › Privacy & Security › Tracking.
- Write to `[privacy@…]`.

**Legal basis.**
- KVKK Art. 5(1) (explicit consent) and Art. 9 (transfer safeguard);
- GDPR Art. 6(1)(a) and ePrivacy Directive Art. 5(3) (consent for device access);
- USA: right to opt out of "sharing" (Privacy Policy §17).

**Checkbox text:**
> ☐ I give my explicit consent to the transfer of my in-app product view, add-to-cart, checkout and purchase events and my advertising identifier to Meta Platforms, to measure the effectiveness of ads.

> **[Reviewer note]**
> - The consent-screen strings already exist in code (`src/lib/metrics/i18n.ts:20-29`) but are not connected to any screen.
> - While consent is "unset", events are sent on Android, and SDK auto-logging stays on for iOS (`app.config.js:402`). The default must be "no consent" (BOSLUKLAR B-06).
> - The current in-app description of first-party analytics as "anonymous usage events" is also inaccurate. Events are linked to the user ID, which makes them pseudonymous.
