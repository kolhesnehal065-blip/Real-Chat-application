import mongoose from 'mongoose';

export const connectDB = async () => {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (MONGODB_URI) {
    try {
      console.log('Attempting to connect to MongoDB...');
      await mongoose.connect(MONGODB_URI);
      console.log('Successfully connected to MongoDB');
    } catch (err) {
      console.error('ERROR: MongoDB connection failure:', err.message);
      console.warn('The server will remain online, but database features will likely fail until a connection is established.');
      // Do not exit process, allowing the server to still serve the health check and static files
    }
  } else {
    console.warn('MONGODB_URI not found in environment variables. Database features will not work.');
  }
};