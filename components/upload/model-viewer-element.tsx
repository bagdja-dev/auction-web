'use client';

import { useEffect, type CSSProperties } from 'react';

interface ModelViewerElementProps {
  src: string;
  className?: string;
  style?: CSSProperties;
  autoRotate?: boolean;
  cameraControls?: boolean;
  ar?: boolean;
}

/**
 * Thin wrapper around Google's <model-viewer> web component (glTF/GLB 3D
 * preview — drag-to-rotate + pinch/scroll-to-zoom built in). The package
 * touches browser-only globals (HTMLElement/customElements) at import
 * time, so it's dynamically imported inside useEffect — never at module
 * scope — to avoid breaking Next.js SSR/build. See
 * types/model-viewer.d.ts for the JSX typing of the custom element.
 */
export function ModelViewerElement({
  src,
  className,
  style,
  autoRotate = false,
  cameraControls = true,
  ar = false,
}: ModelViewerElementProps) {
  useEffect(() => {
    void import('@google/model-viewer');
  }, []);

  return (
    <model-viewer
      src={src}
      className={className}
      style={style}
      camera-controls={cameraControls ? '' : undefined}
      auto-rotate={autoRotate ? '' : undefined}
      ar={ar ? '' : undefined}
      ar-modes={ar ? 'webxr scene-viewer quick-look' : undefined}
      shadow-intensity="1"
    />
  );
}
