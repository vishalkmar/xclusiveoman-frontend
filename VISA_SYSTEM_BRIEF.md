# Xclusive Oman — Visa System: Full Brief

Use this brief as the single source of truth for the Oman visa feature of the **Xclusive Oman Agent Portal**. Write FAQs, help text and UI copy only from what is written here. If something isn't covered, say "contact support" instead of guessing — see **§12 Do not claim**.

---

## 1. What it is and who uses it

- **Xclusive Oman** is a B2B travel company for Oman. Its **Agent Portal** is used by **travel agencies** (mostly India-based) to book Oman travel for their customers.
- The **Visa System** lets an agent apply for **Oman visas** for one or more travellers in a single **application**. The agent does this on the customer's behalf.
- **Agents (agency users)** apply, upload documents, pay and track.
- **Xclusive Oman staff** (ops/super admins, and finance for payments) review, process and upload the issued visas.
- The traveller does not use the portal directly. Everything goes through their agent.
- **Currency:** prices are in **OMR** (Omani Rial), with an approximate **INR** amount shown beside them.

## 2. Key terms

| Term | Meaning |
|---|---|
| **Visa package** | A visa option the admin creates. Every package has four required facts: **Duration**, **Entry type**, **Valid for**, **Maximum stay**. |
| **Duration** | The length of the visa, as the admin labels the package (e.g. 10 / 30 / 90 days, shown as "10 Days", "6 Months", "1 Year"). |
| **Entry type** | Single-Entry, Double-Entry, Multiple-Entry, or a custom label the admin sets (e.g. "Transit"). |
| **Valid for** | How many days the visa can be used within (e.g. 50 / 70 / 90 days). |
| **Maximum stay** | The longest single stay allowed per visit (e.g. 5 / 10 days). |
| **Application** | One visa request covering 1–20 travellers on the **same** visa package. |
| **Traveller (applicant)** | One person on an application. Each traveller needs a name, a photo and a passport. |
| **Visa fee** | One price **per traveller**, the **same for every visa package**. The admin sets it in Payments → Package Controller → Visa. Total = fee × number of travellers. |

## 3. Where things are in the portal

**Agent sidebar → "Visa Hub":**
- **Apply for Visa** — the main page:
  - A hero banner.
  - The visa package cards.
  - A sticky booking card showing the price per traveller, the traveller counter, the total and "Fill details".
  - "Process and documents", "Benefits included with your visa", and the "One visa, every city" carousel.
- **Track Applications** — every application of the agency, with live status, filters and search.

**Admin sidebar → "Visa Administration":**
- **Application Tracker** — every paid request, with filters for agent, days and status. Includes an agency view and per-request pages where visas are uploaded.
- **Visa Packages** — create and edit the packages, and set the one **Hero Image** for the agent Apply for Visa page.

## 4. The agent's application flow (5 steps)

The step bar shows: **1 Choose visa → 2 Traveller names → 3 Photos → 4 Passports → 5 Payment.**
- An application is saved as a **draft** from step 1.
- The agent can leave and come back. **Track Applications** shows the first unfinished step and a "Continue" button.

### Step 1 — Choose visa
1. The agent picks one of the active visa packages. Each card shows the duration, entry type, valid for, maximum stay and price.
2. The agent sets **how many travellers** (1–20).
3. The agent starts the application in one of two ways:
   - **"Fill details"** on the booking card, or
   - **"Apply for Visa"** on any package card, which starts straight away with that package.
4. If only one package exists, it's preselected.
5. If no packages exist, the page shows "No visas available yet" with a Contact support button.
6. The chosen package's details are **copied onto the application**. If the admin later edits or deletes the package, existing applications don't change.

### Step 2 — Traveller names
- Enter each traveller's **full name exactly as printed on the passport**.
- **Allowed characters:** letters, spaces, `.`, `'` and `-`. Names must be at least 2 characters long.
- The agent can add or remove travellers here, up to 20 in total.

### Step 3 — Photos (one per traveller)
There are two ways to provide a photo.

