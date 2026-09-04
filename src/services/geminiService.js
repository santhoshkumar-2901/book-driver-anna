// Gemini AI Service for Book Driver Anna Assistant

const SYSTEM_PROMPT = `
You are "Anna AI", the official friendly, polite, and helpful customer support assistant for "Book Driver Anna" (Namma Bengaluru's #1 Driver & Vehicle Rental Service).
You speak in a warm, welcoming, respectful manner with authentic Bangalore warmth and hospitality (using friendly terms like "Namaskara boss!", "Don't worry anna, we've got you covered!").

Always provide direct, clear, and well-structured answers using bullet points and exact pricing when asked.

KEY INFORMATION ABOUT BOOK DRIVER ANNA SERVICES:

1. IN-CITY HOURLY DRIVER (For Customer's Own Car):
   - Pricing: Starts @ ₹199 for 2 hours (Minimum 2-hour package).
   - Extra Hours: ₹80 per additional hour.
   - Use Cases: Silk Board traffic commute, office runs to Whitefield/Electronic City, shopping sprees in Commercial St/Indiranagar, hospital visits, family errands.
   - Highlights: Manual & Automatic car specialists, 100% background checked & police verified, prompt doorstep arrival.

2. NIGHT PARTY DRIVER (24/7 Safe Ride Home):
   - Pricing: Starts @ ₹399 / trip.
   - Availability: 24/7, active till 4:00 AM.
   - Features: Strict breathalyzer test before taking the wheel, dual GPS tracking for safety, emergency SOS, doorstep valet drop.
   - Popular Spots: Indiranagar 100ft Road, Koramangala 80ft Rd, MG Road, Church Street pubs, UB City.

3. OUTSTATION HIGHWAY & HILL DRIVER:
   - Pricing: Starts @ ₹1,199 / 12 hours (or day).
   - Packages: Round trip 12hr, 24hr, 46hr, 72hr.
   - Highlights: Ghat road & hill driving specialists, zero motion-sickness driving, clean driving records.
   - Popular Destinations:
     * Nandi Hills (60 km, ~1.5 hrs)
     * Mysore / Mysuru via Expressway (145 km, ~2.5 hrs)
     * Chikmagalur (240 km, ~4.5 hrs)
     * Coorg / Madikeri (265 km, ~5.5 hrs)
     * Ooty (270 km, ~6 hrs)
     * Wayanad (280 km, ~6 hrs)
     * Pondicherry (310 km, ~6.5 hrs)

4. MONTHLY / CORPORATE DEDICATED DRIVER:
   - Pricing: Starts @ ₹18,000 / month.
   - Features: Dedicated Anna, 100% document & police verified, uniformed, free driver replacement within 24 hours, GST billing for companies.

5. POINT-TO-POINT & ROUND TRIPS:
   - One-Way Drop: Starts @ ₹249 flat (Point A to Point B drop across Bangalore, Airport BLR T1/T2 drops, no return fare needed for driver).
   - In-City Round Trip: Starts @ ₹199 / 2 hours (Anna stays with car at all stops).

6. VEHICLE RENTAL FLEET (With Professional Driver):
   - Sedan (Maruti Dzire / Honda City / Etios): 4 seats, 3 bags, ₹399/hr | ₹1,999/day | ₹14/km outstation.
   - SUV (Toyota Innova Crysta / Ertiga): 6-7 seats, 5 bags, ₹599/hr | ₹3,499/day | ₹20/km outstation.
   - 12-Seater Luxury Tempo Traveller: 12 seats, 10 bags, ₹999/hr | ₹5,499/day | ₹26/km outstation (pushback seats, AC, LED).
   - 24-Seater Executive Mini Bus: 24 seats, 18 bags, ₹1,499/hr | ₹7,999/day | ₹34/km outstation (air suspension, ideal for weddings & corporate trips).
   - 32-Seater Luxury Coach: 32 seats, 25+ bags, ₹1,999/hr | ₹10,999/day | ₹42/km outstation (VIP luxury).

7. DRIVING CLASSES & ACADEMY (Learn with Anna):
   - Certified, patient, zero-shouting driver Annas who coach you 1-on-1 at your doorstep.
   - Courses:
     * Beginner Comprehensive Course (15 Days, 1 hr/day): ₹5,999 all-inclusive. Covers clutch/gear control, Bangalore traffic navigation, flyovers, parallel & reverse parking, RTO license assistance.
     * City Confidence & Refresher (7 Days, 1 hr/day): ₹3,499 all-inclusive. For license holders who fear Silk Board jams, flyovers, or night driving.
     * Learn in Your Own Car (7 Days, 1.5 hrs/day): ₹2,999 all-inclusive. Anna coaches you in your personal vehicle on your exact office/school route and apartment parking ramp.
     * Automatic Car Specialization (7 Days, 1 hr/day): ₹3,999 all-inclusive. Master automatic AMT/CVT/DCT cars, creep mode, and hill-start assist.
   - Training Vehicle: Anna's Dual-Control Training Car OR Customer's Personal Car (Manual or Automatic).
   - Daily Batches: Early morning (6-8 AM) or evening (5-7 PM). Doorstep pickup across Bangalore.

8. COVERAGE AREAS & CONTACT:
   - Areas: Indiranagar, Koramangala, Whitefield, Electronic City, HSR Layout, MG Road, Hebbal, Yelahanka, Rajajinagar, Banashankari, Bellandur, Marathahalli, BTM Layout, BLR Airport.
   - Doorstep Arrival: Fast on-demand pickup across Bangalore.
   - Hotline: +91 98765 43210 (24x7 support).
   - Booking: Customer can easily click the "Book a Driver", "Book a Vehicle", or "Driving Class" buttons on the screen.

Keep responses concise, cheerful, accurate, and encourage the customer to book right away!
`;

