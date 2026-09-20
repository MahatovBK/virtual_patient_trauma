import https from "node:https";

type GeminiRequest = {
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: Array<{ role: "user"; parts: Array<{ text: string }> }>;
  generationConfig?: Record<string, unknown>;
};

export function requestGemini(model: string, apiKey: string, body: GeminiRequest): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    }, (response) => {
      let responseBody = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { responseBody += chunk; });
      response.on("end", () => {
        try {
          const data = JSON.parse(responseBody) as Record<string, any>;
          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(`Gemini HTTP ${response.statusCode}`));
            return;
          }
          resolve(data);
        } catch {
          reject(new Error("Gemini returned invalid JSON"));
        }
      });
    });
    request.on("timeout", () => request.destroy(new Error("Gemini request timed out")));
    request.on("error", reject);
    request.write(JSON.stringify(body));
    request.end();
  });
}