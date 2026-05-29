"use client";

import type { Deal, PipelineStage } from "@/types";
import { Calendar, Check, X, ShoppingCart } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

interface DealCardProps {
  deal: Deal;
  stage: PipelineStage | null;
  onEdit: (deal: Deal) => void;
  isOverlay?: boolean;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(name?: string, fallback?: string) {
  const source = (name || fallback || "?").trim();
  if (!source) return "?";
  return source.charAt(0).toUpperCase();
}

export function DealCard({ deal, stage, onEdit, isOverlay }: DealCardProps) {
  const { format: formatPrice } = useCurrency();
  const contactLabel = deal.contact?.name || deal.contact?.phone || "No contact";
  const assigneeLabel = deal.assignee?.full_name || null;

  return (
    <button
      type="button"
      onClick={(e) => {
        // `onClick` still fires after a non-drag tap because the PointerSensor
        // requires 5px movement before it counts as a drag.
        if (isOverlay) return;
        e.stopPropagation();
        onEdit(deal);
      }}
      className={`group relative w-full cursor-pointer rounded-xl border border-slate-700/50 bg-slate-800/70 pl-4 pr-3 py-3 text-left shadow-sm transition-all duration-300 ease-out hover-premium animate-scale-up ${
        isOverlay
          ? "shadow-xl"
          : "hover:-translate-y-0.5"
      }`}
    >
      {/* 4px left accent bar using stage color */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
        style={{ backgroundColor: stage?.color ?? "#94a3b8" }}
      />

      <div className="flex items-start justify-between gap-2">
        <h4 className="flex-1 text-sm font-semibold leading-snug text-white break-words">
          {deal.title}
        </h4>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {deal.status === "won" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
              <Check className="h-3 w-3" />
              Won
            </span>
          )}
          {deal.status === "lost" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400">
              <X className="h-3 w-3" />
              Lost
            </span>
          )}
          {deal.order_id && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-400 animate-fade-in" title="Commande liée">
              <ShoppingCart className="h-2.5 w-2.5" />
              Commande
            </span>
          )}
        </div>
      </div>

      {/* Contact row */}
      <div className="mt-2 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] font-semibold text-slate-200">
          {initials(deal.contact?.name, deal.contact?.phone)}
        </span>
        <span className="truncate text-xs text-slate-400">{contactLabel}</span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-bold text-violet-400">
          {formatPrice(deal.value, deal.currency || "XOF")}
        </span>
        {deal.expected_close_date && (
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            <Calendar className="h-3 w-3" />
            {formatDate(deal.expected_close_date)}
          </span>
        )}
      </div>

      {assigneeLabel && (
        <div className="mt-2 flex items-center justify-end">
          <span
            title={assigneeLabel}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-semibold text-violet-400"
          >
            {initials(assigneeLabel)}
          </span>
        </div>
      )}
    </button>
  );
}