**A) Guided camera scan (recommended)**
- The webcam or phone camera opens with an **oval face guide**. The preview is mirrored like a selfie.
- The photo has passport proportions (35 × 45 mm, a 7:9 crop). What the agent sees in the oval is exactly what is uploaded.
- **Live checks** run in the browser, in this order:
  1. Face detected
  2. Centred in the oval
  3. Right distance (head about 45–72% of the photo height)
  4. Looking straight (head not tilted more than 8°)
  5. Eyes open
  6. Good lighting
  7. Sharp & clear — no fixed percentage: the picture must be above a low blur floor (15) and close to the sharpest this camera has shown in the last 3 seconds (settled focus, no movement), so ordinary laptop webcams pass
- The scan shows on-screen directions such as "move back" or "move to your left".
- When **all checks are green**, a **4-second hold** starts and a progress ring fills.
- The traveller must stay still with every check green for the full 4 seconds. Then the photo is **captured automatically**.
- A natural blink doesn't restart the countdown, but a photo is never taken with the eyes closed.
- If any check turns red, or the face moves, the countdown restarts.
- **Camera access:** the browser must be allowed to use the camera. If the camera is blocked or unavailable, the agent can use Upload instead.

**B) Upload a photo**
- **Formats:** JPG, PNG or WebP. **Maximum size:** 10 MB.

**Server checks (applied to both methods)**
- The server re-checks every photo; it never relies on the browser's checks alone.
- **Image checks (always):**
  - Resolution at least **480 × 600 px**
  - Sharpness above a low floor (**15**) — only photos too blurred to make out the face are refused
  - Brightness within range (not too dark, not overexposed)
- **AI checks:**
  - Exactly one face
  - Face centred
  - Looking straight at the camera
  - Eyes open
  - Full face visible
  - Nothing covering the face (no sunglasses or hat)
  - Even lighting
  - Facial details clear (AI score **50+**: eyes, nose and mouth can be made out)

**Results**

| Result | Meaning |
|---|---|
| **Approved** | Every check passed. |
| **Needs review** | The image checks passed but the AI check couldn't run. The photo is saved and staff check it by eye. |
| **Rejected** | A check failed. Nothing is saved; the agent sees which check failed and retakes or replaces the photo. |

- The agent can **remove and retake** a photo while the application is still a draft.

### Step 4 — Passports (one per traveller)

**What to upload**
- **Front page:** the photo/data page, with the two code lines (MRZ) at the bottom.
- **Back page:** the address page.
- The upload screen shows an example of each page.
- The **front page slot** also accepts the **whole passport**: a multi-page PDF, or one photo of the open two-page spread. The system finds the front and back pages itself.
- **Formats:** JPG, PNG, WebP or PDF.
  - Up to **25 MB per file** in the browser. PDFs are turned into page images before upload.
  - At most **20 pages** in total. For long PDFs only the first and last pages are sent, because that's where the data and address pages are.

**How the scan works**
- Scanning **starts automatically** when a page is added; there's no scan button.
- If the back page wasn't found, its slot is highlighted for the agent to add. The back page can also be skipped.
- **Two readers run side by side:**
  1. **MRZ reader (on our server):** reads the two code lines and verifies them with the official check digits. A verified MRZ is the trusted source for surname, given names, passport number, nationality, date of birth, sex, expiry date and issuing country.
  2. **AI reader:** identifies each page and reads what the MRZ doesn't hold: place of birth, place of issue, date of issue, and the back page fields.
- **Automatic checks:**
  - MRZ check digits
  - Printed fields compared with the MRZ
  - **Passport must be valid for at least 6 months from today**
  - Passport name compared with the name typed in step 2

**Scan results**

| Result | Meaning |
|---|---|
| **Scanned** | All hard checks passed. |
| **Needs review** | A hard check failed, or the AI reader couldn't run. The agent fills in or fixes the details by hand. |
| **Rejected** | No passport data page was found. Nothing is saved; the agent uploads again. |

**Review and confirm the details**
- The agent then checks every field and corrects it if needed:
  - Fields the scan was unsure about carry a **warning**.
  - Fields taken from the verified MRZ are **marked**.
