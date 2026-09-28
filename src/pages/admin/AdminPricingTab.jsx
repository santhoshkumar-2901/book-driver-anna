import React, { useState, useEffect } from 'react';
import { 
  Tag, Save, RotateCcw, Search, CheckCircle2, AlertCircle, 
  Car, GraduationCap, Clock, Sparkles, ShieldCheck, ArrowRight, RefreshCw, Info 
} from 'lucide-react';
import { SteeringWheel } from '../../components/Icons';
import { usePricing, DEFAULT_PRICING_MAP } from '../../context/PricingContext';

export default function AdminPricingTab() {
  const { pricing, pricingList, updatePricing, resetPricing, refreshPricing, isLoading } = usePricing();

  // Local editable draft state for prices: { [id]: priceNumber }
  const [draftPrices, setDraftPrices] = useState({});
  const [activeCategory, setActiveCategory] = useState('all'); // 'all', 'driver', 'vehicle', 'class'
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: '' }
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  // Sync draft state whenever incoming pricing updates
  useEffect(() => {
    if (pricing && typeof pricing === 'object') {
      const initial = {};
      for (const [key, item] of Object.entries(pricing)) {
        initial[key] = item.price;
      }
      setDraftPrices(initial);
    }
  }, [pricing]);

  const handlePriceChange = (id, value) => {
    // Only accept numeric input
    const cleanValue = value.replace(/[^0-9]/g, '');
    const num = cleanValue === '' ? '' : parseInt(cleanValue, 10);
    setDraftPrices(prev => ({
      ...prev,
      [id]: num
    }));
  };

  // Determine which items have been modified from current loaded pricing
  const modifiedKeys = Object.keys(draftPrices).filter(key => {
    const original = pricing[key]?.price;
    const current = draftPrices[key];
    return current !== '' && current !== undefined && current !== original;
  });

  const hasModifications = modifiedKeys.length > 0;

  const handleSaveChanges = async () => {
    if (!hasModifications) return;

    // Validate that all modified values are valid numbers > 0
    for (const key of modifiedKeys) {
      const val = draftPrices[key];
      if (val === '' || val === undefined || isNaN(val) || Number(val) < 0) {
        setStatusMessage({
          type: 'error',
          text: `Please enter a valid price for ${pricing[key]?.name || key}.`
        });
        return;
      }
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const payload = modifiedKeys.map(key => ({
        id: key,
        price: Number(draftPrices[key])
      }));

      await updatePricing(payload);
      setStatusMessage({
        type: 'success',
        text: `Successfully updated ${payload.length} service price${payload.length > 1 ? 's' : ''}! Changes are now live on the main site.`
      });

      setTimeout(() => {
        setStatusMessage(null);
      }, 5000);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to update pricing. Please try again.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    setShowConfirmReset(false);
    setIsResetting(true);
    setStatusMessage(null);

    try {
      await resetPricing();
      setStatusMessage({
        type: 'success',
        text: 'All service prices have been restored to factory defaults and synced across the platform.'
      });

      setTimeout(() => {
        setStatusMessage(null);
      }, 5000);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to reset pricing defaults.'
      });
    } finally {
      setIsResetting(false);
    }
  };

  // Filter items based on activeCategory and searchQuery
  const filteredItems = pricingList.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesQuery = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesQuery;
  });

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'driver':
        return <SteeringWheel className="w-4 h-4 text-amber-400" />;
      case 'vehicle':
        return <Car className="w-4 h-4 text-blue-400" />;
      case 'class':
        return <GraduationCap className="w-4 h-4 text-emerald-400" />;
      default:
        return <Tag className="w-4 h-4 text-amber-400" />;
    }
  };

  const getCategoryBadgeClass = (category) => {
    switch (category) {
      case 'driver':
        return 'bg-amber-400/10 text-amber-400 border-amber-400/20';
      case 'vehicle':
        return 'bg-blue-400/10 text-blue-400 border-blue-400/20';
      case 'class':
        return 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getCategoryLabel = (category) => {
    switch (category) {
      case 'driver': return 'Driver Service';
      case 'vehicle': return 'Rental Fleet';
      case 'class': return 'Driving Academy';
      default: return category;
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 pb-16">
      
      {/* 1. Header Banner & Live Status Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl shadow-black/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-amber-400/10 via-amber-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 text-xs font-bold mb-2.5">
              <Tag className="w-3.5 h-3.5" />
              <span>Live Pricing Engine</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-['Outfit'] tracking-tight">
              Service Pricing Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Configure official prices for drivers, fleet rentals, and driving courses. Any price updated here synchronizes in real-time across the client home page, price cards, price estimators, and booking checkout calculations.
            </p>
          </div>

          {/* Action Buttons: Save & Reset */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={() => setShowConfirmReset(true)}
              disabled={isResetting || isSaving}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Reset all prices to factory defaults"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              <span>Reset Defaults</span>
            </button>

            <button
              onClick={handleSaveChanges}
              disabled={!hasModifications || isSaving}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer shadow-lg ${
                hasModifications
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-amber-500/20 scale-102 hover:scale-105'
                  : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-60'
              }`}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Prices...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Pricing Changes {hasModifications && `(${modifiedKeys.length})`}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feedback Alert Banner */}
        {statusMessage && (
          <div className={`mt-5 p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs font-semibold animate-in slide-in-from-top-2 duration-200 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            <div className="flex items-center gap-2.5">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-white/10"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Unsaved changes banner */}
        {hasModifications && !statusMessage && (
          <div className="mt-5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-between gap-3 text-xs font-bold animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
              <span>You have {modifiedKeys.length} unsaved price change{modifiedKeys.length > 1 ? 's' : ''}. Click "Save Pricing Changes" to apply immediately to the website.</span>
            </div>
            <button
              onClick={handleSaveChanges}
              className="px-3 py-1 rounded-lg bg-amber-400 text-slate-950 font-extrabold hover:bg-amber-300 text-[11px] shrink-0"
            >
              Save Now
            </button>
          </div>
        )}
      </div>

      {/* 2. Category Selector & Quick Search Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 p-2 sm:p-2.5 rounded-2xl">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
              activeCategory === 'all'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>All Services</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              activeCategory === 'all' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-400'
            }`}>
              {pricingList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveCategory('driver')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
              activeCategory === 'driver'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <SteeringWheel className="w-3.5 h-3.5" />
            <span>Driver Services</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              activeCategory === 'driver' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-400'
            }`}>
              {pricingList.filter(i => i.category === 'driver').length}
            </span>
          </button>

          <button
            onClick={() => setActiveCategory('vehicle')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
              activeCategory === 'vehicle'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>Rental Fleet</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              activeCategory === 'vehicle' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-400'
            }`}>
              {pricingList.filter(i => i.category === 'vehicle').length}
            </span>
          </button>

          <button
            onClick={() => setActiveCategory('class')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
              activeCategory === 'class'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Driving Academy</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              activeCategory === 'class' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-400'
            }`}>
              {pricingList.filter(i => i.category === 'class').length}
            </span>
          </button>
        </div>

        {/* Search bar */}
        <div className="relative min-w-[200px] sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search service price..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400/60"
          />
        </div>
      </div>

      {/* 3. Pricing Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
        {filteredItems.map(item => {
          const defaultPrice = DEFAULT_PRICING_MAP[item.id]?.price;
          const currentDraft = draftPrices[item.id] !== undefined ? draftPrices[item.id] : item.price;
          const isModified = currentDraft !== item.price && currentDraft !== '';
          const isDifferentFromDefault = currentDraft !== defaultPrice;

          return (
            <div 
              key={item.id}
              className={`bg-slate-900 border rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all relative ${
                isModified 
                  ? 'border-amber-400 ring-2 ring-amber-400/20 shadow-lg shadow-amber-400/5' 
                  : 'border-slate-800/90 hover:border-slate-700'
              }`}
            >
              {/* Card Header */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                      {getCategoryIcon(item.category)}
                    </div>
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${getCategoryBadgeClass(item.category)}`}>
                      {getCategoryLabel(item.category)}
                    </span>
                  </div>

                  {isModified && (
                    <span className="text-[10px] font-black bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md animate-pulse">
                      Modified
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white font-['Outfit'] leading-snug">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Price Input Section */}
              <div className="pt-4 mt-4 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Official Rate:</span>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1">
                    <span>Default:</span>
                    <strong className="text-slate-400">₹{defaultPrice}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-extrabold text-amber-400 select-none">
                      ₹
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={currentDraft}
                      onChange={(e) => handlePriceChange(item.id, e.target.value)}
                      placeholder={String(defaultPrice)}
                      className={`w-full pl-7 pr-3 py-2 rounded-xl bg-slate-950 border font-black text-base text-white focus:outline-none transition-all ${
                        isModified
                          ? 'border-amber-400 focus:ring-2 focus:ring-amber-400/40 text-amber-300'
                          : 'border-slate-800 focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/30'
                      }`}
                    />
                  </div>
                  
                  {item.unit && (
                    <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-bold text-slate-400 shrink-0 select-none">
                      {item.unit}
                    </div>
                  )}
                </div>

                {isDifferentFromDefault && !isModified && (
                  <div className="text-[10px] text-amber-400/90 font-medium flex items-center gap-1 pt-0.5">
                    <Info className="w-3 h-3 shrink-0" />
                    <span>Active custom price differs from default (₹{defaultPrice})</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-3xl p-8 space-y-3">
          <Tag className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-sm font-bold text-white">No service prices match your filter</h3>
          <p className="text-xs text-slate-400">Try changing the category or clearing the search query.</p>
          <button
            onClick={() => { setActiveCategory('all'); setSearchQuery(''); }}
            className="px-3 py-1.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 hover:text-white"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Confirmation Modal for Reset Defaults */}
      {showConfirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white font-['Outfit']">
                Reset All Service Prices to Defaults?
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                This will revert all driver packages, vehicle rental daily rates, and driving class fees back to the original company baseline prices. This immediately synchronizes to the client website.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmReset(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetToDefaults}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-colors shadow-md shadow-amber-400/20"
              >
                Confirm & Reset All
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
