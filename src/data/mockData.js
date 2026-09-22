// Temporary admin number pending a dedicated support line
export const SUPPORT_HELPLINE = '+91 78991 20704';

export const BANGALORE_AREAS = [
  "Indiranagar",
  "Koramangala",
  "Whitefield",
  "Electronic City",
  "HSR Layout",
  "MG Road / Brigade Road",
  "Hebbal & Sahakarnagar",
  "Yelahanka",
  "Rajajinagar & Malleshwaram",
  "Banashankari & Jayanagar",
  "Bellandur & Sarjapur Road",
  "Marathahalli",
  "BTM Layout",
  "Kammanahalli & Kalyan Nagar",
  "Kempegowda Intl Airport (BLR T1/T2)"
];

// Operational service descriptors (non-fabricated verified commitments)
export const LOCAL_STATS = [
  { label: "Bengaluru Coverage", value: "Citywide" },
  { label: "Dispatch Model", value: "On-Demand" },
  { label: "Partner Screening", value: "Verified ID" },
  { label: "Advance Cancellation", value: "₹0 Penalty" }
];

export const OUTSTATION_DESTINATIONS = [
  { name: "Nandi Hills", distance: "60 km", driveTime: "1.5 hrs", popularFor: "Sunrise views & Weekend drive" },
  { name: "Coorg (Madikeri)", distance: "265 km", driveTime: "5.5 hrs", popularFor: "Coffee estates & Hills" },
  { name: "Chikmagalur", distance: "240 km", driveTime: "4.5 hrs", popularFor: "Trekking & Homestays" },
  { name: "Mysuru (Mysore)", distance: "145 km", driveTime: "2.5 hrs (Expressway)", popularFor: "Palace & Culture" },
  { name: "Wayanad", distance: "280 km", driveTime: "6 hrs", popularFor: "Nature & Wildlife" },
  { name: "Ooty", distance: "270 km", driveTime: "6 hrs", popularFor: "Tea gardens & Cool weather" },
  { name: "Puducherry (Pondicherry)", distance: "310 km", driveTime: "6.5 hrs", popularFor: "Beaches & French Quarter" }
];

export const BOOK_DRIVER_TRIP_TYPES = [
  {
    id: 'one-way',
    title: 'One Way Trip',
    badge: 'Point A to Point B Drop',
    subtitle: 'Point A to Point B drop across Bangalore',
    description: 'Need Anna to drive your car from your location to a specific drop location like Bengaluru Airport, office, or railway station?',
    pricing: 'Starts @ ₹249 flat',
    features: [
      'Specific Pickup & Drop Locations',
      'Instant SMS & Live GPS tracking',
      'No return fare needed for Anna',
      'Automatic & Manual car experts'
    ]
  },
  {
    id: 'round-trip',
    title: 'Round Trip',
    badge: 'In-City Hourly Packages',
    subtitle: 'Flexible hourly driving & return home',
    description: 'Hire Anna for city errands, shopping, hospital visits, or office commutes. Anna stays with your car and drives you back home.',
    pricing: 'Starts @ ₹199 / 2 hours',
    durationOptions: ['2hr', '4hr', '6hr', '12hr'],
    features: [
      'Choose 2hr, 4hr, 6hr, or 12hr duration',
      'Anna waits with your car at stops',
      'Covers multiple stops across city',
      'Zero cancellation charges'
    ]
  },
  {
    id: 'outstation',
    title: 'Outstation',
    badge: 'Highway & Hill Getaways',
    subtitle: 'Outstation trips across South India',
    description: 'Planning a road trip to Coorg, Nandi Hills, Chikmagalur or Mysore? Book an experienced outstation Anna for safe highway driving.',
    pricing: 'Starts @ ₹1,199',
    outstationPackages: [
      'Round trip 12hr', 'Round trip 24hr', 'Round trip 46hr', 'Round trip 72hr',
      'One Way (Up to 150 km)', 'One Way (Up to 300 km)', 'One Way (Up to 500 km)', 'One Way Custom Drop'
    ],
    features: [
      'Trip Options: Round Trip (12hr-72hr) & One Way Drop',
      'Ghat road & hill driving specialists',
      'Includes driver return/food allowance guidelines',
      'Night allowance included after 10 PM'
    ]
  }
];

