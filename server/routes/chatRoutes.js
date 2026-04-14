import express from 'express';
import {
  accessChat,
  fetchChats,
  createGroupChat,
  removeFromGroup,
  addToGroup,
  renameGroup,
  exportChatHistory,
  importChatHistory,
  toggleMute,
  updateGroupDetails,
  deleteChat } from
'../controllers/chatController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.route('/').post(protect, accessChat);
router.route('/').get(protect, fetchChats);
router.route('/group').post(protect, createGroupChat);
router.route('/group-update').put(protect, updateGroupDetails);
router.route('/rename').put(protect, renameGroup);
router.route('/groupremove').put(protect, removeFromGroup);
router.route('/groupadd').put(protect, addToGroup);
router.route('/backup').get(protect, exportChatHistory);
router.route('/restore').post(protect, importChatHistory);
router.route('/:id/mute').put(protect, toggleMute);
router.route('/:id').delete(protect, deleteChat);

export default router;