# eatkcal — Pre-Contract Information Form and Distance Sales Agreement

> **DRAFT — for legal review (İlter Öziseven). Not published.**
> Version: `v0.1-draft` · Prepared: 2026-11-09 · Effective: `[EFFECTIVE DATE]`
> **Convenience translation.** The Turkish text (`tr/06-mesafeli-satis-ve-on-bilgilendirme.md`) is the binding version.
> Scope: food orders and Macro package purchases placed by consumers in Türkiye through eatkcal (the eatkcal module of the Kcalculate AI app and eatkcal.com).
> This file holds **two separate documents**: **Part A — Pre-Contract Information Form** (Distance Contracts Regulation, Art.5–6) and **Part B — Distance Sales Agreement** (Consumer Protection Law No. 6502, Art.48; Regulation Art.7, 18). `{{…}}` fields are filled automatically at checkout.

> **[Reviewer note — general]** The current texts (web `mesafeli.ts`, mobile `contractsData.ts` `distance-sales`) do not present a separate Pre-Contract Information Form; the web only states that the agreement "also serves as pre-contract information", and mobile has nothing. Regulation Art.6 requires the information to be given **before** the contract and to be **confirmed separately** by the consumer, with the burden of proof on the seller. Both documents should therefore be shown separately and recorded with two separate checkboxes (see `ENTEGRASYON.md`). Comparison: `MESAFELI_KARSILASTIRMA.md`.

---

## PART A — PRE-CONTRACT INFORMATION FORM

This form informs you, before your order becomes binding, under Turkish Consumer Protection Law No. 6502 and the Distance Contracts Regulation. Confirming your order shows that you have read and confirmed this form.

### A.1 Seller

| | |
|---|---|
| Trade name | `[FULL TRADE NAME]` (short name: SEKULART Ltd.) |
| Brand | eatkcal — kitchen brands: kcal., tera, Breaking Fast |
| MERSIS no. | `[MERSIS]` *(value in current texts to be verified)* |
| Tax office / no. | `[TAX OFFICE]` / `[TAX ID]` |
| Address | `[ADDRESS]` |
| Phone | `[PHONE]` |
| E-mail | `[support@…]` |
| Registered e-mail (KEP) | `[KEP]` |
| Complaints and requests | App › Support, `[support@…]`, `[PHONE]` |

### A.2 Main characteristics of the goods and services

- **Order no.:** {{SIPARIS_NO}}
- **Items:** {{URUNLER}} *(per line: product name, kitchen brand, portion/weight, quantity, unit price, known allergens, energy and macro values)*
- Items are fresh, made-to-order and **perishable** foods. Calorie and macro values on product pages are **estimates** based on recipes and may deviate by ±`[TOLERANCE]`%.
- **Allergen notice:** Our kitchens handle gluten, milk, egg, tree nuts, peanuts, sesame, soy, fish and shellfish; cross-contact cannot be fully excluded.

### A.3 Price and payment

| | |
|---|---|
| Items subtotal (VAT included) | {{ARA_TOPLAM_TL}} |
| Discount / coupon / Macro Coin | {{INDIRIM_TL}} |
| Delivery fee | {{TESLIMAT_UCRETI_TL}} |
| **Total payable (all taxes included)** | **{{TOPLAM_TL}}** |
| Payment method | {{ODEME_YONTEMI}} |

- Payment is taken on the secure payment page of the licensed payment institution **N Kolay Ödeme ve Elektronik Para Kuruluşu A.Ş. ("PaynKolay")**. Card number, expiry date and security code **never reach the Seller's systems and are not stored by the Seller**. If you choose "save my card", your card is tokenised at PaynKolay; the Seller keeps only the last four digits, brand and bank.
- The amount is charged when you confirm the order. Orders are not prepared before payment is approved.
- An e-archive invoice is issued for your order and sent to your registered e-mail address.

### A.4 Delivery and performance

| | |
|---|---|
| Delivery type | {{TESLIMAT_TURU}} *(Now / Scheduled / Pick-up)* |
| Estimated delivery time or chosen slot | {{TESLIMAT_ZAMANI}} |
| Delivery address | {{TESLIMAT_ADRESI}} |
| Preparing kitchen / branch | {{SUBE}} |

