export interface CTAOptions {
  url: string;
  label?: string;
}

export interface CTAHandle {
  attach(parent: HTMLElement): void;
  destroy(): void;
}

/**
 * Persistent CTA button overlay. Sits bottom-center, follows safe-area.
 * Visible during gameplay; the end card may also render its own CTA.
 */
export function mountCTA(opts: CTAOptions): CTAHandle {
  const el = document.createElement('button');
  el.textContent = opts.label ?? '立即下载';
  el.setAttribute('type', 'button');
  Object.assign(el.style, <Partial<CSSStyleDeclaration>>{
    position: 'absolute',
    left: '50%',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
    transform: 'translateX(-50%)',
    padding: '12px 28px',
    border: 'none',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #ff7a18, #af002d)',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '700',
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
    cursor: 'pointer',
    zIndex: '10',
  });
  el.addEventListener('click', () => window.open(opts.url, '_blank'));

  let parent: HTMLElement | null = null;

  return {
    attach(p) {
      parent = p;
      p.appendChild(el);
    },
    destroy() {
      parent?.removeChild(el);
      parent = null;
    },
  };
}
