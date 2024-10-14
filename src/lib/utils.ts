import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export const hashEmail = (email: string): string => {
    return crypto.createHash('sha256').update(email).digest('hex');
};

export const comparePassword = (password: string, hash: string): boolean => {
  return bcrypt.compareSync(password, hash);
};

export const hashPassword = (password: string): string => {
  return bcrypt.hashSync(password, 10);
};