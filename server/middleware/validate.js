const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIndianPhone(phone) {
  if (typeof phone !== 'string') return false;
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    return /^[6-9]\d{9}$/.test(digits);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return /^[6-9]\d{9}$/.test(digits.slice(1));
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return /^[6-9]\d{9}$/.test(digits.slice(2));
  }
  return false;
}

export function formatIndianPhone(phone) {
  const digits = phone.replace(/[^0-9]/g, '').slice(-10);
  return `+91 ${digits}`;
}

// Strip dangerous script/HTML tags
export function sanitizeString(val) {
  if (typeof val !== 'string') return val;
  return val.replace(/<[^>]*>?/gm, '').trim();
}

export function validateRegisterInput(req, res, next) {
  const { name, email, phone, password } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Full name must be at least 2 characters long.' }
    });
  }

  if (!email || !EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Please provide a valid email address.' }
    });
  }

  if (!phone || !isValidIndianPhone(phone)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Please provide a valid 10-digit Indian mobile number.' }
    });
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Password must be at least 8 characters long.' }
    });
  }

  req.body.name = sanitizeString(name);
  req.body.email = email.trim().toLowerCase();
  req.body.phone = phone.trim();
  req.body.area = sanitizeString(req.body.area || 'Indiranagar');

  next();
}

export function validateChangePasswordInput(req, res, next) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || typeof currentPassword !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Current password is required.' }
    });
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'New password must be at least 8 characters long.' }
    });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'New password must be different from current password.' }
    });
  }
  next();
}

export function validateLoginInput(req, res, next) {
  const identifier = req.body.identifier || req.body.email || req.body.phone;
  const password = req.body.password;

  if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Email or phone number is required.' }
    });
  }

  if (!password || typeof password !== 'string' || !password.trim()) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Password is required.' }
    });
  }

  req.body.identifier = sanitizeString(identifier);
  next();
}

export function validateBookingInput(req, res, next) {
  const { customerName, customerPhone, bookingCategory, date, time } = req.body;

  if (!customerName || typeof customerName !== 'string' || customerName.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Customer full name is required.' }
    });
  }

  if (!customerPhone || !isValidIndianPhone(customerPhone)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Valid 10-digit customer mobile number is required.' }
    });
  }

  const validCategories = ['driver', 'vehicle', 'class'];
  if (!bookingCategory || !validCategories.includes(bookingCategory)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Invalid booking service category.' }
    });
  }

  if (!date || !DATE_REGEX.test(date)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Booking date must be in YYYY-MM-DD format.' }
    });
  }

  const today = new Date().toISOString().split('T')[0];
  if (date < today) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_DATE', message: 'Booking date cannot be in the past.' }
    });
  }

  if (!time || typeof time !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Booking time slot is required.' }
    });
  }

  req.body.customerName = sanitizeString(customerName);
  req.body.customerPhone = customerPhone.trim();
  if (req.body.customerEmail) req.body.customerEmail = sanitizeString(req.body.customerEmail);
  if (req.body.pickupArea) req.body.pickupArea = sanitizeString(req.body.pickupArea);
  if (req.body.dropLocation) req.body.dropLocation = sanitizeString(req.body.dropLocation);

  next();
}
