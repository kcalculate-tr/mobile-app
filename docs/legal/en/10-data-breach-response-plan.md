# Personal Data Breach Response Plan

> **DRAFT — for legal review (İlter Öziseven). Not published.**
> Version: `v0.1-taslak` · Date: 2026-11-09 · Source inventory: `docs/legal/VERI_ENVANTERI.md`
> The Turkish version (`tr/10-veri-ihlali-mudahale-plani.md`) prevails in case of conflict.

**Data controller:** SEKULART Ltd. — `[TAM UNVAN]` · MERSİS `[MERSİS]` · Tax ID `[VKN]` · Address `[ADRES]` · KEP `[KEP]` · Contact `[privacy@…]`

---

## 1. Purpose and legal basis

This Plan sets how the Company responds when personal data is unlawfully obtained, accessed, altered, lost or destroyed (a "breach").

| Source | Requirement |
|---|---|
| **KVKK Art. 12(5)** | If processed data is obtained by others unlawfully, the controller notifies the data subjects and the Board as soon as possible. |
| **Board Decision 2019/10** (procedures for breach notification) | Notify the Board without delay and **within 72 hours** of becoming aware. Notify data subjects **within the shortest reasonable time** once they are identified. Record every breach. |
| **GDPR Art. 33–34** | Applies when people in the EU/EEA are affected. |
| **US state breach notification laws** | Apply when US residents are affected. |

## 2. Scope

The Plan covers:
- Company systems;
- Company data held in processors' systems (Supabase, Anthropic, Sentry, Expo, Vercel, Resend, Adisyo, etc.);
- staff devices and paper records.

Each breach is assessed under three headings:
- **confidentiality** breaches;
- **integrity** breaches (data altered);
- **availability** breaches (data lost, encrypted or destroyed).

## 3. Breach Response Team (BRT)

| Role | Duties | Person | Deputy | Contact |
|---|---|---|---|---|
| Decision-maker (management) | Notification decisions, resources, approval of external comms | `[NAME / TITLE]` | `[DEPUTY]` | `[PHONE]` |
| Technical lead | Detection, scoping, containment, evidence, root cause | `[NAME / TITLE]` | `[DEPUTY]` | `[PHONE]` |
| Legal / data protection lead | Legal assessment, Board and authority notices, processor correspondence, records | `[NAME / TITLE]` (proposed: İlter Öziseven) | `[DEPUTY]` | `[PHONE]` |
| Communications | User notices, press, app-store correspondence | `[NAME / TITLE]` | `[DEPUTY]` | `[PHONE]` |
| Operations (as needed) | Branches, couriers, payment and POS processes | `[NAME / TITLE]` | — | `[PHONE]` |

There is one internal reporting channel: `[security@… / emergency phone]`. All staff must report any suspicion **immediately**.

## 4. Detection sources

- **Supabase:** logs (Auth, API, Storage, Edge Functions), advisors, unusual query volume.
- **Sentry:** alerts, for example a sudden spike in authorization errors.
- **People:** reports from users and staff (support tickets, `info@`, social media), and from security researchers.
- **Processors:** notices from Supabase, Anthropic, Sentry, Expo, Vercel, Resend, Adisyo, PaynKolay and Meta.
- **App stores:** notices from Apple and Google (App Store Connect, Play Console).
- **Payment provider:** fraud or card-data alerts.
- **Leaked keys:** alerts from GitHub secret scanning or external scans.

## 5. Severity assessment

### 5.1 Data type score

| Score | Data type |
|---|---|
| 4 — Critical | Special-category or possible health data (nutrition profile, body measurements, meal history, AI scan photos); payment tokens (`user_card_secrets`); authentication secrets (service role key, Apple refresh tokens, session tokens) |
| 3 — High | Address, phone and name together; order history; support attachments; private-profile content |
| 2 — Medium | E-mail, name, handle; push tokens; analytics events linked to `user_id` |
| 1 — Low | Anonymous or aggregated data; content that is already public |

### 5.2 Scale and likelihood