export const DRIVER_SERVICES = [
  {
    id: "hourly-driver",
    title: "In-City Hourly Driver",
    subtitle: "Your car, our expert Anna",
    icon: "Clock",
    tag: "Most Popular in Namma Bengaluru",
    description: "Tired of Bangalore traffic & Silk Board jams? Hire a professional driver for 2, 4, 8, or 12 hours. Sit back, work on your laptop or relax while Anna handles the wheel.",
    pricing: "Starts @ ₹199 / 2 hours",
    features: [
      "Minimum 2-hour package",
      "Police verified & background checked",
      "Proficient in Kannada, English & Hindi",
      "Manual & Automatic car experts",
      "Zero hidden charges"
    ],
    basePrice: 199,
    extraHourRate: 80,
    popularUseCases: ["Traffic commute to office", "Shopping spree in Commercial St", "Hospital visits", "Family errands"]
  },
  {
    id: "night-driver",
    title: "Night Party Driver",
    subtitle: "Safe drive back after night out",
    icon: "Moon",
    tag: "24/7 Night Service",
    description: "Enjoy your night out in Indiranagar, Koramangala or MG Road without worrying about driving back! Our night-owl Annas will reach your club and drive you home safe.",
    pricing: "Starts @ ₹399 / trip",
    features: [
      "Available 24/7 till 4:00 AM",
      "Strict breathalyzer test before drive",
      "Double GPS tracked for safety",
      "Emergency SOS button included",
      "Doorstep valet hand-off"
    ],
    basePrice: 399,
    extraHourRate: 100,
    popularUseCases: ["Indiranagar Pub Hopping", "Koramangala Parties", "Weekend Dinners", "Late night airport drop"]
  },
  {
    id: "outstation-driver",
    title: "Outstation Driver",
    subtitle: "Relaxed long drives across South India",
    icon: "Compass",
    tag: "Weekend Getaways",
    description: "Planning a trip to Nandi Hills, Coorg, Wayanad or Mysore? Hire an experienced outstation Anna who knows highway routes, scenic spots, and best roadside tiffin rooms.",
    pricing: "Starts @ ₹1,199 / day",
    features: [
      "Experienced highway certified drivers",
      "Night allowance included after 10 PM",
      "Includes driver food allowance guidelines",
      "Experienced with hilly terrains & ghat sections",
      "Clean driving record verified"
    ],
    basePrice: 1199,
    extraHourRate: 120,
    popularUseCases: ["Coorg Weekend Trip", "Chikmagalur Homestays", "Mysore Expressway Run", "Tirupati Temple Visit"]
  },
  {
    id: "monthly-driver",
    title: "Monthly / Corporate Driver",
    subtitle: "Dedicated Anna for your daily hassle-free commute",
    icon: "Briefcase",
    tag: "Best Value",
    description: "Need a full-time driver for your family or corporate executive? Book a dedicated, punctual driver Anna on a monthly contract with easy replacement guarantees.",
    pricing: "Starts @ ₹18,000 / month",
    features: [
      "Dedicated assigned driver Anna",
      "Uniformed & polite deportment",
      "Free driver replacement within 24 hrs",
      "Monthly GST billing for corporates",
      "100% background & document verified"
    ],
    basePrice: 18000,
    extraHourRate: 0,
    popularUseCases: ["Daily office commuting to Tech Parks", "School drop & pick up", "Senior citizen care", "Executive car management"]
  }
];

