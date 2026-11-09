# Cookie Policy

> **DRAFT — for legal review (İlter Öziseven). Not published.**
> Version: `v0.1-draft` · Draft date: 2026-11-09 · Effective: `[EFFECTIVE DATE]`
> Scope: eatkcal.com, kcalculate.ai, l.eatkcal.com (websites). For the mobile app see §7.

## 1. Who this policy belongs to

This policy explains how we use cookies and similar technologies on our websites.

**Controller:** SEKULART Ltd. — `[FULL LEGAL NAME]` (SEKÜLART Sağlıklı Gıda Ürünleri San. ve Tic. Ltd. Şti.)
MERSIS: `[MERSIS]` · Tax ID: `[VKN]` · Address: `[ADDRESS]` (Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir, Türkiye) · Registered e-mail (KEP): `[KEP]` · E-mail: `[privacy@…]` (today: info@eatkcal.com)

Brands: **Kcalculate AI** (kcalculate.ai), **eatkcal** (eatkcal.com), kitchen brands **kcal.**, **tera**, **Breaking Fast**.

## 2. What are cookies and similar technologies?

A **cookie** is a small text file stored in your browser when you visit a website. **Similar technologies** are other methods that write information to, or read information from, your device — browser local storage (`localStorage`, `sessionStorage`), pixels/beacons, SDKs and device fingerprinting. In this policy we call them all "cookies".

Cookies can be **session** (deleted when you close the browser) or **persistent**; and **first-party** (set by our site) or **third-party** (set by another company).

## 3. Legal basis

- **Strictly necessary cookies** — needed for the site to work or to provide a service you explicitly request (e.g. remembering your cookie choice). No consent is required. Turkish Law No. 6698 (KVKK) Art.5(2)(c)/(f); GDPR Art.6(1)(b)/(f); the "strictly necessary" exemption in Art.5(3) of the ePrivacy Directive.
- **Analytics, personalisation and marketing cookies** — used **only with your consent**. KVKK Art.5(1) and the Turkish Data Protection Authority's **Guide on Cookie Practices (2022)**; GDPR Art.6(1)(a) and ePrivacy Art.5(3).
- Refusing consent does not stop you from using the site's core functions. You can withdraw consent at any time (§6).

> **[Reviewer note]** The Authority's guide states that consent cannot be obtained through a cookie wall, pre-ticked boxes or "by using the site you accept". Today's web Terms (`web:apps/eatkcal/content/legal/kullanim.ts:262`) and in-app Terms (Art.14.4) say users are "deemed to consent to cookies by accessing the Platform". That clause **must be removed**; otherwise it conflicts with the (correctly designed) consent banner and may invalidate consent.

## 4. Cookies and similar technologies we use today

**Today our websites set no cookies and load no analytics or advertising pixels.** Only the following two entries are kept in your browser's local storage:

| Name | Type | Purpose | Duration | Party | Consent needed? |
|---|---|---|---|---|---|
| `kcal-consent` | `localStorage` | Remember your cookie choice (version, analytics yes/no, marketing yes/no, time of choice) | Until you clear it (in your browser) | First-party | No — strictly necessary |
| `kcal-theme` | `localStorage` | Remember light/dark theme preference | Until you clear it (in your browser) | First-party | No — function you requested |

These entries are not sent to our servers; they stay in your browser.

**Also good to know:**
- **Fonts** are embedded into our site at build time (`next/font`); no request goes to Google during your visit.
- **Hosting:** our sites are hosted on Vercel Inc. infrastructure. Vercel may process IP address and browser information in server logs to deliver the service and keep it secure; this is not a cookie. Details: Privacy Policy.
- **Forms:** newsletter, partnership, add-a-restaurant, support and "notify me" forms do not use cookies; what you submit is processed under the Privacy Policy.
- **Maps:** no map service is embedded; if you click "Open in Google Maps" you go to Google's site and Google's policy applies.

## 5. Cookies we may add in future `[IF ADDED]`

If we add an analytics or marketing tool, we will **first update this table** and run the tool only if you clicked "Accept" for that category in the banner.

| Name | Provider | Category | Purpose | Duration | International transfer | Consent |
|---|---|---|---|---|---|---|
| `[IF ADDED: e.g. _ga, _ga_*]` | `[e.g. Google Ireland Ltd.]` | Analytics | `[visit statistics]` | `[max. 13 months]` | `[USA — KVKK Art.9 standard contract / GDPR SCCs or DPF]` | Consent |
| `[IF ADDED: e.g. _fbp]` | `[e.g. Meta Platforms Ireland Ltd.]` | Marketing | `[ad measurement]` | `[max. 13 months]` | `[USA — KVKK Art.9 standard contract / GDPR SCCs or DPF]` | Consent |
| `[IF ADDED]` | | | | | | |

> **[Reviewer note]** 13-month duration: the Turkish guide sets no fixed period; in EU practice (e.g. CNIL) 13 months for analytics cookies and re-asking consent every 6–13 months is the accepted benchmark. Before adding any tool: (i) this table, (ii) Privacy Policy recipients list, (iii) KVKK Art.9 standard contract + notification within 5 business days, (iv) VERBİS entry must be updated.

## 6. How to manage your choices

- **Cookie banner:** on your first visit "Accept" and "Reject" are shown with equal prominence. "Preferences" lets you choose by category: **Necessary** (always on), **Analytics**, **Marketing**.
- **Changing your mind:** the **"Cookie settings"** link in the footer reopens the banner. Withdrawing consent does not affect the lawfulness of processing before withdrawal.
- **Browser settings:** you can delete or block cookies and site data (including localStorage) in your browser. If `kcal-consent` is deleted, the banner will appear again.
- **Global Privacy Control (GPC):** if your browser sends a GPC signal, we treat it as "Reject" for marketing/advertising cookies (and, where applicable, as an opt-out of "sale"/"sharing" under US state laws).

## 7. Mobile app

The Kcalculate AI / eatkcal mobile app does not use cookies, but it contains **SDKs** that store data on and read data from your device:
- **First-party usage analytics** (KCAL servers) — can be turned off in Settings › Privacy › "Usage analytics".
- **Meta App Events (Facebook SDK)** — ad measurement; only with your consent. On iOS, Apple's **App Tracking Transparency (ATT)** permission is also required; if you don't allow it, your advertising identifier (IDFA) is not read.
- **Sentry** — crash and error diagnostics.

These are governed by the Privacy Policy and the in-app privacy settings.

> **[Reviewer note]** In code today: Meta SDK has `autoLogAppEventsEnabled: true` (`app.config.js:402`); on Android events go to Meta while ad consent is "unset" (`src/lib/metrics/consent.ts:26-29`); there is no in-app consent screen. This text describes the target behaviour after `BOSLUKLAR.md` B-06 is fixed; until then this paragraph must not be published.

## 8. Changes

We may update this policy. The current version and effective date are published on this page. If we add a new cookie category, we will show the banner again and ask for your consent.

## 9. Contact

Questions and requests under KVKK Art.11 / GDPR: `[privacy@…]` (today: info@eatkcal.com) · How to apply: Data Subject Request Form (`en/08-data-subject-request-form-and-process.md`).
