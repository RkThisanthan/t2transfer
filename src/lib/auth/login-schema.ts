import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username").max(100),
  password: z.string().min(1, "Enter your password").max(200),
  remember: z.boolean(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export type LoginState = {
  fieldErrors?: Partial<Record<"username" | "password", string>>;
  formError?: string;
  username?: string;
  remember?: boolean;
};
