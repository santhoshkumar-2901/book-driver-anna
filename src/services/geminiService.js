// Gemini AI Service for Book Driver Anna Assistant
import { SUPPORT_HELPLINE } from '../data/mockData.js';

// Safe no-op helpers for compatibility
export const getActiveApiKey = () => '';
export const saveActiveApiKey = () => {};

/**
 * Call Gemini AI via secure backend proxy (/api/chat).
 * If the backend is unavailable or unconfigured, falls back seamlessly to
 * the local offline knowledge base engine.
 */
export async function sendQueryToGemini(messages, pricingMap = null) {
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
  const offline = getOfflineKnowledgeResponse(userText, pricingMap);
  return offline.text;
}

/**
 * Intelligent Local Knowledge-Base Fallback
 * Provides instant answers even when offline or before the API key is entered
 */
export function getOfflineKnowledgeResponse(query, pricingMap = null) {
  const q = (query || '').toLowerCase().trim();
  const p = (id, fallback) => {
    if (pricingMap && pricingMap[id] && typeof pricingMap[id].price === 'number') {
      return pricingMap[id].price;
    }
    return fallback;
  };

  // 1. Pricing / Rates / Fares
  if (q.includes('rate') || q.includes('price') || q.includes('cost') || q.includes('fare') || q.includes('charge') || q.includes('how much')) {
    if (q.includes('outstation') || q.includes('coorg') || q.includes('mysore') || q.includes('ooty') || q.includes('nandi')) {
      return {
        text: `🛣️ **Outstation Driver Pricing (Distance-Based)**:\n\n• **Distance Rate**: ₹${p('driver_price_per_km', 15)}/km road distance (Base starting fare ₹${p('driver_base_fare', 100)}, Min fare ₹${p('driver_min_fare', 150)})\n• **Round Trips**: Billable distance is 2 × outbound route distance\n• **Exact Fares**: The booking system calculates total fare authoritatively based on verified map routing\n• **Includes**: Police-verified highway & ghat road specialists. Food & return allowance guidelines apply.`,
        actions: [{ label: '🛣️ Book Outstation Anna', type: 'driver', data: { driverTripOption: 'outstation' } }]
      };
    }
    if (q.includes('monthly') || q.includes('month') || q.includes('corporate') || q.includes('full time')) {
      return {
        text: `💼 **Monthly / Corporate Driver Fares**:\n\n• **Starting Rate**: ₹${p('driver_monthly', 18000).toLocaleString('en-IN')} / month\n• **Driver**: Dedicated, background checked & police verified Anna\n• **Guarantee**: Free replacement within 24 hours if Anna is unwell\n• **Billing**: Monthly GST invoicing available for companies.`,
        actions: [{ label: '💼 Inquire Corporate Driver', type: 'driver', data: { driverTripOption: 'one-way' } }]
      };
    }
    return {
      text: `💰 **Book Driver Anna Fares Overview**:\n\n• **City & Outstation Driver**: ₹${p('driver_price_per_km', 15)}/km road distance (Base ₹${p('driver_base_fare', 100)}, Min ₹${p('driver_min_fare', 150)}; City drop flat estimate ₹${p('driver_one_way_city', 299)})\n• **Monthly Corporate Driver**: Starts @ ₹${p('driver_monthly', 18000).toLocaleString('en-IN')} / month\n\n• **Fleet Car Rentals (Vehicle + Driver)**:\n  - Sedan (Dzire/Etios): ₹${p('vehicle_sedan_daily', 1999).toLocaleString('en-IN')}/day (Outstation: ₹${p('vehicle_sedan_km', 14)}/km)\n  - SUV (Innova/Ertiga): ₹${p('vehicle_suv_daily', 3499).toLocaleString('en-IN')}/day (Outstation: ₹${p('vehicle_suv_km', 20)}/km)\n  - 12-Seater Tempo: ₹${p('vehicle_tempo_12_daily', 5499).toLocaleString('en-IN')}/day (Outstation: ₹${p('vehicle_tempo_12_km', 26)}/km)\n  - 24-Seater Mini Bus: ₹${p('vehicle_bus_24_daily', 7999).toLocaleString('en-IN')}/day (Outstation: ₹${p('vehicle_bus_24_km', 34)}/km)\n  - 32-Seater Luxury Coach: ₹${p('vehicle_coach_32_daily', 10999).toLocaleString('en-IN')}/day (Outstation: ₹${p('vehicle_coach_32_km', 42)}/km)`,
      actions: [
        { label: '🚗 Book City Driver', type: 'driver', data: { driverTripOption: 'one-way' } },
        { label: '🚙 Rent a Vehicle', type: 'vehicle', data: {} }
      ]
    };
  }

  // 2. City / Night Driving
  if (q.includes('night') || q.includes('party') || q.includes('alcohol') || q.includes('drink') || q.includes('pub') || q.includes('club') || q.includes('koramangala') || q.includes('indiranagar')) {
    return {
      text: `🚗 **Safe City Drive Home**:\n\nReturning late from Indiranagar, Koramangala, or Central Bangalore? Anna will drive your car home safely 24/7!\n\n• **Fare**: Standard distance pricing @ ₹${p('driver_price_per_km', 15)}/km (City drop flat estimate ₹${p('driver_one_way_city', 299)}, Min ₹${p('driver_min_fare', 150)})\n• **Safety**: Strict police-verified Annas with live GPS tracking and safe doorstep drop.\n\nReady to book your driver Anna?`,
      actions: [{ label: '🚗 Book City Driver', type: 'driver', data: { driverTripOption: 'one-way' } }]
    };
  }

  // 3. Outstation Trips
  if (q.includes('outstation') || q.includes('coorg') || q.includes('mysore') || q.includes('mysuru') || q.includes('ooty') || q.includes('chikmagalur') || q.includes('nandi') || q.includes('wayanad') || q.includes('pondicherry') || q.includes('highway') || q.includes('hill') || q.includes('ghat')) {
    return {
      text: `🌄 **Outstation Driver Anna Service**:\n\nPlanning a highway getaway? Our experienced highway & ghat-road Annas know the smoothest routes across South India!\n\n• **Distance-Based Fare**: ₹${p('driver_price_per_km', 15)}/km road distance (Base ₹${p('driver_base_fare', 100)}, Min ₹${p('driver_min_fare', 150)})\n• **Round Trips**: Billed on 2 × outbound route distance\n• **Exact Fares**: Calculated authoritatively by the booking system based on verified map distance\n• **Benefits**: Safe ghat driving, clean driving records, verified background checks.`,
      actions: [{ label: '🛣️ Book Outstation Driver', type: 'driver', data: { driverTripOption: 'outstation' } }]
    };
  }

  // 4. Vehicle Rentals / Cars
  if (q.includes('car') || q.includes('vehicle') || q.includes('rent') || q.includes('sedan') || q.includes('suv') || q.includes('innova') || q.includes('tempo') || q.includes('traveller') || q.includes('bus') || q.includes('dzire') || q.includes('coach')) {
    return {
      text: `🚘 **Rental Vehicles with Driver Fleet**:\n\nRent one of our commercial vehicles with a courteous Anna:\n\n1. **Sedan (Dzire / Honda City / Etios)**: 4 seats | ₹${p('vehicle_sedan_daily', 1999).toLocaleString('en-IN')}/day (Outstation: ₹${p('vehicle_sedan_km', 14)}/km)\n2. **SUV (Innova Crysta / Ertiga)**: 6-7 seats | ₹${p('vehicle_suv_daily', 3499).toLocaleString('en-IN')}/day (Outstation: ₹${p('vehicle_suv_km', 20)}/km)\n3. **12-Seater Luxury Tempo Traveller**: 12 seats | ₹${p('vehicle_tempo_12_daily', 5499).toLocaleString('en-IN')}/day (Outstation: ₹${p('vehicle_tempo_12_km', 26)}/km)\n4. **24-Seater Executive Bus**: 24 seats | ₹${p('vehicle_bus_24_daily', 7999).toLocaleString('en-IN')}/day (Outstation: ₹${p('vehicle_bus_24_km', 34)}/km)\n5. **32-Seater VIP Coach**: 32 seats | ₹${p('vehicle_coach_32_daily', 10999).toLocaleString('en-IN')}/day (Outstation: ₹${p('vehicle_coach_32_km', 42)}/km)`,
      actions: [
        { label: '🚙 Rent Sedan / SUV', type: 'vehicle', data: { category: 'Sedan' } },
        { label: '🚐 Rent Tempo / Bus', type: 'vehicle', data: { category: '12 Seater' } }
      ]
    };
  }

  // 5. Airport BLR
  if (q.includes('airport') || q.includes('blr') || q.includes('terminal') || q.includes('flight') || q.includes('kempegowda')) {
    return {
      text: `✈️ **Kempegowda Airport (BLR T1 / T2) Service**:\n\n• **Drive Your Car**: Normal City Driver booking with standard distance pricing @ ₹${p('driver_price_per_km', 15)}/km (min ₹${p('driver_min_fare', 150)}). Anna drops you at Terminal 1 or 2 safely.\n• **Rental Vehicles**: Spotless Sedans and SUVs available at daily rental rates.\n• **Punctuality**: 100% on-time arrival. Annas know airport expressway bypasses!`,
      actions: [
        { label: '🚗 Driver For Airport Drop', type: 'driver', data: { driverTripOption: 'one-way' } },
        { label: '✈️ Rent Airport Cab', type: 'vehicle', data: { category: 'Sedan' } }
      ]
    };
  }

  // 6. Verification / Safety / Trust
  if (q.includes('safe') || q.includes('police') || q.includes('verify') || q.includes('verified') || q.includes('trust') || q.includes('background') || q.includes('license')) {
    return {
      text: `🛡️ **100% Safety & Verification Guarantee**:\n\n• **Police Verified**: Every Anna undergoes criminal background checks & Aadhaar KYC.\n• **Driving Experience**: Commercial & private driving experience with clean records.\n• **Live Tracking**: Live GPS tracking shared during active trips.\n• **Zero Cancellation Penalty**: ₹0 cancellation fee before driver departs for trip.`,
      actions: [{ label: '🚗 Book Verified Anna', type: 'driver', data: { tripOption: 'round-trip' } }]
    };
  }

  // 7. Areas Covered
  if (q.includes('area') || q.includes('where') || q.includes('location') || q.includes('coverage') || q.includes('whitefield') || q.includes('hsr') || q.includes('electronic city') || q.includes('hebbal') || q.includes('indiranagar')) {
    return {
      text: `📍 **Service Areas Across Bangalore**:\n\nWe cover major hubs across Namma Bengaluru with **doorstep arrival**:\n\n• Indiranagar, Koramangala & HSR Layout\n• Whitefield, Marathahalli & Bellandur\n• Electronic City & BTM Layout\n• MG Road, Brigade Road & Central Bangalore\n• Hebbal, Yelahanka & Sahakarnagar\n• Rajajinagar, Malleshwaram & Banashankari\n• Kempegowda International Airport (BLR T1/T2)`,
      actions: [{ label: '🚗 Book Driver in Bangalore', type: 'driver', data: { tripOption: 'round-trip' } }]
    };
  }

  // 8. Monthly Driver
  if (q.includes('monthly') || q.includes('daily') || q.includes('corporate') || q.includes('office') || q.includes('contract')) {
    return {
      text: `💼 **Monthly Driver Subscription**:\n\nNeed a dedicated Anna for daily office commutes, school drops, or executive family travel?\n\n• **Pricing**: Starts @ ₹${p('driver_monthly', 18000).toLocaleString('en-IN')} / month\n• **Schedule**: 8-10 hrs / day, 6 days a week\n• **Assurance**: Free driver replacement within 24 hours if Anna takes leave\n• **Payment**: Transparent billing with GST invoicing for companies.`,
      actions: [{ label: '📞 Request Monthly Driver', type: 'driver', data: { tripOption: 'round-trip' } }]
    };
  }

  // 9. Driving Classes & Training
  if (q.includes('class') || q.includes('learn') || q.includes('teach') || q.includes('school') || q.includes('course') || q.includes('training') || q.includes('beginner') || q.includes('refresher')) {
    return {
      text: `🎓 **Driving Classes with Driver Anna (Learn Without Fear)**:\n\nOur patient, certified Annas coach you 1-on-1 at your doorstep with zero shouting:\n\n1. **Beginner Comprehensive Course (15 Days)**: ₹${p('class_beginner', 5999).toLocaleString('en-IN')}\n   • Basics, clutch/gear coordination, Bangalore traffic, flyovers, reverse & parallel parking, RTO assistance.\n2. **City Confidence & Refresher (7 Days)**: ₹${p('class_refresher', 3499).toLocaleString('en-IN')}\n   • Conquer Silk Board traffic, tight mall parking, flyovers & night driving.\n3. **Learn in Your Own Car (7 Days)**: ₹${p('class_own_car', 2999).toLocaleString('en-IN')}\n   • Master your exact daily office route & apartment basement parking in your own vehicle!\n4. **Automatic Car Specialization (7 Days)**: ₹${p('class_automatic', 3999).toLocaleString('en-IN')}\n   • Master automatic AMT/CVT/DCT cars, creep mode & hill-hold.\n\n• **Training Vehicle**: Choose between **Anna's Dual-Control Car** or **Your Own Car**.\n• **Flexible Batches**: Early morning (6-8 AM) or evening (5-7 PM).`,
      actions: [
        { label: '🎓 Enroll in Driving Class', type: 'class', data: { selectedClassId: 'class-beginner' } },
        { label: '🚗 Learn in Own Car', type: 'class', data: { selectedClassId: 'class-own-car' } }
      ]
    };
  }

  // 10. Greetings & Default
  if (q.includes('hi') || q.includes('hello') || q.includes('namaskara') || q.includes('namaste') || q.includes('hey') || q === '') {
    return {
      text: `🙏 **Namaskara boss! Welcome to Book Driver Anna!**\n\nI am your **Anna AI Assistant**. How can I help you today?\n\n• Need a **City or Outstation Driver** (₹${p('driver_price_per_km', 15)}/km road distance, min ₹${p('driver_min_fare', 150)})?\n• Need a dedicated **Monthly Corporate Driver**?\n• Want to **Rent a Sedan, SUV, Tempo Traveller or Bus**?\n• Want to **Learn Driving with Anna** (Classes start ₹${p('class_own_car', 2999).toLocaleString('en-IN')})?\n\nAsk me anything about fares, routes, or click a quick option below!`,
      actions: [
        { label: '🚗 City Driver Drop', query: 'What are city driver rates?' },
        { label: '🎓 Driving Classes', query: 'Tell me about driving classes and fees' },
        { label: '💼 Monthly Corporate Driver', query: 'Tell me about monthly corporate driver' },
        { label: '🛣️ Outstation Trips', query: 'Tell me about outstation driver trips and rates' },
        { label: '🚙 Rental Vehicles', query: 'What rental cars and buses do you have?' }
      ]
    };
  }

  // Generic Catch-All
  return {
    text: `👍 **Got it boss!**\n\nAt **Book Driver Anna**, we provide verified professional drivers for your own car (distance-based pricing @ ₹${p('driver_price_per_km', 15)}/km, min ₹${p('driver_min_fare', 150)}) as well as commercial rental vehicles (Sedans, SUVs, 12-seater Tempos, Buses & Coaches).\n\n• **Instant Booking**: Prompt doorstep arrival across Bengaluru.\n• **24/7 Helpline**: ${SUPPORT_HELPLINE}.\n\nWould you like to book a driver for your car or rent a vehicle?`,
    actions: [
      { label: '🚗 Book a Driver', type: 'driver', data: { driverTripOption: 'one-way' } },
      { label: '🚙 Book a Vehicle', type: 'vehicle', data: {} }
    ]
  };
}
