import { describe, expect, it, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { POST } from "./route";
import { executeQuery } from "@/lib/supabase/mock-db-server";
import fs from "node:fs";
import path from "node:path";

describe("RAG local semantic search and prompt enrichment", () => {
  const originalFetch = global.fetch;
  const dbPath = path.join(process.cwd(), "supabase", "mock-db.json");
  let originalDbContent: string;
  let originalApiKey: string | undefined;

  beforeAll(() => {
    originalDbContent = fs.readFileSync(dbPath, "utf8");
    originalApiKey = process.env.OPENAI_API_KEY;
  });

  afterAll(() => {
    fs.writeFileSync(dbPath, originalDbContent, "utf8");
    if (originalApiKey !== undefined) {
      process.env.OPENAI_API_KEY = originalApiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup test agent
    await executeQuery({
      action: "insert",
      tableName: "ai_agents",
      data: {
        id: "agent-rag-test",
        user_id: "00000000-0000-0000-0000-000000000000",
        name: "RAG Test Agent",
        system_prompt: "Tu es un agent de test.",
        model: "gpt-4o-mini",
        temperature: 0.7,
        is_active: true,
        calendly_link: "https://calendly.com/test",
      }
    });

    // Clear knowledge_base documents for the mock user
    await executeQuery({
      action: "delete",
      tableName: "knowledge_base",
      filters: [{ col: "user_id", op: "eq", val: "00000000-0000-0000-0000-000000000000" }]
    });

    // Insert test documents
    await executeQuery({
      action: "insert",
      tableName: "knowledge_base",
      data: [
        {
          id: "doc-wifi",
          user_id: "00000000-0000-0000-0000-000000000000",
          file_name: "Code_Wifi_Bureau.txt",
          file_type: "txt",
          file_size: 150,
          content: "Le code Wi-Fi du bureau est WaConnect2026. Il est réservé aux collaborateurs."
        },
        {
          id: "doc-parking",
          user_id: "00000000-0000-0000-0000-000000000000",
          file_name: "Acces_Parking.txt",
          file_type: "txt",
          file_size: 120,
          content: "Le parking est accessible via le digicode 4829A du lundi au vendredi."
        }
      ]
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("retrieves and injects the matched context when OpenAI is enabled", async () => {
    // 1. Force OpenAI Mode
    process.env.OPENAI_API_KEY = "sk-mock-test-key-rag";

    const mockFetch = vi.fn().mockImplementation((url, options) => {
      const body = JSON.parse(options.body);
      const systemMessage = body.messages.find((m: { role: string; content?: string }) => m.role === 'system');
      
      return Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: "assistant",
                content: `Response incorporating: ${systemMessage?.content ? 'system-prompt-found' : 'not-found'}`
              }
            }
          ]
        })
      });
    });
    global.fetch = mockFetch;

    // 2. Query asking for wifi code
    const req = new Request("http://localhost:3000/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "user", content: "Quel est le code wifi du bureau ?" }
        ]
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    
    // Check that our mock fetch intercepted the call
    expect(mockFetch).toHaveBeenCalled();
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const systemPrompt = fetchBody.messages[0].content;

    // Ensure RAG context is injected
    expect(systemPrompt).toContain("[CONNAISSANCES COMPLÉMENTAIRES]");
    expect(systemPrompt).toContain("Code_Wifi_Bureau.txt");
    expect(systemPrompt).toContain("WaConnect2026");
    expect(systemPrompt).not.toContain("Acces_Parking.txt");
  });

  it("uses the smart simulator fallback with RAG context when OpenAI is disabled", async () => {
    // 1. Force Simulator Mode by removing API key
    delete process.env.OPENAI_API_KEY;

    // 2. Query asking for parking access
    const req = new Request("http://localhost:3000/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "user", content: "Comment accéder au parking ?" }
        ]
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    // Verify it returned simulated answer with RAG info
    expect(data.answer).toContain("[Simulation RAG - Basé sur Acces_Parking.txt]");
    expect(data.answer).toContain("digicode 4829A");
  });

  it("does not inject RAG context when the query has no matching keywords", async () => {
    // 1. Force OpenAI Mode
    process.env.OPENAI_API_KEY = "sk-mock-test-key-rag";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              role: "assistant",
              content: "Normal response"
            }
          }
        ]
      })
    });
    global.fetch = mockFetch;

    // 2. Generic query
    const req = new Request("http://localhost:3000/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "user", content: "Bonjour, comment allez-vous aujourd'hui ?" }
        ]
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const systemPrompt = fetchBody.messages[0].content;

    // Ensure RAG context is NOT injected since keywords don't match
    expect(systemPrompt).not.toContain("[CONNAISSANCES COMPLÉMENTAIRES]");
    expect(systemPrompt).not.toContain("WaConnect2026");
    expect(systemPrompt).not.toContain("digicode 4829A");
  });
});
