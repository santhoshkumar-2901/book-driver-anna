// src/components/DateInput.jsx
import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';
import { toYYYYMMDD, toDDMMYYYY } from '../utils/dateUtils';

export default function DateInput({
  value = '',
  onChange,
  placeholder = 'DD/MM/YYYY',
  minDate,
  maxDate,
  className = '',
  hasError = false,
  id,
  required = false,
  disabled = false
}) {
  const hiddenPickerRef = useRef(null);

  // Auto-mask digits to DD/MM/YYYY as user types
  const handleInputChange = (e) => {
    let raw = e.target.value;
    
    // If user is deleting with backspace and ends on a slash, remove the slash
    if (raw.length < value.length && value.endsWith('/')) {
      raw = raw.slice(0, -1);
    }

    // Keep only numbers
    const digits = raw.replace(/[^0-9]/g, '').slice(0, 8);
    let formatted = '';

    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else {
      formatted = digits;
    }

    if (onChange) {
      onChange(formatted);
    }
  };

  // When selected via the native calendar picker popup
  const handleNativePickerChange = (e) => {
    const yyyy_mm_dd = e.target.value;
    if (!yyyy_mm_dd) return;
    const formatted = toDDMMYYYY(yyyy_mm_dd);
    if (onChange) {
      onChange(formatted);
    }
  };

  const openCalendarPicker = () => {
    if (disabled) return;
    if (hiddenPickerRef.current) {
      if (typeof hiddenPickerRef.current.showPicker === 'function') {
        hiddenPickerRef.current.showPicker();
      } else {
        hiddenPickerRef.current.focus();
        hiddenPickerRef.current.click();
      }
    }
  };

  // Convert current value (DD/MM/YYYY) to YYYY-MM-DD for native input
  const nativePickerValue = toYYYYMMDD(value);
  const minPickerVal = minDate ? toYYYYMMDD(minDate) : undefined;
  const maxPickerVal = maxDate ? toYYYYMMDD(maxDate) : undefined;

  return (
    <div className="relative flex items-center w-full">
      <input
        type="text"
        id={id}
        required={required}
        disabled={disabled}
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        maxLength={10}
        autoComplete="off"
        className={`w-full bg-slate-900 border rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors ${
          hasError
            ? 'border-red-500 focus:border-red-400 bg-red-500/5'
            : 'border-slate-700 focus:border-amber-400'
        } ${className}`}
      />

      {/* Hidden native date input backing the calendar popup */}
      <input
        ref={hiddenPickerRef}
        type="date"
        min={minPickerVal}
        max={maxPickerVal}
        value={nativePickerValue}
        onChange={handleNativePickerChange}
        tabIndex={-1}
        className="sr-only"
        aria-hidden="true"
      />

      {/* Calendar picker launcher icon button */}
      <button
        type="button"
        onClick={openCalendarPicker}
        disabled={disabled}
        title="Choose date from calendar"
        className="absolute right-2 p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
      >
        <Calendar className="w-4 h-4" />
      </button>
    </div>
  );
}