// Helper to get active API key
export const getActiveApiKey = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      const local = localStorage.getItem('bda_gemini_api_key');
      if (local) return local;
    }
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.VITE_GEMINI_API_KEY || '';
    }
  } catch (e) {
    // Ignore in non-browser context
  }
  return '';
};

// Save custom API key to localStorage
export const saveActiveApiKey = (key) => {
  try {
    if (typeof localStorage !== 'undefined') {
      if (key && key.trim()) {
        localStorage.setItem('bda_gemini_api_key', key.trim());
      } else {
        localStorage.removeItem('bda_gemini_api_key');
      }
    }
  } catch (e) {
    // Ignore in non-browser context
  }
};

/**
 * Call Gemini REST API
 */
export async function sendQueryToGemini(messages, customApiKey = null) {
  // 1. First attempt secure backend proxy so API key is never exposed to browser
  try {
    const lastUserMsg = [...messages].reverse().find(m => m.sender === 'user');
    const userText = lastUserMsg ? lastUserMsg.text : '';
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userText, history: messages.slice(0, -1) })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.data && data.data.text) {
        return data.data.text;
      }
    }
  } catch (proxyErr) {
    // Continue to direct API or fallback
  }

  const apiKey = customApiKey || getActiveApiKey();

  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  // Format history for Gemini API
  const contents = messages.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  const payload = {
    contents,
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 600,
      topP: 0.95
    }
  };

  // Try gemini-1.5-flash first, fallback to gemini-2.0-flash
  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];

  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const message = errData?.error?.message || `HTTP ${response.status}`;
        throw new Error(message);
      }

      const data = await response.json();
      const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (replyText) {
        return replyText.trim();
      }
    } catch (err) {
      lastError = err;
      // If error is invalid key, don't retry other models
      if (err.message && (err.message.includes('API_KEY_INVALID') || err.message.includes('API key not valid'))) {
        throw new Error('API_KEY_INVALID: Please check your Gemini API key.');
      }
    }
  }

  throw lastError || new Error('Failed to reach Gemini API.');
}

/**
 * Intelligent Local Knowledge-Base Fallback
 * Provides instant answers even when offline or before the API key is entered
 */
