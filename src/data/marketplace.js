// Eco Rewards Marketplace — data layer
// Platform fee: 5% of all points redemptions (deducted from merchant payout)
// Points conversion: 100 points = $5 AUD (1 pt = $0.05)

export const PTS_TO_AUD = 0.05   // 1 eco-point = $0.05 AUD
export const PLATFORM_FEE_PCT = 5

export function ptsToAUD(pts) { return (pts * PTS_TO_AUD).toFixed(2) }
export function audToPts(aud) { return Math.round(aud / PTS_TO_AUD) }

// ─── Merchants ────────────────────────────────────────────────────────────────

export const MERCHANTS = [
  {
    id: 'MRC-001', name: 'The Green Cycle', category: 'electronics',
    tagline: 'Certified refurbished electronics powered by recovered e-waste',
    sustainability_score: 94, verified: true, status: 'active', joined: '2025-09-14',
    logo_color: 'bg-eco-600', initials: 'GC', location: 'Sydney NSW',
    platform_fee_pct: 5, total_redemptions: 847, total_points_redeemed: 124_800,
    revenue_aud: 6_240, platform_fee_aud: 312,
    description: 'Every device we sell means one less in landfill. We source exclusively from EcoBin recovery partners.',
    certifications: ['Responsible Recycling R2', 'ISO 14001'],
    active_listings: 12, active_campaigns: 2,
  },
  {
    id: 'MRC-002', name: 'Biome', category: 'lifestyle',
    tagline: 'Australia\'s leading eco-home store — plastic-free guaranteed',
    sustainability_score: 91, verified: true, status: 'active', joined: '2025-10-02',
    logo_color: 'bg-teal-600', initials: 'BI', location: 'Brisbane QLD',
    platform_fee_pct: 5, total_redemptions: 1_204, total_points_redeemed: 96_320,
    revenue_aud: 4_816, platform_fee_aud: 240.80,
    description: 'Curated eco-home products. No single-use plastics — ever.',
    certifications: ['BCorp', '1% for the Planet'],
    active_listings: 28, active_campaigns: 3,
  },
  {
    id: 'MRC-003', name: 'Charged Earth Coffee', category: 'food',
    tagline: 'Carbon-neutral specialty coffee — roasted with renewable energy',
    sustainability_score: 86, verified: true, status: 'active', joined: '2025-11-15',
    logo_color: 'bg-amber-700', initials: 'CE', location: 'Melbourne VIC',
    platform_fee_pct: 5, total_redemptions: 3_140, total_points_redeemed: 78_500,
    revenue_aud: 3_925, platform_fee_aud: 196.25,
    description: 'Specialty coffee sourced from regenerative farms. 100% compostable packaging.',
    certifications: ['Carbon Neutral Certified', 'Rainforest Alliance'],
    active_listings: 8, active_campaigns: 1,
  },
  {
    id: 'MRC-004', name: 'Sun Rides', category: 'transport',
    tagline: 'E-bike & EV car share network — zero emissions, city-wide',
    sustainability_score: 97, verified: true, status: 'active', joined: '2025-08-22',
    logo_color: 'bg-yellow-500', initials: 'SR', location: 'Sydney NSW',
    platform_fee_pct: 5, total_redemptions: 612, total_points_redeemed: 55_080,
    revenue_aud: 2_754, platform_fee_aud: 137.70,
    description: 'Every ride offsets 1.2 kg of CO₂. Fleet charged exclusively from rooftop solar.',
    certifications: ['Carbon Neutral Certified', 'ISO 50001'],
    active_listings: 4, active_campaigns: 2,
  },
  {
    id: 'MRC-005', name: 'Loop Store', category: 'home',
    tagline: 'Zero-waste refill — bring your own container',
    sustainability_score: 99, verified: true, status: 'active', joined: '2025-12-01',
    logo_color: 'bg-eco-700', initials: 'LS', location: 'Melbourne VIC',
    platform_fee_pct: 5, total_redemptions: 2_088, total_points_redeemed: 83_520,
    revenue_aud: 4_176, platform_fee_aud: 208.80,
    description: 'Refill-only store. No packaging sold, ever. Bring your containers and fill up.',
    certifications: ['BCorp', 'Zero Waste Australia Certified'],
    active_listings: 16, active_campaigns: 2,
  },
  {
    id: 'MRC-006', name: 'ReThread', category: 'lifestyle',
    tagline: 'Premium secondhand fashion — authenticated, circular',
    sustainability_score: 88, verified: true, status: 'active', joined: '2026-01-10',
    logo_color: 'bg-purple-600', initials: 'RT', location: 'Sydney NSW',
    platform_fee_pct: 5, total_redemptions: 741, total_points_redeemed: 51_870,
    revenue_aud: 2_593.50, platform_fee_aud: 129.68,
    description: 'Authenticated pre-loved fashion. Every item extends garment life by 2+ years.',
    certifications: ['Fashion Revolution Verified', 'Textile Exchange'],
    active_listings: 34, active_campaigns: 1,
  },
  {
    id: 'MRC-007', name: 'SunPower Collective', category: 'home',
    tagline: 'Community solar — group-buy installs at wholesale pricing',
    sustainability_score: 96, verified: true, status: 'active', joined: '2026-02-14',
    logo_color: 'bg-orange-500', initials: 'SP', location: 'National',
    platform_fee_pct: 5, total_redemptions: 108, total_points_redeemed: 162_000,
    revenue_aud: 8_100, platform_fee_aud: 405,
    description: 'Pool your community\'s buying power for wholesale solar panel installs.',
    certifications: ['Clean Energy Council Accredited', 'CEC Designer'],
    active_listings: 3, active_campaigns: 1,
  },
  {
    id: 'MRC-008', name: 'Wholesome Pedal', category: 'food',
    tagline: 'Organic box delivery — zero-emission bicycle courier',
    sustainability_score: 93, verified: true, status: 'active', joined: '2026-03-05',
    logo_color: 'bg-lime-600', initials: 'WP', location: 'Sydney NSW',
    platform_fee_pct: 5, total_redemptions: 514, total_points_redeemed: 30_840,
    revenue_aud: 1_542, platform_fee_aud: 77.10,
    description: 'Organic seasonal produce delivered by cargo bike. Packaging 100% compostable.',
    certifications: ['ACO Certified Organic', 'Bicycle NSW'],
    active_listings: 6, active_campaigns: 2,
  },
  {
    id: 'MRC-009', name: 'GreenForce Solar', category: 'home',
    tagline: 'Affordable solar for renters and homeowners alike',
    sustainability_score: 89, verified: false, status: 'pending_approval', joined: '2026-05-20',
    logo_color: 'bg-yellow-600', initials: 'GF', location: 'Brisbane QLD',
    platform_fee_pct: 5, total_redemptions: 0, total_points_redeemed: 0,
    revenue_aud: 0, platform_fee_aud: 0,
    description: 'Renter-friendly solar subscription. No upfront costs.',
    certifications: ['Clean Energy Council Accredited'],
    active_listings: 0, active_campaigns: 0,
  },
  {
    id: 'MRC-010', name: 'EcoBox AU', category: 'home',
    tagline: 'Industrial and home compostable packaging',
    sustainability_score: 82, verified: false, status: 'pending_approval', joined: '2026-05-22',
    logo_color: 'bg-brown-600', initials: 'EB', location: 'Adelaide SA',
    platform_fee_pct: 5, total_redemptions: 0, total_points_redeemed: 0,
    revenue_aud: 0, platform_fee_aud: 0,
    description: 'Compostable mailers, boxes and void fill for businesses.',
    certifications: [],
    active_listings: 0, active_campaigns: 0,
  },
]

