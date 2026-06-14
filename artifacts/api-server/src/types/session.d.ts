import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: number;
    userRole: "admin" | "transport" | "labour_contractor" | "labour_worker";
    userName: string;
  }
}
