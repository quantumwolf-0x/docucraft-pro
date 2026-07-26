import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  active: boolean;
}

export function Spotlight({ active }: Props) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isSpotlightOn, setIsSpotlightOn] = useState(false);

  useEffect(() => {
    if (!active) return;

    const onMouseMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        setIsSpotlightOn(true);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        setIsSpotlightOn(false);
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [active]);

  if (!active || !isSpotlightOn) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9999]"
      style={{
        background: `radial-gradient(circle 200px at ${pos.x}px ${pos.y}px, transparent 0%, rgba(0,0,0,0.85) 100%)`,
      }}
    />
  );
}
