import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiClient';

export const DEFAULT_PRICING_MAP = {
  // Driver Services
  driver_hourly_2hr: { id: 'driver_hourly_2hr', category: 'driver', name: 'In-City Hourly Driver (2 Hours)', price: 199, unit: '/ 2 hrs', description: 'Minimum 2-hour in-city acting driver package' },
  driver_hourly_4hr: { id: 'driver_hourly_4hr', category: 'driver', name: 'In-City Hourly Driver (4 Hours)', price: 349, unit: '/ 4 hrs', description: '4-hour city errand, shopping & commute package' },
  driver_hourly_6hr: { id: 'driver_hourly_6hr', category: 'driver', name: 'In-City Hourly Driver (6 Hours)', price: 499, unit: '/ 6 hrs', description: '6-hour flexible city travel and business commute package' },
  driver_hourly_8hr: { id: 'driver_hourly_8hr', category: 'driver', name: 'In-City Hourly Driver (8 Hours)', price: 599, unit: '/ 8 hrs', description: '8-hour full day in-city driver package' },
  driver_hourly_12hr: { id: 'driver_hourly_12hr', category: 'driver', name: 'In-City Hourly Driver (12 Hours)', price: 899, unit: '/ 12 hrs', description: '12-hour extended city driving package' },
  driver_base_fare: { id: 'driver_base_fare', category: 'driver', name: 'Base Fare', price: 100, unit: 'booking', description: 'Base starting fare for distance rides' },
  driver_price_per_km: { id: 'driver_price_per_km', category: 'driver', name: 'Price Per KM', price: 15, unit: 'km', description: 'Distance rate per kilometer for driver services' },
  driver_min_fare: { id: 'driver_min_fare', category: 'driver', name: 'Minimum Fare', price: 150, unit: 'booking', description: 'Minimum charge for distance rides' },
  driver_one_way_city: { id: 'driver_one_way_city', category: 'driver', name: 'One-Way City Drop', price: 299, unit: 'flat', description: 'Point A to Point B drop across Bangalore' },
  driver_airport_drop: { id: 'driver_airport_drop', category: 'driver', name: 'Kempegowda Airport (BLR T1/T2) Drop', price: 899, unit: 'flat', description: 'Dedicated airport drop with zero return fare' },
  driver_night_party: { id: 'driver_night_party', category: 'driver', name: 'Night Party Driver', price: 399, unit: '/ trip', description: 'Late-night safe ride home from Indiranagar/Koramangala' },
  driver_outstation_12hr: { id: 'driver_outstation_12hr', category: 'driver', name: 'Outstation Driver (Round Trip 12hr)', price: 1199, unit: '/ 12 hrs', description: 'Day getaway highway driver' },
  driver_outstation_24hr: { id: 'driver_outstation_24hr', category: 'driver', name: 'Outstation Driver (Round Trip 24hr)', price: 1999, unit: '/ day', description: 'Weekend road trip driver package' },
  driver_outstation_46hr: { id: 'driver_outstation_46hr', category: 'driver', name: 'Outstation Driver (Round Trip 46hr)', price: 3899, unit: '/ 46 hrs', description: 'Multi-day long getaway driver' },
  driver_outstation_72hr: { id: 'driver_outstation_72hr', category: 'driver', name: 'Outstation Driver (Round Trip 72hr)', price: 5799, unit: '/ 72 hrs', description: 'Extended vacation tour driver' },
  driver_outstation_150km: { id: 'driver_outstation_150km', category: 'driver', name: 'Outstation Driver One-Way (Up to 150 km)', price: 1199, unit: 'flat', description: 'One-way intercity drop up to 150 km' },
  driver_outstation_300km: { id: 'driver_outstation_300km', category: 'driver', name: 'Outstation Driver One-Way (Up to 300 km)', price: 1799, unit: 'flat', description: 'One-way intercity drop up to 300 km' },
  driver_outstation_500km: { id: 'driver_outstation_500km', category: 'driver', name: 'Outstation Driver One-Way (Up to 500 km)', price: 2399, unit: 'flat', description: 'One-way intercity drop up to 500 km' },
  driver_monthly: { id: 'driver_monthly', category: 'driver', name: 'Monthly Corporate Driver', price: 18000, unit: '/ month', description: 'Dedicated full-time driver contract with replacements' },

  // Fleet Vehicle Rentals
  vehicle_sedan_daily: { id: 'vehicle_sedan_daily', category: 'vehicle', name: 'Sedan (Dzire / Honda City) Daily Rate', price: 1999, unit: '/ day', description: 'Comfortable 4-seater executive sedan with driver' },
  vehicle_sedan_km: { id: 'vehicle_sedan_km', category: 'vehicle', name: 'Sedan Outstation Rate Per Km', price: 14, unit: '/ km', description: 'Outstation per-kilometer distance rate' },
  vehicle_suv_daily: { id: 'vehicle_suv_daily', category: 'vehicle', name: '7-Seater SUV (Innova / Ertiga) Daily Rate', price: 3499, unit: '/ day', description: 'Spacious family 6-7 seater SUV with driver' },
  vehicle_suv_km: { id: 'vehicle_suv_km', category: 'vehicle', name: 'SUV Outstation Rate Per Km', price: 20, unit: '/ km', description: 'Outstation per-kilometer distance rate' },
  vehicle_tempo_12_daily: { id: 'vehicle_tempo_12_daily', category: 'vehicle', name: '12 Seater Luxury Tempo Daily Rate', price: 5499, unit: '/ day', description: 'Group travel 12-seater luxury tempo traveller' },
  vehicle_tempo_12_km: { id: 'vehicle_tempo_12_km', category: 'vehicle', name: '12 Seater Outstation Rate Per Km', price: 26, unit: '/ km', description: 'Outstation per-kilometer distance rate' },
  vehicle_bus_24_daily: { id: 'vehicle_bus_24_daily', category: 'vehicle', name: '24 Seater Executive Mini Bus Daily Rate', price: 7999, unit: '/ day', description: 'Executive 24-seater bus for functions & events' },
  vehicle_bus_24_km: { id: 'vehicle_bus_24_km', category: 'vehicle', name: '24 Seater Outstation Rate Per Km', price: 34, unit: '/ km', description: 'Outstation per-kilometer distance rate' },
  vehicle_coach_32_daily: { id: 'vehicle_coach_32_daily', category: 'vehicle', name: '32 Seater Luxury Coach Daily Rate', price: 10999, unit: '/ day', description: 'VIP 32-seater luxury coach bus with air suspension' },
  vehicle_coach_32_km: { id: 'vehicle_coach_32_km', category: 'vehicle', name: '32 Seater Outstation Rate Per Km', price: 42, unit: '/ km', description: 'Outstation per-kilometer distance rate' },

  // Driving Academy
  class_beginner: { id: 'class_beginner', category: 'class', name: 'Beginner Comprehensive Course (15 Days)', price: 5999, unit: 'all-inclusive', description: '15-day course from zero experience to full Bangalore confidence' },
  class_refresher: { id: 'class_refresher', category: 'class', name: 'City Confidence & Refresher (7 Days)', price: 3499, unit: 'all-inclusive', description: '7-day traffic & peak-hour confidence builder course' },
  class_own_car: { id: 'class_own_car', category: 'class', name: 'Learn in Your Own Car (7 Days)', price: 2999, unit: 'all-inclusive', description: 'Doorstep personalized training in your personal vehicle' },
  class_automatic: { id: 'class_automatic', category: 'class', name: 'Automatic Car Specialization (7 Days)', price: 3999, unit: 'all-inclusive', description: 'AMT / CVT / DCT dual-pedal specialization course' }
};