// ─── Listings ─────────────────────────────────────────────────────────────────
// type: product | voucher | experience | swap
// swap: special type — consumer sends e-waste, earns points credited immediately

export const LISTINGS = [
  // ── The Green Cycle — Electronics ──────────────────────────────────────
  {
    id: 'LST-0081', merchant_id: 'MRC-001', merchant_name: 'The Green Cycle',
    name: 'Certified Refurbished iPhone 14 — 128GB Midnight',
    type: 'product', points_cost: 7_980, aud_value: 399,
    stock: 3, redeemed_total: 28, category: 'electronics',
    sustainability_tag: 'refurbished', sustainability_score: 94,
    description: 'Grade A refurb. 12-month warranty, original cable, battery ≥88% health. Diverts 1 device from landfill.',
    badge: 'popular', expires: null, image_color: 'bg-slate-800',
  },
  {
    id: 'LST-0082', merchant_id: 'MRC-001', merchant_name: 'The Green Cycle',
    name: 'Refurbished MacBook Air M1 — 8GB / 256GB',
    type: 'product', points_cost: 17_980, aud_value: 899,
    stock: 1, redeemed_total: 6, category: 'electronics',
    sustainability_tag: 'refurbished', sustainability_score: 94,
    description: 'Grade B+ cosmetic, Grade A functional. Battery 91% health. Saves 170 kg CO₂ vs new.',
    badge: null, expires: null, image_color: 'bg-slate-700',
  },
  {
    id: 'LST-0083', merchant_id: 'MRC-001', merchant_name: 'The Green Cycle',
    name: 'E-Waste Swap Voucher — $50 Credit',
    type: 'swap', points_cost: 500, aud_value: 50,
    stock: 999, redeemed_total: 214, category: 'electronics',
    sustainability_tag: 'swap', sustainability_score: 94,
    description: 'Trade in any working or broken device. Earn $50 credit toward any Green Cycle product. We handle responsible recycling.',
    badge: 'swap', expires: null, image_color: 'bg-eco-700',
  },
  {
    id: 'LST-0084', merchant_id: 'MRC-001', merchant_name: 'The Green Cycle',
    name: 'Certified Refurbished Samsung Galaxy S23 — 256GB',
    type: 'product', points_cost: 6_980, aud_value: 349,
    stock: 5, redeemed_total: 41, category: 'electronics',
    sustainability_tag: 'refurbished', sustainability_score: 94,
    description: 'Grade A. 1 year warranty. 87% battery health. Saves 68 kg CO₂ vs new production.',
    badge: null, expires: null, image_color: 'bg-violet-800',
  },
  // ── Biome — Lifestyle ──────────────────────────────────────────────────
  {
    id: 'LST-0085', merchant_id: 'MRC-002', merchant_name: 'Biome',
    name: '$25 Biome Store Voucher',
    type: 'voucher', points_cost: 500, aud_value: 25,
    stock: 200, redeemed_total: 387, category: 'lifestyle',
    sustainability_tag: 'voucher', sustainability_score: 91,
    description: 'Redeemable in-store or online. No minimum spend. Valid 12 months.',
    badge: 'popular', expires: '2027-05-28', image_color: 'bg-teal-600',
  },
  {
    id: 'LST-0086', merchant_id: 'MRC-002', merchant_name: 'Biome',
    name: 'Plastic-Free Starter Kit — Home Bundle',
    type: 'product', points_cost: 1_200, aud_value: 60,
    stock: 42, redeemed_total: 98, category: 'lifestyle',
    sustainability_tag: 'plastic-free', sustainability_score: 91,
    description: 'Beeswax wraps, stainless straws, bamboo toothbrushes, shampoo bar. Eliminates 200+ single-use plastics per year.',
    badge: 'new', expires: null, image_color: 'bg-teal-500',
  },
  {
    id: 'LST-0087', merchant_id: 'MRC-002', merchant_name: 'Biome',
    name: '$10 Biome Gift Card',
    type: 'voucher', points_cost: 200, aud_value: 10,
    stock: 500, redeemed_total: 641, category: 'lifestyle',
    sustainability_tag: 'voucher', sustainability_score: 91,
    description: 'Perfect intro. Use online or in Brisbane flagship store.',
    badge: null, expires: '2027-05-28', image_color: 'bg-teal-600',
  },
  // ── Charged Earth Coffee — Food ────────────────────────────────────────
  {
    id: 'LST-0088', merchant_id: 'MRC-003', merchant_name: 'Charged Earth Coffee',
    name: 'Free Coffee Voucher — Any Size, Any Brew',
    type: 'voucher', points_cost: 60, aud_value: 6,
    stock: 999, redeemed_total: 1_840, category: 'food',
    sustainability_tag: 'carbon-neutral', sustainability_score: 86,
    description: 'Redeem at any Charged Earth location. Bring your own cup for +10 bonus points.',
    badge: 'popular', expires: '2026-08-31', image_color: 'bg-amber-700',
  },
  {
    id: 'LST-0089', merchant_id: 'MRC-003', merchant_name: 'Charged Earth Coffee',
    name: '1kg Single Origin Specialty Coffee Bag',
    type: 'product', points_cost: 800, aud_value: 40,
    stock: 60, redeemed_total: 122, category: 'food',
    sustainability_tag: 'regenerative-farm', sustainability_score: 86,
    description: 'Seasonal rotating origin. Roasted with 100% renewable energy. Compostsable packaging.',
    badge: null, expires: null, image_color: 'bg-amber-800',
  },
  {
    id: 'LST-0090', merchant_id: 'MRC-003', merchant_name: 'Charged Earth Coffee',
    name: '10-Coffee Loyalty Card',
    type: 'voucher', points_cost: 480, aud_value: 50,
    stock: 200, redeemed_total: 88, category: 'food',
    sustainability_tag: 'carbon-neutral', sustainability_score: 86,
    description: '10 free coffees of your choice. Valid 6 months. BYO cup earns extra points each visit.',
    badge: 'value', expires: '2026-11-30', image_color: 'bg-amber-600',
  },
  // ── Sun Rides — Transport ───────────────────────────────────────────────
  {
    id: 'LST-0091', merchant_id: 'MRC-004', merchant_name: 'Sun Rides',
    name: '1-Day E-Bike Pass — Unlimited City Access',
    type: 'experience', points_cost: 600, aud_value: 30,
    stock: 50, redeemed_total: 204, category: 'transport',
    sustainability_tag: 'zero-emission', sustainability_score: 97,
    description: 'Unlock any Sun Rides e-bike for a full day. Includes helmet and lock.',
    badge: 'popular', expires: null, image_color: 'bg-yellow-500',
  },
  {
    id: 'LST-0092', merchant_id: 'MRC-004', merchant_name: 'Sun Rides',
    name: 'Monthly E-Bike Subscription — Unlimited Rides',
    type: 'product', points_cost: 2_800, aud_value: 140,
    stock: 30, redeemed_total: 48, category: 'transport',
    sustainability_tag: 'zero-emission', sustainability_score: 97,
    description: 'One month of unlimited e-bike access across our Sydney network. Saves avg 28 kg CO₂ vs car.',
    badge: null, expires: null, image_color: 'bg-yellow-400',
  },
  {
    id: 'LST-0093', merchant_id: 'MRC-004', merchant_name: 'Sun Rides',
    name: 'EV Car Share — Weekend Booking ($80 value)',
    type: 'voucher', points_cost: 1_600, aud_value: 80,
    stock: 15, redeemed_total: 24, category: 'transport',
    sustainability_tag: 'zero-emission', sustainability_score: 97,
    description: 'Sat + Sun EV booking. Includes 300 km. Car returned fully charged.',
    badge: 'exclusive', expires: '2026-12-31', image_color: 'bg-yellow-600',
  },
  // ── Loop Store — Home ──────────────────────────────────────────────────
  {
    id: 'LST-0094', merchant_id: 'MRC-005', merchant_name: 'Loop Store',
    name: '$20 Loop Store Refill Credit',
    type: 'voucher', points_cost: 400, aud_value: 20,
    stock: 300, redeemed_total: 762, category: 'home',
    sustainability_tag: 'zero-waste', sustainability_score: 99,
    description: 'Use toward any refill: cleaning products, shampoo, conditioner, laundry. Zero packaging.',
    badge: 'popular', expires: '2027-05-28', image_color: 'bg-eco-700',
  },
  {
    id: 'LST-0095', merchant_id: 'MRC-005', merchant_name: 'Loop Store',
    name: 'Zero-Waste Home Starter Pack',
    type: 'product', points_cost: 1_400, aud_value: 70,
    stock: 25, redeemed_total: 61, category: 'home',
    sustainability_tag: 'zero-waste', sustainability_score: 99,
    description: 'Glass jars, mesh produce bags, compost bin, bamboo sponges, dish soap starter. Eliminate 340 items of plastic per year.',
    badge: 'new', expires: null, image_color: 'bg-eco-600',
  },
  // ── ReThread — Lifestyle ───────────────────────────────────────────────
  {
    id: 'LST-0096', merchant_id: 'MRC-006', merchant_name: 'ReThread',
    name: '$30 ReThread Voucher — Pre-loved Fashion',
    type: 'voucher', points_cost: 600, aud_value: 30,
    stock: 150, redeemed_total: 198, category: 'lifestyle',
    sustainability_tag: 'secondhand', sustainability_score: 88,
    description: 'Authenticated pre-loved items. Min $30 order. Saves avg 4 kg CO₂ per item vs new.',
    badge: null, expires: '2027-01-31', image_color: 'bg-purple-600',
  },
  // ── SunPower Collective — Home ─────────────────────────────────────────
  {
    id: 'LST-0097', merchant_id: 'MRC-007', merchant_name: 'SunPower Collective',
    name: 'Group Solar Install — $500 Credit',
    type: 'product', points_cost: 10_000, aud_value: 500,
    stock: 10, redeemed_total: 8, category: 'home',
    sustainability_tag: 'solar', sustainability_score: 96,
    description: 'Apply $500 toward a group solar install. Typically saves $1,200–$1,800 per year on electricity.',
    badge: 'exclusive', expires: null, image_color: 'bg-orange-500',
  },
  // ── Wholesome Pedal — Food ─────────────────────────────────────────────
  {
    id: 'LST-0098', merchant_id: 'MRC-008', merchant_name: 'Wholesome Pedal',
    name: 'Seasonal Organic Veggie Box — Small (4 serves)',
    type: 'product', points_cost: 480, aud_value: 24,
    stock: 40, redeemed_total: 184, category: 'food',
    sustainability_tag: 'organic', sustainability_score: 93,
    description: 'Delivered by cargo bike. 100% Australian certified organic. Seasonal varieties. Compostable packaging.',
    badge: 'popular', expires: null, image_color: 'bg-lime-600',
  },
  {
    id: 'LST-0099', merchant_id: 'MRC-008', merchant_name: 'Wholesome Pedal',
    name: '4-Week Organic Box Subscription',
    type: 'product', points_cost: 1_760, aud_value: 88,
    stock: 20, redeemed_total: 47, category: 'food',
    sustainability_tag: 'organic', sustainability_score: 93,
    description: 'Monthly subscription for 4 weekly organic deliveries. Save 10% vs single boxes.',
    badge: null, expires: null, image_color: 'bg-lime-500',
  },
]

