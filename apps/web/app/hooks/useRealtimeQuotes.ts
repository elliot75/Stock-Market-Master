"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";

export interface Quote {
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

export function useRealtimeQuotes(symbols: string[], intervalMs = 5000) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(true);
  const prevQuotesRef = useRef<Record<string, Quote>>({});
  const symbolsKey = symbols.join(",");

  useEffect(() => {
    const currentSymbols = symbolsKey ? symbolsKey.split(",") : [];
    if (currentSymbols.length === 0) {
      setQuotes({});
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchQuotes = async () => {
      try {
        console.log(`[useRealtimeQuotes] Polling for: ${symbolsKey}`);
        const data = await api.getRealtimeQuotes(currentSymbols);
        if (!isMounted) return;

        // 將當前報價存入 ref，然後更新 state，這樣元件在下次渲染時就能比對出價差
        setQuotes(prev => {
          prevQuotesRef.current = prev;
          return data;
        });
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch realtime quotes:", err);
        // Don't set loading to false on error so we don't clear UI
        if (isMounted) setLoading(false);
      }
    };

    // Initial fetch
    fetchQuotes();

    // Set up polling
    const intervalId = setInterval(fetchQuotes, intervalMs);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [symbolsKey, intervalMs]);

  return { quotes, loading, prevQuotes: prevQuotesRef.current };
}
