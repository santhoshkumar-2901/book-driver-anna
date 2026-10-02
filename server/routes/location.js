import { Router } from 'express';
import { geocodingService } from '../services/geocodingService.js';
import { routingService } from '../services/routingService.js';
import { locationRateLimiter, routeRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

/**
 * GET /api/location/search?q=...
 *
 * Secure backend geocoding proxy to OpenStreetMap Nominatim.
 * Enforces rate limiting, input validation, structured normalization, and response caching.
 */
router.get('/search', locationRateLimiter, async (req, res, next) => {
  try {
    const rawQuery = String(req.query.q || '').trim();

    if (!rawQuery || rawQuery.length < 2) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Search query must be at least 2 characters long.'
        }
      });
    }

    if (rawQuery.length > 200) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'QUERY_TOO_LONG',
          message: 'Search query exceeds maximum allowed length of 200 characters.'
        }
      });
    }

    const { results, fromCache } = await geocodingService.search(rawQuery, { limit: 5 });

    res.json({
      success: true,
      data: results,
      meta: {
        query: rawQuery,
        count: results.length,
        fromCache
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/location/route?pickupLat=...&pickupLng=...&destLat=...&destLng=...
 *
 * Secure backend routing proxy to OSRM.
 * Calculates road distance, duration, and GeoJSON LineString geometry.
 */
router.get('/route', routeRateLimiter, async (req, res, next) => {
  try {
    const pickupLat = req.query.pickupLat ?? req.query.pickupLatitude;
    const pickupLng = req.query.pickupLng ?? req.query.pickupLongitude;
    const destLat = req.query.destLat ?? req.query.destinationLatitude;
    const destLng = req.query.destLng ?? req.query.destinationLongitude;

    if (
      pickupLat === undefined || pickupLng === undefined ||
      destLat === undefined || destLng === undefined ||
      String(pickupLat).trim() === '' || String(pickupLng).trim() === '' ||
      String(destLat).trim() === '' || String(destLng).trim() === ''
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_COORDINATES',
          message: 'All coordinates (pickupLat, pickupLng, destLat, destLng) are required.'
        }
      });
    }

    const pLat = parseFloat(pickupLat);
    const pLng = parseFloat(pickupLng);
    const dLat = parseFloat(destLat);
    const dLng = parseFloat(destLng);

    if (
      isNaN(pLat) || isNaN(pLng) || isNaN(dLat) || isNaN(dLng) ||
      !isFinite(pLat) || !isFinite(pLng) || !isFinite(dLat) || !isFinite(dLng)
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_COORDINATES',
          message: 'Coordinates must be valid finite numbers.'
        }
      });
    }

    if (
      pLat < -90 || pLat > 90 ||
      dLat < -90 || dLat > 90 ||
      pLng < -180 || pLng > 180 ||
      dLng < -180 || dLng > 180
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_COORDINATES',
          message: 'Coordinates must be within geographic bounds (-90..90 latitude, -180..180 longitude).'
        }
      });
    }

    const routeData = await routingService.getRoute({
      pickupLat: pLat,
      pickupLng: pLng,
      destLat: dLat,
      destLng: dLng
    });

    res.json({
      success: true,
      data: routeData
    });
  } catch (err) {
    next(err);
  }
});

export default router;