// Clean vehicle illustration placeholder (TODO: replace with actual fleet photography)
const createVehiclePlaceholder = (title, category) => `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><rect width="100%" height="100%" fill="%230f172a"/><rect x="20" y="20" width="760" height="410" rx="16" fill="%231e293b" stroke="%23334155" stroke-width="2"/><text x="50%" y="45%" text-anchor="middle" fill="%23f59e0b" font-family="sans-serif" font-size="28" font-weight="bold">${category}</text><text x="50%" y="58%" text-anchor="middle" fill="%2394a3b8" font-family="sans-serif" font-size="16">${encodeURIComponent(title)}</text><text x="50%" y="70%" text-anchor="middle" fill="%2364748b" font-family="sans-serif" font-size="12">Fleet Vehicle</text></svg>`;

export const VEHICLE_SERVICES = [
  {
    id: "veh-sedan",
    category: "Sedan",
    name: "Sedan (Maruti Dzire / Honda City / Etios)",
    image: createVehiclePlaceholder("Maruti Dzire / Honda City / Etios", "Sedan"),
    badge: "Comfortable 4 Seater",
    type: "Driver + Car",
    seats: 4,
    luggage: "3 Bags",
    fuel: "Petrol / Diesel",
    transmission: "Manual / Auto",
    hourlyRate: 399,
    dailyRate: 1999,
    outstationPerKm: 14,
    description: "Smooth ride with executive legroom & air conditioning. Ideal for Bangalore city commutes, airport BLR drops & family rides."
  },
  {
    id: "veh-suv",
    category: "SUV",
    name: "SUV (Toyota Innova Crysta / Ertiga)",
    image: createVehiclePlaceholder("Toyota Innova Crysta / Ertiga", "SUV"),
    badge: "Spacious 6-7 Seater",
    type: "Driver + Vehicle",
    seats: 7,
    luggage: "5 Bags",
    fuel: "Diesel",
    transmission: "Manual / Auto",
    hourlyRate: 599,
    dailyRate: 3499,
    outstationPerKm: 20,
    description: "Ultra-comfortable 6-7 seater MUV/SUV for family getaways to Coorg, Nandi Hills, Mysore Expressway or airport transfers."
  },
  {
    id: "veh-12seater",
    category: "12 Seater",
    name: "12 Seater Luxury Tempo Traveller",
    image: createVehiclePlaceholder("Luxury Tempo Traveller", "12 Seater"),
    badge: "Group Travel 12 Seater",
    type: "Driver + Vehicle",
    seats: 12,
    luggage: "10 Bags",
    fuel: "Diesel",
    transmission: "Manual",
    hourlyRate: 999,
    dailyRate: 5499,
    outstationPerKm: 26,
    description: "Pushback recliner seats, LED screen & AC. Perfect for group outstation trips, team outings & family functions."
  },
  {
    id: "veh-24seater",
    category: "24 Seater",
    name: "24 Seater Executive Mini Bus",
    image: createVehiclePlaceholder("Executive Mini Bus", "24 Seater"),
    badge: "Executive 24 Seater",
    type: "Driver + Bus",
    seats: 24,
    luggage: "18 Bags",
    fuel: "Diesel",
    transmission: "Manual",
    hourlyRate: 1499,
    dailyRate: 7999,
    outstationPerKm: 34,
    description: "Spacious 24-seater executive bus with air suspension, audio system & ample luggage boot for marriage parties & corporate tours."
  },
  {
    id: "veh-32seater",
    category: "32 Seater",
    name: "32 Seater Luxury Coach Bus",
    image: createVehiclePlaceholder("Luxury Coach Bus", "32 Seater"),
    badge: "VIP Luxury 32 Seater",
    type: "Driver + Luxury Coach",
    seats: 32,
    luggage: "25+ Bags",
    fuel: "Diesel",
    transmission: "Manual",
    hourlyRate: 1999,
    dailyRate: 10999,
    outstationPerKm: 42,
    description: "Premium 32-seater luxury coach with reclining pushback seats, individual charging ports & high-capacity luggage hold."
  }
];

// Featured drivers and client testimonials (TODO: populate from live reviews API)
export const FEATURED_DRIVERS = [];
export const BANGALORE_TESTIMONIALS = [];

