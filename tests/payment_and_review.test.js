import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Ride Payment Options & Manual Optional Review Verification', () => {
  const ridePaymentModalPath = path.resolve('src/components/RidePaymentModal.jsx');
  const userProfileModalPath = path.resolve('src/components/UserProfileModal.jsx');

  test('1. RidePaymentModal allows only UPI and Cash payment methods', () => {
    const content = fs.readFileSync(ridePaymentModalPath, 'utf8');
    
    // Check initial state
    assert.match(content, /useState\(['"]upi['"]\)/, 'Initial payment method should be upi');
    
    // Check that grid has only 2 payment options
    assert.match(content, /grid grid-cols-2 gap-2\.5/, 'Payment buttons grid should be 2 columns');
    assert.match(content, /setPaymentMethod\(['"]upi['"]\)/, 'UPI option button should exist');
    assert.match(content, /setPaymentMethod\(['"]cash['"]\)/, 'Cash option button should exist');
    
    // Ensure Card and Wallet are NOT options in the selector
    assert.doesNotMatch(content, /setPaymentMethod\(['"]card['"]\)/, 'Card option should not be in selector');
    assert.doesNotMatch(content, /setPaymentMethod\(['"]wallet['"]\)/, 'Wallet option should not be in selector');
    assert.doesNotMatch(content, /Enter 16-digit Card Number/, 'Card input form should not be present');
    assert.doesNotMatch(content, /FastPay Wallet/, 'FastPay Wallet sub-view should not be present');
  });

  test('2. RidePaymentModal includes manual review textarea marked as (Optional)', () => {
    const content = fs.readFileSync(ridePaymentModalPath, 'utf8');
    
    // Must have review textarea with optional indicator
    assert.match(content, /Write a Review/, 'Section must have Write a Review label');
    assert.match(content, /Optional/, 'Review must be marked as Optional');
    assert.match(content, /<textarea/, 'Must render a textarea for manual review');
    assert.match(content, /feedbackNotes/, 'Textarea should bind to feedbackNotes state');
    assert.match(content, /maxLength=\{300\}/, 'Textarea should have character limit');
  });

  test('3. RidePaymentModal sends review in onPaymentSuccess and renders it in receipt', () => {
    const content = fs.readFileSync(ridePaymentModalPath, 'utf8');
    
    // Payment success payload
    assert.match(content, /review:\s*feedbackNotes\.trim\(\)/, 'onPaymentSuccess must include review text');
    
    // Receipt screen display
    assert.match(content, /feedbackNotes\.trim\(\)\s*&&/, 'Receipt screen must check if feedbackNotes exists');
    assert.match(content, /Your Driver Review/, 'Receipt screen must display driver review header');
    assert.match(content, /\{feedbackNotes\.trim\(\)\}/, 'Receipt screen must display the review content');
  });

  test('4. UserProfileModal stores review and keeps receipt visible after payment', () => {
    const content = fs.readFileSync(userProfileModalPath, 'utf8');
    
    // Stores booking reviews
    assert.match(content, /bda_booking_reviews/, 'UserProfileModal should persist reviews to bda_booking_reviews');
    assert.match(content, /setBookingReviews/, 'UserProfileModal should update bookingReviews state');
    
    // Does not immediately wipe paymentRideData inside handlePaymentSuccess so receipt is visible
    const handleSuccessSection = content.substring(
      content.indexOf('const handlePaymentSuccess'),
      content.indexOf('useEffect(() => {', content.indexOf('const handlePaymentSuccess'))
    );
    assert.doesNotMatch(handleSuccessSection, /setPaymentRideData\(null\)/, 'handlePaymentSuccess should not immediately close modal before user sees receipt');
    
    // Displays user review on the booking card
    assert.match(content, /bookingReviews\[b\.id\]/, 'Booking card should check for existing booking review');
  });
});
