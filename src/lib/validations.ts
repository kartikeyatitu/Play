import { z } from "zod";

export const phoneSchema = z.string().regex(/^[6-9]\d{9}$/, "Enter valid 10-digit Indian phone number");
export const nameSchema = z.string().min(2, "Name must be at least 2 characters").max(100);
export const emailSchema = z.string().email("Enter a valid email").optional().or(z.literal(""));

export const createStudentSchema = z.object({
  name: nameSchema,
  parentPhone: phoneSchema,
  parentName: nameSchema,
  dob: z.string().min(1, "Date of birth is required"),
  batchId: z.string().min(1, "Select a batch"),
});

export const createCoachSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
});

export const createBatchSchema = z.object({
  name: nameSchema,
  sport: z.string().min(1, "Select a sport"),
  schedule: z.string().min(1, "Enter schedule"),
  coachId: z.string().min(1, "Select a coach"),
});

export const announcementSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  message: z.string().min(1, "Message is required").max(2000),
});

export const registerAcademySchema = z.object({
  academyName: z.string().min(2, "Academy name required").max(100),
  ownerName: nameSchema,
  phone: phoneSchema,
  email: emailSchema,
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  sport: z.string().min(1, "Select a sport"),
});
