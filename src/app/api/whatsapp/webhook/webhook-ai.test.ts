import { describe, expect, it, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { POST } from "./route";
import { executeQuery } from "@/lib/supabase/mock-db-server";
import { verifyMetaWebhookSignature } from "@/lib/whatsapp/webhook-signature";
import { encrypt } from "@/lib/whatsapp/encryption";
import fs from "node:fs";
import path from "node:path";

// Mock the signature verification so we can easily test the endpoint
vi.mock("@/lib/whatsapp/webhook-signature", () => ({
  verifyMetaWebhookSignature: vi.fn(() => true),
}));

describe("Webhook AI Integration (Hybrid Shared Inbox)", () => {
  const originalFetch = global.fetch;
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

    // Ensure whatsapp_config has phone_number_id = "phone-123456" for mock user
    await executeQuery({
      action: "insert",
      tableName: "whatsapp_config",
      data: {
        id: "wcfg-test",
        phone_number_id: "phone-123456",
        access_token: encrypt("mock-access-token"),
        status: "connected",
      },
    });

    // Ensure we have an active agent configured in the DB
    await executeQuery({
      action: "update",
      tableName: "ai_agents",
      filters: [{ col: "id", op: "eq", val: "agent-1" }],
      data: { is_active: true }, // Ensure agent-1 is active
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("skips AI response when the conversation is paused (ai_paused = true)", async () => {
    // 1. Mark conv-1 as paused
    await executeQuery({
      action: "update",
      tableName: "conversations",
      filters: [{ col: "id", op: "eq", val: "conv-1" }],
      data: { ai_paused: true },
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answer: "This is a simulated AI reply." }),
    });
    global.fetch = mockFetch;

    // 2. Prepare WhatsApp message webhook payload
    const payload = {
      entry: [
        {
          id: "entry-1",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "+33612345678",
                  phone_number_id: "phone-123456", // must match seeded whatsapp_config
                },
                contacts: [
                  {
                    profile: { name: "Alice Martin" },
                    wa_id: "+33612345678",
                  },
                ],
                messages: [
                  {
                    id: "meta-msg-123",
                    from: "+33612345678",
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: "text",
                    text: { body: "Je veux connaitre les prix" },
                  },
                ],
              },
              field: "messages",
            },
          ],
        },
      ],
    };

    const req = new Request("http://localhost:3000/api/whatsapp/webhook", {
      method: "POST",
      headers: {
        "x-hub-signature-256": "sha256=mock",
      },
      body: JSON.stringify(payload),
    });

    // Call webhook POST handler
    const res = await POST(req);
    expect(res.status).toBe(200);

    // Wait slightly to let async processWebhook execution complete
    await new Promise((resolve) => setTimeout(resolve, 150));

    // The fetch call for AI completion should NOT have been made
    const aiChatFetchCalls = mockFetch.mock.calls.filter((call) =>
      String(call[0]).includes("/api/ai/chat")
    );
    expect(aiChatFetchCalls.length).toBe(0);
  });

  it("triggers AI response when the conversation is active (ai_paused = false)", async () => {
    // 1. Mark conv-1 as active (not paused)
    await executeQuery({
      action: "update",
      tableName: "conversations",
      filters: [{ col: "id", op: "eq", val: "conv-1" }],
      data: { ai_paused: false },
    });

    const mockFetch = vi.fn().mockImplementation((url) => {
      if (String(url).includes("/api/ai/chat")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ answer: "Automated Bot Reply." }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    global.fetch = mockFetch;

    const payload = {
      entry: [
        {
          id: "entry-1",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "+33612345678",
                  phone_number_id: "phone-123456",
                },
                contacts: [
                  {
                    profile: { name: "Alice Martin" },
                    wa_id: "+33612345678",
                  },
                ],
                messages: [
                  {
                    id: "meta-msg-456",
                    from: "+33612345678",
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: "text",
                    text: { body: "Bonjour !" },
                  },
                ],
              },
              field: "messages",
            },
          ],
        },
      ],
    };

    const req = new Request("http://localhost:3000/api/whatsapp/webhook", {
      method: "POST",
      headers: {
        "x-hub-signature-256": "sha256=mock",
      },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Wait slightly to let async processWebhook execution complete
    await new Promise((resolve) => setTimeout(resolve, 200));

    // The fetch call for AI completion SHOULD have been made
    const aiChatFetchCalls = mockFetch.mock.calls.filter((call) =>
      String(call[0]).includes("/api/ai/chat")
    );
    expect(aiChatFetchCalls.length).toBeGreaterThan(0);
  });

  it("automatically parses cart orders and inserts them into the DB", async () => {
    const orderPayload = {
      entry: [
        {
          id: "entry-order-1",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "+33612345678",
                  phone_number_id: "phone-123456",
                },
                contacts: [
                  {
                    profile: { name: "Alice Martin" },
                    wa_id: "+33612345678",
                  },
                ],
                messages: [
                  {
                    id: "meta-msg-order-999",
                    from: "+33612345678",
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: "order",
                    order: {
                      catalog_id: "catalog-111",
                      text: "Je veux acheter ces produits",
                      product_items: [
                        {
                          product_retailer_id: "TEST-SKU-ORDER",
                          quantity: 2,
                          item_price: 150,
                          currency: "EUR"
                        }
                      ]
                    }
                  },
                ],
              },
              field: "messages",
            },
          ],
        },
      ],
    };

    const req = new Request("http://localhost:3000/api/whatsapp/webhook", {
      method: "POST",
      headers: {
        "x-hub-signature-256": "sha256=mock",
      },
      body: JSON.stringify(orderPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Wait for the async webhook processing
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Verify product was created
    const finalProducts = await executeQuery({ action: "select", tableName: "products" });
    const createdProduct = finalProducts.data.find(
      (p: any) => p.sku === "TEST-SKU-ORDER"
    );
    expect(createdProduct).toBeDefined();
    expect(createdProduct.price).toBe(150);

    // Verify order was created
    const finalOrders = await executeQuery({ action: "select", tableName: "orders" });
    const createdOrder = finalOrders.data.find(
      (o: any) => o.payment_method === "whatsapp_catalog" && o.contact_id === "c-1"
    );
    expect(createdOrder).toBeDefined();
    expect(createdOrder.total_amount).toBe(300);
    expect(createdOrder.items[0].quantity).toBe(2);

    // Verify message text was formatted correctly in the db
    const finalMsgs = await executeQuery({ action: "select", tableName: "messages" });
    const orderMsg = finalMsgs.data.find((m: any) => m.message_id === "meta-msg-order-999");
    expect(orderMsg).toBeDefined();
    expect(orderMsg.content_text).toContain("Nouvelle commande panier");
    expect(orderMsg.content_text).toContain("TEST-SKU-ORDER");
    expect(orderMsg.content_text).toContain("*Total :* 300 EUR");

    // Verify deal was created in pipeline
    const finalDeals = await executeQuery({ action: "select", tableName: "deals" });
    const createdDeal = finalDeals.data.find(
      (d: any) => d.contact_id === "c-1" && d.value === 300
    );
    expect(createdDeal).toBeDefined();
    expect(createdDeal.pipeline_id).toBe("p-1");
    expect(createdDeal.stage_id).toBe("s-1");
    expect(createdDeal.title).toBe("Commande - Alice Martin");
  });

  it("automatically creates a deal when a new contact sends their first message", async () => {
    const textPayload = {
      entry: [
        {
          id: "entry-newcontact-1",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "+33612345678",
                  phone_number_id: "phone-123456",
                },
                contacts: [
                  {
                    profile: { name: "Bernard Durand" },
                    wa_id: "+33699991111",
                  },
                ],
                messages: [
                  {
                    id: "meta-msg-newcontact-999",
                    from: "+33699991111",
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: "text",
                    text: { body: "Bonjour, je suis intéressé." }
                  },
                ],
              },
              field: "messages",
            },
          ],
        },
      ],
    };

    const req = new Request("http://localhost:3000/api/whatsapp/webhook", {
      method: "POST",
      headers: {
        "x-hub-signature-256": "sha256=mock",
      },
      body: JSON.stringify(textPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Wait for the async webhook processing
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Verify contact was created
    const finalContacts = await executeQuery({ action: "select", tableName: "contacts" });
    const createdContact = finalContacts.data.find(
      (c: any) => c.phone === "+33699991111"
    );
    expect(createdContact).toBeDefined();
    expect(createdContact.name).toBe("Bernard Durand");

    // Verify deal was created in pipeline for the new contact
    const finalDeals = await executeQuery({ action: "select", tableName: "deals" });
    const createdDeal = finalDeals.data.find(
      (d: any) => d.contact_id === createdContact.id
    );
    expect(createdDeal).toBeDefined();
    expect(createdDeal.value).toBe(0);
    expect(createdDeal.title).toBe("Opportunité - Bernard Durand");
    expect(createdDeal.pipeline_id).toBe("p-1");
    expect(createdDeal.stage_id).toBe("s-1");
  });

  it("does NOT create a deal when an existing contact sends a standard text message", async () => {
    // Count deals before
    const initialDeals = await executeQuery({ action: "select", tableName: "deals" });
    const initialDealsCountForAlice = initialDeals.data.filter((d: any) => d.contact_id === "c-1").length;

    const textPayload = {
      entry: [
        {
          id: "entry-existingcontact-1",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "+33612345678",
                  phone_number_id: "phone-123456",
                },
                contacts: [
                  {
                    profile: { name: "Alice Martin" },
                    wa_id: "+33612345678",
                  },
                ],
                messages: [
                  {
                    id: "meta-msg-existingcontact-999",
                    from: "+33612345678",
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: "text",
                    text: { body: "Je voulais juste poser une autre question." }
                  },
                ],
              },
              field: "messages",
            },
          ],
        },
      ],
    };

    const req = new Request("http://localhost:3000/api/whatsapp/webhook", {
      method: "POST",
      headers: {
        "x-hub-signature-256": "sha256=mock",
      },
      body: JSON.stringify(textPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Wait for the async webhook processing
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Verify NO new deal was created for Alice
    const finalDeals = await executeQuery({ action: "select", tableName: "deals" });
    const finalDealsCountForAlice = finalDeals.data.filter((d: any) => d.contact_id === "c-1").length;
    expect(finalDealsCountForAlice).toBe(initialDealsCountForAlice);
  });
});