// ─── Merchant Campaigns ───────────────────────────────────────────────────────
// type: points_multiplier | bonus_offer | exclusive_access | group_buy | swap_drive

export const MERCHANT_CAMPAIGNS = [
  {
    id: 'MCAM-0041', merchant_id: 'MRC-001', merchant_name: 'The Green Cycle',
    name: 'E-Waste Trade-In Bonus — Double Points',
    type: 'points_multiplier', status: 'active',
    description: 'Earn 2× points on all swap-type redemptions. Trade in old devices faster.',
    uplift_pct: 100, uplift_label: '2× Points',
    start_date: '2026-05-01', end_date: '2026-06-30',
    eligible_categories: ['electronics'], eligible_type: 'swap',
    redeemed_count: 142, points_awarded: 28_400,
    budget_pts: 100_000, spent_pts: 28_400,
  },
  {
    id: 'MCAM-0040', merchant_id: 'MRC-001', merchant_name: 'The Green Cycle',
    name: 'Refurb Phone Flash Sale — Extra 10% Off',
    type: 'bonus_offer', status: 'active',
    description: 'All refurbished phone listings discounted by 500 extra points this month.',
    uplift_pct: 0, uplift_label: '−500 pts',
    start_date: '2026-05-15', end_date: '2026-05-31',
    eligible_categories: ['electronics'], eligible_type: 'product',
    redeemed_count: 18, points_awarded: 0,
    budget_pts: 0, spent_pts: 0,
  },
  {
    id: 'MCAM-0039', merchant_id: 'MRC-002', merchant_name: 'Biome',
    name: 'Plastic-Free July Early Access',
    type: 'exclusive_access', status: 'scheduled',
    description: 'Silver+ members get 48-hour early access to Plastic-Free July collection.',
    uplift_pct: 0, uplift_label: 'Early Access',
    start_date: '2026-06-28', end_date: '2026-07-02',
    eligible_categories: ['lifestyle'], eligible_type: null,
    redeemed_count: 0, points_awarded: 0,
    budget_pts: 0, spent_pts: 0,
  },
  {
    id: 'MCAM-0038', merchant_id: 'MRC-002', merchant_name: 'Biome',
    name: 'Bundle & Save — 1.5× Points on Starter Kits',
    type: 'points_multiplier', status: 'active',
    description: 'Earn 1.5× points when you redeem the Plastic-Free Starter Kit.',
    uplift_pct: 50, uplift_label: '1.5× Points',
    start_date: '2026-05-01', end_date: '2026-05-31',
    eligible_categories: ['lifestyle'], eligible_type: 'product',
    redeemed_count: 41, points_awarded: 24_600,
    budget_pts: 50_000, spent_pts: 24_600,
  },
  {
    id: 'MCAM-0037', merchant_id: 'MRC-003', merchant_name: 'Charged Earth Coffee',
    name: 'BYO Cup Week — Triple Points',
    type: 'points_multiplier', status: 'active',
    description: 'Bring your own reusable cup to any Charged Earth location, earn 3× points on your coffee voucher.',
    uplift_pct: 200, uplift_label: '3× Points',
    start_date: '2026-05-26', end_date: '2026-06-01',
    eligible_categories: ['food'], eligible_type: 'voucher',
    redeemed_count: 288, points_awarded: 34_560,
    budget_pts: 50_000, spent_pts: 34_560,
  },
  {
    id: 'MCAM-0036', merchant_id: 'MRC-004', merchant_name: 'Sun Rides',
    name: 'Car-Free Week Challenge',
    type: 'bonus_offer', status: 'active',
    description: 'Complete 5 e-bike rides in a week and unlock a bonus 200 points.',
    uplift_pct: 0, uplift_label: '+200 pts bonus',
    start_date: '2026-05-27', end_date: '2026-06-02',
    eligible_categories: ['transport'], eligible_type: 'experience',
    redeemed_count: 74, points_awarded: 14_800,
    budget_pts: 20_000, spent_pts: 14_800,
  },
  {
    id: 'MCAM-0035', merchant_id: 'MRC-007', merchant_name: 'SunPower Collective',
    name: 'Community Solar Group Buy — Winter Round',
    type: 'group_buy', status: 'active',
    description: 'Minimum 20 households unlock wholesale pricing. Deadline 30 June.',
    uplift_pct: 0, uplift_label: 'Group Buy',
    start_date: '2026-05-01', end_date: '2026-06-30',
    eligible_categories: ['home'], eligible_type: 'product',
    redeemed_count: 14, points_awarded: 140_000,
    budget_pts: 500_000, spent_pts: 140_000,
    min_participants: 20, current_participants: 14,
  },
  {
    id: 'MCAM-0034', merchant_id: 'MRC-008', merchant_name: 'Wholesome Pedal',
    name: 'New Subscriber Bonus — Free Box',
    type: 'bonus_offer', status: 'active',
    description: 'First-time subscribers get 1 free box (480 pts credit) on their first 4-week order.',
    uplift_pct: 0, uplift_label: 'Free box',
    start_date: '2026-04-01', end_date: '2026-06-30',
    eligible_categories: ['food'], eligible_type: 'product',
    redeemed_count: 38, points_awarded: 18_240,
    budget_pts: 30_000, spent_pts: 18_240,
  },
]

