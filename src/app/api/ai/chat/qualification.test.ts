import { describe, expect, it, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { POST } from "./route";
import { executeQuery } from "@/lib/supabase/mock-db-server";
import fs from "node:fs";
import path from "node:path";

interface ContactCustomValue {
  id: string;
  contact_id: string;
  custom_field_id: string;
  value: string;
}

describe("Lead qualification automatic extraction (offline simulator parser)", () => {
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

    // 1. Force simulator mode (no OpenAI API key)
    delete process.env.OPENAI_API_KEY;

    // 2. Clear custom_fields and contact data for test safety
    await executeQuery({
      action: "delete",
      tableName: "custom_fields",
      filters: [{ col: "user_id", op: "eq", val: "00000000-0000-0000-0000-000000000000" }]
    });

    // 3. Clear contact custom values for c-test-qualif
    await executeQuery({
      action: "delete",
      tableName: "contact_custom_values",
      filters: [{ col: "contact_id", op: "eq", val: "c-test-qualif" }]
    });

    // 4. Create test contact c-test-qualif
    await executeQuery({
      action: "delete",
      tableName: "contacts",
      filters: [{ col: "id", op: "eq", val: "c-test-qualif" }]
    });

    await executeQuery({
      action: "insert",
      tableName: "contacts",
      data: {
        id: "c-test-qualif",
        user_id: "00000000-0000-0000-0000-000000000000",
        phone: "+33600000000",
        name: "Initial Name",
        email: "initial@example.com",
        company: "Initial Company",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    });

    // 5. Seed custom fields
    await executeQuery({
      action: "insert",
      tableName: "custom_fields",
      data: [
        {
          id: "cf-test-budget",
          user_id: "00000000-0000-0000-0000-000000000000",
          field_name: "budget",
          field_type: "text",
          created_at: new Date().toISOString(),
        },
        {
          id: "cf-test-besoin",
          user_id: "00000000-0000-0000-0000-000000000000",
          field_name: "besoin",
          field_type: "text",
          created_at: new Date().toISOString(),
        },
        {
          id: "cf-test-echeance",
          user_id: "00000000-0000-0000-0000-000000000000",
          field_name: "échéance",
          field_type: "text",
          created_at: new Date().toISOString(),
        }
      ]
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("extracts identity information from introduction message", async () => {
    const req = new Request("http://localhost:3000/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "user", content: "Bonjour, je m'appelle Jean-Marc. Mon email est jm.pro@company.fr. Je travaille chez TechSoft." }
        ],
        contact_id: "c-test-qualif"
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Retrieve updated contact
    const contactRes = await executeQuery({
      action: "select",
      tableName: "contacts",
      filters: [{ col: "id", op: "eq", val: "c-test-qualif" }]
    });

    const contact = contactRes.data?.[0];
    expect(contact).toBeDefined();
    expect(contact.name).toBe("Jean-Marc");
    expect(contact.email).toBe("jm.pro@company.fr");
    expect(contact.company).toBe("TechSoft");
  });

  it("extracts custom fields budget, besoin and échéance from messages", async () => {
    const req = new Request("http://localhost:3000/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "user", content: "Bonjour, j'ai un budget de 5000€ pour mon projet. J'ai besoin d'un nouveau site e-commerce, d'ici la semaine prochaine." }
        ],
        contact_id: "c-test-qualif"
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Retrieve custom values
    const valuesRes = await executeQuery({
      action: "select",
      tableName: "contact_custom_values",
      filters: [{ col: "contact_id", op: "eq", val: "c-test-qualif" }]
    });

    const values = (valuesRes.data || []) as ContactCustomValue[];
    
    // Find budget value
    const budgetVal = values.find((v: ContactCustomValue) => v.custom_field_id === "cf-test-budget");
    expect(budgetVal).toBeDefined();
    expect(budgetVal?.value).toBe("5000€");

    // Find besoin value
    const besoinVal = values.find((v: ContactCustomValue) => v.custom_field_id === "cf-test-besoin");
    expect(besoinVal).toBeDefined();
    expect(besoinVal?.value).toBe("nouveau site e-commerce");

    // Find échéance value
    const echeanceVal = values.find((v: ContactCustomValue) => v.custom_field_id === "cf-test-echeance");
    expect(echeanceVal).toBeDefined();
    expect(echeanceVal?.value).toBe("la semaine prochaine");
  });
});
