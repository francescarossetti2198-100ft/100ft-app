export type Env = {
  DB: D1Database;
  FOTO_SFIDE: R2Bucket;
  FRONTEND_ORIGIN: string;
  SESSION_SECRET: string;
  RESEND_API_KEY: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
};

export type Role = "atleta" | "coach";

export type SessionUser = {
  userId: number;
  role: Role;
};