// ─── Group Rewards ─────────────────────────────────────────────────────────────

export const GROUP_REWARDS = [
  {
    id: 'GRP-0014',
    name: 'Sydney CBD Circle — Community Solar Pool',
    description: 'Pool your points to unlock a 6-panel solar kit installation for a local community hall.',
    reward: 'Solar Panel Kit — 6 panels + installation ($2,800 retail value)',
    reward_type: 'experience',
    target_points: 56_000,
    current_points: 37_420,
    participants: 24,
    max_participants: 50,
    deadline: '2026-06-30',
    status: 'active',
    merchant_id: 'MRC-007',
    merchant_name: 'SunPower Collective',
    my_contribution: 1_200,
    top_contributors: [
      { name: 'Sarah M.', points: 1_200, initials: 'SM', is_me: true },
      { name: 'James K.', points: 3_800, initials: 'JK' },
      { name: 'Priya L.', points: 2_940, initials: 'PL' },
      { name: 'Tom W.', points: 2_100, initials: 'TW' },
      { name: 'Mei C.', points: 1_800, initials: 'MC' },
    ],
  },
  {
    id: 'GRP-0013',
    name: 'Inner West Riders — E-Bike Fleet Pool',
    description: 'Collectively fund an e-bike for Inner West community loan. Everyone who contributes gets priority booking.',
    reward: 'Community E-Bike — 12 months of shared community access',
    reward_type: 'product',
    target_points: 30_000,
    current_points: 28_840,
    participants: 62,
    max_participants: 80,
    deadline: '2026-06-07',
    status: 'active',
    merchant_id: 'MRC-004',
    merchant_name: 'Sun Rides',
    my_contribution: 0,
    top_contributors: [
      { name: 'Anika S.', points: 800, initials: 'AS' },
      { name: 'Ben O.', points: 720, initials: 'BO' },
      { name: 'Cleo F.', points: 640, initials: 'CF' },
      { name: 'Dan M.', points: 580, initials: 'DM' },
      { name: 'Eva T.', points: 500, initials: 'ET' },
    ],
  },
  {
    id: 'GRP-0012',
    name: 'North Shore Circle — Zero Waste Home Challenge',
    description: 'Enough for 40 homes to receive a full Zero-Waste Starter Pack from Loop Store.',
    reward: 'Zero-Waste Starter Pack × 40 homes',
    reward_type: 'product',
    target_points: 56_000,
    current_points: 56_000,
    participants: 40,
    max_participants: 40,
    deadline: '2026-05-25',
    status: 'completed',
    merchant_id: 'MRC-005',
    merchant_name: 'Loop Store',
    my_contribution: 1_400,
    top_contributors: [],
  },
  {
    id: 'GRP-0011',
    name: 'Green Schools — Classroom Supplies Pool',
    description: 'Fund eco-school supplies from Biome for 3 local primary schools.',
    reward: 'Classroom eco kits for 3 schools (Biome $1,500 voucher)',
    reward_type: 'experience',
    target_points: 30_000,
    current_points: 8_400,
    participants: 11,
    max_participants: 100,
    deadline: '2026-07-31',
    status: 'active',
    merchant_id: 'MRC-002',
    merchant_name: 'Biome',
    my_contribution: 0,
    top_contributors: [
      { name: 'Rose H.', points: 1_200, initials: 'RH' },
      { name: 'Jack L.', points: 900, initials: 'JL' },
      { name: 'Nadia P.', points: 700, initials: 'NP' },
    ],
  },
]

