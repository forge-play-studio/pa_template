/**
 * LoadingScreen (Scaffold)
 *
 * 最小可用加载页面：
 * - 不依赖任何具体图片资源
 * - 保持项目开箱即跑
 */

export class LoadingScreen {
  private container: HTMLDivElement;
  private isVisible: boolean = true;

  constructor(title: string = 'Loading...') {
    // 创建容器
    this.container = document.createElement('div');
    this.container.id = 'loading-screen';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #101018;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
      color: rgba(255,255,255,0.85);
    `;

    // 标题
    const label = document.createElement('div');
    label.innerText = title;
    label.style.cssText = `
      font-size: 18px;
      letter-spacing: 0.5px;
      margin-bottom: 14px;
    `;

    // 简单旋转指示器
    const spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 36px;
      height: 36px;
      border: 4px solid rgba(255,255,255,0.15);
      border-top-color: rgba(255,255,255,0.85);
      border-radius: 50%;
      animation: scaffold-spin 1s linear infinite;
    `;

    // keyframes
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes scaffold-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;

    this.container.appendChild(style);
    this.container.appendChild(label);
    this.container.appendChild(spinner);
    document.body.appendChild(this.container);
  }

  /** 隐藏加载页面（立即隐藏） */
  public hide(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    this.container.style.display = 'none';
  }

  /** 显示加载页面 */
  public show(): void {
    this.isVisible = true;
    this.container.style.display = 'flex';
  }

  /** 销毁 */
  public dispose(): void {
    this.container.remove();
  }
}
