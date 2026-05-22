"use client"

import Link from 'next/link'
import { useState } from 'react'
import {
  MessageSquare,
  UserPlus,
  Briefcase,
  Radio,
  Zap,
  Inbox,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { ActivityItem, ActivityKind } from '@/lib/dashboard/types'
import { cn } from '@/lib/utils'
import { EmptyState } from './empty-state'
import { Skeleton } from './skeleton'
import { useTranslation } from '@/hooks/use-translation'

interface ActivityFeedProps {
  items: ActivityItem[] | null
  loading: boolean
}

const PAGE_SIZES = [5, 10, 20, 50] as const
type PageSize = (typeof PAGE_SIZES)[number]

interface KindTheme {
  icon: ComponentType<{ className?: string }>
  /** Tailwind classes for the round icon badge + label color. */
  badge: string
}

const KIND_THEME: Record<ActivityKind, KindTheme> = {
  message: { icon: MessageSquare, badge: 'bg-blue-500/10 text-blue-400' },
  contact: { icon: UserPlus, badge: 'bg-violet-500/10 text-violet-400' },
  deal: { icon: Briefcase, badge: 'bg-violet-500/10 text-violet-400' },
  broadcast: { icon: Radio, badge: 'bg-amber-500/10 text-amber-400' },
  automation: { icon: Zap, badge: 'bg-rose-500/10 text-rose-400' },
}

export function ActivityFeed({ items, loading }: ActivityFeedProps) {
  const { t } = useTranslation()
  // Start at 5 — a quick scan of the most recent events without
  // dominating vertical real estate. User expands explicitly via the
  // footer control when they want deeper history.
  const [pageSize, setPageSize] = useState<PageSize>(5)

  const totalLoaded = items?.length ?? 0
  const visible = items?.slice(0, pageSize) ?? []
  // A size option is "useful" if picking it would reveal rows the
  // smaller option doesn't already show. With PAGE_SIZES=[5,10,20,50]:
  // "10" is useful only once we've loaded ≥6 items, "20" once ≥11, etc.
  // The smallest option is always enabled.
  const isSizeUseful = (size: PageSize, i: number) =>
    i === 0 || totalLoaded > PAGE_SIZES[i - 1]

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <h2 className="text-sm font-semibold text-white">{t("Recent Activity")}</h2>
        <Link
          href="/inbox"
          className="text-xs font-medium text-violet-400 hover:text-violet-300"
        >
          {t("View all")} →
        </Link>
      </header>

      {loading || !items ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="p-5">
          <EmptyState
            icon={Inbox}
            title={t("No activity yet")}
            hint={t("Activity from messages, deals, broadcasts, and automations will appear here.")}
          />
        </div>
      ) : (
        <>
          <ul className="divide-y divide-slate-800">
            {visible.map((it, i) => {
              const theme = KIND_THEME[it.kind]
              const Icon = theme.icon
              // Alternating row background for scanability — dark-theme
              // translation of the spec's white / #f9fafb stripes.
              const stripe = i % 2 === 0 ? 'bg-transparent' : 'bg-slate-900/40'
              const row = (
                <div className="flex items-center gap-3 px-5 py-2.5">
                  <span
                    className={cn(
                      'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
                      theme.badge,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                    {translateActivityText(it.text, t)}
                  </span>
                  <span className="flex-shrink-0 text-xs text-slate-500 tabular-nums">
                    {relativeTime(it.at, t)}
                  </span>
                </div>
              )
              return (
                <li key={it.id} className={cn(stripe, 'transition-colors hover:bg-slate-800/40')}>
                  {it.href ? (
                    <Link href={it.href} className="block">
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              )
            })}
          </ul>
          <footer className="flex items-center justify-between border-t border-slate-800 px-5 py-3 text-xs">
            <span className="text-slate-500 tabular-nums">
              {t("Showing")} {visible.length} {t("of")} {totalLoaded}
              {totalLoaded === 50 ? '+' : ''}
            </span>
            <div className="flex items-center gap-1">
              <span className="mr-1 text-slate-500">{t("Show")}</span>
              {PAGE_SIZES.map((size, i) => {
                const disabled = !isSizeUseful(size, i)
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setPageSize(size)}
                    disabled={disabled}
                    className={cn(
                      'rounded-md px-2 py-1 font-medium tabular-nums transition-colors',
                      pageSize === size
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                      disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-slate-400',
                    )}
                  >
                    {size}
                  </button>
                )
              })}
            </div>
          </footer>
        </>
      )}
    </section>
  )
}

function relativeTime(iso: string, t: (text: string) => string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 60) return `${Math.max(1, diffSec)}${t("s ago")}`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}${t("m ago")}`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}${t("h ago")}`
  if (diffSec < 2_592_000) return `${Math.floor(diffSec / 86400)}${t("d ago")}`
  return new Date(iso).toLocaleDateString()
}

export function translateActivityText(text: string, t: (text: string) => string): string {
  // 1. New message from <who>
  if (text.startsWith("New message from ")) {
    const who = text.slice("New message from ".length)
    return `${t("New message from")} ${who}`
  }

  // 2. New contact: <who>
  if (text.startsWith("New contact: ")) {
    const who = text.slice("New contact: ".length)
    return `${t("New contact")}: ${who}`
  }

  // 3. Deal "<title>" in <stage>
  const dealInMatch = text.match(/^Deal "([^"]+)" in (.+)$/)
  if (dealInMatch) {
    const [, title, stage] = dealInMatch
    return `${t("deal")} "${title}" ${t("in")} ${t(stage)}`
  }

  // 4. Deal "<title>" updated
  const dealUpdatedMatch = text.match(/^Deal "([^"]+)" updated$/)
  if (dealUpdatedMatch) {
    const [, title] = dealUpdatedMatch
    return `${t("deal")} "${title}" ${t("updated")}`
  }

  // 5. Broadcast "<name>" sent to <count> contacts
  const broadcastSentMatch = text.match(/^Broadcast "([^"]+)" sent to (\d+) contacts$/)
  if (broadcastSentMatch) {
    const [, name, count] = broadcastSentMatch
    return `${t("broadcast")} "${name}" ${t("sent to")} ${count} ${t("contacts").toLowerCase()}`
  }

  // 6. Broadcast "<name>" <status> (<count> recipients)
  const broadcastStatusMatch = text.match(/^Broadcast "([^"]+)" ([^\s]+) \((\d+) recipients\)$/)
  if (broadcastStatusMatch) {
    const [, name, status, count] = broadcastStatusMatch
    return `${t("broadcast")} "${name}" ${t(status)} (${count} ${t("recipients")})`
  }

  // 7. Automation "<autoName>" failed for <who>
  const autoFailedMatch = text.match(/^Automation "([^"]+)" failed for (.+)$/)
  if (autoFailedMatch) {
    const [, autoName, who] = autoFailedMatch
    return `${t("automation")} "${autoName}" ${t("failed for")} ${who}`
  }

  // 8. Automation "<autoName>" triggered for <who>
  const autoTriggeredMatch = text.match(/^Automation "([^"]+)" triggered for (.+)$/)
  if (autoTriggeredMatch) {
    const [, autoName, who] = autoTriggeredMatch
    return `${t("automation")} "${autoName}" ${t("triggered for")} ${who}`
  }

  // Fallback
  return t(text)
}
