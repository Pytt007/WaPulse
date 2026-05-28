"use client"

import { useState, useEffect } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTranslation } from '@/hooks/use-translation'
import { cn } from '@/lib/utils'

interface DateRangePickerProps {
  startDate: Date
  endDate: Date
  onApply: (start: Date, end: Date) => void
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}

function isBetween(d: Date, start: Date, end: Date): boolean {
  const dTime = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
  const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()
  return dTime > startTime && dTime < endTime
}

export function DateRangePicker({ startDate, endDate, onApply }: DateRangePickerProps) {
  const { t, language } = useTranslation()
  const [open, setOpen] = useState(false)

  // Internal selection states
  const [tempStart, setTempStart] = useState<Date | null>(startDate)
  const [tempEnd, setTempEnd] = useState<Date | null>(endDate)

  // Calendar month/year navigation view states
  const [currentMonth, setCurrentMonth] = useState(startDate.getMonth())
  const [currentYear, setCurrentYear] = useState(startDate.getFullYear())

  // Synchronize when parent dates change
  useEffect(() => {
    setTempStart(startDate)
    setTempEnd(endDate)
    setCurrentMonth(startDate.getMonth())
    setCurrentYear(startDate.getFullYear())
  }, [startDate, endDate])

  const locale = language === 'fr' ? 'fr-FR' : 'en-US'

  const formattedLabel = (() => {
    const format = (d: Date) =>
      d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    return `${format(startDate)} – ${format(endDate)}`
  })()

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear((prev) => prev - 1)
    } else {
      setCurrentMonth((prev) => prev - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((prev) => prev + 1)
    } else {
      setCurrentMonth((prev) => prev + 1)
    }
  }

  const handleDayClick = (date: Date) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(date)
      setTempEnd(null)
    } else {
      if (date < tempStart) {
        setTempStart(date)
      } else {
        setTempEnd(date)
      }
    }
  }

  const handleApply = () => {
    if (tempStart && tempEnd) {
      onApply(tempStart, tempEnd)
      setOpen(false)
    } else if (tempStart) {
      // If only one day is selected, set both start and end to it
      onApply(tempStart, tempStart)
      setOpen(false)
    }
  }

  const handleCancel = () => {
    setTempStart(startDate)
    setTempEnd(endDate)
    setOpen(false)
  }

  // Generate 42 grid cells
  const gridCells = (() => {
    const cells: { date: Date; isCurrentMonth: boolean }[] = []
    const start = new Date(currentYear, currentMonth, 1)
    const startDayOfWeek = (start.getDay() + 6) % 7 // Monday-first (0 = Monday, 6 = Sunday)

    // Previous month padding
    const prevMonthEnd = new Date(currentYear, currentMonth, 0).getDate()
    for (let i = 0; i < startDayOfWeek; i++) {
      const day = prevMonthEnd - startDayOfWeek + 1 + i
      cells.push({
        date: new Date(currentYear, currentMonth - 1, day),
        isCurrentMonth: false,
      })
    }

    // Current month days
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({
        date: new Date(currentYear, currentMonth, i),
        isCurrentMonth: true,
      })
    }

    // Next month padding to reach 42 cells (6 rows)
    const remaining = 42 - cells.length
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        date: new Date(currentYear, currentMonth + 1, i),
        isCurrentMonth: false,
      })
    }

    return cells
  })()

  // Capitalized Month name and Year string
  const monthYearTitle = (() => {
    const date = new Date(currentYear, currentMonth, 1)
    const str = date.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
    return str.charAt(0).toUpperCase() + str.slice(1)
  })()

  const weekdays = language === 'fr'
    ? ['L', 'M', 'M', 'J', 'V', 'S', 'D']
    : ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:text-white cursor-pointer"
      >
        <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
        <span>{formattedLabel}</span>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[300px] border border-slate-800 bg-slate-900 p-4 shadow-xl rounded-xl text-white outline-none"
      >
        <div className="space-y-4">
          {/* Calendar Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">{monthYearTitle}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Weekdays Grid */}
          <div className="grid grid-cols-7 text-center">
            {weekdays.map((w, idx) => (
              <span key={idx} className="text-[10px] font-semibold text-slate-500 py-1">
                {w}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-y-1 text-center">
            {gridCells.map(({ date, isCurrentMonth }, idx) => {
              const isStart = tempStart ? isSameDay(date, tempStart) : false
              const isEnd = tempEnd ? isSameDay(date, tempEnd) : false
              const isRange = tempStart && tempEnd ? isBetween(date, tempStart, tempEnd) : false

              return (
                <div
                  key={idx}
                  className={cn(
                    'py-0.5 flex justify-center items-center relative',
                    isRange && 'bg-violet-500/10',
                    isStart && tempEnd && 'bg-violet-500/10 rounded-l-full',
                    isEnd && tempStart && 'bg-violet-500/10 rounded-r-full',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleDayClick(date)}
                    className={cn(
                      'h-8 w-8 text-xs font-medium rounded-full flex items-center justify-center cursor-pointer transition-all relative',
                      !isCurrentMonth && 'text-slate-600',
                      isCurrentMonth && 'text-slate-300 hover:bg-slate-800 hover:text-white',
                      (isStart || isEnd) && 'bg-violet-600 text-white font-bold hover:bg-violet-600!',
                    )}
                  >
                    {date.getDate()}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-violet-700 transition-colors cursor-pointer"
            >
              {t("Apply")}
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