export const DRIVING_CLASSES = [
  {
    id: "class-beginner",
    name: "Beginner Comprehensive Course",
    badge: "Most Popular for Fresh Learners",
    duration: "15 Days (1 hr / day)",
    daysCount: 15,
    pricing: "₹5,999 all-inclusive",
    basePrice: 5999,
    description: "From zero driving experience to total confidence on Bangalore roads. Covers basics, traffic navigation, flyovers, and reverse parking.",
    transmission: "Manual or Automatic",
    carOptions: ["Anna's Dual-Control Car", "Your Own Car"],
    features: [
      "Clutch, steering & gear coordination",
      "Bangalore peak traffic & signal navigation",
      "Parallel, reverse & basement ramp parking",
      "Flyover incline & hill-hold technique",
      "RTO Learner & Driving License assistance"
    ],
    popularFor: "Freshers & First-Time Car Owners"
  },
  {
    id: "class-refresher",
    name: "City Confidence & Refresher",
    badge: "Overcome Traffic Fear",
    duration: "7 Days (1 hr / day)",
    daysCount: 7,
    pricing: "₹3,499 all-inclusive",
    basePrice: 3499,
    description: "Have a driving license but feel anxious driving in Silk Board jams or tight Bangalore alleys? Our patient Annas build your confidence.",
    transmission: "Manual or Automatic",
    carOptions: ["Your Own Car", "Anna's Dual-Control Car"],
    features: [
      "Bumper-to-bumper crawl & clutch control",
      "Lane discipline on Outer Ring Road & Expressways",
      "Mall basement & tight street parking",
      "Night driving & high-beam management",
      "Defensive driving tactics for two-wheelers"
    ],
    popularFor: "License Holders Who Lack Confidence"
  },
  {
    id: "class-own-car",
    name: "Learn in Your Own Car",
    badge: "Doorstep Personalized Training",
    duration: "7 Days (1.5 hrs / day)",
    daysCount: 7,
    pricing: "₹2,999 all-inclusive",
    basePrice: 2999,
    description: "Nothing beats mastering the exact car you drive daily. Anna comes to your home and teaches you on your personal vehicle and exact daily routes.",
    transmission: "Manual or Automatic",
    carOptions: ["Your Own Personal Car"],
    features: [
      "Your exact home-to-office daily route practice",
      "Your apartment's narrow basement parking ramp",
      "Personalized speed & blind-spot coaching",
      "Familiarity with your car's dimensions & turning radius",
      "Doorstep pickup & drop every morning/evening"
    ],
    popularFor: "New Car Owners Familiarizing with Their Vehicle"
  },
  {
    id: "class-automatic",
    name: "Automatic Car Specialization",
    badge: "AMT / CVT / DCT Masterclass",
    duration: "7 Days (1 hr / day)",
    daysCount: 7,
    pricing: "₹3,999 all-inclusive",
    basePrice: 3999,
    description: "Switched from manual to automatic? Learn seamless accelerator control, creep function, paddle shifters, and downhill engine braking.",
    transmission: "Automatic Only",
    carOptions: ["Anna's Dual-Control Automatic", "Your Own Automatic Car"],
    features: [
      "Strict single-foot pedal discipline",
      "Creep mode mastery in traffic jams",
      "Hill-start assist & electronic parking brake",
      "Sport mode & highway overtaking techniques",
      "Fuel-efficient city driving methods"
    ],
    popularFor: "Drivers Switching to Modern Automatics & EVs"
  }
];

export const DRIVING_CLASS_HIGHLIGHTS = [
  { label: "Dual-Control Safety", value: "Certified Cars" },
  { label: "Personalized Training", value: "1-on-1 with Anna" },
  { label: "Doorstep Pickup", value: "Across Bangalore" },
  { label: "Timings", value: "Flexible 6 AM - 8 PM" }
];

// Initial registered drivers fleet (empty on clean boot; populated via registration)
export const DEFAULT_REGISTERED_DRIVERS = [];


