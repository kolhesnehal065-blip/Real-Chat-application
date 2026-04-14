import mongoose, { Schema } from 'mongoose';













const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePic: { type: String, default: '' },
  bio: { type: String, default: '' },
  website: { type: String, default: '' },
  socialLinks: { type: Object, default: {} },
  lastSeen: { type: Date, default: Date.now },
  isOnline: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('User', UserSchema);