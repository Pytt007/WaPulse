"use client"

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/use-translation'
import {
  MessageSquare,
  UserPlus,
  DollarSign,
  Send,
} from 'lucide-react'

import {
  loadActivity,
  loadConversationsSeries,
  loadMetrics,
  loadPipelineDonut,
  loadResponseTime,
} from '@/lib/dashboard/queries'
import type {
  ActivityItem,
  ConversationsSeriesPoint,
  MetricsBundle,
  PeriodType,
  PipelineDonutData,
  ResponseTimeSummary,
} from '@/lib/dashboard/types'

import { MetricCard } from '@/components/dashboard/metric-card'
import { SkeletonCard } from '@/components/dashboard/skeleton'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { ConversationsChart } from '@/components/dashboard/conversations-chart'
import { PipelineDonut } from '@/components/dashboard/pipeline-donut'
import { ResponseTimeChart } from '@/components/dashboard/response-time-chart'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { useCurrency } from '@/hooks/use-currency'
import { DateRangePicker } from '@/components/dashboard/date-range-picker'

type RangeDays = 7 | 30 | 90

export default function DashboardPage() {
  const { t } = useTranslation()
  const { format: formatPrice } = useCurrency()
  const [metrics, setMetrics] = useState<MetricsBundle | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)

  const [period, setPeriod] = useState<PeriodType>('day')
  const [range, setRange] = useState<RangeDays>(30)
  // Keep a cache per range so switching tabs doesn't re-fetch what we
  // already have. Ranges the user hasn't opened yet stay null and
  // trigger a fetch on first view.
  const [series, setSeries] = useState<Record<RangeDays, ConversationsSeriesPoint[] | null>>({
    7: null,
    30: null,
    90: null,
  })
  const [seriesLoading, setSeriesLoading] = useState(true)

  const [pipeline, setPipeline] = useState<PipelineDonutData | null>(null)
  const [pipelineLoading, setPipelineLoading] = useState(true)

  const [responseTime, setResponseTime] = useState<ResponseTimeSummary | null>(null)
  const [responseTimeLoading, setResponseTimeLoading] = useState(true)

  const [activity, setActivity] = useState<ActivityItem[] | null>(null)
  const [activityLoading, setActivityLoading] = useState(true)

  // Custom date selection states (Date objects)
  const [isCustomRange, setIsCustomRange] = useState(false)
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 3)
    return d
  })
  const [customEnd, setCustomEnd] = useState(() => {
    return new Date()
  })
  const [customSeries, setCustomSeries] = useState<ConversationsSeriesPoint[] | null>(null)
  const [customSeriesLoading, setCustomSeriesLoading] = useState(false)

  const loadMetricsData = useCallback((p: PeriodType | 'custom', start?: Date, end?: Date) => {
    setMetricsLoading(true)
    const db = createClient()
    void loadMetrics(db, p, start, end)
      .then((m) => setMetrics(m))
      .catch((err) => console.error('[dashboard] metrics failed:', err))
      .finally(() => setMetricsLoading(false))
  }, [])

  const loadCustomSeries = useCallback((start: Date, end: Date) => {
    setCustomSeriesLoading(true)
    const db = createClient()
    void loadConversationsSeries(db, { start, end })
      .then((s) => setCustomSeries(s))
      .catch((err) => console.error('[dashboard] custom series failed:', err))
      .finally(() => setCustomSeriesLoading(false))
  }, [])

  const loadAll = useCallback(() => {
    const db = createClient()

    void loadConversationsSeries(db, 30)
      .then((s) => setSeries((prev) => ({ ...prev, 30: s })))
      .catch((err) => console.error('[dashboard] series failed:', err))
      .finally(() => setSeriesLoading(false))

    void loadPipelineDonut(db)
      .then((p) => setPipeline(p))
      .catch((err) => console.error('[dashboard] pipeline failed:', err))
      .finally(() => setPipelineLoading(false))

    void loadResponseTime(db)
      .then((r) => setResponseTime(r))
      .catch((err) => console.error('[dashboard] response time failed:', err))
      .finally(() => setResponseTimeLoading(false))

    // Fetch up to 50 so the biggest page-size option in the feed
    // (50 rows) is already in memory — switching sizes then becomes
    // a pure client-side slice with no extra round trip.
    void loadActivity(db, 50)
      .then((a) => setActivity(a))
      .catch((err) => console.error('[dashboard] activity failed:', err))
      .finally(() => setActivityLoading(false))
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    if (isCustomRange) {
      loadMetricsData('custom', customStart, customEnd)
    } else {
      loadMetricsData(period)
    }
  }, [isCustomRange, period, customStart, customEnd, loadMetricsData])

  useEffect(() => {
    if (isCustomRange) {
      loadCustomSeries(customStart, customEnd)
    }
  }, [isCustomRange, customStart, customEnd, loadCustomSeries])

  // Range switch handler — kept in an event callback (not an effect)
  // so the setState calls stay out of the react-hooks/set-state-in-effect
  // rule's way. The cached bucket check means switching back to a
  // previously-viewed range is instant and doesn't re-fetch.
  const handleRangeChange = useCallback(
    (r: RangeDays) => {
      setRange(r)
      if (series[r] !== null) return
      setSeriesLoading(true)
      const db = createClient()
      loadConversationsSeries(db, r)
        .then((s) => setSeries((prev) => ({ ...prev, [r]: s })))
        .catch((err) => console.error('[dashboard] series failed:', err))
        .finally(() => setSeriesLoading(false))
    },
    [series],
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("Dashboard")}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {t("Live analytics across conversations, contacts, deals, broadcasts, and automations.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{t("Période :")}</span>
            <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5">
              {(['day', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setIsCustomRange(false)
                    setPeriod(p)
                  }}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    !isCustomRange && period === p ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p === 'day' ? t("Jour") : p === 'week' ? t("Semaine") : t("Mois")}
                </button>
              ))}
              <button
                onClick={() => setIsCustomRange(true)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  isCustomRange ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t("Personnalisé")}
              </button>
            </div>
          </div>

          {isCustomRange && (
            <DateRangePicker
              startDate={customStart}
              endDate={customEnd}
              onApply={(start, end) => {
                setCustomStart(start)
                setCustomEnd(end)
              }}
            />
          )}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricsLoading || !metrics ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricCard
              title={t("Active Conversations")}
              value={metrics.activeConversations.current.toLocaleString()}
              icon={MessageSquare}
              delta={{
                sign: metrics.activeConversations.previous,
                label: deltaLabel(
                  metrics.activeConversations.previous,
                  isCustomRange
                    ? 'new vs previous period'
                    : period === 'week'
                    ? 'new this week vs last week'
                    : period === 'month'
                    ? 'new this month vs last month'
                    : 'new today vs yesterday',
                  t,
                ),
              }}
            />
            <MetricCard
              title={
                isCustomRange
                  ? t("New Contacts In Selected Period")
                  : period === 'week'
                  ? t("New Contacts This Week")
                  : period === 'month'
                  ? t("New Contacts This Month")
                  : t("New Contacts Today")
              }
              value={metrics.newContactsToday.current.toLocaleString()}
              icon={UserPlus}
              delta={{
                sign:
                  metrics.newContactsToday.current - metrics.newContactsToday.previous,
                label: deltaLabel(
                  metrics.newContactsToday.current - metrics.newContactsToday.previous,
                  isCustomRange
                    ? 'vs previous period'
                    : period === 'week'
                    ? 'vs last week'
                    : period === 'month'
                    ? 'vs last month'
                    : 'vs yesterday',
                  t,
                ),
              }}
            />
            <MetricCard
              title={t("Open Deals Value")}
              value={formatPrice(metrics.openDealsValue, 'XOF')}
              icon={DollarSign}
              subtitle={`${metrics.openDealsCount} ${t(metrics.openDealsCount === 1 ? 'open deal' : 'open deals')}`}
            />
            <MetricCard
              title={
                isCustomRange
                  ? t("Messages Sent In Selected Period")
                  : period === 'week'
                  ? t("Messages Sent This Week")
                  : period === 'month'
                  ? t("Messages Sent This Month")
                  : t("Messages Sent Today")
              }
              value={metrics.messagesSentToday.current.toLocaleString()}
              icon={Send}
              delta={{
                sign:
                  metrics.messagesSentToday.current - metrics.messagesSentToday.previous,
                label: deltaLabel(
                  metrics.messagesSentToday.current - metrics.messagesSentToday.previous,
                  isCustomRange
                    ? 'vs previous period'
                    : period === 'week'
                    ? 'vs last week'
                    : period === 'month'
                    ? 'vs last month'
                    : 'vs yesterday',
                  t,
                ),
              }}
            />
          </>
        )}
      </div>

      {/* Quick actions */}
      <QuickActions />

      {/* Charts row */}
      {/* items-stretch (the grid default) stretches the two columns to
          match the tallest sibling; adding h-full on each wrapper and
          on the inner panels makes both cards actually fill that
          stretched height so their rounded borders line up. Without
          this, the pipeline card rendered at its natural (shorter)
          height while the line chart drove the row height. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="h-full lg:col-span-3">
          <ConversationsChart
            series={isCustomRange ? customSeries : series}
            loading={isCustomRange ? customSeriesLoading : seriesLoading}
            range={isCustomRange ? 'custom' : range}
            onRangeChange={isCustomRange ? undefined : handleRangeChange}
          />
        </div>
        <div className="h-full lg:col-span-2">
          <PipelineDonut data={pipeline} loading={pipelineLoading} />
        </div>
      </div>

      {/* Response time */}
      <ResponseTimeChart data={responseTime} loading={responseTimeLoading} />

      {/* Activity feed */}
      <ActivityFeed items={activity} loading={activityLoading} />
    </div>
  )
}

// ------------------------------------------------------------

function deltaLabel(delta: number, suffix: string, t: (text: string) => string): string {
  if (delta === 0) return `${t('No change')} ${t(suffix)}`
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toLocaleString()} ${t(suffix)}`
}

