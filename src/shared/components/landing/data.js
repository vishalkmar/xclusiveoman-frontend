// Placeholder content for the public marketing LandingPage (src/App.jsx "/").
// Every image reference below is the one photo the repo already ships
// (public/oman_pic.jpg — a Muscat coastline shot, used as-is for the hero and
// the "We Operate" banner) or a gradient placeholder (cardGradient, per
// TourCard) standing in for real per-tour photography. Swap both once actual
// marketing assets exist; nothing about the component structure needs to
// change to do that — every image lives in this one file.

export const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Activities', href: '/#activities' },
  { label: 'Tours', href: '/#tours' },
  { label: 'Transfers', href: '/#transfers' },
  { label: 'Gallery', href: '/gallery' },
];

export const GALLERY_CATEGORIES = [
  {
    key: 'events',
    label: 'Events',
    heroImage: '/We_Operate_Section.png',
    eyebrow: 'Xclusive Oman Events',
    description: 'Memorable gatherings, conferences and partner moments from across Oman.',
    images: ['/We_Operate_Section.png', '/activity_6.png', '/activity_4.png', '/activity_1.png', '/transfer_2.png', '/activity_5.png', '/travel_3.png', '/activity_2.png', '/travel_1.png'],
  },
  {
    key: 'tours',
    label: 'Tours',
    heroImage: '/oman_pic.jpg',
    eyebrow: 'Tours Gallery',
    description: 'Explore Oman together through coastlines, wadis, mountains and desert landscapes.',
    images: ['/oman_pic.jpg', '/travel_1.png', '/travel_2.png', '/salalah_image.jpg', '/activity_5.png', '/activity_3.png', '/HeroImage.png', '/travel_3.png', '/activity_6.png'],
  },
  {
    key: 'destinations',
    label: 'Destination Highlights',
    heroImage: '/HeroImage.png',
    eyebrow: 'Destination Highlights',
    description: 'The places, heritage and scenery that make Oman unforgettable.',
    images: ['/HeroImage.png', '/We_Operate_Section.png', '/salalah_image.jpg', '/oman_pic.jpg', '/activity_3.png', '/travel_2.png', '/activity_4.png', '/travel_1.png', '/transfer_2.png'],
  },
];

export const LANDING_IMAGE_SECTIONS = [
  { key: 'landing-hero', label: 'Landing Page Hero', description: 'Main image displayed behind the landing page headline.', heroOnly: true },
];

export const HERO_STATS = [
  { value: '6+ yrs', label: 'Ground Operations in Oman' },
  { value: '40+', label: 'Trade Partners Served Monthly' },
  { value: '24/7', label: 'On-Ground Op Support' },
];

// Signature Tours cards use real photos (reusing what's already in
// /public — see the reference-matching pass on SignatureToursSection.jsx):
// We_Operate_Section.png for the Grand Mosque card, oman_pic.jpg for the two
// Nizwa cards. The reference screenshot itself repeats "Nizwa Heritage
// Trail" for both the 1st and 3rd card (same photo, same copy, same
// badge) — reproduced as-is rather than diversified, since the brief was
// to match the reference exactly, not improve on it.
export const SIGNATURE_TOURS = [
  {
    title: 'Nizwa Heritage Trail',
    description:
      "The 17th-century Nizwa Fort, the Friday goat souq, and the terraced date plantations of Oman's former capital.",
    duration: 'Full Day Tour',
    nights: '4N | 5D',
    image: '/oman_pic.jpg',
  },
  {
    title: 'Muscat City & Grand Mosque',
    description:
      'Sultan Qaboos Grand Mosque, Al Alam Palace, Mutrah Souq and the corniche — the essential half-day introduction to the capital.',
    duration: 'Full Day Tour',
    nights: '4N | 5D',
    image: '/We_Operate_Section.png',
  },
  {
    title: 'Salalah Escape',
    description:
      'Explore Salalah’s lush landscapes, stunning beaches, frankincense heritage, and the natural beauty of southern Oman.',
    duration: 'Full Day Tours',
    nights: '4N | 5D',
    image: '/salalah_image.jpg',
  },
];

