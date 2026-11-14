import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ success: false, message: "Authentication required." });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ success: false, message: "Authentication required." });
    return;
  }
  if (req.session.userRole !== "admin") {
    res.status(403).json({ success: false, message: "Admin access required." });
    return;
  }
  next();
}

export function requireRole(...roles: Array<"admin" | "transport" | "labour_contractor" | "labour_worker" | "laptop_watch">) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session?.userId) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }
    const role = req.session.userRole;
    if (!role || !(roles as string[]).includes(role)) {
      res.status(403).json({ success: false, message: "Access denied." });
      return;
    }
    next();
  };
}