| Factor | 1 | 2 | 3 |
|---|---|---|---|
| People affected | < 100 | 100–10,000 | > 10,000 |
| Likelihood of harm | Evidence the data was encrypted or not accessed | Access is possible; misuse is unclear | Evidence of misuse or spread |

**Total = data type × scale × likelihood.**

| Total | Level | Default action |
|---|---|---|
| ≥ 18, or data type 4 with likelihood ≥ 2 | **S1 Critical** | Notify the Board within 72 h; notify data subjects; assess GDPR and US duties |
| 8–17 | **S2 High** | Notify the Board (default: notify); assess notifying data subjects |
| 3–7 | **S3 Medium** | Legal assessment; usually notify; recording is mandatory |
| ≤ 2 | **S4 Low** | Record; notification may not be needed, and the reason is written down |

> **[Reviewer note]** KVKK has no express equivalent of the GDPR Art. 33(1) exception ("unless unlikely to result in a risk"), and the Board's practice leans towards notification. The default for S3 and above is therefore to notify the Board. A decision not to notify at S4 is recorded with reasons.

## 6. Phases and timeline

T0 is the moment the Company **becomes aware** of the breach. A processor's notice to the Company counts as T0.

### 6.1 T0 to 1 hour: triage and containment

1. The reporter alerts the BRT, and the technical lead opens an incident record (§9.4).
2. The team confirms the breach is real and makes a first severity estimate.
3. The team contains the breach as needed. **No secrets are written in this document.**
   - Rotate the Supabase **service role key** and, if needed, the **JWT secret** (Dashboard › Settings › API). Rotating the JWT secret signs out every user, so weigh that impact first.
   - Disable the affected **edge functions**, or cut off their access before redeploying.
   - Switch any exposed **Storage bucket** from public to private, and purge the CDN cache.
   - Revoke and reissue the affected third-party **API keys**: Anthropic, Resend, PaynKolay, Adisyo, Trendyol Go, Google Maps, Sentry, and the Expo access token.
   - Remove suspicious admin accounts from `admin_allowlist` and end their sessions.
   - Internal guide to earlier key rotations: `docs/night/G3-S2-KEY_ROTATION.md`.
4. The team **preserves evidence** (§8). Containment steps must not destroy evidence.

### 6.2 1 to 24 hours: scope and risk analysis

- Identify the affected systems, data categories, number of records and people, and countries (TR / EU / US / other).
- Establish the start time, duration, attack vector and whether data left the systems.
- Finalise the severity score (§5). Legal decides which notifications are required.
- If a processor caused the breach, request written details from them.

### 6.3 Within 72 hours: notify the Board (KVKK)

- File the Authority's **"Personal Data Breach Notification Form"** online at kvkk.gov.tr, or by KEP if needed.
- If not all facts are known by 72 hours, notify what is known and add the rest **in phases without delay**.
- If 72 hours is exceeded, state the **reasons for the delay** with the notice.

### 6.4 Shortest reasonable time: notify data subjects (KVKK)

- Notify affected people **directly** (e-mail, in-app message, push) as soon as they are identified.
- If direct contact is impossible or disproportionate, publish a notice on the Company websites (eatkcal.com / kcalculate.ai).
- Use the template in §9.2 (TR) or §9.3 (EN).

### 6.5 GDPR (if people in the EU/EEA are affected)

- **Art. 33:** notify the supervisory authority within **72 hours** of becoming aware.
- The Company has no EU establishment, so the **one-stop-shop does not apply**. Separate notices may be needed to the competent authority in each member state where affected people live.
- Coordinate notices through the **GDPR Art. 27 representative** `[EU REPRESENTATIVE — not yet appointed]`.
- **Art. 34:** if there is a **high risk** to people's rights and freedoms, notify them without undue delay. The exceptions, such as data that was encrypted or unintelligible, are assessed case by case.
- **Art. 33(5):** record every breach, whether or not it was notified.

### 6.6 United States

