import express from 'express';
import { registerUser, authUser, allUsers, updateProfilePic, getUserById } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', registerUser);
router.route('/').get(protect, allUsers);
router.route('/users/:id').get(protect, getUserById);
router.post('/login', authUser);
router.put('/profile', protect, updateProfilePic);

export default router;