import { readFile } from "node:fs/promises";
import * as http from "node:http";
import * as https from "node:https";

import cors from "cors";
import express from "express";

import { Tunnels } from "./config/Tunnels";
import { getStatus } from "./utils/getStatus";
import { logHandler } from "./utils/logHandler";

// anonymous IIFE for async/await
(async () => {
  const app = express();

  const allowedOrigins = [
    "https://naomi.exposed",
    "https://www.naomi.exposed",
    "http://localhost:4200",
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
    })
  );

  // mount your middleware and routes here

  app.use("/:name", async (req, res) => {
    const name = req.params.name;
    const tunnel = Tunnels.find((tunnel) => tunnel.name === name);
    if (!tunnel) {
      res.status(400).json({
        status: 400,
        message: `Tunnel ${name} not found.`,
      });
      return;
    }

    const status = await getStatus(tunnel.url);
    if (status === 0) {
      res.status(404).json({
        status: 404,
        message: `Tunnel ${name} not found.`,
      });
      return;
    }
    res.json({
      status,
      message: `Tunnel ${name} has a status of ${status}`,
    });
  });

  const httpServer = http.createServer(app);

  httpServer.listen(8080, () => {
    logHandler.log("http", "http server listening on port 8080");
  });

  if (process.env.NODE_ENV === "production") {
    const privateKey = await readFile(
      "/etc/letsencrypt/live/status.naomi.exposed/privkey.pem",
      "utf8"
    );
    const certificate = await readFile(
      "/etc/letsencrypt/live/status.naomi.exposed/cert.pem",
      "utf8"
    );
    const ca = await readFile(
      "/etc/letsencrypt/live/status.naomi.exposed/chain.pem",
      "utf8"
    );

    const credentials = {
      key: privateKey,
      cert: certificate,
      ca: ca,
    };

    const httpsServer = https.createServer(credentials, app);

    httpsServer.listen(8443, () => {
      logHandler.log("http", "https server listening on port 8443");
    });
  }
})();
