import mongoose, { Schema } from 'mongoose';






const PushSubscriptionSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  subscription: { type: Object, required: true }
}, { timestamps: true });

export default mongoose.model('PushSubscription', PushSubscriptionSchema);