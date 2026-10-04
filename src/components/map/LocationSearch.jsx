import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, X, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

/**
 * LocationSearch Component
 *
 * Provides a debounced, accessible autocomplete search bar that queries
 * the backend /api/location/search proxy without calling Nominatim directly.
 */
export default function LocationSearch({
  placeholder = 'Search area, street, or landmark...',
  onSelect,
  initialValue = '',
  className = '',
  id = 'location-search-input',
  biasCoords = null,
  mapContext = ''
}) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Cleanup pending timer and abort pending request on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Perform backend search with AbortController and optional viewport biasing
  const performSearch = useCallback(async (searchQuery) => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Cancel any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);

    const biasLat = biasCoords?.latitude ?? biasCoords?.lat;
    const biasLng = biasCoords?.longitude ?? biasCoords?.lng;

    try {
      const response = await apiClient.searchLocations(trimmed, {
        biasLat,
        biasLng,
        mapContext,
        signal: abortController.signal
      });
      if (abortControllerRef.current === abortController) {
        if (response && response.success && Array.isArray(response.data)) {
          setResults(response.data);
          setIsOpen(true);
        } else {
          setResults([]);
        }
      }
    } catch (err) {
      // Ignore AbortError from cancelled stale requests
      if (err.name === 'AbortError') {
        return;
      }
      if (abortControllerRef.current === abortController) {
        setError('Unable to search locations. Please try again.');
        setResults([]);
        setIsOpen(true);
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        setLoading(false);
      }
    }
  }, [biasCoords, mapContext]);

  // Debounced query change handler (350ms delay)
  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setError(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (val.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      setLoading(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      performSearch(val);
    }, 350);
  };

  const handleSelect = (item) => {
    setQuery(item.displayName);
    setIsOpen(false);
    setResults([]);
    if (onSelect) {
      onSelect(item);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setError(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>

      {/* Input container */}
      <div className="relative flex items-center">
        <div className="absolute left-3 pointer-events-none text-slate-400">
          <Search className="w-4 h-4 text-amber-400" />
        </div>

        <input
          id={id}
          type="text"
          inputMode="search"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck="false"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (results.length > 0 || error) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full pl-9 pr-10 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
        />

        <div className="absolute right-1 flex items-center">
          {loading && (
            <div className="p-2 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            </div>
          )}
          {!loading && query.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear location search"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors min-w-[38px] min-h-[38px] flex items-center justify-center cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-[1100] bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl max-h-60 overflow-y-auto no-scrollbar py-1">
          {loading && results.length === 0 && (
            <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>Searching locations...</span>
            </div>
          )}

          {error && !loading && (
            <div className="p-3 text-xs text-red-300 flex items-center justify-between gap-2 bg-red-500/10">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => performSearch(query)}
                className="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-200 text-[10px] font-semibold transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
            <div className="p-3 text-center text-xs text-slate-400">
              No locations found.
            </div>
          )}

          {!loading && results.length > 0 && (
            <ul className="divide-y divide-slate-800/60" role="listbox">
              {results.map((item) => (
                <li
                  key={item.id}
                  role="option"
                  aria-selected={false}
                  onClick={() => handleSelect(item)}
                  className="px-3 py-3 hover:bg-slate-800/80 cursor-pointer transition-colors flex items-start gap-2.5 min-h-[44px] touch-manipulation"
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-100 font-medium truncate">
                      {item.title || item.displayName.split(',')[0]}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {item.subtitle || item.displayName}
                    </p>
                  </div>
                  {item.type && (
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono shrink-0">
                      {item.type}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
