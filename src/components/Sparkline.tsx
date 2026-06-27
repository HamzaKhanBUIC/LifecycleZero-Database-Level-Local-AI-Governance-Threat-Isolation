"use client";

import { useEffect, useRef } from "react";

interface SparklineProps {
  assetId: string;
  status: string;
  hasCriticalAlert?: boolean;
}

export default function Sparkline({ assetId, status, hasCriticalAlert = false }: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const points: number[] = Array(20).fill(0).map(() => 12 + Math.random() * 8);
    let animationFrameId: number;

    const isIsolated = status === "ISOLATED";
    const isUnreachable = status === "UNREACHABLE" || status === "MAINTENANCE";
    const isOffline = status === "PROCURING" || status === "IN_TRANSIT" || status === "RETIRED";

    // Set canvas size
    const width = 100;
    const height = 24;
    canvas.width = width;
    canvas.height = height;

    const render = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, width, height);

      // Determine waveform parameters based on health status
      let val = 12;
      if (isIsolated) {
        // Completely flat at zero
        val = height - 2;
      } else if (isOffline) {
        // Flat gray line at center (no live telemetry yet/anymore)
        val = height / 2;
      } else if (hasCriticalAlert) {
        // High frequency spike (critical CPU/RAM)
        val = 2 + Math.random() * 16;
      } else if (isUnreachable) {
        // Flat line or slow crawl (unreachable status)
        val = height / 2;
      } else {
        // Normal active fluctuation
        const last = points[points.length - 1];
        const change = (Math.random() - 0.5) * 3;
        val = Math.max(4, Math.min(height - 4, last + change));
      }

      points.push(val);
      if (points.length > 20) {
        points.shift();
      }

      // Draw line path
      ctx.beginPath();
      ctx.lineWidth = 1.0;
      
      if (isIsolated) {
        ctx.strokeStyle = "#f43f5e"; // Rose-500 flat
      } else if (isOffline) {
        ctx.strokeStyle = "#3f3f46"; // Zinc-700 flat/offline
      } else if (hasCriticalAlert) {
        ctx.strokeStyle = "#ef4444"; // Red-500 spikes
      } else if (isUnreachable) {
        ctx.strokeStyle = "#f59e0b"; // Amber-500 flat
      } else {
        ctx.strokeStyle = "#10b981"; // Emerald-500
      }

      // If unreachable, draw dashed line
      if (isUnreachable) {
        ctx.setLineDash([2, 2]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.moveTo(0, points[0]);
      for (let i = 1; i < points.length; i++) {
        const x = (i / (points.length - 1)) * width;
        ctx.lineTo(x, points[i]);
      }
      ctx.stroke();

      // If active, draw gradient fill below path
      if (!isIsolated && !isUnreachable && !isOffline) {
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        if (hasCriticalAlert) {
          grad.addColorStop(0, "rgba(239, 68, 68, 0.12)");
          grad.addColorStop(1, "rgba(239, 68, 68, 0)");
        } else {
          grad.addColorStop(0, "rgba(16, 185, 129, 0.12)");
          grad.addColorStop(1, "rgba(16, 185, 129, 0)");
        }
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Slow frame rate update to 12fps to conserve browser resources
      setTimeout(() => {
        animationFrameId = requestAnimationFrame(render);
      }, 1000 / 12);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [status, hasCriticalAlert]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-[100px] h-[24px] block select-none bg-zinc-950/40 border border-zinc-900/50 rounded-sm"
      style={{ imageRendering: "pixelated" }}
      title={`Realtime telemetry log for ${assetId}`}
    />
  );
}
