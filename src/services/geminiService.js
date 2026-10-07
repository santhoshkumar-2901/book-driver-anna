// Gemini AI Service for Book Driver Anna Assistant
import { SUPPORT_HELPLINE } from '../data/mockData';

const SYSTEM_PROMPT = `
You are "Anna AI", the official friendly, polite, and helpful customer support assistant for "Book Driver Anna" (Namma Bengaluru's #1 Driver & Vehicle Rental Service).
You speak in a warm, welcoming, respectful manner with authentic Bangalore warmth and hospitality (using friendly terms like "Namaskara boss!", "Don't worry anna, we've got you covered!").

Always provide direct, clear, and well-structured answers using bullet points and exact pricing when asked.

KEY INFORMATION ABOUT BOOK DRIVER ANNA SERVICES:

1. CITY DRIVER (For Customer's Own Car):
   - Pricing: Point-to-point distance-based driver pricing (starts @ ₹299 base fare).
   - Use Cases: City traffic commute, office runs to Whitefield/Electronic City, shopping trips, airport drops, hospital visits, family errands.
   - Highlights: Manual & Automatic car specialists, 100% background checked & police verified, prompt doorstep arrival.

2. OUTSTATION HIGHWAY & HILL DRIVER:
   - Pricing: Distance-based tiers (Up to 150 km @ ₹1,199, Up to 300 km @ ₹1,799, Up to 500 km @ ₹2,399).
   - Highlights: Ghat road & hill driving specialists, zero motion-sickness driving, clean driving records.
   - Popular Destinations:
     * Nandi Hills (60 km, ~1.5 hrs)
     * Mysore / Mysuru via Expressway (145 km, ~2.5 hrs)
     * Chikmagalur (240 km, ~4.5 hrs)
     * Coorg / Madikeri (265 km, ~5.5 hrs)
     * Ooty (270 km, ~6 hrs)
     * Wayanad (280 km, ~6 hrs)
     * Pondicherry (310 km, ~6.5 hrs)

3. MONTHLY / CORPORATE DEDICATED DRIVER:
   - Pricing: Starts @ ₹18,000 / month.
   - Features: Dedicated Anna, 100% document & police verified, uniformed, free driver replacement within 24 hours, GST billing for companies.

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
   - Hotline: ${SUPPORT_HELPLINE} (24x7 support).
   - Booking: Customer can easily click the "Book a Driver", "Book a Vehicle", or "Driving Class" buttons on the screen.

Keep responses concise, cheerful, accurate, and encourage the customer to book right away!
`;

// Safe no-op helpers for compatibility
export const getActiveApiKey = () => '';
export const saveActiveApiKey = () => {};

/**
 * Call Gemini AI via secure backend proxy (/api/chat).
 * If the backend is unavailable or unconfigured, falls back seamlessly to
 * the local offline knowledge base engine.
 */
export async function sendQueryToGemini(messages) {
  const lastUserMsg = [...messages].reverse().find(m => m.sender === 'user');
  const userText = lastUserMsg ? lastUserMsg.text : '';

  try {
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
    // Continue to local knowledge-base fallback
  }

  // Graceful offline knowledge-base fallback
  const offline = getOfflineKnowledgeResponse(userText);
  return offline.text;
}

/**
 * Intelligent Local Knowledge-Base Fallback
 * Provides instant answers even when offline or before the API key is entered
 */