// ─── Member Tiers ─────────────────────────────────────────────────────────────

export const MEMBER_TIERS = {
  bronze:   {
    name: 'Bronze', min_points_earned_lifetime: 0, multiplier: 1.0,
    color: 'amber', badge_bg: 'bg-amber-100', badge_text: 'text-amber-700',
    perks: ['Base marketplace access', '5% bonus on featured offers', 'Standard redemption queue'],
  },
  silver:   {
    name: 'Silver', min_points_earned_lifetime: 1_000, multiplier: 1.2,
    color: 'slate', badge_bg: 'bg-slate-200', badge_text: 'text-slate-700',
    perks: ['1.2× points multiplier on earnings', 'Early access to new listings', 'Free shipping on vouchers', 'Monthly exclusive offer'],
  },
  gold:     {
    name: 'Gold', min_points_earned_lifetime: 5_000, multiplier: 1.5,
    color: 'yellow', badge_bg: 'bg-yellow-100', badge_text: 'text-yellow-700',
    perks: ['1.5× points multiplier', 'Priority redemption — skip queue', 'Exclusive gold-only campaigns', 'Monthly bonus drop (200 pts)', 'Dedicated support line'],
  },
  platinum: {
    name: 'Platinum', min_points_earned_lifetime: 15_000, multiplier: 2.0,
    color: 'violet', badge_bg: 'bg-violet-100', badge_text: 'text-violet-700',
    perks: ['2× points multiplier', 'Curated partner experiences', 'Co-branded sustainability certificate', 'Quarterly impact report', 'White-glove onboarding for referred merchants', 'Unlimited point transfers'],
  },
}

