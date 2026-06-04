import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { createProxyMiddleware } from "http-proxy-middleware";

dotenv.config();

const app = express();

const PORT = 3000;

// ── Backend service URL (resolved inside Docker network, or localhost in dev) ──
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// ── Initialize GoogleGenAI SDK Server-Side ───────────────────────────────────
let ai: GoogleGenAI | null = null;

function getGeminiClient() {
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn(
        "GEMINI_API_KEY environment variable is not defined. AI Triage will fall back to rule-based analysis.",
      );
      return null;
    }
    ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
  }
  return ai;
}

// ── Gemini Triage Endpoint (served by this Express server, uses GEMINI_API_KEY) ─
app.post("/api/gemini/triage", express.json(), async (req, res) => {
  const { symptoms } = req.body;

  if (!symptoms || typeof symptoms !== "string" || symptoms.trim() === "") {
    return res.status(400).json({ error: "Symptom description is required" });
  }

  const client = getGeminiClient();

  if (!client) {
    console.log("No Gemini API Key found. Performing rules-based clinical triage.");
    const symptomLower = symptoms.toLowerCase();
    let urgency: "Critical" | "Urgent" | "Routine" = "Routine";
    let department = "General Medicine";
    let actions = ["Drink plenty of water", "Monitor symptoms", "Consult a clinic if symptoms persist"];
    let justification = "Based on keyword analysis of symptoms.";
    let nextSteps = ["Ask for duration of symptoms", "Verify temperature / vitals"];

    if (
      symptomLower.includes("chest pain") ||
      symptomLower.includes("heart") ||
      symptomLower.includes("breath") ||
      symptomLower.includes("stroke") ||
      symptomLower.includes("unconscious")
    ) {
      urgency = "Critical";
      department = "Emergency Medicine";
      actions = [
        "Call 911 / EMS immediately",
        "Administer oxygen if available",
        "Do not exert physical effort",
        "Sit upright and rest",
      ];
      justification =
        "Symptoms point towards a cardiovascular or respiratory crisis that requires immediate emergency evaluation.";
      nextSteps = ["Check heart rate", "Assess for breathing difficulty or radiating pain in left arm"];
    } else if (
      symptomLower.includes("fracture") ||
      symptomLower.includes("broken") ||
      symptomLower.includes("bleed") ||
      symptomLower.includes("cut") ||
      symptomLower.includes("vomit") ||
      symptomLower.includes("fever")
    ) {
      urgency = "Urgent";
      department =
        symptomLower.includes("fracture") || symptomLower.includes("broken")
          ? "Orthopedics"
          : "General Medicine";
      actions = [
        "Keep the affected area immobilized",
        "Apply a cold compress to reduce swelling",
        "Arrive at the Urgent Care ward promptly",
      ];
      justification =
        "Patient has immediate physical trauma or acute systemic symptoms requiring urgent investigation.";
      nextSteps = ["Check pain score (1-10)", "Check if there is open skin or visible deformity"];
    } else if (
      symptomLower.includes("child") ||
      symptomLower.includes("baby") ||
      symptomLower.includes("pediatric")
    ) {
      department = "Pediatrics";
    }

    return res.json({ urgency, department, actions, justification, nextSteps });
  }

  try {
    const prompt = `Perform a clinical check on the following user-submitted symptoms: "${symptoms}".
Determine:
1. Urgency Level: Must be exactly one of "Critical", "Urgent", or "Routine".
2. Recommended Specialty Department: Choose the most appropriate: "General Medicine", "Cardiology", "Pediatrics", "Neurology", "Orthopedics", or "Emergency Medicine".
3. Immediate clinical actions to recommend (at least 3 items).
4. Short justification explaining your assessment and potential differential focus in professional yet simple language.
5. Next questions the medical receptionist should ask the patient.

Format your response as a strict JSON object matches the schema.`;

    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        systemInstruction:
          "You are an expert hospital clinical receptionist and triage specialist. Analyze patient symptoms accurately. If critical symptoms such as chest pain, dyspnea, severe head trauma, or acute paralysis are entered, immediately classify as 'Critical' and route to 'Emergency Medicine'. Keep instructions clear and actionable.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            urgency: { type: Type.STRING, description: "Must be exactly: Critical, Urgent, or Routine." },
            department: {
              type: Type.STRING,
              description: "Must be one of: General Medicine, Cardiology, Pediatrics, Neurology, Orthopedics, Emergency Medicine.",
            },
            actions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Actionable immediate advice for the patient.",
            },
            justification: { type: Type.STRING, description: "Brief reasoning for this categorization." },
            nextSteps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "A list of 2-3 clinical follow-up questions to ask.",
            },
          },
          required: ["urgency", "department", "actions", "justification", "nextSteps"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response output from Gemini API");

    return res.json(JSON.parse(text.trim()));
  } catch (error: any) {
    console.error("Gemini triage generation failed:", error);
    return res
      .status(500)
      .json({ error: "Clinical router failed to parse symptoms. Please use offline protocol." });
  }
});

// ── Configure Vite or serve static assets ──────────────────────────────────
import http from "http";
import { URL } from "url";

/**
 * Simple native Node.js reverse proxy — no external libraries needed.
 * Forwards the full path including /api/* to the backend service.
 */
function makeNativeProxy(backendUrl: string): express.RequestHandler {
  return (req, res) => {
    const target = new URL(backendUrl);
    const options: http.RequestOptions = {
      hostname: target.hostname,
      port: target.port || 80,
      path: req.url,          // full path, e.g. /api/livekit/token
      method: req.method,
      headers: {
        ...req.headers,
        host: target.host,    // override host header to backend hostname
      },
    };

    console.log(`[proxy] → ${req.method} ${backendUrl}${req.url}`);

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on("error", (err) => {
      console.error("[proxy] backend error:", err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: "Backend service unavailable", detail: err.message });
      }
    });

    req.pipe(proxyReq, { end: true });
  };
}

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // ── DEV: Vite middleware + proxy to FastAPI backend ──────────────────
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    // Proxy /api/* → FastAPI backend (except /api/gemini which is handled above)
    app.use("/api", (req, res, next) => {
      if (req.path.startsWith("/gemini")) return next(); // handled by Express above
      // Re-prefix /api for the proxy (Express strips mount prefix from req.url)
      req.url = "/api" + req.url;
      makeNativeProxy(BACKEND_URL)(req, res, next);
    });

    app.use(vite.middlewares);
  } else {
    // ── PRODUCTION: serve compiled SPA + proxy /api → FastAPI backend ────
    const distPath = path.join(process.cwd(), "dist");

    // Proxy /api/* → FastAPI backend (except /api/gemini/* handled by Express above)
    // Note: At root level, req.url still includes the full /api/* path.
    app.use("/api", (req, res, next) => {
      if (req.path.startsWith("/gemini")) return next(); // local Gemini handler above

      // Restore full path (Express strips mount prefix /api from req.url)
      req.url = "/api" + req.url;
      makeNativeProxy(BACKEND_URL)(req, res, next);
    });

    // Serve static SPA assets
    app.use(express.static(distPath));

    // SPA fallback — all non-API routes return index.html
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Hospital Server listening on http://0.0.0.0:${PORT} [${process.env.NODE_ENV || "development"}] → Backend: ${BACKEND_URL}`,
    );
  });
}

startServer();
