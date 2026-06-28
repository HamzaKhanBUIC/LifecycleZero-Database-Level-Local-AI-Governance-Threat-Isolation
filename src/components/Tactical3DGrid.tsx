"use client";

import { useState, useRef, useEffect } from "react";

interface Tactical3DGridProps {
  assets: any[];
  alerts: any[];
  isUnreachable: (asset: any) => boolean;
  selectionMode: boolean;
  selectedAssetIds: Set<string>;
  setSelectedAssetIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedAsset: (asset: any) => void;
}

export default function Tactical3DGrid({
  assets,
  alerts,
  isUnreachable,
  selectionMode,
  selectedAssetIds,
  setSelectedAssetIds,
  setSelectedAsset,
}: Tactical3DGridProps) {
  // Rotation states (Tactical View)
  const [rotateX, setRotateX] = useState(55);
  const [rotateZ, setRotateZ] = useState(-45);
  const [zoom, setZoom] = useState(0.9);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragRotation = useRef({ x: 55, z: -45 });
  const [autoRotate, setAutoRotate] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Slow auto-rotation when not interacting
  useEffect(() => {
    if (!autoRotate || isDragging) return;
    const interval = setInterval(() => {
      setRotateZ((prev) => (prev + 0.08) % 360);
    }, 16);
    return () => clearInterval(interval);
  }, [autoRotate, isDragging]);

  // Pointer dragging event handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setAutoRotate(false);
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragRotation.current = { x: rotateX, z: rotateZ };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    // Map drag distance to rotation degrees
    const sensitivity = 0.5;
    // Constrain X rotation to reasonable viewing angles (25 to 80 degrees)
    const newX = Math.max(25, Math.min(80, dragRotation.current.x + dy * sensitivity));
    const newZ = dragRotation.current.z - dx * sensitivity;

    setRotateX(newX);
    setRotateZ(newZ);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    // Resume auto-rotation after 6 seconds of inactivity
    setTimeout(() => {
      setAutoRotate(true);
    }, 6000);
  };

  const cols = 10;
  const cellSize = 16;
  const gap = 6;
  const step = cellSize + gap; // 22px

  return (
    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden">
      {/* 3D Viewport Controls Overlay */}
      <div className="absolute top-2 left-2 z-10 flex gap-1.5 font-mono text-[9px] text-zinc-400">
        <span className="bg-zinc-950/70 border border-zinc-800 px-1.5 py-0.5 rounded-[2px] flex items-center gap-1 select-none">
          <span className="w-1 h-1 rounded-full bg-blue-500 animate-ping" />
          TACTICAL GRID
        </span>
        <button
          onClick={() => {
            setRotateX(55);
            setRotateZ(-45);
            setZoom(0.9);
          }}
          className="bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 px-1.5 py-0.5 rounded-[2px] cursor-pointer"
        >
          RESET
        </button>
        <button
          onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}
          className="bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 px-1.5 py-0.5 rounded-[2px] cursor-pointer"
        >
          +
        </button>
        <button
          onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
          className="bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 px-1.5 py-0.5 rounded-[2px] cursor-pointer"
        >
          -
        </button>
      </div>

      {/* Drag Surface Canvas */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full h-full cursor-grab active:cursor-grabbing flex items-center justify-center relative touch-none select-none bg-zinc-950/20"
        style={{ perspective: "1000px" }}
      >
        {/* The 3D World (Tilted Floor Plane) */}
        <div
          className="relative transition-transform duration-75 preserve-3d"
          style={{
            transform: `rotateX(${rotateX}deg) rotateZ(${rotateZ}deg) scale3d(${zoom}, ${zoom}, ${zoom})`,
            width: `${cols * step}px`,
            height: `${Math.ceil(assets.length / cols) * step}px`,
          }}
        >
          {/* Grid lines floor */}
          <div
            className="absolute inset-0 border border-zinc-800/40 pointer-events-none"
            style={{
              backgroundImage: "linear-gradient(to right, rgba(63, 63, 70, 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(63, 63, 70, 0.15) 1px, transparent 1px)",
              backgroundSize: `${step}px ${step}px`,
            }}
          />

          {/* Pillars List */}
          {assets.map((asset, idx) => {
            const hasCriticalAlert = alerts.some(
              (a) => a.AssetId === asset.AssetId && a.RiskLevel === "CRITICAL"
            );
            const isIsolated = asset.Status === "ISOLATED";
            const isSilent = isUnreachable(asset);

            const col = idx % cols;
            const row = Math.floor(idx / cols);

            // Positioning on floor grid
            const x = col * step;
            const y = row * step;

            // Determine dimensions and color tokens
            let h = 18; // Height in 3D (Z-axis)
            let colorTop = "#22c55e"; // Emerald-500
            let colorFront = "#16a34a"; // Emerald-600
            let colorSide = "#15803d"; // Emerald-700
            let pulseClass = "";

            if (isIsolated) {
              h = 4; // Flat severed node
              colorTop = "#4b5563"; // Gray-600
              colorFront = "#374151"; // Gray-700
              colorSide = "#1f2937"; // Gray-800
            } else if (hasCriticalAlert) {
              h = 32; // Tall tower
              colorTop = "#ef4444"; // Red-500
              colorFront = "#dc2626"; // Red-600
              colorSide = "#b91c1c"; // Red-700
              pulseClass = "animate-pulse";
            } else if (isSilent) {
              h = 24;
              colorTop = "#f59e0b"; // Amber-500
              colorFront = "#d97706"; // Amber-600
              colorSide = "#b45309"; // Amber-700
            }

            const isSelected = selectedAssetIds.has(asset.AssetId);

            const lastSeenText = asset.LastHeartbeat
              ? `${Math.floor((now - new Date(asset.LastHeartbeat).getTime()) / 60000)}m ago`
              : "Never";

            return (
              <div
                key={idx}
                className="absolute preserve-3d group transition-transform duration-300"
                style={{
                  width: `${cellSize}px`,
                  height: `${cellSize}px`,
                  transform: `translate3d(${x}px, ${y}px, 0)`,
                  zIndex: row,
                }}
              >
                {/* 3D Pillar */}
                <button
                  onClick={() => {
                    if (selectionMode) {
                      setSelectedAssetIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(asset.AssetId)) next.delete(asset.AssetId);
                        else next.add(asset.AssetId);
                        return next;
                      });
                    } else {
                      setSelectedAsset(asset);
                    }
                  }}
                  className={`relative w-full h-full text-left focus:outline-none preserve-3d block cursor-pointer transition-transform duration-300 hover:translate-z-[8px]`}
                  style={{
                    transformStyle: "preserve-3d",
                  }}
                >
                  {/* Top Face */}
                  <div
                    className={`absolute inset-0 border border-zinc-950/20 ${pulseClass}`}
                    style={{
                      transform: `translateZ(${h}px)`,
                      backgroundColor: colorTop,
                      boxShadow: isSelected
                        ? "0 0 12px 2px #ffffff"
                        : hasCriticalAlert
                        ? "0 0 16px 2px rgba(239, 68, 68, 0.4)"
                        : "none",
                    }}
                  >
                    {/* Ring selector highlight */}
                    {isSelected && (
                      <div className="absolute inset-[1px] border border-white animate-ping" />
                    )}
                  </div>

                  {/* Front Face (Facing bottom-right along Y) */}
                  <div
                    className="absolute border border-zinc-950/20"
                    style={{
                      width: `${cellSize}px`,
                      height: `${h}px`,
                      transformOrigin: "bottom",
                      transform: "rotateX(-90deg)",
                      bottom: 0,
                      left: 0,
                      backgroundColor: colorFront,
                    }}
                  />

                  {/* Back Face (Facing top-left along Y) */}
                  <div
                    className="absolute border border-zinc-950/20"
                    style={{
                      width: `${cellSize}px`,
                      height: `${h}px`,
                      transformOrigin: "top",
                      transform: "rotateX(90deg)",
                      top: 0,
                      left: 0,
                      backgroundColor: colorFront,
                    }}
                  />

                  {/* Right Face (Facing top-right along X) */}
                  <div
                    className="absolute border border-zinc-950/20"
                    style={{
                      width: `${h}px`,
                      height: `${cellSize}px`,
                      transformOrigin: "right",
                      transform: "rotateY(90deg)",
                      right: 0,
                      top: 0,
                      backgroundColor: colorSide,
                    }}
                  />

                  {/* Left Face (Facing bottom-left along X) */}
                  <div
                    className="absolute border border-zinc-950/20"
                    style={{
                      width: `${h}px`,
                      height: `${cellSize}px`,
                      transformOrigin: "left",
                      transform: "rotateY(-90deg)",
                      left: 0,
                      top: 0,
                      backgroundColor: colorSide,
                    }}
                  />

                  {/* Pulse Ring Indicator at Base for Critical nodes */}
                  {hasCriticalAlert && (
                    <div
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-red-500/40 pointer-events-none animate-ping"
                      style={{ transform: "translate3d(-50%, -50%, 0) translateZ(1px)" }}
                    />
                  )}
                </button>

                {/* Tactical Hover Tooltip */}
                <div
                  className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-[999] bg-[#050505] border border-zinc-800 p-2 font-mono text-[9px] text-zinc-400 w-48 rounded-[2px] shadow-[0_4px_12px_rgba(0,0,0,0.5)] pointer-events-none"
                  style={{
                    // Counteract grid tilt to display flat to viewport
                    transform: `translate3d(-50%, 0, ${h + 15}px) rotateZ(${-rotateZ}deg) rotateX(${-rotateX}deg)`,
                  }}
                >
                  <div className="text-white font-bold mb-1 pb-1 border-b border-zinc-900 flex justify-between">
                    <span>{asset.AssetId}</span>
                    <span
                      className={
                        isIsolated
                          ? "text-zinc-500 font-bold"
                          : hasCriticalAlert
                          ? "text-red-500 font-bold"
                          : isSilent
                          ? "text-amber-500 font-bold"
                          : "text-green-500 font-bold"
                      }
                    >
                      {isIsolated
                        ? "ISOLATED"
                        : hasCriticalAlert
                        ? "CRITICAL"
                        : isSilent
                        ? "UNREACHABLE"
                        : "CLEAN"}
                    </span>
                  </div>
                  <div>HOST: {asset.AssetName}</div>
                  <div>TYPE: {asset.Type}</div>
                  <div>USER: {asset.EmployeeName}</div>
                  <div className="text-zinc-600 mt-1">LAST SEEN: {lastSeenText}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend & Instructions footer */}
      <div className="px-4 py-2 border-t border-zinc-900 bg-zinc-950/40 flex justify-between items-center text-[9px] font-mono text-zinc-500 select-none">
        <span>DRAG TO ROTATE SCENE</span>
        <span>SCROLL TO ZOOM</span>
      </div>
    </div>
  );
}
