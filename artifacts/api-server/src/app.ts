import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from 'connect-pg-simple';
import { pool } from '@workspace/db';
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";
import "./types/session.d";

const app: Express = express();
if(process.env.NODE_ENV==='production' && (!process.env.SESSION_SECRET || !process.env.APP_ORIGIN)) throw new Error('SESSION_SECRET and APP_ORIGIN are required in production');
const distDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(
  distDir,
  "../../grille-calc-web/dist/public",
);

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ credentials: true, origin: process.env.APP_ORIGIN ?? false }));
app.use(cookieParser());
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb", parameterLimit: 1000 }));

app.use(
  session({
    store: new (connectPgSimple(session))({pool,createTableIfMissing:false}),
    secret: process.env["SESSION_SECRET"] ?? "grille-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use("/api", router);
app.use('/api', (_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({message:'Request failed. Please try again.'});
});

if (process.env["NODE_ENV"] === "production") {
  app.use(express.static(frontendDir));

  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(frontendDir, "index.html"));
  });
}

export default app;
