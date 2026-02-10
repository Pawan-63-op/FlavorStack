import {MailtrapClient} from "mailtrap";
import dotenv from "dotenv";
import { log } from "console";

dotenv.config();
 
export const client = new MailtrapClient({token: process.env.MAILTRAP_API_TOKEN! });
export const sender = {
  email: "mailtrap@demomailtrap.com",
  name: "PAWAN op",
};