import mongoose from 'mongoose';

export const connectDB = async () => {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (MONGODB_URI) {
    try {
      console.log('Attempting to connect to MongoDB...');
      await mongoose.connect(MONGODB_URI);
      console.log('Successfully connected to MongoDB');
    } catch (err) {
      console.error('CRITICAL: MongoDB connection error:', err);
      process.exit(1);
    }
  } else {
    console.warn('MONGODB_URI not found in environment variables. Database features will not work.');
  }
};