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

export const LOCAL_STATS = [
  { label: "Bengaluru Hubs Covered", value: "25+ Hubs" },
  { label: "Average Dispatch Time", value: "15–20 Mins" },
  { label: "Background & Police Clearance", value: "100% Verified" },
  { label: "Advance Cancellation Fee", value: "₹0 Penalty" }
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

export const VEHICLE_SERVICES = [
  {
    id: "veh-sedan",
    category: "Sedan",
    name: "Sedan (Maruti Dzire / Honda City / Etios)",
    image: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80",
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
    image: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80",
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
    image: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80",
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
    image: "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=800&q=80",
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
    image: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80",
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

export const FEATURED_DRIVERS = [
  {
    id: "anna-1",
    name: "Manjunath 'Manja' Gowda",
    experience: "12 Years Driving in Bangalore",
    rating: 4.98,
    trips: 3420,
    languages: ["Kannada", "English", "Hindi"],
    specialty: "Silk Board Traffic Expert & Outstation Specialist",
    tagline: "Always on time, smooth driving guarantee boss!",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80",
    badge: "Top Rated Anna"
  },
  {
    id: "anna-2",
    name: "Venkatesh Prasad",
    experience: "9 Years Driving",
    rating: 4.95,
    trips: 2890,
    languages: ["Kannada", "Telugu", "Tamil", "Hindi"],
    specialty: "Night Party Driver & Luxury Car Specialist",
    tagline: "Safe home guaranteed after your weekend party!",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80",
    badge: "Night Owl Specialist"
  },
  {
    id: "anna-3",
    name: "Syed Nizamuddin",
    experience: "15 Years Driving",
    rating: 4.99,
    trips: 4150,
    languages: ["Kannada", "Hindi", "English", "Urdu"],
    specialty: "Airport Transfers & Corporate Executives",
    tagline: "Punctuality is my habit. Terminal 1 or 2, I know shortcut roads!",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80",
    badge: "Airport Express"
  },
  {
    id: "anna-4",
    name: "Ramesh Kumar K.",
    experience: "8 Years Driving",
    rating: 4.92,
    trips: 2180,
    languages: ["Kannada", "Tamil", "English"],
    specialty: "Hill Drives (Coorg, Ooty, Nandi Hills)",
    tagline: "Zero motion sickness smooth ghat road driver!",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&q=80",
    badge: "Ghat Master"
  }
];

export const BANGALORE_TESTIMONIALS = [
  {
    id: 1,
    name: "Ananya Sharma",
    role: "Senior Tech Lead @ Manyata Tech Park",
    area: "Hebbal, Bangalore",
    rating: 5,
    comment: "Driving from Electronic City to Hebbal used to exhaust me daily. Booking a driver Anna for 4 hours every day was the best decision! Now I finish my code reviews on the backseat. Unmatched service!",
    date: "2 days ago",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: 2,
    name: "Karthik Raja",
    role: "Product Manager @ Indiranagar Startup",
    area: "Indiranagar, Bangalore",
    rating: 5,
    comment: "Booked an outstation Anna for a weekend trip to Chikmagalur with family. Manja Gowda was super professional, drove very smoothly through the ghats, and recommended authentic Akki Roti spots!",
    date: "1 week ago",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: 3,
    name: "Dr. Sandeep Hegde",
    role: "Consultant Surgeon",
    area: "Koramangala, Bangalore",
    rating: 5,
    comment: "Whenever we host family functions, we book 24-seater mini buses and drivers from Book Driver Anna. Verified, punctual, and reliable every single time.",
    date: "2 weeks ago",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80"
  }
];

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

// Default Registered Driver Partners Fleet (for testing & demo)
export const DEFAULT_REGISTERED_DRIVERS = [
  {
    id: "DRV-1001",
    name: "Manjunath Gowda",
    phone: "+91 98860 12345",
    dlNumber: "KA-04-2021-0098745",
    vehicleType: "Manual & Automatic Cars",
    area: "Indiranagar",
    experienceYears: "12 Years",
    rating: 4.98,
    trips: 3420,
    status: "Active",
    earningsToday: 2450,
    isOnline: true,
    createdAt: "2026-08-15"
  },
  {
    id: "DRV-1002",
    name: "Venkatesh Prasad",
    phone: "+91 98450 67890",
    dlNumber: "KA-05-2020-0081234",
    vehicleType: "Automatic Luxury & SUVs",
    area: "Koramangala",
    experienceYears: "9 Years",
    rating: 4.95,
    trips: 2890,
    status: "Active",
    earningsToday: 1800,
    isOnline: true,
    createdAt: "2026-08-20"
  },
  {
    id: "DRV-1003",
    name: "Suresh Kumar",
    phone: "+91 99002 55667",
    dlNumber: "KA-01-2019-0043120",
    vehicleType: "All Cars & Heavy Sedans",
    area: "Whitefield",
    experienceYears: "14 Years",
    rating: 4.96,
    trips: 4150,
    status: "Active",
    earningsToday: 2100,
    isOnline: true,
    createdAt: "2026-08-22"
  },
  {
    id: "DRV-1004",
    name: "Raghavendra Rao",
    phone: "+91 97410 33445",
    dlNumber: "KA-03-2022-0077889",
    vehicleType: "Manual Hatchback & Sedans",
    area: "Jayanagar",
    experienceYears: "7 Years",
    rating: 4.92,
    trips: 1940,
    status: "Active",
    earningsToday: 1650,
    isOnline: true,
    createdAt: "2026-08-28"
  },
  {
    id: "DRV-1005",
    name: "Chandra Shekar",
    phone: "+91 98801 99881",
    dlNumber: "KA-51-2021-0065432",
    vehicleType: "Electric & Automatic Cars",
    area: "HSR Layout",
    experienceYears: "6 Years",
    rating: 4.94,
    trips: 1620,
    status: "Active",
    earningsToday: 1950,
    isOnline: true,
    createdAt: "2026-09-01"
  }
];