- Apply the breach laws of each state where affected residents live. Deadlines and thresholds vary, and some states require notice to the Attorney General. `[STATE LIST — to be filled from US user distribution]`
- For possible health data, also assess:
  - the **Washington My Health My Data Act** and similar state consumer-health-data laws;
  - the **FTC Health Breach Notification Rule** (16 CFR Part 318).

> **[Reviewer note]** The FTC Health Breach Notification Rule can apply to non-HIPAA apps that provide "personal health records". It can also treat unauthorised disclosure as a breach, for example sending health data to an advertising SDK. If Kcalculate AI is offered in the US, this rule should be reviewed separately.

### 6.7 Other notifications

- **Processors:** each DPA requires the processor to notify the Company **without undue delay** (proposed: within 24 hours). Their notice starts T0.
- **Payment provider (PaynKolay):** notify immediately if card tokens or the payment flow are affected. If card data is suspected, follow PCI DSS processes together with the provider.
- **Apple and Google:** contact developer support if account security or Sign in with Apple / Google tokens are affected, and make any notices store policies require.
- **Marketplace and POS (Trendyol Go, Adisyo):** notify under contract if their customers' data is affected.
- **Law enforcement (optional):** report to the Turkish National Police Cybercrime Department or the public prosecutor. The decision-maker and Legal decide together.
- **Insurance:** notify within the policy period if there is cyber cover `[POLICY DETAILS]`.

### 6.8 Close-out and post-incident review (within 30 days)

- Carry out a root-cause analysis and make permanent fixes, including policy and code changes.
- Record lessons learned. Update the retention policy, the data inventory and this Plan.
- Close the incident and enter it in the breach register.

## 7. Timeline summary

| Time | Step | Owner |
|---|---|---|
| T0 | Awareness, internal report, incident record | Reporter → Technical lead |
| T0 + 1 h | Triage, containment, evidence preservation | Technical lead |
| T0 + 24 h | Scope, headcount, countries, severity | Technical lead + Legal |
| T0 + 48 h | Draft notices, decision | Legal + Decision-maker |
| ≤ T0 + 72 h | Notify the Board and GDPR authorities | Legal |
| Shortest reasonable time | Notify data subjects | Communications + Legal |
| ≤ T0 + 30 days | Post-incident review and close-out | BRT |

## 8. Evidence preservation

- Export logs from the affected systems (Supabase, Vercel, Sentry) to immutable storage. Do this before the logs expire.
- Record screenshots, timestamps, and the relevant commit and deploy IDs.
- Keep a chain-of-custody note: who touched the evidence, and when.
- Keep evidence at least as long as the breach record (5 years, proposed).

## 9. Templates

### 9.1 Board notice: form headings

| Heading | What to fill in |
|---|---|
| Controller | Name, VERBİS number `[if any]`, address, contact person |
| Notifier | Person making the notice |
| Dates and times | Breach start, breach end, awareness |
| Source and how it happened | Cyber attack, unauthorised access, loss, staff error, etc. |
| Data categories | Including whether special-category data is involved |
| Scale | Number of people and records; groups (users, customers, staff) |
| Consequences | Likely effects of the breach |
| Measures | Measures taken and planned |
| Data subjects | Whether they were notified, how and when |
| Other countries | Whether people abroad are affected |
| Delay | Reasons for any delay |
| Processor | Processor identity, if a processor caused the breach |

### 9.2 Data subject notice — TR template
See `tr/10-veri-ihlali-mudahale-plani.md` §9.2.

### 9.3 Data subject notice — EN template

> **Subject: Important security notice about your account**
>
> Hello [Name],
>
> On [DATE] we discovered [short, plain description of what happened]. As a result, the following information about you may have been affected: [data categories]. [Your card number and password were not affected — only if true.]
>
> As soon as we learned of it we took these steps: [measures]. We have notified [the Turkish Personal Data Protection Board / the relevant data protection authority].
>
> We recommend that you [e.g. change the password of the linked e-mail account, be cautious about suspicious e-mails and calls].
>
> For questions or to exercise your data protection rights, contact [privacy@…] · [PHONE].
>
> We apologise for this.
> SEKULART Ltd. ([brand]) — [TAM UNVAN], [ADRES]

