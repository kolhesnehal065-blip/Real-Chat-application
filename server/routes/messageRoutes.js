import express from 'express';
import { allMessages, sendMessage, markAsRead, markAsDelivered, toggleReaction, deleteMessage, clearMessages } from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.route('/clear/:chatId').put(protect, clearMessages);
router.route('/:chatId').get(protect, allMessages);
router.route('/:chatId/read').put(protect, markAsRead);
router.route('/:chatId/delivered').put(protect, markAsDelivered);
router.route('/reaction').post(protect, toggleReaction);
router.route('/:messageId').delete(protect, deleteMessage);
router.route('/').post(protect, sendMessage);

export default router;