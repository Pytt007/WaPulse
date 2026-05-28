"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCurrency } from "@/hooks/use-currency";
import { createClient } from "@/lib/supabase/client";
import type {
  Contact,
  Conversation,
  Deal,
  DealStatus,
  PipelineStage,
  Profile,
  Product,
} from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  X,
  Trash2,
  MessageSquare,
  Loader2,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";

interface DealFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal | null;
  pipelineId: string;
  stages: PipelineStage[];
  defaultStageId?: string;
  onSaved: () => void;
}

export function DealForm({
  open,
  onOpenChange,
  deal,
  pipelineId,
  stages,
  defaultStageId,
  onSaved,
}: DealFormProps) {
  const supabase = createClient();
  const { currency: globalCurrency } = useCurrency();

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState(globalCurrency);
  const [contactId, setContactId] = useState("");
  const [stageId, setStageId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [notes, setNotes] = useState("");

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [linkedConversation, setLinkedConversation] =
    useState<Conversation | null>(null);

  const [saving, setSaving] = useState(false);
  const [statusAction, setStatusAction] = useState<DealStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // States for order link / creation
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [createOrderLoading, setCreateOrderLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [orderPaymentMethod, setOrderPaymentMethod] = useState<string>("card");
  const [orderStatus, setOrderStatus] = useState<"pending" | "paid" | "shipped">("pending");

  // Reset the form fields every time the sheet opens or its input
  // props change. This is a legitimate prop-driven sync; the rule is
  // over-cautious here, hence the block-level disable.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    setShowOrderPanel(false);
    setSelectedProductId("");
    setOrderPaymentMethod("card");
    setOrderStatus("pending");
    if (deal) {
      setTitle(deal.title);
      setValue(String(deal.value ?? ""));
      setCurrency((deal.currency || globalCurrency) as any);
      // contact_id is nullable when the contact has been deleted
      // (migration 004: ON DELETE SET NULL). "" means "no selection".
      setContactId(deal.contact_id ?? "");
      setStageId(deal.stage_id);
      setAssignedTo(deal.assigned_to ?? "");
      setExpectedCloseDate(deal.expected_close_date ?? "");
      setNotes(deal.notes ?? "");
    } else {
      setTitle("");
      setValue("");
      setCurrency(globalCurrency);
      setContactId("");
      setStageId(defaultStageId || stages[0]?.id || "");
      setAssignedTo("");
      setExpectedCloseDate("");
      setNotes("");
    }
  }, [open, deal, defaultStageId, stages, globalCurrency]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Load supporting data once the sheet is open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const [c, p, prod] = await Promise.all([
        supabase.from("contacts").select("*").order("name"),
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("products").select("*").eq("active", true).order("name"),
      ]);
      if (cancelled) return;
      setContacts((c.data ?? []) as Contact[]);
      setProfiles((p.data ?? []) as Profile[]);
      setProducts((prod.data ?? []) as Product[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  // Fetch linked conversation for the selected contact (newest open one).
  // Clearing on no-selection is sync with prop state; the populated
  // case runs setLinkedConversation inside the async fetch callback.
  useEffect(() => {
    if (!open || !contactId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLinkedConversation(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("contact_id", contactId)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setLinkedConversation((data as Conversation | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, contactId, supabase]);

  async function handleSave() {
    if (!title.trim() || !contactId || !stageId) {
      toast.error("Title, contact, and stage are required");
      return;
    }
    setSaving(true);

    const payload = {
      title: title.trim(),
      value: parseFloat(value) || 0,
      currency,
      contact_id: contactId,
      pipeline_id: pipelineId,
      stage_id: stageId,
      assigned_to: assignedTo || null,
      notes: notes.trim() || null,
      expected_close_date: expectedCloseDate || null,
    };

    if (deal) {
      const { error } = await supabase
        .from("deals")
        .update(payload)
        .eq("id", deal.id);
      if (error) {
        toast.error("Failed to save deal");
        setSaving(false);
        return;
      }
    } else {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        toast.error("Not signed in");
        setSaving(false);
        return;
      }
      const { error } = await supabase
        .from("deals")
        .insert({ ...payload, user_id: user.id, status: "open" });
      if (error) {
        toast.error("Failed to create deal");
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    toast.success(deal ? "Deal updated" : "Deal created");
    onOpenChange(false);
    onSaved();
  }

  async function handleStatusChange(status: DealStatus) {
    if (!deal) return;
    setStatusAction(status);
    const updatePayload: any = { status };
    if (status === "open" || status === "lost") {
      updatePayload.order_id = null;
    }
    const { error } = await supabase
      .from("deals")
      .update(updatePayload)
      .eq("id", deal.id);
    setStatusAction(null);
    if (error) {
      toast.error("Failed to update deal status");
      return;
    }
    toast.success(
      status === "won" ? "Marked as won" : status === "lost" ? "Marked as lost" : "Deal reopened",
    );
    onOpenChange(false);
    onSaved();
  }

  async function handleMarkAsWonWithOrder() {
    if (!deal) return;
    setCreateOrderLoading(true);

    try {
      const selectedProduct = selectedProductId
        ? products.find((p) => p.id === selectedProductId)
        : null;

      const qty = selectedProduct
        ? Math.max(1, Math.round(deal.value / (selectedProduct.price || 1)))
        : 1;

      const totalAmount = selectedProduct
        ? (selectedProduct.price || 0) * qty
        : deal.value;

      const orderPayload = {
        user_id: deal.user_id,
        contact_id: deal.contact_id,
        total_amount: totalAmount,
        currency: deal.currency || "XOF",
        status: orderStatus,
        payment_method: orderPaymentMethod,
        items: [
          selectedProduct
            ? {
                product_id: selectedProductId,
                quantity: qty,
                price: selectedProduct.price,
              }
            : {
                name: `Opportunité: ${deal.title}`,
                quantity: 1,
                price: deal.value,
                product_id: null,
              },
        ],
      };

      const { data: newOrder, error: orderError } = await supabase
        .from("orders")
        .insert(orderPayload)
        .select()
        .single();

      if (orderError) {
        throw orderError;
      }

      const { error: dealError } = await supabase
        .from("deals")
        .update({ status: "won", order_id: newOrder.id })
        .eq("id", deal.id);

      if (dealError) {
        throw dealError;
      }

      toast.success("Deal gagné et commande créée !");
      setShowOrderPanel(false);
      onOpenChange(false);
      onSaved();
    } catch (error: any) {
      console.error("Error linking deal to order:", error);
      toast.error("Erreur lors de la création de la commande.");
    } finally {
      setCreateOrderLoading(false);
    }
  }

  async function handleDelete() {
    if (!deal) return;
    setDeleting(true);
    const { error } = await supabase.from("deals").delete().eq("id", deal.id);
    setDeleting(false);
    if (error) {
      toast.error("Failed to delete deal");
      return;
    }
    toast.success("Deal deleted");
    setConfirmDelete(false);
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-lg w-full p-0 overflow-hidden flex flex-col max-h-[85vh]"
      >
        <DialogHeader className="border-b border-slate-700/50 p-4 shrink-0">
          <DialogTitle className="text-white">
            {deal ? "Edit Deal" : "New Deal"}
          </DialogTitle>
        </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[calc(85vh-180px)]">
            <div className="grid gap-2">
              <Label className="text-slate-300">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Deal title"
                className="border-slate-700 bg-slate-800 text-white"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-slate-300">Contact</Label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              >
                <option value="">Select a contact</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.phone}
                  </option>
                ))}
              </select>

              {linkedConversation && (
                <Link
                  href="/inbox"
                  className="mt-1 inline-flex items-center gap-1.5 self-start rounded-md bg-violet-500/10 px-2 py-1 text-xs text-violet-400 hover:bg-violet-500/20"
                >
                  <MessageSquare className="h-3 w-3" />
                  Link to Conversation
                </Link>
              )}
            </div>

            <div className="grid grid-cols-[1fr_110px] gap-3">
              <div className="grid gap-2">
                <Label className="text-slate-300">Value</Label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-slate-500 text-xs font-semibold pointer-events-none select-none">
                    {currency === "XOF" ? "XOF" : currency === "EUR" ? "€" : "$"}
                  </span>
                  <Input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0"
                    className="border-slate-700 bg-slate-800 pl-11 text-white"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-slate-300">Currency</Label>
                <Input
                  value={currency}
                  disabled
                  className="border-slate-700 bg-slate-800/50 text-slate-400 focus-visible:ring-0"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-slate-300">Expected Close Date</Label>
              <Input
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
                className="border-slate-700 bg-slate-800 text-white"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-slate-300">Stage</Label>
              <select
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-violet-500"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label className="text-slate-300">Assigned To</Label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-violet-500"
              >
                <option value="">Unassigned</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label className="text-slate-300">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes..."
                className="min-h-[100px] border-slate-700 bg-slate-800 text-white"
              />
            </div>

            {deal && (
              <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Status
                  </p>
                  {deal.order_id && (
                    <Link
                      href="/dashboard/orders"
                      className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 hover:underline"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" /> Voir la commande liée
                    </Link>
                  )}
                </div>
                
                {deal.status === "won" && deal.order_id ? (
                  <div className="text-sm font-semibold text-emerald-400 flex items-center gap-1 py-1">
                    <Check className="h-4 w-4" /> Gagné (Commande liée)
                  </div>
                ) : showOrderPanel ? (
                  <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60 space-y-3 mt-2">
                    <p className="text-xs font-semibold text-white">Générer une commande liée ?</p>
                    
                    <div className="grid gap-1">
                      <Label className="text-[10px] text-slate-300">Produit (Optionnel)</Label>
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className="h-8 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white outline-none"
                      >
                        <option value="">-- Article générique (valeur du deal) --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.price} {p.currency})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="grid gap-0.5">
                        <Label className="text-[10px] text-slate-300">Moyen Paiement</Label>
                        <select
                          value={orderPaymentMethod}
                          onChange={(e) => setOrderPaymentMethod(e.target.value)}
                          className="h-8 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-white outline-none"
                        >
                          <option value="card">Carte</option>
                          <option value="mobile_money">Mobile Money</option>
                          <option value="cash">Espèces</option>
                        </select>
                      </div>
                      
                      <div className="grid gap-0.5">
                        <Label className="text-[10px] text-slate-300">Statut initial</Label>
                        <select
                          value={orderStatus}
                          onChange={(e) => setOrderStatus(e.target.value as any)}
                          className="h-8 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-white outline-none"
                        >
                          <option value="pending">En Attente</option>
                          <option value="paid">Payée</option>
                          <option value="shipped">Expédiée</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        onClick={handleMarkAsWonWithOrder}
                        disabled={createOrderLoading}
                        className="flex-1 h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                      >
                        {createOrderLoading ? "Création..." : "Créer commande"}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleStatusChange("won")}
                        disabled={createOrderLoading}
                        className="flex-1 h-7 text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-200"
                      >
                        Seulement Won
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowOrderPanel(false)}
                      disabled={createOrderLoading}
                      className="w-full h-6 text-[10px] text-slate-400 hover:text-white"
                    >
                      Annuler
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => setShowOrderPanel(true)}
                      disabled={!!statusAction || deal.status === "won"}
                      className="flex-1 bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      {statusAction === "won" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="mr-1 h-4 w-4" />
                          Mark as Won
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleStatusChange("lost")}
                      disabled={!!statusAction || deal.status === "lost"}
                      className="flex-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {statusAction === "lost" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <X className="mr-1 h-4 w-4" />
                          Mark as Lost
                        </>
                      )}
                    </Button>
                  </div>
                )}
                {deal.status && deal.status !== "open" && !showOrderPanel && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleStatusChange("open")}
                    disabled={!!statusAction}
                    className="w-full text-slate-400 hover:text-white"
                  >
                    Reopen deal
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-slate-700/50 bg-slate-900/80 p-4 shrink-0">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !title.trim() || !contactId || !stageId}
                className="flex-1 bg-violet-600 text-white hover:bg-violet-700"
              >
                {saving ? "Saving..." : deal ? "Save Changes" : "Create Deal"}
              </Button>
            </div>

            {deal &&
              (confirmDelete ? (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs">
                  <span className="text-red-300">Delete this deal?</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="rounded px-2 py-1 text-slate-300 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Confirm"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-red-400 hover:text-red-300"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete Deal
                </button>
              ))}
          </div>
      </DialogContent>
    </Dialog>
  );
}
