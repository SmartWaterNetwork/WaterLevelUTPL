import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy endpoint for ThingSpeak API to avoid CORS issues and handle multiple stations
  app.get("/api/thingspeak", async (req, res) => {
    try {
      const channelId = req.query.channelId ? String(req.query.channelId) : "3440458";
      const apiKey = req.query.apiKey ? String(req.query.apiKey) : "";
      const start = req.query.start ? String(req.query.start) : "";
      const end = req.query.end ? String(req.query.end) : "";
      const minutes = req.query.minutes ? String(req.query.minutes) : "";
      // A date range wants everything ThingSpeak has in that window, not "the
      // last 60" — only fall back to the small live-poll default when neither
      // a range nor an explicit count was requested.
      const results = req.query.results ? String(req.query.results) : start || end ? "8000" : "60";

      let url = `https://api.thingspeak.com/channels/${encodeURIComponent(channelId)}/feeds.json?results=${encodeURIComponent(results)}`;
      if (apiKey) url += `&api_key=${encodeURIComponent(apiKey)}`;
      if (start) url += `&start=${encodeURIComponent(start)}`;
      if (end) url += `&end=${encodeURIComponent(end)}`;
      if (minutes) url += `&minutes=${encodeURIComponent(minutes)}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`ThingSpeak response error: ${response.statusText}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      console.error("Error fetching ThingSpeak data:", err);
      res.status(500).json({ error: "Failed to fetch channel data", message: err?.message || String(err) });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", channelId: 3425609, timestamp: new Date().toISOString() });
  });

  // Vite middleware in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
