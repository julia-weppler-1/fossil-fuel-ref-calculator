import { useLayoutEffect, useRef, useState } from 'react';

export function useChartDims(aspect = 0.875) {
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      const h = Math.round(w * aspect);
      setDims(prev => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    });

    ro.observe(node);
    return () => ro.disconnect();
  }, [aspect]);

  return { containerRef, dims };
}