- Delivery is available only in service zones in İzmir. Current zones and hours are shown in the app. Delivery hours: `[DELIVERY HOURS]`.
- Delivery is made by the Seller's contracted courier partners. For **Pick-up**, the order is collected from the stated branch within `[PICK-UP WINDOW]`.
- Items are sent under cold-chain conditions. After delivery, keep them refrigerated at +4 °C / +8 °C and consume them by the date on the package.
- The statutory maximum performance period is 30 days; food orders are, however, delivered within the estimated time or chosen slot above.

> **[Reviewer note]** Delivery hours are inconsistent: current agreements say "every day 09:00–21:00"; the website says "Monday–Saturday 09:00–21:30, closed Sunday" (`web:apps/eatkcal/lib/site.ts:16-17`). There are next-day zones (`web:apps/eatkcal/lib/delivery.ts:5-10`) and a Bayraklı branch (`web:apps/eatkcal/lib/site.ts:52`). Hours, zones and branches should not be hard-coded in the agreement; refer to the live app screen and print the value at order time via {{TESLIMAT_ZAMANI}}.

### A.5 Right of withdrawal

- **Food orders:** Because the items are perishable foods, there is **no right of withdrawal** under Distance Contracts Regulation **Art.15(1)(c)**.
- **Cancelling an order:** You may cancel in the app before the kitchen starts preparing it `[CANCELLATION WINDOW — e.g. until status changes to "Preparing"]`; the amount paid is then refunded. Orders cannot be cancelled once preparation has started.
- **Macro packages:** see Part B clause 8.3.
- These exceptions **do not remove** your statutory rights for defective goods (A.6).

> **[Reviewer note]** The cancellation window is a business decision; if not offered, delete this item. If offered, map it to the app's order statuses (`orders.status`).

### A.6 Defective goods and complaints

- If a delivered item is defective (missing, wrong, spoiled, damaged, or not as agreed), you may use one of your rights under Law No. 6502 Art.11: **refund, price reduction, free repair, or replacement with a non-defective item**.
- For food safety and fast resolution, please report a defect **as soon as possible**, with a photo if you can. Channels: app › Support, `[support@…]`, `[PHONE]`.
- You may bring complaints to the **Consumer Arbitration Committee** at your place of residence or where the transaction took place, within the monetary limits announced annually by the Ministry of Trade (`[CURRENT YEAR LIMIT]`), and above that limit to the **Consumer Court**. Applications can also be made via e-Devlet through the **Consumer Information System (TÜBİS)**.

### A.7 Technical steps and records

- To place an order: add items to the basket → choose address and delivery type → read and confirm this form and the Distance Sales Agreement → complete payment on the PaynKolay payment page.
- You can correct items, address and amount before confirming.
- This form and the agreement are recorded together with the version in force at confirmation; a copy is sent durably to your e-mail and to the order detail in the app.
- The contract language is Turkish.

### A.8 Personal data

Personal data in your order is processed in line with the KVKK Privacy Notice: `[LINK: /legal/kvkk]`.

**Confirmation:** ☐ *I have read the Pre-Contract Information Form and have been informed about the seller, the items, the total price, payment, delivery and the exception to the right of withdrawal.* (separate checkbox; recorded with timestamp and document version)

---

## PART B — DISTANCE SALES AGREEMENT

### Clause 1 — Parties

**1.1 Seller:** `[FULL TRADE NAME]` ("SEKULART Ltd." or the "Seller"), MERSIS `[MERSIS]`, tax ID `[TAX ID]`, address `[ADDRESS]`, phone `[PHONE]`, e-mail `[support@…]`, KEP `[KEP]`.

**1.2 Buyer:** {{ALICI_AD_SOYAD}}, e-mail {{ALICI_EPOSTA}}, phone {{ALICI_TELEFON}}, delivery address {{TESLIMAT_ADRESI}} (the "Buyer").

### Clause 2 — Subject

This agreement governs the parties' rights and obligations for the sale and delivery of the items in order no. {{SIPARIS_NO}} (and any Macro package) placed electronically by the Buyer through eatkcal, under Law No. 6502 and the Distance Contracts Regulation.

### Clause 3 — Items, price and payment

3.1. Items, quantities, unit prices and total including taxes: {{URUNLER}} · delivery fee {{TESLIMAT_UCRETI_TL}} · discount {{INDIRIM_TL}} · **total {{TOPLAM_TL}}**.

