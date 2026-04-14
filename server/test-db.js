import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).
then(() => {console.log('DB SUCCESS');process.exit(0);}).
catch((err) => {console.error('DB ERROR:', err.message);process.exit(1);});