import mongoose, { Schema } from 'mongoose';



















const MessageSchema = new Schema({
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
  text: { type: String },
  fileUrl: { type: String },
  fileType: { type: String, enum: ['image', 'document', 'audio'] },
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  isSystem: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  clearedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  reactions: [
  {
    emoji: { type: String },
    user: { type: Schema.Types.ObjectId, ref: 'User' }
  }],
  replyTo: { type: Schema.Types.ObjectId, ref: 'Message' },
  metadata: {
    title: { type: String },
    description: { type: String },
    image: { type: String },
    url: { type: String }
  },
  isBurn: { type: Boolean, default: false },
  expiresAt: { type: Date }
}, { timestamps: true });

export default mongoose.model('Message', MessageSchema);