// ─── Member-Only Offers ───────────────────────────────────────────────────────

export const MEMBER_OFFERS = [
  {
    id: 'MOF-0028', name: 'EV Test Drive Experience — 2hr Private Session',
    tier_required: 'gold', merchant_id: 'MRC-004', merchant_name: 'Sun Rides',
    points_cost: 2_000, aud_value: 180, available_slots: 5,
    description: 'Private 2-hour EV test drive with a sustainability transport expert. Includes lunch.',
    expires: '2026-06-15', category: 'experience', badge: 'exclusive',
    image_color: 'bg-yellow-500',
  },
  {
    id: 'MOF-0027', name: 'Platinum Members Masterclass — Sustainable Home Design',
    tier_required: 'platinum', merchant_id: 'MRC-005', merchant_name: 'Loop Store',
    points_cost: 3_000, aud_value: 250, available_slots: 12,
    description: 'Full-day sustainability design workshop with certified eco-designer. Certificate of completion.',
    expires: '2026-07-01', category: 'experience', badge: 'platinum',
    image_color: 'bg-violet-700',
  },
  {
    id: 'MOF-0026', name: 'Silver+ Early Access — Biome Plastic-Free July Collection',
    tier_required: 'silver', merchant_id: 'MRC-002', merchant_name: 'Biome',
    points_cost: 200, aud_value: 10, available_slots: 200,
    description: '48-hour early access + 10 pts entry credit toward your first purchase.',
    expires: '2026-06-28', category: 'lifestyle', badge: 'early-access',
    image_color: 'bg-teal-600',
  },
  {
    id: 'MOF-0025', name: 'Gold Drop — Limited Edition Refurb Tech Bundle',
    tier_required: 'gold', merchant_id: 'MRC-001', merchant_name: 'The Green Cycle',
    points_cost: 5_000, aud_value: 320, available_slots: 8,
    description: 'Refurbished iPad + AirPods bundle. Grade A, 12-month warranty. Gold tier only.',
    expires: '2026-06-05', category: 'electronics', badge: 'limited',
    image_color: 'bg-slate-800',
  },
  {
    id: 'MOF-0024', name: 'Silver Perks — Free Monthly Coffee (4 weeks)',
    tier_required: 'silver', merchant_id: 'MRC-003', merchant_name: 'Charged Earth Coffee',
    points_cost: 160, aud_value: 24, available_slots: 100,
    description: 'One free coffee per week for a month. Silver members only. BYO cup earns extra points.',
    expires: '2026-06-30', category: 'food', badge: 'member',
    image_color: 'bg-amber-700',
  },
  {
    id: 'MOF-0023', name: 'Platinum Exclusive — SunPower Home Assessment',
    tier_required: 'platinum', merchant_id: 'MRC-007', merchant_name: 'SunPower Collective',
    points_cost: 4_000, aud_value: 350, available_slots: 3,
    description: 'Free in-home solar assessment + custom savings report. Platinum only. 3 slots remain.',
    expires: '2026-06-20', category: 'home', badge: 'platinum',
    image_color: 'bg-orange-500',
  },
]

