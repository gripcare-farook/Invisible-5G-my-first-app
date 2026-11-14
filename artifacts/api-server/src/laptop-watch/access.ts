import type { Request, Response, NextFunction } from "express";
export function laptopBoundary(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (
    req.session?.userRole === "laptop_watch" &&
    !/^\/(?:laptop-watch(?:\/|$)|notifications(?:\/|$)|auth\/(?:me|logout)$)/i.test(
      req.path,
    )
  ) {
    res.status(403).json({ message: "Laptop Watch access only." });
    return;
  }
  next();
}
export function sameOrigin(req: Request, res: Response, next: NextFunction) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const expected =
      process.env.APP_ORIGIN ?? `${req.protocol}://${req.get("host")}`;
    if (
      req.get("origin") !== expected ||
      req.get("sec-fetch-site") === "cross-site"
    ) {
      res.status(403).json({ message: "Same-origin request required." });
      return;
    }
  }
  next();
}
