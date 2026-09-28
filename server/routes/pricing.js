import { Router } from 'express';
import { getAllPricing } from '../services/pricingService.js';

const router = Router();

// GET /api/pricing (Public endpoint to fetch current verified service tariffs)
router.get('/', async (req, res, next) => {
  try {
    const pricing = await getAllPricing();
    res.json({
      success: true,
      data: pricing
    });
  } catch (err) {
    next(err);
  }
});

export default router;
