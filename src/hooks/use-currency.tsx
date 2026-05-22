"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/hooks/use-translation";
import { Currency, SUPPORTED_CURRENCIES, convertCurrency } from "@/lib/currency";

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  format: (
    value: number,
    sourceCurrency?: string,
    options?: Intl.NumberFormatOptions
  ) => string;
  convert: (value: number, sourceCurrency?: string) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { language } = useTranslation();
  const [currency, setCurrencyState] = useState<Currency>("XOF");

  // Read preferences on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("wapulse_currency");
      if (stored && SUPPORTED_CURRENCIES.includes(stored as Currency)) {
        setCurrencyState(stored as Currency);
      }
    }
  }, []);

  const setCurrency = useCallback((newCurrency: Currency) => {
    setCurrencyState(newCurrency);
    if (typeof window !== "undefined") {
      localStorage.setItem("wapulse_currency", newCurrency);
    }
  }, []);

  const convert = useCallback(
    (value: number, sourceCurrency: string = "XOF") => {
      return convertCurrency(value, sourceCurrency, currency);
    },
    [currency]
  );

  const format = useCallback(
    (
      value: number,
      sourceCurrency: string = "XOF",
      options?: Intl.NumberFormatOptions
    ) => {
      const convertedValue = convertCurrency(value, sourceCurrency, currency);
      const locale = language === "fr" ? "fr-FR" : "en-US";

      // By default, XOF has no fractional digits, whereas EUR/USD/GBP have 2.
      const defaultFractionDigits = currency === "XOF" ? 0 : 2;

      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency,
        minimumFractionDigits:
          options?.minimumFractionDigits !== undefined
            ? options.minimumFractionDigits
            : defaultFractionDigits,
        maximumFractionDigits:
          options?.maximumFractionDigits !== undefined
            ? options.maximumFractionDigits
            : defaultFractionDigits,
        ...options,
      }).format(convertedValue);
    },
    [currency, language]
  );

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, format, convert }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