export function getOfflineKnowledgeResponse(query) {
  const q = query.toLowerCase().trim();

  // 1. Pricing / Rates / Fares
  if (q.includes('rate') || q.includes('price') || q.includes('cost') || q.includes('fare') || q.includes('charge') || q.includes('how much')) {
    if (q.includes('outstation') || q.includes('coorg') || q.includes('mysore') || q.includes('ooty') || q.includes('nandi')) {
      return {
        text: `🛣️ **Outstation Driver Pricing (Distance-Based)**:\n\n• **Up to 150 km**: ₹1,199 (Mysuru, Hassan)\n• **Up to 300 km**: ₹1,799 (Coorg, Chikmagalur)\n• **Up to 500 km**: ₹2,399 (Wayanad, Ooty, Chennai)\n• **Includes**: Experienced ghat & highway drivers, food allowance guidelines, return bus allowance.`,
        actions: [{ label: '🛣️ Book Outstation Anna', type: 'driver', data: { driverTripOption: 'outstation' } }]
      };
    }
    if (q.includes('monthly') || q.includes('month') || q.includes('corporate') || q.includes('full time')) {
      return {
        text: `💼 **Monthly / Corporate Driver Fares**:\n\n• **Starting Rate**: ₹18,000 / month\n• **Driver**: Dedicated, background checked & police verified Anna\n• **Guarantee**: Free replacement within 24 hours if Anna is unwell\n• **Billing**: Monthly GST invoicing available for companies.`,
        actions: [{ label: '💼 Inquire Corporate Driver', type: 'driver', data: { driverTripOption: 'one-way' } }]
      };
    }
    return {
      text: `💰 **Book Driver Anna Fares Overview**:\n\n• **City Driver**: Starts @ **₹299** base (point-to-point distance-based driver for your car)\n• **Outstation Driver**: From **₹1,199** (150 km), **₹1,799** (300 km), **₹2,399** (500 km)\n• **Monthly Corporate Driver**: Starts @ **₹18,000** / month\n\n• **Car Rentals (Vehicle + Driver)**:\n  - Sedan (Dzire/Etios): ₹1,999/day\n  - SUV (Innova/Ertiga): ₹3,499/day\n  - 12-Seater Tempo: ₹5,499/day`,
      actions: [
        { label: '🚗 Book City Driver', type: 'driver', data: { driverTripOption: 'one-way' } },
        { label: '🚙 Rent a Vehicle', type: 'vehicle', data: {} }
      ]
    };
  }

  // 2. City / Night Driving
  if (q.includes('night') || q.includes('party') || q.includes('alcohol') || q.includes('drink') || q.includes('pub') || q.includes('club') || q.includes('koramangala') || q.includes('indiranagar')) {
    return {
      text: `🚗 **Safe City Drive Home**:\n\nReturning late from Indiranagar, Koramangala, or UB City? Anna will drive your car home safely 24/7!\n\n• **Fare**: Standard distance-based City Driver rate (starts @ ₹299 base)\n• **Hours**: Available 24/7\n• **Safety**: Strict police-verified Annas with live GPS tracking and safe doorstep drop.\n\nReady to book your driver Anna?`,
      actions: [{ label: '🚗 Book City Driver', type: 'driver', data: { driverTripOption: 'one-way' } }]
    };
  }

  // 3. Outstation Trips
  if (q.includes('outstation') || q.includes('coorg') || q.includes('mysore') || q.includes('mysuru') || q.includes('ooty') || q.includes('chikmagalur') || q.includes('nandi') || q.includes('wayanad') || q.includes('pondicherry') || q.includes('highway') || q.includes('hill') || q.includes('ghat')) {
    return {
      text: `🌄 **Outstation Driver Anna Service**:\n\nPlanning a highway getaway? Our experienced highway & ghat-road Annas know the smoothest routes and best roadside breakfast stops!\n\n• **Distance Tiers**:\n  - **Up to 150 km**: ₹1,199 (Mysore, Nandi Hills)\n  - **Up to 300 km**: ₹1,799 (Chikmagalur, Coorg)\n  - **Up to 500 km**: ₹2,399 (Ooty, Wayanad, Chennai)\n• **Benefits**: Safe ghat driving, zero motion sickness, return bus allowance included.`,
      actions: [{ label: '🛣️ Book Outstation Driver', type: 'driver', data: { driverTripOption: 'outstation' } }]
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
      text: `✈️ **Kempegowda Airport (BLR T1 / T2) Service**:\n\n• **Drive Your Car**: Normal City Driver booking with standard distance pricing! Anna drops you at Terminal 1 or 2 safely.\n• **Rental Sedan/SUV**: Airport pickup or drop starting at ₹1,499 all-inclusive.\n• **Punctuality**: 100% on-time guarantee. Annas know the airport expressway bypasses!`,
      actions: [
        { label: '🚗 Driver For Airport Drop', type: 'driver', data: { driverTripOption: 'one-way' } },
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
      text: `🙏 **Namaskara boss! Welcome to Book Driver Anna!**\n\nI am your **Anna AI Assistant**. How can I help you today?\n\n• Need a **City Driver** (Point A to Point B drop across Bangalore from ₹299)?\n• Planning an **Outstation Trip** to Coorg, Nandi Hills or Mysore (Distance-based from ₹1,199)?\n• Need a dedicated **Monthly Corporate Driver**?\n• Want to **Rent a Sedan, SUV or Tempo Traveller**?\n• Want to **Learn Driving with Anna** (Classes start ₹2,999)?\n\nAsk me anything about fares, routes, or click a quick option below!`,
      actions: [
        { label: '🚗 City Driver Drop', query: 'What are city driver rates?' },
        { label: '🎓 Driving Classes', query: 'Tell me about driving classes and fees' },
        { label: '💼 Monthly Corporate Driver', query: 'Tell me about monthly corporate driver' },
        { label: '🛣️ Outstation Trips', query: 'Outstation trips to Coorg and Mysore' },
        { label: '🚙 Rental Vehicles', query: 'What rental cars and buses do you have?' }
      ]
    };
  }

  // Generic Catch-All
  return {
    text: `👍 **Got it boss!**\n\nAt **Book Driver Anna**, we provide verified professional drivers for your own car (distance-based City Drops from ₹299 & Outstation from ₹1,199) as well as commercial rental vehicles (Sedans, SUVs, 12-seater Tempos & 24-seater Buses).\n\n• **Instant Booking**: Anna arrives promptly at your doorstep.\n• **24/7 Helpline**: ${SUPPORT_HELPLINE}.\n\nWould you like to book a driver for your car or rent a vehicle?`,
    actions: [
      { label: '🚗 Book a Driver', type: 'driver', data: { driverTripOption: 'one-way' } },
      { label: '🚙 Book a Vehicle', type: 'vehicle', data: {} }
    ]
  };
}
