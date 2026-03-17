import { useEffect } from "react";

// useful for debugging
export function useDetectChange(expr: any, name: string) {
  useEffect(() => {
    console.log(name, 'changed to:', expr);
  }, [expr]);
}

export function useDetectChange2(obj: {}) {
  for (const [key,val] of Object.entries(obj)) {
    useDetectChange(val, key);
  }
}