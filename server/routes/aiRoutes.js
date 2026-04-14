import express from 'express';
import { protect } from '../middleware/auth.js';
import { generateSmartReplies, generateChatSummary } from '../controllers/aiController.js';

const router = express.Router();

router.post('/replies', protect, generateSmartReplies);
router.post('/summary', protect, generateChatSummary);

export default router;
