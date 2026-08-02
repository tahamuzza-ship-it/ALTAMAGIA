import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Detrás del proxy de Replit/Railway: req.ip refleja la IP real del cliente
// (necesario para que el rate-limit de Plan B no sea falsificable).
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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Optional static frontend serving (used on Railway, where the API and the
// built web app run as a single service). Set SERVE_STATIC_DIR to the
// frontend build output directory to enable it.
const staticDir = process.env["SERVE_STATIC_DIR"];
if (staticDir) {
  const resolvedDir = path.resolve(staticDir);
  app.use(express.static(resolvedDir));
  // SPA fallback: any non-API GET request serves index.html
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(resolvedDir, "index.html"));
  });
}

export default app;
