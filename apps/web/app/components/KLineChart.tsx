"use client";

import { useEffect, useRef } from "react";
import { createChart, type IChartApi, ColorType } from "lightweight-charts";

interface CandleData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma5?: number | null;
  ma10?: number | null;
  ma20?: number | null;
  ma60?: number | null;
}

interface KLineChartProps {
  data: CandleData[];
  height?: number;
}

export default function KLineChart({ data, height = 400 }: KLineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    // 清除舊 chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8b95a5",
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: "#1e2a4530" },
        horzLines: { color: "#1e2a4530" },
      },
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: "#1e2a45",
      },
      timeScale: {
        borderColor: "#1e2a45",
        timeVisible: false,
      },
    });

    chartRef.current = chart;

    // K 線 (v4 API: addCandlestickSeries)
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#ef4444",
      downColor: "#22c55e",
      borderUpColor: "#ef4444",
      borderDownColor: "#22c55e",
      wickUpColor: "#ef4444",
      wickDownColor: "#22c55e",
    });

    const candleData = data.map((d) => ({
      time: d.date.split("T")[0],
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    candleSeries.setData(candleData as any);

    // MA 線
    const maConfigs = [
      { key: "ma5" as const, color: "#f59e0b", width: 1 },
      { key: "ma20" as const, color: "#3b82f6", width: 1 },
      { key: "ma60" as const, color: "#a855f7", width: 1 },
    ];

    for (const ma of maConfigs) {
      const maData = data
        .filter((d) => d[ma.key] != null)
        .map((d) => ({
          time: d.date.split("T")[0],
          value: d[ma.key] as number,
        }));

      if (maData.length > 0) {
        const lineSeries = chart.addLineSeries({
          color: ma.color,
          lineWidth: ma.width as any,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        lineSeries.setData(maData as any);
      }
    }

    // 成交量
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    const volumeData = data.map((d) => ({
      time: d.date.split("T")[0],
      value: d.volume,
      color: d.close >= d.open ? "#ef444460" : "#22c55e60",
    }));

    volumeSeries.setData(volumeData as any);

    chart.timeScale().fitContent();

    // Resize observer
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    observer.observe(chartContainerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data, height]);

  if (data.length === 0) {
    return (
      <div className="empty-state" style={{ height }}>
        <div className="icon">📉</div>
        <p>暫無 K 線資料</p>
      </div>
    );
  }

  return <div ref={chartContainerRef} style={{ width: "100%", height }} />;
}