// ─── Point Transfer History ───────────────────────────────────────────────────

export const TRANSFER_HISTORY = [
  {
    id: 'TXF-0041', direction: 'sent', counterparty: 'James M. (Household)',
    points: 500, ts: '2026-05-20T14:22:00', status: 'completed', message: 'Birthday treat!',
  },
  {
    id: 'TXF-0040', direction: 'received', counterparty: 'Mia K. (Referral)',
    points: 250, ts: '2026-05-12T09:14:00', status: 'completed', message: 'Thanks for the referral bonus',
  },
  {
    id: 'TXF-0039', direction: 'sent', counterparty: 'GRP-0014 Community Pool',
    points: 1_200, ts: '2026-05-08T18:00:00', status: 'completed', message: 'Sydney Solar Pool contribution',
  },
  {
    id: 'TXF-0038', direction: 'received', counterparty: 'Household Circle (James, Mia)',
    points: 400, ts: '2026-04-30T20:10:00', status: 'completed', message: 'Circle bonus distribution',
  },
]

// ─── Redemption History (consumer view) ──────────────────────────────────────

export const REDEMPTION_HISTORY = [
  {
    id: 'RDM-0112', listing_id: 'LST-0088', listing_name: 'Free Coffee Voucher',
    merchant_name: 'Charged Earth Coffee', points_spent: 60, aud_value: 6,
    ts: '2026-05-26T08:44:00', status: 'fulfilled', code: 'CE-X8K2P',
  },
  {
    id: 'RDM-0111', listing_id: 'LST-0094', listing_name: '$20 Loop Store Refill Credit',
    merchant_name: 'Loop Store', points_spent: 400, aud_value: 20,
    ts: '2026-05-18T14:12:00', status: 'fulfilled', code: 'LS-A4Q8W',
  },
  {
    id: 'RDM-0110', listing_id: 'LST-0083', listing_name: 'E-Waste Swap Voucher',
    merchant_name: 'The Green Cycle', points_spent: 500, aud_value: 50,
    ts: '2026-05-05T11:30:00', status: 'pending', code: 'GC-R2Z7L',
  },
]

