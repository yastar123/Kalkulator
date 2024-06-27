var VanillaTilt = /** @class */ (function () {
    function VanillaTilt(element, options) {
        if (options === void 0) { options = {}; }
        this.width = null;
        this.height = null;
        this.clientWidth = null;
        this.clientHeight = null;
        this.left = null;
        this.top = null;
        this.gammazero = null;
        this.betazero = null;
        this.lastgammazero = null;
        this.lastbetazero = null;
        this.transitionTimeout = null;
        this.updateCall = null;
        this.event = null;
        if (!(element instanceof Node)) {
            throw "Can't initialize VanillaTilt because " + element + " is not a Node.";
        }
        this.element = element;
        this.settings = this.extendSettings(options);
        this.reverse = this.settings.reverse ? -1 : 1;
        this.glare = VanillaTilt.isSettingTrue(this.settings.glare);
        this.glarePrerender = VanillaTilt.isSettingTrue(this.settings["glare-prerender"]);
        this.fullPageListening = VanillaTilt.isSettingTrue(this.settings["full-page-listening"]);
        this.gyroscope = VanillaTilt.isSettingTrue(this.settings.gyroscope);
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
    VanillaTilt.isSettingTrue = function (value) {
        return value === "" || value === true || value === 1;
    };
    VanillaTilt.prototype.getElementListener = function () {
        if (this.fullPageListening) {
            return window.document;
        }
        if (typeof this.settings["mouse-event-element"] === "string") {
            var element = document.querySelector(this.settings["mouse-event-element"]);
            if (element instanceof HTMLElement) {
                return element;
            }
        }
        return this.settings["mouse-event-element"] instanceof Node
            ? this.settings["mouse-event-element"]
            : this.element;
    };
    VanillaTilt.prototype.addEventListeners = function () {
        this.elementListener.addEventListener("mouseenter", this.onMouseEnter.bind(this));
        this.elementListener.addEventListener("mouseleave", this.onMouseLeave.bind(this));
        this.elementListener.addEventListener("mousemove", this.onMouseMove.bind(this));
        if (this.glare || this.fullPageListening) {
            window.addEventListener("resize", this.onWindowResize.bind(this));
        }
        if (this.gyroscope) {
            window.addEventListener("deviceorientation", this.onDeviceOrientation.bind(this));
        }
    };
    VanillaTilt.prototype.removeEventListeners = function () {
        this.elementListener.removeEventListener("mouseenter", this.onMouseEnter.bind(this));
        this.elementListener.removeEventListener("mouseleave", this.onMouseLeave.bind(this));
        this.elementListener.removeEventListener("mousemove", this.onMouseMove.bind(this));
        if (this.gyroscope) {
            window.removeEventListener("deviceorientation", this.onDeviceOrientation.bind(this));
        }
        if (this.glare || this.fullPageListening) {
            window.removeEventListener("resize", this.onWindowResize.bind(this));
        }
    };
    VanillaTilt.prototype.destroy = function () {
        clearTimeout(this.transitionTimeout);
        if (this.updateCall !== null) {
            cancelAnimationFrame(this.updateCall);
        }
        this.reset();
        this.removeEventListeners();
        this.element.vanillaTilt = null;
        delete this.element.vanillaTilt;
        this.element = null;
    };
    VanillaTilt.prototype.onDeviceOrientation = function (event) {
        if (event.gamma === null || event.beta === null) {
            return;
        }
        this.updateElementPosition();
        if (this.gyroscopeSamples > 0) {
            this.lastgammazero = this.gammazero;
            this.lastbetazero = this.betazero;
            if (this.gammazero === null) {
                this.gammazero = event.gamma;
            }
            if (this.betazero === null) {
                this.betazero = event.beta;
            }
            this.gammazero = (event.gamma + this.lastgammazero) / 2;
            this.betazero = (event.beta + this.lastbetazero) / 2;
            this.gyroscopeSamples -= 1;
        }
        var dx = event.gamma - (this.settings.gyroscopeMinAngleX + this.gammazero);
        var dy = event.beta - (this.settings.gyroscopeMinAngleY + this.betazero);
        var tiltX = dx / ((this.settings.gyroscopeMaxAngleX - this.settings.gyroscopeMinAngleX) / this.width);
        var tiltY = dy / ((this.settings.gyroscopeMaxAngleY - this.settings.gyroscopeMinAngleY) / this.height);
        if (this.updateCall !== null) {
            cancelAnimationFrame(this.updateCall);
        }
        this.event = {
            clientX: tiltX + this.left,
            clientY: tiltY + this.top,
        };
        this.updateCall = requestAnimationFrame(this.updateBind);
    };
    VanillaTilt.prototype.onMouseEnter = function () {
        this.updateElementPosition();
        this.element.style.willChange = "transform";
        this.setTransition();
    };
    VanillaTilt.prototype.onMouseMove = function (event) {
        if (this.updateCall !== null) {
            cancelAnimationFrame(this.updateCall);
        }
        this.event = event;
        this.updateCall = requestAnimationFrame(this.updateBind);
    };
    VanillaTilt.prototype.onMouseLeave = function () {
        this.setTransition();
        if (this.settings.reset) {
            requestAnimationFrame(this.resetBind);
        }
    };
    VanillaTilt.prototype.reset = function () {
        this.event = {
            clientX: this.left + this.width / 2,
            clientY: this.top + this.height / 2,
        };
        if (this.element && this.element.style) {
            this.element.style.transform = "perspective(".concat(this.settings.perspective, "px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)");
        }
        this.resetGlare();
    };
    VanillaTilt.prototype.resetGlare = function () {
        if (this.glare && this.glareElement) {
            this.glareElement.style.transform = "rotate(180deg) translate(-50%, -50%)";
            this.glareElement.style.opacity = "0";
        }
    };
    VanillaTilt.prototype.updateInitialPosition = function () {
        if (this.settings.startX === 0 && this.settings.startY === 0) {
            return;
        }
        this.onMouseEnter();
        if (this.fullPageListening) {
            this.event = {
                clientX: (this.settings.startX + this.settings.max) / (2 * this.settings.max) * this.clientWidth,
                clientY: (this.settings.startY + this.settings.max) / (2 * this.settings.max) * this.clientHeight,
            };
        }
        else {
            this.event = {
                clientX: this.left + (this.settings.startX + this.settings.max) / (2 * this.settings.max) * this.width,
                clientY: this.top + (this.settings.startY + this.settings.max) / (2 * this.settings.max) * this.height,
            };
        }
        var scale = this.settings.scale;
        this.settings.scale = 1;
        this.update();
        this.settings.scale = scale;
        this.resetGlare();
    };
    VanillaTilt.prototype.getValues = function () {
        var offsetX, offsetY;
        if (this.fullPageListening) {
            offsetX = this.event.clientX / this.clientWidth;
            offsetY = this.event.clientY / this.clientHeight;
        }
        else {
            offsetX = (this.event.clientX - this.left) / this.width;
            offsetY = (this.event.clientY - this.top) / this.height;
        }
        offsetX = Math.min(Math.max(offsetX, 0), 1);
        offsetY = Math.min(Math.max(offsetY, 0), 1);
        return {
            tiltX: (this.reverse * (this.settings.max - offsetX * this.settings.max * 2)).toFixed(2),
            tiltY: (this.reverse * (offsetY * this.settings.max * 2 - this.settings.max)).toFixed(2),
            percentageX: 100 * offsetX,
            percentageY: 100 * offsetY,
            angle: Math.atan2(this.event.clientX - (this.left + this.width / 2), -(this.event.clientY - (this.top + this.height / 2))) * (180 / Math.PI),
        };
    };
    return VanillaTilt;
}());