3.2. Payment is taken on the PaynKolay payment page via {{ODEME_YONTEMI}}. The Seller does not see or store card details. Saving a card is optional and the Buyer can delete it in the app at any time.

3.3. The price shown at order time applies. The Seller cannot change the price of a confirmed order.

3.4. Coupons and Macro Coin are subject to campaign terms and the Terms of Use; the amount used is shown on the {{INDIRIM_TL}} line.

3.5. In case of unauthorised use of the Buyer's card, Bank Cards and Credit Cards Law No. 5464 applies.

3.6. The Seller issues an e-archive invoice for each order and sends it to the Buyer's e-mail.

### Clause 4 — Delivery

4.1. Items are delivered according to the delivery type chosen by the Buyer (Now / Scheduled / Pick-up) within {{TESLIMAT_ZAMANI}}, to {{TESLIMAT_ADRESI}}, or for Pick-up at the {{SUBE}} branch. Delivery zones and hours (`[DELIVERY HOURS]`) are shown in the app.

4.2. Delivery is made by the Seller's contracted couriers. Any delivery fee is borne by the Buyer and shown in the pre-contract information.

4.3. If the Buyer cannot be reached or the address is wrong, the courier will call the Buyer. Undeliverable orders: `[UNDELIVERABLE ORDER PROCEDURE — e.g. may be collected from the branch by 21:00 the same day]`. Because the food is perishable, no refund is made where non-delivery is not caused by the Seller.

4.4. If the Seller cannot perform due to force majeure or the address being outside the service zone, it will notify the Buyer within 3 days of learning this and refund all amounts collected **within 14 days** (Regulation Art.16 — to be verified).

4.5. After delivery, items must be stored at +4 °C / +8 °C. The Seller is not liable for spoilage caused by improper storage; this does not affect rights relating to defects existing at delivery.

> **[Reviewer note]** The mobile text has a "Pick-up / undeliverable order" clause (mobile M7) corresponding to 4.3; the "no refund" rule for undeliverable orders has been limited to cases not caused by the Seller.

### Clause 5 — Seller's obligations

5.1. The Seller shall prepare and deliver the items sound, compliant with food legislation and matching the characteristics in the pre-contract information.

5.2. Where performance becomes impossible, the Seller acts under 4.4.

5.3. The Seller keeps the pre-contract confirmation, agreement acceptance and order records for **at least 3 years** (Regulation Art.18/… — to be verified).

### Clause 6 — Buyer's obligations

6.1. The Buyer shall give correct address, phone and delivery details.

6.2. The Buyer should check product information on allergies and dietary restrictions before ordering.

### Clause 7 — Right of withdrawal and exceptions

7.1. **Food orders:** Because the items are perishable foods that may quickly pass their expiry date, **the right of withdrawal does not apply** to these orders under Distance Contracts Regulation **Art.15(1)(c)**. The Buyer accepts that where an item is prepared to the Buyer's personal specification (e.g. a menu with a custom macro split), the exception in **Art.15(1)(b)** also applies.

7.2. **Cancellation before preparation:** The Buyer may cancel in the app before the order reaches the `[CANCELLATION WINDOW]` stage; the amount collected is then refunded to the payment method within 14 days.

7.3. This clause does not limit the defective-goods rights in Clause 9.

> **[Reviewer note]** The current text cites the exception as "Law No. 6502 Art.15/1-(b) and (c)" and mixes up the letters (it gives (b) as "financial-market fluctuation" and (c) as "personal needs", with perishables only "in addition") (`web:apps/eatkcal/content/legal/mesafeli.ts:134-146`). The exceptions are not in the Law but in **Regulation Art.15(1)**, based on Law Art.48. Known order: (a) financial-market fluctuation, (b) goods made to personal needs, (c) perishable / expiring goods, (ç) hygiene-sealed goods unsealed after delivery … (f) food-and-drink supply for a specific date/period … (ğ) services started with the consumer's consent before the withdrawal period ends. **Verify the lettering against the current consolidated text after the 2022 amendment.** Saying "all items are personalised" may be untrue for standard menu items; the primary basis should be (c).

### Clause 8 — Macro packages and Macro Coin

8.1. A Macro package is a prepaid balance/service package usable on orders within a set period. Content, duration and price are shown on the purchase screen.

8.2. Expired balances lapse under `[EXPIRY RULE]`; the Buyer is notified at least `[N]` days before expiry.