### 9.4 Internal incident record

| Field | Value |
|---|---|
| Incident no. | `IHL-YYYY-NNN` |
| Awareness time (T0) / source | |
| Reporter | |
| Affected system(s) | |
| Data categories / special category? | |
| People and records; countries | |
| Severity score (type × scale × likelihood) | |
| Containment steps (timed) | |
| Board notice (date/time, reference) | |
| Data subject notice (channel, date) | |
| GDPR / US / other notices | |
| Root cause | |
| Permanent fixes | |
| Close-out date, approver | |

## 10. Breach register

Every breach is recorded, whether or not it was notified. The register holds these fields:
- incident number;
- times: start, awareness, containment, close;
- facts;
- data categories and categories of people;
- number of people;
- consequences;
- measures taken;
- notification decisions with reasons;
- notification dates;
- owners.

Records are kept for **5 years** (proposed) and produced on request of the Board or any authority.

## 11. Scenarios

### (a) Personal data exposed in a public Storage bucket

**Risk today**
- `support-attachments` is public. Support attachments can include invoices, order photos or IDs, and anyone with the URL can read them (`supabase/migrations/20261021132735_storage_public_assets_and_support_attachments.sql:26-44`).
- `post-media` is public, so media from private profiles is also reachable by URL.
- Avatar file names are user UUIDs.

**Response**
1. Make the bucket private and move to signed URLs. Purge the CDN cache.
2. Check access logs for external access, and identify the affected attachments.
3. If attachments contain ID or health data, treat the breach as S1.

### (b) Supabase service role key leaked

**Impact:** full database and Storage access that bypasses RLS. Every category is exposed, including special-category data, so this is **S1**.

**Response**
1. Rotate the key immediately, and the JWT secret if needed.
2. Update the edge function environment and the web (Vercel) environment variables.
3. Find the source of the leak (repository, CI log or device).
4. Review Supabase logs for queries made with the key.
5. Notify the Board within 72 h.

### (c) Personal data exposed in Adisyo logs

**Risk today**
- `adisyo_api_log` and `adisyo_webhook_events` keep names, phone numbers and addresses in raw requests and responses, with no time limit (`supabase/migrations/20260508000000_adisyo_phase1.sql:14`; `supabase/functions/adisyo-save-order/index.ts:405`).
- These tables also hold data about customers from other channels (Yemeksepeti, Getir, etc.).

**Response**
1. Lock down access to the tables. Identify the affected records and channels.
2. Notify the relevant marketplaces under contract if their customers are affected.
3. Enable the 30-day retention job.

### (d) Processor breach (e.g. Anthropic, Sentry, Expo, Resend)

**Flow:** the processor's notice starts T0. Request the affected data, time window and measures from the processor in writing.

**Anthropic specifically**
- What is sent:
  - the plate photo, the prompt and the user's hint (`supabase/functions/analyze-ai-scan/index.ts:217-227`);
  - Explore post text and images (`supabase/functions/moderate-content/index.ts:153-175`).
- No user ID is sent.
- A photo can still identify someone (a face or a home setting) and carries health context, so severity is at least S2.

Also invoke the notification clauses of the transfer SCCs.

### (e) Lost staff device with an admin panel session

**Impact:** access to all addresses (Customer 360), profiles, support tickets and the boss-panel customer activity (`supabase/migrations/20260524000000_addresses_admin_select.sql:1-40`; `supabase/migrations/20260926103402_boss_musteri_hareketleri.sql:1-12`).

**Response**
1. End the user's Supabase sessions and temporarily remove them from `admin_allowlist`.
2. Reset their password and 2FA. Remote-wipe the device if MDM exists.
3. Review access logs for activity after the loss.
4. If access cannot be ruled out, treat the breach as S2.

## 12. Exercises and review

- Hold one tabletop exercise **per year** using one of the scenarios above, and record the results.
- Review the Plan after every real breach and at least yearly. Verify BRT contact details every quarter.

| Version | Date | Change | Approved by |
|---|---|---|---|
| v0.1-taslak | 2026-11-09 | First draft | — |
