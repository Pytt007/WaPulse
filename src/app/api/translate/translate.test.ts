import { describe, expect, it, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { POST } from "./route";

describe("Translation API Endpoint", () => {
  let originalApiKey: string | undefined;

  beforeAll(() => {
    originalApiKey = process.env.OPENAI_API_KEY;
  });

  afterAll(() => {
    if (originalApiKey !== undefined) {
      process.env.OPENAI_API_KEY = originalApiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  beforeEach(() => {
    // Disable OpenAI key for offline fallback testing by default
    delete process.env.OPENAI_API_KEY;
  });

  it("should translate a word from the offline dictionary to French (case-insensitive)", async () => {
    const req = new Request("http://localhost:3000/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: "Dashboard",
        targetLang: "fr",
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.translation).toBe("Tableau de bord");
  });

  it("should translate a word from the offline dictionary to English", async () => {
    const req = new Request("http://localhost:3000/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: "tableau de bord",
        targetLang: "en",
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.translation).toBe("Dashboard");
  });

  it("should fallback to returning original text if word is not in dictionary and OpenAI key is missing", async () => {
    const req = new Request("http://localhost:3000/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: "Some random sentence that is not cached",
        targetLang: "fr",
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.translation).toBe("Some random sentence that is not cached");
  });

  it("should return a 400 error if text or targetLang are missing", async () => {
    const req = new Request("http://localhost:3000/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: "",
        targetLang: "fr",
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Text and targetLang are required");
  });

  it("should return a 400 error for unsupported target language", async () => {
    const req = new Request("http://localhost:3000/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: "Hello",
        targetLang: "es", // Spanish not supported
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Unsupported targetLang");
  });
});
