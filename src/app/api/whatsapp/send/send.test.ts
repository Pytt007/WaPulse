import { describe, expect, it, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { POST } from "./route";
import { executeQuery } from "@/lib/supabase/mock-db-server";
import { sendTextMessage, sendTemplateMessage } from "@/lib/whatsapp/meta-api";
import { encrypt } from "@/lib/whatsapp/encryption";
import fs from "node:fs";
import path from "node:path";

// Mock next/headers cookies to return session
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    has: (name: string) => name === "sb-mock-session",
    get: (name: string) => name === "sb-mock-session" ? { value: "true" } : undefined,
  }),
}));

// Mock the Meta WhatsApp API functions
vi.mock("@/lib/whatsapp/meta-api", () => ({
  sendTextMessage: vi.fn().mockResolvedValue({ messageId: "meta-mock-text-123" }),
  sendTemplateMessage: vi.fn().mockResolvedValue({ messageId: "meta-mock-tmpl-123" }),
}));

describe("WhatsApp Send API Endpoint (Automatic Template Wrapping)", () => {
  const dbPath = path.join(process.cwd(), "supabase", "mock-db.json");
  let originalDbContent: string;

  beforeAll(() => {
    originalDbContent = fs.readFileSync(dbPath, "utf8");
  });

  afterAll(() => {
    fs.writeFileSync(dbPath, originalDbContent, "utf8");
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset relevant tables in mock-db
    // We'll clean messages, conversations, whatsapp_config, and templates.
    await executeQuery({ action: "delete", tableName: "messages", filters: [{ col: "id", op: "neq", val: "" }] });
    await executeQuery({ action: "delete", tableName: "conversations", filters: [{ col: "id", op: "neq", val: "" }] });
    await executeQuery({ action: "delete", tableName: "whatsapp_config", filters: [{ col: "id", op: "neq", val: "" }] });
    await executeQuery({ action: "delete", tableName: "message_templates", filters: [{ col: "id", op: "neq", val: "" }] });

    // Seed default whatsapp configuration
    await executeQuery({
      action: "insert",
      tableName: "whatsapp_config",
      data: {
        id: "wcfg-test",
        phone_number_id: "phone-123456",
        access_token: encrypt("mock-access-token"),
        status: "connected",
        user_id: "00000000-0000-0000-0000-000000000000",
      },
    });

    // Seed a default contact
    // (We reuse the existing contact "c-1" which exists in the original mock DB or we can insert if not existing)
    await executeQuery({
      action: "insert",
      tableName: "contacts",
      data: {
        id: "c-1",
        phone: "+33612345678",
        name: "Alice Martin",
        user_id: "00000000-0000-0000-0000-000000000000",
      },
    });
  });

  it("sends normal text message if customer session is active (<24h)", async () => {
    // 1. Create a conversation and seed a customer message from 2 hours ago
    await executeQuery({
      action: "insert",
      tableName: "conversations",
      data: {
        id: "conv-active",
        contact_id: "c-1",
        status: "open",
        user_id: "00000000-0000-0000-0000-000000000000",
      },
    });

    await executeQuery({
      action: "insert",
      tableName: "messages",
      data: {
        id: "msg-cust",
        conversation_id: "conv-active",
        sender_type: "customer",
        content_type: "text",
        content_text: "Hello",
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
      },
    });

    const req = new Request("http://localhost:3000/api/whatsapp/send", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conv-active",
        message_type: "text",
        content_text: "This is a reply under 24h",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify Meta API call
    expect(sendTextMessage).toHaveBeenCalledWith(expect.objectContaining({
      text: "This is a reply under 24h",
      to: "33612345678",
    }));
    expect(sendTemplateMessage).not.toHaveBeenCalled();
  });

  it("auto-wraps in generic template if customer session is expired (>=24h)", async () => {
    // 1. Create a conversation and seed a customer message from 25 hours ago
    await executeQuery({
      action: "insert",
      tableName: "conversations",
      data: {
        id: "conv-expired",
        contact_id: "c-1",
        status: "open",
        user_id: "00000000-0000-0000-0000-000000000000",
      },
    });

    await executeQuery({
      action: "insert",
      tableName: "messages",
      data: {
        id: "msg-cust-old",
        conversation_id: "conv-expired",
        sender_type: "customer",
        content_type: "text",
        content_text: "Hello",
        created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25h ago
      },
    });

    // 2. Seed an approved generic template with exactly one parameter {{1}}
    await executeQuery({
      action: "insert",
      tableName: "message_templates",
      data: {
        id: "tmpl-generic",
        name: "generic_reply",
        body_text: "Hello! {{1}}",
        language: "fr",
        status: "Approved",
        user_id: "00000000-0000-0000-0000-000000000000",
      },
    });

    const req = new Request("http://localhost:3000/api/whatsapp/send", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conv-expired",
        message_type: "text",
        content_text: "This is my re-engagement message",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify Meta API call
    expect(sendTemplateMessage).toHaveBeenCalledWith(expect.objectContaining({
      templateName: "generic_reply",
      language: "fr",
      params: ["This is my re-engagement message"],
      to: "33612345678",
    }));
    expect(sendTextMessage).not.toHaveBeenCalled();

    // Verify database record has substituting text
    const { data: dbMsgs } = await executeQuery({
      action: "select",
      tableName: "messages",
      filters: [{ col: "conversation_id", op: "eq", val: "conv-expired" }],
    });

    // Filter to agents' messages in the DB
    const agentMsgs = dbMsgs.filter((m: any) => m.sender_type === "agent");
    expect(agentMsgs.length).toBe(1);
    expect(agentMsgs[0].content_type).toBe("template");
    expect(agentMsgs[0].content_text).toBe("Hello! This is my re-engagement message");
    expect(agentMsgs[0].template_name).toBe("generic_reply");
  });

  it("returns 403 if customer session is expired and no generic single-parameter template is approved", async () => {
    // 1. Create a conversation and seed no messages (equivalent to no customer message)
    await executeQuery({
      action: "insert",
      tableName: "conversations",
      data: {
        id: "conv-expired-no-templates",
        contact_id: "c-1",
        status: "open",
        user_id: "00000000-0000-0000-0000-000000000000",
      },
    });

    // 2. We only have a multi-parameter template, which should be ignored
    await executeQuery({
      action: "insert",
      tableName: "message_templates",
      data: {
        id: "tmpl-multi",
        name: "complex_reply",
        body_text: "Hello {{1}} and {{2}}",
        language: "fr",
        status: "Approved",
        user_id: "00000000-0000-0000-0000-000000000000",
      },
    });

    const req = new Request("http://localhost:3000/api/whatsapp/send", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: "conv-expired-no-templates",
        message_type: "text",
        content_text: "This is my message",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toContain("Session WhatsApp expirée");
  });
});