- **Fields:**
  - **Front page:**
    - Document type
    - Issuing country
    - Passport number (5–12 letters or digits)
    - Surname
    - Given names
    - Nationality
    - Sex (M / F / X)
    - Date of birth
    - Place of birth
    - Place of issue
    - Date of issue
    - Date of expiry
  - **Back page:**
    - Father's name
    - Mother's name
    - Spouse's name
    - Address
    - File number
    - Old passport number
- **Required:** passport number, surname, nationality, sex, date of birth and date of expiry.
- If the passport name differs from the typed name, the agent can choose to **use the passport's name** for the traveller.
- Saving runs the checks again on the server and marks the passport **confirmed**.
- While the application is a draft, the agent can delete the passport and upload it again.

### Step 5 — Payment (submits the application)
- Payment opens only when **every traveller** has a name, a photo and a confirmed passport.
- **Amount** = visa fee per traveller × number of travellers. The server calculates it.
- **Option 1 — Card (Cashfree):**
  - The agent is redirected to Cashfree's secure checkout. It accepts **card, UPI or net banking**.
  - After paying, the agent returns to the portal, and the server confirms the payment with Cashfree.
  - A confirmed payment **submits the application immediately**.
- **Option 2 — NEFT bank transfer:**
  - The agent transfers the money to the bank account shown on the page.
  - The agent then enters the **transfer reference (UTR) number** and uploads the **transfer slip** (JPG, PNG, WebP or PDF, up to 10 MB).
  - Status becomes **"Payment in review"** until finance verifies the slip:
    - If finance **confirms** it, the application is submitted.
    - If finance **rejects** it, a reason is given and the agent can pay again.
- **After paying, or while an NEFT slip is in review, the travellers are locked.** Names, photos and passports can no longer be changed.

## 5. After submission — processing and getting the visa

1. **Submitted · paid** — Xclusive Oman staff receive the request.
2. **In process** — staff start working on it.
3. For **each traveller**, staff either:
   - **issue the visa:** upload the visa file (PDF, JPG, PNG or WebP, up to 10 MB) with an optional **visa number** and **valid-until date**, or
   - **refuse the visa**, with a reason.
   Staff can also refuse all remaining travellers at once, with a reason.
4. The application then settles automatically:
   - **Visas issued** — every traveller has a decision and at least one visa was issued.
   - **Refused** — every traveller was refused.
   - It stays **In process** while any traveller is still pending.
5. **Agent sees it:**
   - **Track Applications** and the application's detail page show the status, a timeline, and each traveller's visa status (Visa in process / Visa issued / Visa refused).
   - Each issued visa has a **Download visa** button.
   - Refusals show the reason.
6. **Notifications:**
   - The agent gets an **in-portal notification and an email** when visas are ready, or when a request is refused.
   - Admins are notified of new paid requests and of NEFT slips to verify.
7. If staff remove an uploaded visa, that traveller goes back to "in process".

## 6. Application statuses

| Status shown | Meaning |
|---|---|
| Names pending / Photos pending / Passports pending | Draft; this is the first unfinished step. |
| Ready to pay | Draft; everything is complete and only payment remains. |
| Payment in review | An NEFT slip is waiting for finance to verify it. Travellers are locked. |
| Submitted · paid | Paid; waiting for staff to start. |
| In process | Staff are working on it. |
| Visas issued | Done; at least one visa issued, every traveller decided. |
| Refused | Every traveller was refused (with a reason). |
| Cancelled | Closed. |

## 7. Track Applications (agent)

- Shows every visa application of the **agency**, not just the agent's own.
- Each application shows **"Applied by"** (the agent who started it). An **"Only mine"** filter shows just the agent's own.
- Each row shows progress per step (names / photos / passports done of total), status, travellers, date, and visas issued.
- Filters and search are available, including search by traveller name.
- Visa fee payments also appear in the agent's **Payment & Transaction History**, linked to the visa application.

## 8. Admin side (for context)

- **Application Tracker:** every paid request, filterable by agent, days and status. Includes an agency view with delivered vs pending counts per agency.
- **Request page:**
  - Traveller cards with photo, passport images and extracted details, plus a passport expiry warning.
  - A timeline of events.
  - Actions: start processing, upload a visa per traveller, refuse per traveller, refuse the remaining travellers.