const PricingContext = createContext(null);

export function PricingProvider({ children }) {
  const [pricing, setPricing] = useState(() => {
    try {
      const cached = localStorage.getItem('bda_service_pricing');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_PRICING_MAP, ...parsed };
        }
      }
    } catch (e) {}
    return DEFAULT_PRICING_MAP;
  });

  const [isLoading, setIsLoading] = useState(false);

  const fetchPricing = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getPublicPricing();
      if (res && res.data && res.data.map) {
        setPricing((prev) => {
          const next = { ...prev, ...res.data.map };
          try {
            localStorage.setItem('bda_service_pricing', JSON.stringify(next));
          } catch (e) {}
          return next;
        });
      }
    } catch (err) {
      console.warn('[PRICING CONTEXT] Failed to fetch live pricing from server, using local cache:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPricing();

    const handlePricingUpdated = (e) => {
      if (e?.detail?.pricing) {
        setPricing((prev) => {
          const next = { ...prev, ...e.detail.pricing };
          try {
            localStorage.setItem('bda_service_pricing', JSON.stringify(next));
          } catch (err) {}
          return next;
        });
      } else {
        fetchPricing();
      }
    };

    window.addEventListener('bda_pricing_updated', handlePricingUpdated);
    window.addEventListener('storage', (e) => {
      if (e.key === 'bda_service_pricing' && e.newValue) {
        try {
          setPricing(JSON.parse(e.newValue));
        } catch (err) {}
      }
    });

    return () => {
      window.removeEventListener('bda_pricing_updated', handlePricingUpdated);
    };
  }, [fetchPricing]);

  const getPrice = useCallback((id, fallback = 0) => {
    if (pricing[id] && typeof pricing[id].price === 'number') {
      return pricing[id].price;
    }
    const def = DEFAULT_PRICING_MAP[id];
    return def ? def.price : fallback;
  }, [pricing]);

  const formatPrice = useCallback((id, fallback = 0) => {
    const val = getPrice(id, fallback);
    return `₹${val.toLocaleString('en-IN')}`;
  }, [getPrice]);

  const getUnit = useCallback((id, fallback = '') => {
    if (pricing[id] && pricing[id].unit) {
      return pricing[id].unit;
    }
    const def = DEFAULT_PRICING_MAP[id];
    return def ? def.unit : fallback;
  }, [pricing]);

  const broadcastUpdatedPricing = (newMap) => {
    setPricing(newMap);
    try {
      localStorage.setItem('bda_service_pricing', JSON.stringify(newMap));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('bda_pricing_updated', { detail: { pricing: newMap } }));
  };

  const updatePricing = async (items) => {
    const res = await apiClient.updateAdminPricing(items);
    if (res && res.data && res.data.map) {
      broadcastUpdatedPricing(res.data.map);
    }
    return res;
  };

  const resetPricing = async () => {
    const res = await apiClient.resetAdminPricing();
    if (res && res.data && res.data.map) {
      broadcastUpdatedPricing(res.data.map);
    }
    return res;
  };

  const value = {
    pricing,
    pricingList: Object.values(pricing),
    getPrice,
    formatPrice,
    getUnit,
    updatePricing,
    resetPricing,
    refreshPricing: fetchPricing,
    isLoading
  };

  return (
    <PricingContext.Provider value={value}>
      {children}
    </PricingContext.Provider>
  );
}

export function usePricing() {
  const ctx = useContext(PricingContext);
  if (!ctx) {
    // If used outside provider, return default accessor functions
    return {
      pricing: DEFAULT_PRICING_MAP,
      pricingList: Object.values(DEFAULT_PRICING_MAP),
      getPrice: (id, fallback = 0) => DEFAULT_PRICING_MAP[id]?.price ?? fallback,
      formatPrice: (id, fallback = 0) => `₹${(DEFAULT_PRICING_MAP[id]?.price ?? fallback).toLocaleString('en-IN')}`,
      getUnit: (id, fallback = '') => DEFAULT_PRICING_MAP[id]?.unit ?? fallback,
      updatePricing: async () => {},
      resetPricing: async () => {},
      refreshPricing: async () => {},
      isLoading: false
    };
  }
  return ctx;
}
