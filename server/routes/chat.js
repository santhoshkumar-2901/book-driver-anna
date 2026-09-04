import { Router } from 'express';
import { queryGeminiAI } from '../services/geminiProxyService.js';

const router = Router();

// POST /api/chat
router.post('/', async (req, res, next) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Message text is required.' }
      });
    }

    const response = await queryGeminiAI(message.trim(), Array.isArray(history) ? history : []);
    res.json({
      success: true,
      data: response
    });
  } catch (err) {
    next(err);
  }
});

export default router;
