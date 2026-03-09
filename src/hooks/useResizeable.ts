import { useState, useEffect, useCallback } from "react";

export function useResizeable(onMove: (e: MouseEvent) => void) {
  // whether the user is resizing (i.e., mouse down on edge) the side panel
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onMove(e);
    }
    if (resizing) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', () => setResizing(false));
    }
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [resizing]);

  return [resizing, useCallback((e: {preventDefault: () => void; stopPropagation: () => void; button: number}) => {
    if (e.button === 0) {
      setResizing(true);
      e.preventDefault();
      e.stopPropagation();
    }
  }, [setResizing])] as const;
}
