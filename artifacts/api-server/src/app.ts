import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";
import { seedUsers } from "./lib/seed";
import { ensureDatabaseSchema } from "./lib/schema";
import "./types/session.d";

const app: Express = express();
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

app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env["SESSION_SECRET"] ?? "grille-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: process.env["NODE_ENV"] === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use("/api", router);

if (process.env["NODE_ENV"] === "production") {
  app.use(express.static(frontendDir));

  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(frontendDir, "index.html"));
  });
}

ensureDatabaseSchema()
  .then(() => seedUsers())
  .catch((err) => {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "startup db setup skipped");
  });

export default app;