// ─── Marketplace Admin Summary ────────────────────────────────────────────────

export const MARKETPLACE_SUMMARY = {
  active_merchants: 8,
  pending_merchants: 2,
  suspended_merchants: 0,
  total_listings: 64,
  total_redemptions_30d: 1_847,
  total_points_redeemed_30d: 284_600,
  platform_fees_30d_aud: 711.50,   // 5% × (284_600 × 0.05) ÷ ... adjusted
  top_category: 'electronics',
  active_campaigns: 8,
  group_rewards_active: 3,
  member_offers_active: 6,
  sustainability_impact_units_30d: 214,  // e-waste units diverted via swap campaigns
}

export const PLATFORM_FEE_BREAKDOWN_30D = [
  { merchant: 'The Green Cycle',    redemptions: 412, pts_redeemed: 74_240, fee_aud: 185.60 },
  { merchant: 'Biome',              redemptions: 428, pts_redeemed: 56_840, fee_aud: 142.10 },
  { merchant: 'Charged Earth',      redemptions: 488, pts_redeemed: 29_280, fee_aud: 73.20 },
  { merchant: 'Loop Store',         redemptions: 241, pts_redeemed: 38_400, fee_aud: 96.00 },
  { merchant: 'Sun Rides',          redemptions: 114, pts_redeemed: 42_800, fee_aud: 107.00 },
  { merchant: 'ReThread',           redemptions: 98,  pts_redeemed: 24_040, fee_aud: 60.10 },
  { merchant: 'SunPower Collective',redemptions: 28,  pts_redeemed: 14_000, fee_aud: 35.00 },
  { merchant: 'Wholesome Pedal',    redemptions: 38,  pts_redeemed: 5_000,  fee_aud: 12.50 },
]

// Merchant analytics (for merchant dashboard — shown for MRC-001 perspective)
export const MERCHANT_ANALYTICS_7D = [
  { day: 'Mon', redemptions: 18, points: 9_400, revenue: 470 },
  { day: 'Tue', redemptions: 24, points: 12_800, revenue: 640 },
  { day: 'Wed', redemptions: 31, points: 16_600, revenue: 830 },
  { day: 'Thu', redemptions: 22, points: 11_200, revenue: 560 },
  { day: 'Fri', redemptions: 41, points: 21_800, revenue: 1_090 },
  { day: 'Sat', redemptions: 58, points: 30_200, revenue: 1_510 },
  { day: 'Sun', redemptions: 36, points: 19_400, revenue: 970 },
]