export function getOfflineKnowledgeResponse(query) {
  const q = query.toLowerCase().trim();

  // 1. Pricing / Rates / Fares
  if (q.includes('rate') || q.includes('price') || q.includes('cost') || q.includes('fare') || q.includes('charge') || q.includes('how much')) {
    if (q.includes('night') || q.includes('party')) {
      return {
        text: `🌙 **Night Party Driver Pricing**:\n\n• **Starting Fare**: ₹399 flat per trip\n• **Extra Hours**: ₹100/hr\n• **Timing**: Active 24/7 up to 4:00 AM\n• **Safety**: 100% breathalyzer tested Anna, GPS tracked, and doorstep drop!\n\nWould you like me to reserve a night party driver for you?`,
        actions: [{ label: '🚗 Book Night Driver', type: 'driver', data: { tripOption: 'one-way' } }]
      };
    }
    if (q.includes('outstation') || q.includes('coorg') || q.includes('mysore') || q.includes('ooty') || q.includes('nandi')) {
      return {
        text: `🛣️ **Outstation Driver Pricing**:\n\n• **Daily / 12-Hour Package**: Starts @ ₹1,199\n• **Overtime / Extra Hour**: ₹120/hr\n• **Packages Available**: 12hr, 24hr, 48hr, 72hr round trips\n• **Includes**: Experienced ghat & highway drivers, food allowance guidelines, night allowance included after 10 PM.`,
        actions: [{ label: '🛣️ Book Outstation Anna', type: 'driver', data: { tripOption: 'outstation' } }]
      };
    }
    if (q.includes('monthly') || q.includes('month') || q.includes('corporate') || q.includes('full time')) {
      return {
        text: `💼 **Monthly / Corporate Driver Fares**:\n\n• **Starting Rate**: ₹18,000 / month\n• **Driver**: Dedicated, background checked & police verified Anna\n• **Guarantee**: Free replacement within 24 hours if Anna is unwell\n• **Billing**: Monthly GST invoicing available for companies.`,
        actions: [{ label: '💼 Inquire Monthly Driver', type: 'driver', data: { tripOption: 'round-trip' } }]
      };
    }
    return {
      text: `💰 **Book Driver Anna Fares Overview**:\n\n• **In-City Hourly Driver**: Starts @ **₹199** for 2 hours (₹80/extra hr)\n• **Night Party Driver**: Starts @ **₹399** / trip (24/7 till 4 AM)\n• **One-Way Drop (City/Airport)**: Starts @ **₹249** flat\n• **Outstation Driver**: Starts @ **₹1,199** / 12 hrs\n• **Monthly Driver**: Starts @ **₹18,000** / month\n\n• **Car Rentals (Vehicle + Driver)**:\n  - Sedan (Dzire/Etios): ₹1,999/day\n  - SUV (Innova/Ertiga): ₹3,499/day\n  - 12-Seater Tempo: ₹5,499/day`,
      actions: [
        { label: '🚗 Book Hourly Driver', type: 'driver', data: { tripOption: 'round-trip' } },
        { label: '🚙 Rent a Vehicle', type: 'vehicle', data: {} }
      ]
    };
  }

  // 2. Night Driver
  if (q.includes('night') || q.includes('party') || q.includes('alcohol') || q.includes('drink') || q.includes('pub') || q.includes('club') || q.includes('koramangala') || q.includes('indiranagar')) {
    return {
      text: `🍻 **Night Party Driver Service (Safe Drive Home)**:\n\nParty hard in Indiranagar, Koramangala, or UB City—Anna will drive your car home safely!\n\n• **Fare**: Starts @ ₹399 / trip\n• **Hours**: Available 24/7 until 4:00 AM\n• **Verification**: Strict breathalyzer test before driving\n• **Features**: Live GPS tracking, emergency SOS, and safe doorstep parking.\n\nReady to book your night driver Anna?`,
      actions: [{ label: '🌙 Book Night Driver', type: 'driver', data: { tripOption: 'one-way' } }]
    };
  }

  // 3. Outstation Trips
  if (q.includes('outstation') || q.includes('coorg') || q.includes('mysore') || q.includes('mysuru') || q.includes('ooty') || q.includes('chikmagalur') || q.includes('nandi') || q.includes('wayanad') || q.includes('pondicherry') || q.includes('highway') || q.includes('hill') || q.includes('ghat')) {
    return {
      text: `🌄 **Outstation Driver Anna Service**:\n\nPlanning a highway getaway? Our experienced highway & ghat-road Annas know the smoothest routes and best roadside breakfast stops!\n\n• **Popular Spots**:\n  - **Nandi Hills**: 60 km (~1.5 hrs)\n  - **Mysore Expressway**: 145 km (~2.5 hrs)\n  - **Chikmagalur / Coorg**: 240-265 km (~4.5 - 5.5 hrs)\n  - **Ooty / Wayanad**: 270-280 km (~6 hrs)\n• **Package**: Starts @ ₹1,199 / 12 hrs\n• **Benefits**: Safe ghat driving, zero motion sickness, night driving certified.`,
      actions: [{ label: '🛣️ Book Outstation Driver', type: 'driver', data: { tripOption: 'outstation' } }]
    };
  }

  // 4. Vehicle Rentals / Cars
  if (q.includes('car') || q.includes('vehicle') || q.includes('rent') || q.includes('sedan') || q.includes('suv') || q.includes('innova') || q.includes('tempo') || q.includes('traveller') || q.includes('bus') || q.includes('dzire')) {
    return {
      text: `🚘 **Rental Vehicles with Driver Fleet**:\n\nDon't have a car? Rent one of our spotless, sanitized commercial vehicles with a courteous Anna:\n\n1. **Sedan (Dzire / Honda City / Etios)**: 4 seats | ₹399/hr or ₹1,999/day (Outstation ₹14/km)\n2. **SUV (Innova Crysta / Ertiga)**: 6-7 seats | ₹599/hr or ₹3,499/day (Outstation ₹20/km)\n3. **12-Seater Luxury Tempo Traveller**: 12 seats | ₹999/hr or ₹5,499/day (Outstation ₹26/km)\n4. **24-Seater Executive Bus**: 24 seats | ₹1,499/hr or ₹7,999/day (Outstation ₹34/km)\n5. **32-Seater VIP Coach**: 32 seats | ₹1,999/hr or ₹10,999/day`,
      actions: [
        { label: '🚙 Rent Sedan / SUV', type: 'vehicle', data: { category: 'Sedan' } },
        { label: '🚐 Rent Tempo / Bus', type: 'vehicle', data: { category: '12 Seater' } }
      ]
    };
  }

  // 5. Airport BLR
  if (q.includes('airport') || q.includes('blr') || q.includes('terminal') || q.includes('flight') || q.includes('kempegowda')) {
    return {
      text: `✈️ **Kempegowda Airport (BLR T1 / T2) Service**:\n\n• **Drive Your Car**: One-way drop starts @ ₹249 flat! Anna drops you at Terminal 1 or 2 and you don't have to pay return fare for Anna.\n• **Rental Sedan/SUV**: Airport pickup or drop starts at ₹1,499 all-inclusive.\n• **Punctuality**: 100% on-time guarantee. Annas know the airport expressway bypasses!`,
      actions: [
        { label: '🚗 Driver For Airport Drop', type: 'driver', data: { tripOption: 'one-way' } },
        { label: '✈️ Rent Airport Cab', type: 'vehicle', data: { category: 'Sedan' } }
      ]
    };
  }

  // 6. Verification / Safety / Trust
  if (q.includes('safe') || q.includes('police') || q.includes('verify') || q.includes('verified') || q.includes('trust') || q.includes('background') || q.includes('license')) {
    return {
      text: `🛡️ **100% Safety & Verification Guarantee**:\n\n• **Police Verified**: Every Anna undergoes criminal background checks & Aadhaar KYC.\n• **Driving Experience**: Minimum 5+ years commercial/private driving experience.\n• **Live Tracking**: Live GPS tracking shared via SMS/WhatsApp with your family.\n• **Strict Conduct**: Zero tolerance policy for misconduct; breathalyzer checks for night trips.`,
      actions: [{ label: '🚗 Book Verified Anna', type: 'driver', data: { tripOption: 'round-trip' } }]
    };
  }

  // 7. Areas Covered
  if (q.includes('area') || q.includes('where') || q.includes('location') || q.includes('coverage') || q.includes('whitefield') || q.includes('hsr') || q.includes('electronic city') || q.includes('hebbal') || q.includes('indiranagar')) {
    return {
      text: `📍 **Service Areas Across Bangalore**:\n\nWe cover all major hubs across Namma Bengaluru with **fast doorstep pickup**:\n\n• Indiranagar, Koramangala & HSR Layout\n• Whitefield, Marathahalli & Bellandur\n• Electronic City & BTM Layout\n• MG Road, Brigade Road & Central Bangalore\n• Hebbal, Yelahanka & Sahakarnagar\n• Rajajinagar, Malleshwaram & Banashankari\n• Kempegowda International Airport (BLR T1/T2)`,
      actions: [{ label: '🚗 Book Driver in Bangalore', type: 'driver', data: { tripOption: 'round-trip' } }]
    };
  }

  // 8. Monthly Driver
  if (q.includes('monthly') || q.includes('daily') || q.includes('corporate') || q.includes('office') || q.includes('contract')) {
    return {
      text: `💼 **Monthly Driver Subscription**:\n\nNeed a dedicated Anna for daily office commutes, school drops, or senior family members?\n\n• **Pricing**: Starts @ ₹18,000 / month\n• **Schedule**: 8-10 hrs / day, 6 days a week\n• **Assurance**: Free driver replacement within 24 hours if Anna takes leave\n• **Payment**: Transparent billing with GST invoicing for companies.`,
      actions: [{ label: '📞 Request Monthly Driver', type: 'driver', data: { tripOption: 'round-trip' } }]
    };
  }

  // 9. Driving Classes & Training
  if (q.includes('class') || q.includes('learn') || q.includes('teach') || q.includes('school') || q.includes('course') || q.includes('training') || q.includes('beginner') || q.includes('refresher')) {
    return {
      text: `🎓 **Driving Classes with Driver Anna (Learn Without Fear)**:\n\nOur patient, certified Annas coach you 1-on-1 at your doorstep with zero shouting and complete peace of mind:\n\n1. **Beginner Comprehensive Course (15 Days)**: ₹5,999\n   • Basics, clutch/gear coordination, Bangalore traffic, flyovers, reverse & parallel parking, RTO assistance.\n2. **City Confidence & Refresher (7 Days)**: ₹3,499\n   • Conquer Silk Board traffic, tight mall parking, flyovers & night driving.\n3. **Learn in Your Own Car (7 Days)**: ₹2,999\n   • Master your exact daily office route & apartment basement parking in your own vehicle!\n4. **Automatic Car Specialization (7 Days)**: ₹3,999\n   • Master automatic AMT/CVT/DCT cars, creep mode & hill-hold.\n\n• **Training Vehicle**: Choose between **Anna's Dual-Control Car** or **Your Own Car**.\n• **Flexible Batches**: Early morning (6-8 AM) or evening (5-7 PM).`,
      actions: [
        { label: '🎓 Enroll in Driving Class', type: 'class', data: { selectedClassId: 'class-beginner' } },
        { label: '🚗 Learn in Own Car', type: 'class', data: { selectedClassId: 'class-own-car' } }
      ]
    };
  }

  // 10. Greetings & Default
  if (q.includes('hi') || q.includes('hello') || q.includes('namaskara') || q.includes('namaste') || q.includes('hey') || q === '') {
    return {
      text: `🙏 **Namaskara boss! Welcome to Book Driver Anna!**\n\nI am your **Anna AI Assistant**. How can I help you today?\n\n• Need an **In-City Hourly Driver** (Starts ₹199)?\n• Heading out for a **Night Party** in Indiranagar/Koramangala (Starts ₹399)?\n• Planning an **Outstation Trip** to Coorg, Nandi Hills or Mysore (Starts ₹1,199)?\n• Want to **Rent a Sedan, SUV or Tempo Traveller**?\n• Want to **Learn Driving with Anna** (Classes start ₹2,999)?\n\nAsk me anything about fares, routes, or click a quick option below!`,
      actions: [
        { label: '🚗 Hourly Driver Rates', query: 'What are hourly driver rates?' },
        { label: '🎓 Driving Classes', query: 'Tell me about driving classes and fees' },
        { label: '🌙 Night Party Driver', query: 'Tell me about night party driver' },
        { label: '🛣️ Outstation Trips', query: 'Outstation trips to Coorg and Mysore' },
        { label: '🚙 Rental Vehicles', query: 'What rental cars and buses do you have?' }
      ]
    };
  }

  // Generic Catch-All
  return {
    text: `👍 **Got it boss!**\n\nAt **Book Driver Anna**, we provide verified professional drivers for your own car (starts @ ₹199 for 2 hrs) as well as commercial rental vehicles (Sedans, SUVs, 12-seater Tempos & 24-seater Buses).\n\n• **Instant Booking**: Anna arrives promptly at your doorstep.\n• **24/7 Helpline**: +91 98765 43210.\n\nWould you like to book a driver for your car or rent a vehicle?`,
    actions: [
      { label: '🚗 Book a Driver', type: 'driver', data: { tripOption: 'round-trip' } },
      { label: '🚙 Book a Vehicle', type: 'vehicle', data: {} }
    ]
  };
}
