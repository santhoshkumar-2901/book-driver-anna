/**
 * Server-Side Authoritative Pricing Calculation Engine
 * 
 * NEVER TRUST client-sent prices. Every booking fare is calculated
 * and validated authoritatively by this service.
 */

const DRIVING_CLASS_PRICES = {
  'class-beginner': 5999,
  'class-refresher': 3499,
  'class-own-car': 2999,
  'class-automatic': 3999
};

const VEHICLE_BASE_RATES = {
  'Sedan': 1999,
  'SUV': 3499,
  '12 Seater': 5499,
  '24 Seater': 7999,
  '32 Seater': 10999
};

export function calculateAuthoritativeFare(bookingDetails) {
  const {
    bookingCategory = 'driver',
    selectedClassId = 'class-beginner',
    vehicleCategory = 'Sedan',
    driverTripOption = 'one-way',
    dropLocation = '',
    roundTripDuration = '4hr',
    outstationTripType = 'round-trip',
    outstationPackage = 'Round trip 24hr'
  } = bookingDetails;

  let basePrice = 299;

  // 1. Driving Class Pricing (all-inclusive flat rate)
  if (bookingCategory === 'class') {
    basePrice = DRIVING_CLASS_PRICES[selectedClassId] || 5999;
    return {
      basePrice,
      gst: 0,
      totalFare: basePrice,
      currency: 'INR'
    };
  }

  // 2. Vehicle Rental Fleet Pricing
  if (bookingCategory === 'vehicle') {
    basePrice = VEHICLE_BASE_RATES[vehicleCategory] || 1999;
    const gst = Math.round(basePrice * 0.05);
    return {
      basePrice,
      gst,
      totalFare: basePrice + gst,
      currency: 'INR'
    };
  }

  // 3. Driver Service Pricing
  if (driverTripOption === 'one-way') {
    // Airport drops have premium highway toll / distance tier
    const isAirport = typeof dropLocation === 'string' && dropLocation.toLowerCase().includes('airport');
    basePrice = isAirport ? 899 : 299;
  } else if (driverTripOption === 'round-trip') {
    if (roundTripDuration.includes('2hr')) basePrice = 199;
    else if (roundTripDuration.includes('4hr')) basePrice = 349;
    else if (roundTripDuration.includes('8hr')) basePrice = 599;
    else if (roundTripDuration.includes('12hr')) basePrice = 899;
    else basePrice = 349;
  } else if (driverTripOption === 'outstation') {
    if (outstationTripType === 'one-way') {
      if (outstationPackage.includes('150 km')) basePrice = 1199;
      else if (outstationPackage.includes('300 km')) basePrice = 1799;
      else if (outstationPackage.includes('500 km')) basePrice = 2399;
      else basePrice = 1499;
    } else {
      if (outstationPackage.includes('12hr')) basePrice = 1199;
      else if (outstationPackage.includes('24hr')) basePrice = 1999;
      else if (outstationPackage.includes('46hr')) basePrice = 3899;
      else if (outstationPackage.includes('72hr')) basePrice = 5799;
      else basePrice = 1999;
    }
  }

  const gst = Math.round(basePrice * 0.05);
  const totalFare = basePrice + gst;

  return {
    basePrice,
    gst,
    totalFare,
    currency: 'INR'
  };
}