// Landing page photo cards (Signature Tours, Activities, Transfers) are
// editable from admin Gallery Management, one gallery item per card —
// category 'landing-tour-1'..'-3', 'landing-activity-1'..'-6' and
// 'landing-transfer-1'..'-2'. Any field left empty there falls back to the
// card's entry in SIGNATURE_TOURS / ACTIVITIES / TRANSFERS. `duration` is the
// type pill ("Full Day Tour", "2–3 Hours", "Point to Point"); `nights` is the
// Signature Tours "4N | 5D" badge.
export const SIGNATURE_TOUR_SLOT_KEYS = SIGNATURE_TOURS.map((_, i) => `landing-tour-${i + 1}`);

// `slot` is the card's own gallery item; `legacy` is the same-position item
// from the old shared list ('landing-tours' / 'landing-activities'), only
// used while the card has no slot yet, so images uploaded before per-card
// slots existed keep showing.
export function resolveLandingCard(fallback, slot, legacy) {
  const source = slot || legacy;
  return {
    ...fallback,
    title: source?.title || fallback.title,
    description: source?.description || fallback.description,
    duration: source?.duration || fallback.duration,
    nights: slot?.nights || fallback.nights,
    image: source?.imageUrl || fallback.image,
  };
}

export const resolveSignatureTour = resolveLandingCard;

export const ACTIVITIES = [
  {
    title: 'Dolphin Watching Cruise',
    description:
      'Enjoy a relaxing cruise along Muscat’s coastline with the opportunity to spot dolphins and experience Oman’s beautiful Arabian Sea waters.',
    duration: '2–3 Hours',
    image: '/activity_1.png',
  },
  {
    title: 'Wahiba Sands Desert Safari',
    description:
      'Experience the golden dunes of Oman with an exciting desert drive, stunning landscapes and a memorable Arabian sunset.',
    duration: 'Full Day',
    image: '/activity_2.png',
  },
  {
    title: 'Snorkeling & Marine Experience',
    description:
      'Discover Oman’s underwater world with crystal-clear waters, marine life and beautiful coastal surroundings.',
    duration: 'Half Day',
    image: '/activity_3.png',
  },
  {
    title: 'Jebel Akhdar Mountain Escape',
    description:
      'Explore the spectacular Al Hajar Mountains, traditional villages and the famous terraced landscapes of Jebel Akhdar.',
    duration: 'Full Day',
    image: '/activity_4.png',
  },
  {
    title: 'Wadi Adventure',
    description:
      'Discover Oman’s natural beauty through dramatic wadis, mountain landscapes and refreshing natural pools.',
    duration: 'Full Day',
    image: '/activity_5.png',
  },
  {
    title: 'Muscat Dhow Cruise',
    description:
      'Enjoy a traditional dhow cruise along Muscat’s coastline with beautiful views of the city and Arabian Sea.',
    duration: '2–3 Hours',
    image: '/activity_6.png',
  },
];

export const ACTIVITY_SLOT_KEYS = ACTIVITIES.map((_, i) => `landing-activity-${i + 1}`);

export const TRANSFERS = [
  {
    title: 'Airport Transfers',
    description: 'Meet-and-greet at Muscat International, private vehicle direct to any city hotel.',
    duration: 'Point to Point',
    price: 'From AED 45',
    gradient: 'from-[#2E5F63] to-[#16343A]',
    image: '/Transfer_1.png',
  },
  {
    title: 'Intercity Transfers',
    description: 'Private, air-conditioned transfers between Muscat, Nizwa, Salalah and the interior.',
    duration: 'Point to Point',
    price: 'From AED 180',
    gradient: 'from-[#B4552C] to-[#6E3319]',
    image: '/transfer_2.png',
  },
];

export const TRANSFER_SLOT_KEYS = TRANSFERS.map((_, i) => `landing-transfer-${i + 1}`);

export const FOOTER_LINKS = {
  itineraries: ['Nizwa Heritage Trail', 'Muscat City & Grand Mosque', 'Wahiba Sands Desert Safari', 'Wadi Shab Adventure'],
  partners: ['Sign Up For Trade Access', 'Log In', 'B2B Portal', 'Become a Partner'],
};

export const CONTACT = {
  address: '128-A, D-Mall, NSP, Delhi, India (110034)',
  phone: '+91 9540111307',
  email: 'xclusiveoman@gmail.com',
};
