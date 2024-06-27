class VanillaTilt {
  private width: number | null = null;
  private height: number | null = null;
  private clientWidth: number | null = null;
  private clientHeight: number | null = null;
  private left: number | null = null;
  private top: number | null = null;
  private gammazero: number | null = null;
  private betazero: number | null = null;
  private lastgammazero: number | null = null;
  private lastbetazero: number | null = null;
  private transitionTimeout: ReturnType<typeof setTimeout> | null = null;
  private updateCall: ReturnType<typeof requestAnimationFrame> | null = null;
  private event: MouseEvent | TouchEvent | DeviceOrientationEvent | null = null;

  private element: HTMLElement;
  private settings: any;
  private reverse: number;
  private glare: boolean;
  private glarePrerender: boolean;
  private fullPageListening: boolean;
  private gyroscope: boolean;
  private gyroscopeSamples: number;

  private elementListener: HTMLElement | Document | Window;
  private glareElementWrapper?: HTMLElement | null;
  private glareElement?: HTMLElement | null;

  private updateBind: () => void;
  private resetBind: () => void;

  constructor(element: HTMLElement, options: any = {}) {
    if (!(element instanceof Node)) {
      throw new Error("Can't initialize VanillaTilt because " + element + " is not a Node.");
    }

    this.element = element;
    this.settings = this.extendSettings(options);
    this.reverse = this.settings.reverse ? -1 : 1;
    this.glare = this.isSettingTrue(this.settings.glare);
    this.glarePrerender = this.isSettingTrue(this.settings["glare-prerender"]);
    this.fullPageListening = this.isSettingTrue(this.settings["full-page-listening"]);
    this.gyroscope = this.isSettingTrue(this.settings.gyroscope);
    this.gyroscopeSamples = this.settings.gyroscopeSamples;

    this.elementListener = this.getElementListener();

    if (this.glare) {
      this.prepareGlare();
    }

    if (this.fullPageListening) {
      this.updateClientSize();
    }

    this.updateBind = this.update.bind(this);
    this.resetBind = this.reset.bind(this);

    this.addEventListeners();
    this.updateInitialPosition();
  }

  private isSettingTrue(value: any): boolean {
    return value === "" || value === true || value === 1;
  }

  private extendSettings(options: any): any {
    const defaultSettings = {
      reverse: false,
      glare: false,
      "glare-prerender": false,
      "full-page-listening": false,
      gyroscope: false,
      gyroscopeSamples: 10,
      mouseEventElement: null,
      reset: true,
      perspective: 1000,
      startX: 0,
      startY: 0,
      max: 15,
      scale: 1,
      gyroscopeMinAngleX: -45,
      gyroscopeMaxAngleX: 45,
      gyroscopeMinAngleY: -45,
      gyroscopeMaxAngleY: 45,
    };

    return { ...defaultSettings, ...options };
  }

  private getElementListener(): HTMLElement | Document | Window {
    if (this.fullPageListening) {
      return window.document;
    }

    const mouseEventElement = this.settings.mouseEventElement;
    if (typeof mouseEventElement === "string") {
      const element = document.querySelector(mouseEventElement);
      if (element instanceof HTMLElement) {
        return element;
      }
    }

    return mouseEventElement instanceof Node ? mouseEventElement : this.element;
  }

  private addEventListeners(): void {
    this.elementListener.addEventListener("mouseenter", this.onMouseEnter.bind(this));
    this.elementListener.addEventListener("mouseleave", this.onMouseLeave.bind(this));
    this.elementListener.addEventListener("mousemove", this.onMouseMove.bind(this));

    if (this.glare || this.fullPageListening) {
      window.addEventListener("resize", this.onWindowResize.bind(this));
    }

    if (this.gyroscope) {
      window.addEventListener("deviceorientation", this.onDeviceOrientation.bind(this));
    }
  }

  private removeEventListeners(): void {
    this.elementListener.removeEventListener("mouseenter", this.onMouseEnter.bind(this));
    this.elementListener.removeEventListener("mouseleave", this.onMouseLeave.bind(this));
    this.elementListener.removeEventListener("mousemove", this.onMouseMove.bind(this));

    if (this.gyroscope) {
      window.removeEventListener("deviceorientation", this.onDeviceOrientation.bind(this));
    }

    if (this.glare || this.fullPageListening) {
      window.removeEventListener("resize", this.onWindowResize.bind(this));
    }
  }

  public destroy(): void {
    clearTimeout(this.transitionTimeout!);
    if (this.updateCall !== null) {
      cancelAnimationFrame(this.updateCall);
    }

    this.reset();
    this.removeEventListeners();
    delete this.element.vanillaTilt;
    this.element = null!;
  }

  private onDeviceOrientation(event: DeviceOrientationEvent): void {
    if (event.gamma === null || event.beta === null) {
      return;
    }

    this.updateElementPosition();
    if (this.gyroscopeSamples > 0) {
      this.lastgammazero = this.gammazero ?? event.gamma;
      this.lastbetazero = this.betazero ?? event.beta;

      this.gammazero = (event.gamma + this.lastgammazero) / 2;
      this.betazero = (event.beta + this.lastbetazero) / 2;

      this.gyroscopeSamples -= 1;
    }

    const dx = event.gamma - (this.settings.gyroscopeMinAngleX + this.gammazero!);
    const dy = event.beta - (this.settings.gyroscopeMinAngleY + this.betazero!);
    const tiltX = dx / ((this.settings.gyroscopeMaxAngleX - this.settings.gyroscopeMinAngleX) / this.width!);
    const tiltY = dy / ((this.settings.gyroscopeMaxAngleY - this.settings.gyroscopeMinAngleY) / this.height!);

    if (this.updateCall !== null) {
      cancelAnimationFrame(this.updateCall);
    }

    this.event = {
      clientX: tiltX + this.left!,
      clientY: tiltY + this.top!,
    };

    this.updateCall = requestAnimationFrame(this.updateBind);
  }

  private onMouseEnter(): void {
    this.updateElementPosition();
    this.element.style.willChange = "transform";
    this.setTransition();
  }

  private onMouseMove(event: MouseEvent): void {
    if (this.updateCall !== null) {
      cancelAnimationFrame(this.updateCall);
    }

    this.event = event;
    this.updateCall = requestAnimationFrame(this.updateBind);
  }

  private onMouseLeave(): void {
    this.setTransition();
    if (this.settings.reset) {
      requestAnimationFrame(this.resetBind);
    }
  }

  private reset(): void {
    this.event = {
      clientX: this.left! + this.width! / 2,
      clientY: this.top! + this.height! / 2,
    };

    if (this.element && this.element.style) {
      this.element.style.transform = `perspective(${this.settings.perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    }

    this.resetGlare();
  }

  private resetGlare(): void {
    if (this.glare && this.glareElement) {
      this.glareElement.style.transform = "rotate(180deg) translate(-50%, -50%)";
      this.glareElement.style.opacity = "0";
    }
  }

  private updateInitialPosition(): void {
    if (this.settings.startX === 0 && this.settings.startY === 0) {
      return;
    }

    this.onMouseEnter();
    if (this.fullPageListening) {
      this.event = {
        clientX: (this.settings.startX + this.settings.max) / (2 * this.settings.max) * this.clientWidth!,
        clientY: (this.settings.startY + this.settings.max) / (2 * this.settings.max) * this.clientHeight!,
      };
    } else {
      this.event = {
        clientX: this.left! + (this.settings.startX + this.settings.max) / (2 * this.settings.max) * this.width!,
        clientY: this.top! + (this.settings.startY + this.settings.max) / (2 * this.settings.max) * this.height!,
      };
    }

    const scale = this.settings.scale;
    this.settings.scale = 1;
    this.update();
    this.settings.scale = scale;
    this.resetGlare();
  }

  private updateElementPosition(): void {
    const rect = this.element.getBoundingClientRect();
    this.width = this.element.offsetWidth;
    this.height = this.element.offsetHeight;
    this.clientWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    this.clientHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
    this.left = rect.left;
    this.top = rect.top;
  }

  private setTransition(): void {
    clearTimeout(this.transitionTimeout!);
    this.element.style.transition = this.settings.transition ?? "all 0.1s ease";
    this.transitionTimeout = setTimeout(() => {
      this.element.style.transition = "";
    }, 300);
  }

  private on
