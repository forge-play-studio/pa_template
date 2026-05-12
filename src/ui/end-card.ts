export interface EndCardOptions {
  ctaUrl: string;
  onRetry?: () => void;
}

export type EndCardVariant = 'success' | 'fail';

export interface EndCardHandle {
  attach(parent: HTMLElement): void;
  show(variant: EndCardVariant): void;
  hide(): void;
  destroy(): void;
}

const COPY: Record<EndCardVariant, { title: string; subtitle: string }> = {
  success: { title: '🏆 通关！', subtitle: '挑战完整玩法' },
  fail: { title: '差一点！', subtitle: '再来一次试试' },
};

export function mountEndCard(opts: EndCardOptions): EndCardHandle {
  const root = document.createElement('div');
  Object.assign(root.style, <Partial<CSSStyleDeclaration>>{
    position: 'absolute',
    inset: '0',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(6px)',
    zIndex: '20',
  });

  const card = document.createElement('div');
  Object.assign(card.style, <Partial<CSSStyleDeclaration>>{
    minWidth: '260px',
    maxWidth: '320px',
    padding: '28px 24px',
    borderRadius: '20px',
    background: '#1a1f2b',
    color: '#fff',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  });
  root.appendChild(card);

  const title = document.createElement('div');
  title.style.fontSize = '24px';
  title.style.fontWeight = '700';
  title.style.marginBottom = '8px';

  const subtitle = document.createElement('div');
  subtitle.style.fontSize = '14px';
  subtitle.style.opacity = '0.7';
  subtitle.style.marginBottom = '20px';

  const ctaBtn = document.createElement('button');
  ctaBtn.textContent = '立即下载';
  Object.assign(ctaBtn.style, <Partial<CSSStyleDeclaration>>{
    width: '100%',
    padding: '14px',
    marginBottom: '10px',
    border: 'none',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #ff7a18, #af002d)',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
  });
  ctaBtn.addEventListener('click', () => window.open(opts.ctaUrl, '_blank'));

  const retryBtn = document.createElement('button');
  retryBtn.textContent = '再玩一次';
  Object.assign(retryBtn.style, <Partial<CSSStyleDeclaration>>{
    width: '100%',
    padding: '12px',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '12px',
    background: 'transparent',
    color: '#fff',
    fontSize: '14px',
    cursor: 'pointer',
  });
  retryBtn.addEventListener('click', () => {
    root.style.display = 'none';
    opts.onRetry?.();
  });

  card.append(title, subtitle, ctaBtn, retryBtn);

  let parent: HTMLElement | null = null;

  return {
    attach(p) {
      parent = p;
      p.appendChild(root);
    },
    show(variant) {
      const copy = COPY[variant];
      title.textContent = copy.title;
      subtitle.textContent = copy.subtitle;
      root.style.display = 'flex';
    },
    hide() {
      root.style.display = 'none';
    },
    destroy() {
      parent?.removeChild(root);
      parent = null;
    },
  };
}
