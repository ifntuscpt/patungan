import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Setup request body limits for larger image payloads
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  // Health endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Receipt OCR parsing endpoint using server-side Gemini Vision
  app.post("/api/ocr", async (req, res) => {
    try {
      const { image, mimeType } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Missing image inside request body (base64 string)." });
      }

      // Lazy load Gemini client to prevent crash on startup if key is missing
      const ai = getGeminiClient();

      // Extract the raw base64 data regardless of data scheme URI
      let cleanBase64 = image;
      if (image.startsWith("data:")) {
        const parts = image.split(";base64,");
        if (parts.length > 1) {
          cleanBase64 = parts[1];
        }
      }

      const targetMimeType = mimeType || "image/jpeg";

      const prompt = `Extract all line items from this restaurant receipt image. Return a valid JSON object with this exact structure, and nothing else:
{
  "items": [
    {"name": "string", "price": number, "quantity": number}
  ],
  "taxAmount": number,
  "serviceCharge": number,
  "grandTotal": number
}
Rules:
- price is per unit in Indonesian Rupiah as integer (no decimals, no symbols)
- If tax or service charge not found, use 0
- Item names in original language from receipt
- Do NOT include subtotals, totals, or summary lines as items
- quantity defaults to 1 if not explicitly shown`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: targetMimeType
            }
          },
          prompt
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    price: { type: Type.INTEGER },
                    quantity: { type: Type.INTEGER }
                  },
                  required: ["name", "price", "quantity"]
                }
              },
              taxAmount: { type: Type.INTEGER },
              serviceCharge: { type: Type.INTEGER },
              grandTotal: { type: Type.INTEGER }
            },
            required: ["items", "taxAmount", "serviceCharge", "grandTotal"]
          }
        }
      });

      const textValue = response.text;
      if (!textValue) {
        throw new Error("Failed to receive structured description text from Gemini API.");
      }

      const parsedJSON = JSON.parse(textValue.trim());
      return res.json(parsedJSON);
    } catch (e: any) {
      console.error("OCR Failure:", e);
      return res.status(500).json({
        error: e.message || "Gagal memproses gambar struk makan.",
        details: String(e)
      });
    }
  });

  // Mount Vite middleware in development environment, otherwise serve compiled frontend
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
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
    console.log(`Patungan Server online on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode.`);
  });
}

startServer();
