// Visa FAQs shown at the bottom of the agent Apply for Visa page
// (VisaFaq.jsx). Written from VISA_SYSTEM_BRIEF.md (repo root) — keep the
// two in step: answer only what the portal actually does, and never promise
// processing times, refunds or approvals.
//
// Each answer is a list of blocks: a string is a paragraph, { list: [...] }
// a bulleted list. **text** renders bold (e.g. "**Front Page:** …").

export const FAQ_CATEGORIES = [
  { key: 'start', label: 'Getting started' },
  { key: 'fees', label: 'Fees & payments' },
  { key: 'photos', label: 'Travellers & photos' },
  { key: 'passports', label: 'Passports' },
  { key: 'tracking', label: 'Tracking & status' },
  { key: 'delivery', label: 'Processing & delivery' },
  { key: 'general', label: 'General & support' },
];

export const VISA_FAQS = [
  // ── 1. Getting started & visa selection ─────────────────────────────
  {
    category: 'start',
    q: 'Who can apply for an Oman visa through the portal?',
    a: [
      'Travel agents can apply for Oman visas on behalf of their customers through the Xclusive Oman Agent Portal. Travellers do not access the portal directly.',
    ],
  },
  {
    category: 'start',
    q: 'How do I choose the right visa package?',
    a: [
      'Go to **Visa Hub → Apply for Visa**. Compare the available visa packages by duration, entry type, validity period and maximum stay, then select the one that fits your travellers.',
    ],
  },
  {
    category: 'start',
    q: 'What is the difference between Duration, Valid For and Maximum Stay?',
    a: [
      {
        list: [
          '**Duration:** The length of the visa package, such as 10 days, 30 days or 1 year.',
          '**Valid For:** The number of days within which the visa can be used.',
          '**Maximum Stay:** The maximum number of days a traveller can stay per visit.',
        ],
      },
    ],
  },
  {
    category: 'start',
    q: 'What does Entry Type mean?',
    a: [
      'Entry Type tells you how many entries a visa package allows: Single-Entry, Double-Entry, Multiple-Entry, or a custom entry type set by Xclusive Oman.',
    ],
  },
  {
    category: 'start',
    q: 'Can I apply for multiple travellers in one application?',
    a: ['Yes. You can include between **1 and 20 travellers** in a single application.'],
  },
  {
    category: 'start',
    q: 'Can I select different visa packages for different travellers in one application?',
    a: [
      'No. All travellers in an application use the same visa package. To apply for different visa packages, create a separate application for each.',
    ],
  },
  {
    category: 'start',
    q: 'Can I save my visa application and complete it later?',
    a: [
      'Yes. Your application is saved as a draft automatically from the first step. Come back any time through **Track Applications** and use **Continue** to pick up where you left off.',
    ],
  },
  {
    category: 'start',
    q: 'What happens if only one visa package is available?',
    a: ['If only one active visa package is available, it is selected for you automatically.'],
  },
  {
    category: 'start',
    q: 'What should I do if no visa packages are available?',
    a: [
      'The Apply for Visa page will show that no visas are currently available. Use **Contact & Support** in the portal for assistance.',
    ],
  },

  // ── 2. Visa fees & payments ────────────────────────────────────────
  {
    category: 'fees',
    q: 'How much does an Oman visa cost?',
    a: [
      'The visa fee is charged **per traveller** and is the same for every visa package.',
      'The total is the per-traveller fee multiplied by the number of travellers. Prices are shown in OMR, with an approximate INR equivalent.',
    ],
  },
  {
    category: 'fees',
    q: 'What payment methods are available?',
    a: [
      'You can pay using either of these methods:',
      {
        list: [
          "**Online payment:** Credit/debit card, UPI or net banking through Cashfree's secure checkout.",
          '**NEFT bank transfer:** Transfer the amount to the bank account shown in the portal, then submit the transfer reference (UTR) number with the payment slip.',
        ],
      },
    ],
  },
  {
    category: 'fees',
    q: 'What happens after I complete an online card payment?',
    a: [
      'After paying through Cashfree, you are brought back to the Agent Portal. The payment is verified with Cashfree and, once confirmed, your visa application is submitted immediately.',
    ],
  },
  {
    category: 'fees',
    q: 'How do I submit payment through NEFT?',
    a: [
      'Transfer the amount to the bank account shown on the payment page. Then enter the **UTR number** and upload the **transfer slip** (JPG, PNG, WebP or PDF, up to 10 MB).',
      'Your application shows **Payment in Review** until the finance team verifies it.',
    ],
  },
  {
    category: 'fees',
    q: 'How long does NEFT payment verification take?',
    a: [
      'Your NEFT payment stays under review until the finance team verifies the transfer slip. You will be notified once a decision is made.',
    ],
  },
  {
    category: 'fees',
    q: 'What happens if my NEFT payment is rejected?',
    a: ['If the finance team rejects your payment slip, the reason is shown and you can make the payment again.'],
  },
  {
    category: 'fees',
    q: 'Can I edit traveller details after making payment?',
    a: [
      'No. Once payment is completed, traveller names, photos and passport details are locked. They are also locked while an NEFT payment slip is awaiting verification.',
    ],
  },
  {
    category: 'fees',
    q: 'My card payment was successful, but my application status has not changed. What should I do?',
    a: [
      'Online payments are confirmed with Cashfree before an application is submitted, which can take a short while. If the status still does not reflect your payment, contact support through the Agent Portal.',
    ],
  },

  // ── 3. Traveller details & photos ──────────────────────────────────
  {
    category: 'photos',
    q: 'What details are required for each traveller?',
    a: ['Each traveller needs a full name exactly as printed on their passport, one photograph and one confirmed passport.'],
  },
  {
    category: 'photos',
    q: "How should I enter a traveller's name?",
    a: [
      'Enter the full name **exactly as printed on the passport**. Names can be 2–200 characters long and may include letters, spaces, full stops, apostrophes and hyphens.',
    ],
  },
  {
    category: 'photos',
    q: "How can I add a traveller's visa photograph?",
    a: [
      'You can provide a photograph in either of these ways:',
      {
        list: [
          '**Guided camera scan:** Use your webcam or phone camera with the on-screen face guide. The photo is captured automatically once every check is green and the traveller holds still for four seconds.',
          '**Upload photo:** Select an existing photograph from your device.',
        ],
      },
    ],
  },
  {
    category: 'photos',
    q: 'What are the requirements for a visa photograph?',
    a: [
      'The photograph should meet these requirements:',
      {
        list: [
          'JPG, PNG or WebP format, up to 10 MB.',
          'Minimum resolution of 480 × 600 pixels.',
          'Only one face, centred and looking straight at the camera.',
          'Eyes open and the full face visible.',
          'Clear facial details and good, even lighting.',
          'No sunglasses or hats covering the face.',
        ],
      },
      'The camera scan captures the photo in passport-photo proportions (35 × 45 mm) for you.',
    ],
  },
  {
    category: 'photos',
    q: "Why was my traveller's photograph rejected?",
    a: [
      'A photograph is rejected when it does not meet the requirements. Common reasons include:',
      {
        list: [
          'Face not detected or not centred.',
          'Face tilted or looking away from the camera.',
          'Eyes closed.',
          'Poor lighting.',
          'Blurry or unclear facial details.',
          'Face partly covered.',
          'Resolution too low.',
        ],
      },
      'The failed check is shown so you can retake or replace the photograph.',
    ],
  },
  {
    category: 'photos',
    q: 'What does Needs Review mean for a photograph?',
    a: [
      'Needs Review means the image checks passed, but the AI verification could not run. The photograph is saved and Xclusive Oman staff will review it manually.',
    ],
  },
  {
    category: 'photos',
    q: 'My camera is not working. Can I upload a photograph instead?',
    a: [
      'Yes. First check that your browser has permission to use the camera. If the camera is blocked or unavailable, use the **Upload** option to add the photograph instead.',
    ],
  },
  {
    category: 'photos',
    q: 'Can I replace a photograph after uploading it?',
    a: ["Yes. You can remove and retake or replace a traveller's photograph while the application is still a draft."],
  },

  // ── 4. Passport upload & verification ──────────────────────────────
  {
    category: 'passports',
    q: 'Which passport pages do I need to upload?',
    a: [
      'You should provide:',
      {
        list: [
          '**Front page:** The photo and personal details page, with the two machine-readable code lines (MRZ) at the bottom.',
          '**Back page:** The passport address page.',
        ],
      },
      'The upload screen shows an example of both pages.',
    ],
  },
  {
    category: 'passports',
    q: 'Can I upload the entire passport as a PDF?',
    a: [
      'Yes. Add a multi-page passport PDF, or a photo of the open two-page spread, in the front-page slot. The system finds the front and back pages automatically.',
    ],
  },
  {
    category: 'passports',
    q: 'What passport file formats are supported?',
    a: ['JPG, PNG, WebP and PDF. Each file can be up to 25 MB, with at most 20 pages in total.'],
  },
  {
    category: 'passports',
    q: 'Does passport scanning start automatically?',
    a: ['Yes. Scanning starts as soon as you add a passport page — there is no separate scan button.'],
  },
  {
    category: 'passports',
    q: 'What information is extracted during passport scanning?',
    a: [
      'Two readers work together:',
      {
        list: [
          '**MRZ reader:** Reads and verifies the machine-readable code lines for the passport number, name, nationality, date of birth, sex, expiry date and issuing country.',
          '**AI reader:** Identifies the passport pages and reads the rest — place of birth, place of issue, date of issue and the back-page details.',
        ],
      },
    ],
  },
  {
    category: 'passports',
    q: 'What does Needs Review mean for a passport?',
    a: [
      'Needs Review means a passport check failed or the AI reader could not finish. Review the details and correct them by hand before confirming the passport.',
    ],
  },
  {
    category: 'passports',
    q: 'What happens if the passport scan extracts incorrect information?',
    a: [
      'You can review every extracted detail and correct anything that is wrong. Fields that need attention carry a warning, and details verified from the MRZ are marked. Saving runs the checks again.',
    ],
  },
  {
    category: 'passports',
    q: 'How much validity should remain on a passport?',
    a: ['The passport must be valid for **at least six months** from today.'],
  },
  {
    category: 'passports',
    q: 'What if the name entered in Traveller Details does not match the passport?',
    a: ['You can choose to use the name printed on the passport for that traveller.'],
  },
  {
    category: 'passports',
    q: 'Which passport details are mandatory?',
    a: [
      'These fields are required:',
      { list: ['Passport number', 'Surname', 'Nationality', 'Sex', 'Date of birth', 'Date of expiry'] },
      'The passport number must be 5–12 letters or digits.',
    ],
  },
  {
    category: 'passports',
    q: 'Can I upload a passport again if I make a mistake?',
    a: ['Yes. While the application is still a draft, you can delete the uploaded passport and upload it again.'],
  },

  // ── 5. Application tracking & status ───────────────────────────────
  {
    category: 'tracking',
    q: 'How can I track my visa application?',
    a: [
      "Go to **Visa Hub → Track Applications** to see your agency's applications, their current status and progress, and open any application for full details.",
    ],
  },
  {
    category: 'tracking',
    q: 'What do the different visa application statuses mean?',
    a: [
      {
        list: [
          '**Names Pending:** Traveller names are not complete yet.',
          '**Photos Pending:** Traveller photographs are still needed.',
          '**Passports Pending:** Passport uploads or confirmations are incomplete.',
          '**Ready to Pay:** Everything is complete and only payment remains.',
          '**Payment in Review:** An NEFT payment slip is awaiting verification.',
          '**Submitted · Paid:** Payment is confirmed and the application is waiting for processing to begin.',
          '**In Process:** Xclusive Oman staff are processing the application.',
          '**Visas Issued:** Every traveller has a decision and at least one visa has been issued.',
          '**Refused:** Every traveller in the application has been refused.',
          '**Cancelled:** The application has been closed.',
        ],
      },
    ],
  },
  {
    category: 'tracking',
    q: 'Can I see applications created by other agents in my agency?',
    a: [
      "Yes. Track Applications shows every visa application of your agency, including other agents'. Use the **Only mine** filter to see just the ones you started.",
    ],
  },
  {
    category: 'tracking',
    q: 'Can I see who created a visa application?',
    a: ['Yes. Each application shows **Applied by** with the agent who started it.'],
  },
  {
    category: 'tracking',
    q: 'Will I receive a notification when the visa is ready?',
    a: ['Yes. You get both an in-portal notification and an email when visas are ready, or when an application is refused.'],
  },

  // ── 6. Visa processing & delivery ──────────────────────────────────
  {
    category: 'delivery',
    q: 'What happens after my visa application is submitted?',
    a: [
      'Once payment is confirmed, Xclusive Oman staff receive your application. Its status changes to **In Process** when they start working on it.',
    ],
  },
  {
    category: 'delivery',
    q: 'How long does visa processing take?',
    a: ['Processing times are not specified in the portal. You can follow your application at any time in Track Applications.'],
  },
  {
    category: 'delivery',
    q: 'Can a visa application be refused?',
    a: [
      'Yes. Staff issue or refuse a visa for each traveller. If a visa is refused, the reason is shown in the application details.',
    ],
  },
  {
    category: 'delivery',
    q: 'What happens if only some travellers receive their visas?',
    a: [
      'The application stays **In Process** while any traveller is still awaiting a decision. Once every traveller has a decision and at least one visa has been issued, it becomes **Visas Issued**.',
    ],
  },
  {
    category: 'delivery',
    q: 'Where can I download the issued visa?',
    a: [
      'Open the application from **Track Applications**. Each issued visa has its own **Download visa** button on the application details page.',
    ],
  },
  {
    category: 'delivery',
    q: 'Can I see the visa number and validity details?',
    a: [
      'Yes. When staff upload an issued visa, they can add the visa number and a valid-until date. These are shown with the visa in the application.',
    ],
  },
  {
    category: 'delivery',
    q: 'What happens if an uploaded visa is removed by the processing team?',
    a: ["That traveller's visa status goes back to **In Process**."],
  },

  // ── 7. General information & support ──────────────────────────────
  {
    category: 'general',
    q: 'Can I use the visa to visit different cities in Oman?',
    a: [
      'Yes. The visa covers travel across all of Oman, including Muscat, Wadi Shab, Jebel Shams, Jebel Akhdar, Wahiba Sands, Musandam and Salalah.',
    ],
  },
  {
    category: 'general',
    q: 'What benefits are available through the Visa System?',
    a: [
      {
        list: [
          'Automatic photograph checks.',
          'Passport scanning and automatic detail extraction.',
          'Live application tracking and notifications.',
          'Downloadable issued visas.',
          'One application for up to 20 travellers.',
        ],
      },
    ],
  },
  {
    category: 'general',
    q: 'Are visa approvals guaranteed?',
    a: ['No. Visa applications can be refused during processing. The decision and any reason for refusal are shown in the application details.'],
  },
  {
    category: 'general',
    q: 'What is the refund policy for visa payments?',
    a: ['Please refer to the Refund Policy, or contact support through the Agent Portal for help with a specific payment.'],
  },
  {
    category: 'general',
    q: 'Are nationality-specific visa eligibility rules available in the portal?',
    a: ['Nationality-specific eligibility rules are not handled in the portal. Please contact support for help with a specific case.'],
  },
  {
    category: 'general',
    q: 'How can I contact Xclusive Oman support?',
    a: ['Use **Contact & Support** in the Agent Portal for help with visa applications, documents, payments and anything else.'],
  },
];