8.3. **Withdrawal:** The Buyer may withdraw from a Macro package without giving reasons **within 14 days** of purchase if the package **has not been used at all**; the amount is refunded within 14 days. If the Buyer expressly requests immediate activation at purchase and starts using the package within the withdrawal period, the right of withdrawal ends for the used part under Regulation **Art.15(1)(ğ)**; the unused part is refunded under `[PARTIAL REFUND RULE]`.

> **[Reviewer note]** The current text says "no refund even if unused" (`web:apps/eatkcal/content/legal/mesafeli.ts:158-166`; mobile M8.2/11.3). A Macro package is a prepaid balance/service rather than goods; if it includes personal services such as dietitian sessions, (ğ) applies only where performance **started with the consumer's consent**. Refusing refunds for a wholly unused package may be an **unfair term** under Law No. 6502 Art.5 and is hard to defend under Art.15. The business must decide whether to offer partial refunds. The consumer's consent for (ğ) should be recorded with a separate checkbox.

### Clause 9 — Defective goods

9.1. If a delivered item is defective, the Buyer may exercise one of the elective rights under Law No. 6502 Art.11: (a) termination (refund), (b) price reduction, (c) free repair, (ç) replacement with a non-defective item. Given the nature of food, repair is usually not possible.

9.2. For food safety and quick resolution, the Buyer is asked to report a defect **as soon as it is noticed**, with a photo if possible, via app › Support, `[support@…]` or `[PHONE]`. This request does not limit statutory time limits.

9.3. The Seller responds within `[REVIEW PERIOD — e.g. 2 business days]`. Refunds are made to the payment method **within 14 days** of notifying the Buyer of the decision; the time to appear on the account depends on the bank.

9.4. For partial defects, the Buyer may request a refund or reduction for the defective part.

> **[Reviewer note]** The current text makes "within 2 hours of delivery, final and non-extendable", "only via the app; phone/e-mail not valid" and "no request processed without images" conditions for the defect claim (`web:apps/eatkcal/content/legal/mesafeli.ts:180-189`; mobile terms M10.3). Under Law No. 6502 Art.8–12 (defective goods and elective rights) and Art.5 (unfair terms), these conditions carry a high risk of being void/unfair as against the consumer. The draft rewrites them as **requests**. In the mobile text, lists 9.2 and 9.4 are empty (table loss).

### Clause 10 — Personal data

Personal data given for the order is processed under the Seller's KVKK Privacy Notice (`[LINK]`). For delivery, name, address and phone are shared with the courier partner; for preparation, order content is shared with the kitchen/branch and the order management system (Adisyo).

### Clause 11 — Disputes

11.1. Turkish law governs this agreement.

11.2. The Buyer may bring complaints, within the monetary limits set annually by the Ministry of Trade (`[CURRENT YEAR LIMIT]`), to the Consumer Arbitration Committee **at the Buyer's place of residence or where the transaction took place**, and for disputes above those limits to the Consumer Court **at the Buyer's place of residence or where the transaction took place** (Law No. 6502 Art.73). Applications can also be made via TÜBİS (e-Devlet).

> **[Reviewer note]** The current text gives exclusive jurisdiction to "İzmir Central Consumer Courts" (`web:apps/eatkcal/content/legal/mesafeli.ts:284`). Law No. 6502 Art.73(5) lets consumers sue at their own domicile; a single-venue clause cannot be enforced against the consumer.

### Clause 12 — Evidence and entry into force

12.1. The parties accept that the Seller's electronic records may serve as evidence under Code of Civil Procedure Art.193; this does not limit the Buyer's right to submit counter-evidence.

12.2. The agreement is concluded when the Buyer electronically confirms the Pre-Contract Information Form and this agreement. The confirmation is recorded with document version, date-time, order no. and account ID. A copy is delivered to the Buyer's e-mail and to the order detail in the app as a durable medium (Regulation Art.7).

**Acceptance:** ☐ *I have read and accept the Distance Sales Agreement.* (separate from the pre-contract confirmation; for Macro packages additionally ☐ *I request immediate activation of the package and understand that my right of withdrawal ends for the part I use.*)

**Seller:** `[FULL TRADE NAME]` · **Buyer:** {{ALICI_AD_SOYAD}} · **Date:** {{ONAY_TARIHI}} · **Document version:** {{BELGE_SURUMU}}