- **Visa Packages:**
  - Create packages with preset or custom values for Duration, Entry type, Valid for and Maximum stay. Every field is required.
  - Mark a package active or inactive; inactive packages are hidden from agents.
  - Upload the single **Hero Image** shown on the agent Apply for Visa page.
- **Revenue, Transaction Ledger and NEFT Verification** include visa fees.

## 9. Limits at a glance

| Item | Limit |
|---|---|
| Travellers per application | 1–20 |
| Traveller name | 2–200 characters; letters, spaces, `. ' -` |
| Photo upload | JPG / PNG / WebP, ≤ 10 MB, ≥ 480 × 600 px, not blurred (sharpness ≥ 15) |
| Camera scan hold | 4 seconds with all checks green |
| Passport files | JPG / PNG / WebP / PDF; ≤ 25 MB per file (browser), ≤ 20 pages |
| Passport validity | ≥ 6 months from today |
| Passport number | 5–12 letters or digits |
| NEFT slip / issued visa file | JPG / PNG / WebP / PDF, ≤ 10 MB |
| Visa fee | One price per traveller for every visa package (OMR) |

## 10. Benefits shown to agents (and what is true)

- **Automatic photo check:** every photo is checked against visa photo rules before submission.
- **Passport scan & auto-fill:** details are read from the scan; the agent reviews and confirms them.
- **Live tracking & alerts:** status for every application, plus a notification and email when visas are issued or refused.
- **Visas delivered to your portal:** each traveller's visa file, visa number and validity are available to download.
- **"One visa, every city":** the visa covers travel across all of Oman. The carousel shows Muscat (Grand Mosque, Mutrah Corniche, Al Alam Palace, Old Muscat), Wadi Shab, Jebel Shams, Jebel Akhdar, Wahiba Sands, Musandam and Salalah.

## 11. Suggested FAQ topics

Write for **travel agents**: short, plain answers in a friendly, professional tone, with OMR amounts.

**Getting started**
- Which visa should I choose?
- What do duration, valid for and maximum stay mean?
- Can I apply for several travellers at once?
- Can different travellers get different visas? (No — one package per application; start a separate application.)

**Documents and photos**
- What documents are needed? (Passport and a photo per traveller.)
- How do I take a good visa photo?
- Why was my photo rejected?
- My camera isn't working — what can I do? (Allow camera access, or use Upload.)
- Which passport pages do I upload?
- Can I upload a PDF of the whole passport?
- The scan read a detail wrong — how do I fix it?
- My passport expires soon — can I still apply? (It must be valid for 6+ months.)
- The name on the passport doesn't match what I typed.

**Payment**
- How much does it cost?
- Which payment methods are accepted?
- How long does NEFT verification take? (Don't give a time — say finance verifies it and the agent is notified.)
- My card payment went through but the status hasn't changed.

**After submitting**
- Can I edit travellers after paying? (No — they're locked.)
- How do I track my application?
- How will I know when the visa is ready?
- Where do I download the visa?
- What happens if a visa is refused?
- Can I see applications made by other agents in my agency?
- Can I save and finish later? (Yes — drafts are kept; use Continue.)

## 12. Do not claim (not offered or not confirmed)

Do **not** state or promise any of the following:
- **Processing times** or a guaranteed delivery date. No processing time is set per visa.
- **Refunds:** the refund policy for visa fees isn't defined in the visa flow. Point to support or the Refund Policy page.
- **Approval guarantees** or "risk-free" promises. Visas can be refused.
- **Government authorisation** or official partnership claims.
- **Travel perks:** passport-loss protection, airport fast-track, emergency hotline, on-call doctor, or insurance.
- **Different prices per package.** There is one price per traveller for every package.
- **Visa-on-arrival or nationality-specific eligibility rules.** Not handled by the portal.
- **NEFT bank account details.** The ones in the UI are **placeholders** (Bank Muscat · A/C 0123456789 · BMUSOMRXXXX). Confirm the real account with the business before publishing.
- **A phone or WhatsApp number.** None is configured; use "Contact & Support" in the portal.
