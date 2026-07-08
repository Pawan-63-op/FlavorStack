import jwt, { Secret } from 'jsonwebtoken';
import { Types } from 'mongoose';
import mongoose, { Document } from "mongoose";
import dotenv from "dotenv";
import cookieParser from 'cookie-parser';
import { Response } from 'express';
import {IUser} from "@/Types/allTypes";
dotenv.config();
   



export const generateToken = (res:Response, user:IUser ) => {
    const token = jwt.sign({id:user._id}, process.env.JWT_SECRET!, {expiresIn:'2d'});
    res.cookie("token", token, {httpOnly:true, secure:true,sameSite:"none", maxAge:24*60*60*1000});
    
    return token;
}
