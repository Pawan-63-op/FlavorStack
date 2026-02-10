// mongopassword=RNH5LGAdhH4R360H
// pavangawali75_db_user
// import dotenv from "dotenv"
// dotenv.config()
import mongoose from "mongoose";
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI!);
        console.log(process.env.MONGO_URI !);
        console.log('mongoDB connected.');
    } catch (error) {
        console.log(error)
    }
}
export default connectDB;