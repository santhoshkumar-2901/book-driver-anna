import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Vehicle Fleet Reservation — Location Autocomplete Inputs Suite', () => {
  const modalPath = path.resolve('src/components/BookingModal.jsx');
  const searchPath = path.resolve('src/components/map/LocationSearch.jsx');
  const modalContent = fs.readFileSync(modalPath, 'utf8');
  const searchContent = fs.readFileSync(searchPath, 'utf8');

  describe('1. LocationSearch Controlled & Uncontrolled Contract', () => {
    test('1.1 LocationSearch accepts optional value and onChange props', () => {
      assert.match(searchContent, /value,/, 'LocationSearch must accept value prop');
      assert.match(searchContent, /onChange,/, 'LocationSearch must accept onChange prop');
    });

    test('1.2 LocationSearch detects controlled mode and synchronizes value cleanly', () => {
      assert.match(
        searchContent,
        /const\s+isControlled\s*=\s*value\s*!==\s*undefined;/,
        'LocationSearch must define isControlled guard'
      );
      assert.match(
        searchContent,
        /const\s*\[query,\s*setQuery\]\s*=\s*useState\(isControlled\s*\?\s*value\s*:\s*initialValue\);/,
        'LocationSearch must initialize query with value when controlled'
      );
      assert.match(
        searchContent,
        /useEffect\(\(\)\s*=>\s*\{[\s\S]*?if\s*\(isControlled\)\s*\{[\s\S]*?setQuery\(value\s*\?\?\s*''\);[\s\S]*?\},?\s*\[isControlled,\s*value\]\);/,
        'LocationSearch must sync query via useEffect when controlled'
      );
    });

    test('1.3 LocationSearch notifies parent onChange on typing, selecting, and clearing', () => {
      // Typing
      assert.match(
        searchContent,
        /handleInputChange\s*=\s*\(e\)\s*=>\s*\{[\s\S]*?if\s*\(onChange\)\s*\{[\s\S]*?onChange\(val\);/,
        'handleInputChange must notify onChange on keystroke'
      );

      // Selecting suggestion
      assert.match(
        searchContent,
        /handleSelect\s*=\s*\(item\)\s*=>\s*\{[\s\S]*?if\s*\(onChange\)\s*\{[\s\S]*?onChange\(selectedText\);/,
        'handleSelect must notify onChange with selected text'
      );

      // Clearing input
      assert.match(
        searchContent,
        /handleClear\s*=\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(onChange\)\s*\{[\s\S]*?onChange\(''\);/,
        'handleClear must notify onChange with empty string'
      );
    });

    test('1.4 Uncontrolled callers without value/onChange continue to work without breaking', () => {
      // Guarded calls ensure undefined onChange does not throw
      assert.ok(!searchContent.includes('onChange(') || searchContent.includes('if (onChange)'), 'onChange must be guarded');
    });
  });

  describe('2. BookingModal Vehicle Location Field Replacement', () => {
    // Extract the vehicle location section
    const vehicleSectionStart = modalContent.indexOf("{bookingCategory === 'vehicle' && (");
    const vehicleSectionEnd = modalContent.indexOf('{/* =========================================================================\n              SERVICE 3: DRIVING CLASSES');
    const vehicleSection = modalContent.slice(vehicleSectionStart, vehicleSectionEnd);

    test('2.1 Replaces pickup and drop dropdown select elements with LocationSearch', () => {
      assert.ok(!vehicleSection.includes('<select'), 'Vehicle section must NOT contain <select> elements');
      assert.ok(!vehicleSection.includes('BANGALORE_AREAS.map'), 'Vehicle section must NOT map BANGALORE_AREAS dropdown options');
      assert.match(vehicleSection, /<LocationSearch[\s\S]*?id="vehicle-pickup-location"/, 'Must render LocationSearch for pickup');
      assert.match(vehicleSection, /<LocationSearch[\s\S]*?id="vehicle-drop-location"/, 'Must render LocationSearch for drop');
    });

    test('2.2 Updates field labels to Pickup Location * and Drop Location * with icons', () => {
      assert.match(vehicleSection, /Pickup Location\s*\*/, 'Must have Pickup Location * label');
      assert.match(vehicleSection, /Drop Location\s*\*/, 'Must have Drop Location * label');
      assert.ok(!vehicleSection.includes('Pickup Area in Bangalore *'), 'Old Pickup Area in Bangalore label must be removed');
      assert.ok(!vehicleSection.includes('Drop Location in Bangalore *'), 'Old Drop Location in Bangalore label must be removed');
      assert.match(vehicleSection, /<MapPin className="w-3 h-3 text-amber-400" \/>/);
    });

    test('2.3 Provides proper empty placeholders', () => {
      assert.match(vehicleSection, /placeholder="Enter pickup location"/, 'Pickup input must use Enter pickup location placeholder');
      assert.match(vehicleSection, /placeholder="Enter drop location"/, 'Drop input must use Enter drop location placeholder');
    });

    test('2.4 Binds to existing form state variables pickupArea and dropLocation', () => {
      assert.match(vehicleSection, /value=\{pickupArea\}/, 'Must bind pickupArea to value');
      assert.match(vehicleSection, /onChange=\{\(val\) => setPickupArea\(val\)\}/, 'Must update pickupArea on change');
      assert.match(vehicleSection, /value=\{dropLocation\}/, 'Must bind dropLocation to value');
      assert.match(vehicleSection, /onChange=\{\(val\) => setDropLocation\(val\)\}/, 'Must update dropLocation on change');
    });

    test('2.5 Preserves responsive grid layout (side by side on desktop, stacked on mobile)', () => {
      assert.match(vehicleSection, /grid grid-cols-1 sm:grid-cols-2 gap-3/, 'Must maintain responsive 2-column grid layout');
    });
  });

  describe('3. Form State Reset & Empty Default Guarantee', () => {
    test('3.1 resetForm clears pickupArea and dropLocation to empty strings unless provided in initialData', () => {
      const resetBlock = modalContent.slice(
        modalContent.indexOf('const resetForm = () => {'),
        modalContent.indexOf('const { getPrice, formatPrice, refreshPricing }')
      );
      assert.match(
        resetBlock,
        /setPickupArea\(initialData\?\.pickupArea \|\| ''\);/,
        'resetForm must reset pickupArea to initialData or empty string'
      );
      assert.match(
        resetBlock,
        /setDropLocation\(initialData\?\.dropLocation \|\| ''\);/,
        'resetForm must reset dropLocation to initialData or empty string'
      );
      assert.ok(
        !resetBlock.includes("'Indiranagar'"),
        'resetForm must NOT default to Indiranagar'
      );
    });
  });

  describe('4. Vehicle Booking Validation & Regression Safety', () => {
    const submitBlock = modalContent.slice(
      modalContent.indexOf('const handleSubmitBooking = async'),
      modalContent.indexOf('const effectivePickupArea =')
    );

    test('4.1 Validates required pickup location for vehicle booking with specific error', () => {
      assert.match(
        submitBlock,
        /if\s*\(!pickupArea\s*\|\|\s*!pickupArea\.trim\(\)\)\s*\{\s*setFormError\('Please enter a pickup location'\);\s*return;\s*\}/,
        'Must reject empty or whitespace pickup location for vehicle booking'
      );
    });

    test('4.2 Validates required drop location for vehicle booking with specific error', () => {
      assert.match(
        submitBlock,
        /if\s*\(!dropLocation\s*\|\|\s*!dropLocation\.trim\(\)\)\s*\{\s*setFormError\('Please enter a drop location'\);\s*return;\s*\}/,
        'Must reject empty or whitespace drop location for vehicle booking'
      );
    });

    test('4.3 Preserves driver booking independent handlers and coordinate validation', () => {
      assert.match(
        modalContent,
        /const handleSelectPickup = \(item\) => \{[\s\S]*?setPickupLocation\(item\);/,
        'Driver handleSelectPickup must remain intact'
      );
      assert.match(
        modalContent,
        /const handleSelectDestination = \(item\) => \{[\s\S]*?setDestinationLocation\(item\);/,
        'Driver handleSelectDestination must remain intact'
      );
      assert.match(
        submitBlock,
        /if \(bookingCategory === 'driver'\)/,
        'Driver coordinate validation block must remain untouched'
      );
    });

    test('4.4 Vehicle booking payload submits pickupArea and dropLocation correctly', () => {
      assert.match(modalContent, /pickupArea:\s*effectivePickupArea,/, 'Payload includes pickupArea');
      assert.match(modalContent, /dropLocation:\s*destinationLocation\?\.displayName\s*\|\|\s*dropLocation,/, 'Payload includes dropLocation');
    });
  });
});
