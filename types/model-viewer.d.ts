import type { DetailedHTMLProps, HTMLAttributes } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        alt?: string;
        poster?: string;
        ar?: string;
        'ar-modes'?: string;
        'auto-rotate'?: string;
        'camera-controls'?: string;
        'shadow-intensity'?: string;
        'disable-zoom'?: string;
        exposure?: string;
      };
    }
  }
}

export {};
