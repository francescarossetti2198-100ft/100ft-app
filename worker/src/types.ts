export type Env = {
  DB: D1Database;
  FOTO_SFIDE: R2Bucket;
  FRONTEND_ORIGIN: string;
  SESSION_SECRET: string;
  COACH_PASSWORD_HASH: string;
  RESEND_API_KEY: string;
};

export type SessionUser =
  | { isCoach: true; atletaId: null }
  | { isCoach: false; atletaId: number };
