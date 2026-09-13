import { env } from '../server/config/env.js';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: env.smtp.secure,
  auth: env.smtp.user && env.smtp.pass ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
});

console.log(`Testing SMTP ${env.smtp.host}:${env.smtp.port} secure=${env.smtp.secure} user=${env.smtp.user ? env.smtp.user.slice(0,3)+'***' : 'NOT SET'}`);

transporter.verify().then(()=>{
  console.log('SMTP connection verified — ready to send');
  process.exit(0);
}).catch(e=>{
  console.log('SMTP connection failed');
  console.error(e.message);
  process.exit(1);
});
