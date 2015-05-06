function _snapPixel (p) {
    return Math.floor(p);
}

function _uninterpolate(a, b) {
    b = (b -= a) || 1 / b;
    return function(x) { return (x - a) / b; };
}

function _interpolate(a, b) {
    return function(t) { return a * (1 - t) + b * t; };
}

// pixi config
PIXI.utils._saidHello = true;

window['widgets.pixi-grid'] = Polymer({
    is: 'pixi-grid',

    properties: {
        debugInfo: {
            type: Object,
            value: {
                xAxisScale: 0,
                xMinLevel: 0,
                xMaxLevel: 0,
                yAxisScale: 0,
                yMinLevel: 0,
                yMaxLevel: 0,
            },
        },

        showDebugInfo: {
            type: Boolean,
            value: false,
            reflectToAttribute: true
        },

        showLabel: {
            type: Boolean,
            value: false,
            reflectToAttribute: true
        },
    },

    listeners: {
        'mousewheel': '_onMouseWheel',
    },

    created: function () {
        this.canvasWidth = 0;
        this.canvasHeight = 0;
        this.worldPosition = [0, 0];

        this.labels = [];
        this.labelIdx = 0;

        this.hticks = null;
        this.xAxisScale = 1.0;
        this.xAxisOffset = 0.0;
        this.xAnchor = 0.5;

        this.vticks = null;
        this.yAxisScale = 1.0;
        this.yAxisOffset = 0.0;
        this.yAnchor = 0.5;

        // this is generated in setMapping
        this._xAnchorOffset = 0.0;
        this._yAnchorOffset = 0.0;

    },

    ready: function () {
        var rect = this.$.view.getBoundingClientRect();
        this.renderer = new PIXI.WebGLRenderer( rect.width, rect.height, {
            view: this.$.canvas,
            transparent: true,
        });

        this.stage = new PIXI.Container();
        var background = new PIXI.Container();
        this.stage.addChild(background);

        this.graphics = new PIXI.Graphics();
        background.addChild(this.graphics);
    },

    // default 0.5, 0.5
    setAnchor: function ( x, y ) {
        this.xAnchor = Math.clamp( x, -1, 1 );
        this.yAnchor = Math.clamp( y, -1, 1 );
    },

    // recommended: [5,2], 0.001, 1000
    setScaleH: function ( lods, minScale, maxScale, type ) {
        this.hticks = new LinearTicks()
        .initTicks( lods, minScale, maxScale )
        .spacing ( 10, 80 )
        ;
        this.xAxisScale = Math.clamp(this.xAxisScale,
                                     this.hticks.minValueScale,
                                     this.hticks.maxValueScale);

        if ( type === 'frame' ) {
            this.hformat = function ( frame ) {
                return Editor.Utils.formatFrame( frame, 60.0 );
            };
        }

        this.pixelToValueH = function (x) {
            // return (x - this.canvasWidth * 0.5) / this.xAxisScale;
            return (x - this.xAxisOffset) / this.xAxisScale;
        }.bind(this);

        this.valueToPixelH = function (x) {
            // return x * this.xAxisScale + this.canvasWidth * 0.5;
            return x * this.xAxisScale + this.xAxisOffset;
        }.bind(this);
    },

    setMappingH: function ( minValue, maxValue, pixelRange ) {
        this._xAnchorOffset = minValue / (maxValue - minValue);

        this.pixelToValueH = function (x) {
            var pixelOffset = this.xAxisOffset;

            var ratio = this.canvasWidth / pixelRange;
            var u = _uninterpolate( 0.0, this.canvasWidth );
            var i = _interpolate( minValue * ratio, maxValue * ratio );
            return i(u(x - pixelOffset)) / this.xAxisScale;
        }.bind(this);

        this.valueToPixelH = function (x) {
            var pixelOffset = this.xAxisOffset;

            var ratio = this.canvasWidth / pixelRange;
            var u = _uninterpolate( minValue * ratio, maxValue * ratio );
            var i = _interpolate( 0.0, this.canvasWidth );
            return i(u(x * this.xAxisScale)) + pixelOffset;
        }.bind(this);
    },

    setScaleV: function ( lods, minScale, maxScale, type ) {
        this.vticks = new LinearTicks()
        .initTicks( lods, minScale, maxScale )
        .spacing ( 10, 80 )
        ;
        this.yAxisScale = Math.clamp(this.yAxisScale,
                                     this.vticks.minValueScale,
                                     this.vticks.maxValueScale);

        if ( type === 'frame' ) {
            this.vformat = function ( frame ) {
                return Editor.Utils.formatFrame( frame, 60.0 );
            };
        }

        this.pixelToValueV = function (y) {
            // return (this.canvasHeight*0.5 - y) / this.yAxisScale;
            return (this.canvasHeight - y + this.yAxisOffset) / this.yAxisScale;
        }.bind(this);

        this.valueToPixelV = function (y) {
            // return -y * this.yAxisScale + this.canvasHeight*0.5;
            return -y * this.yAxisScale + this.canvasHeight + this.yAxisOffset;
        }.bind(this);
    },

    setMappingV: function ( minValue, maxValue, pixelRange ) {
        this._yAnchorOffset = minValue / (maxValue - minValue);

        this.pixelToValueV = function (y) {
            var pixelOffset = this.yAxisOffset;

            var ratio = this.canvasHeight / pixelRange;
            var u = _uninterpolate( 0.0, this.canvasHeight );
            var i = _interpolate( minValue * ratio, maxValue * ratio );
            return i(u(y - pixelOffset)) / this.yAxisScale;
        }.bind(this);

        this.valueToPixelV = function (y) {
            var pixelOffset = this.yAxisOffset;

            var ratio = this.canvasHeight / pixelRange;
            var u = _uninterpolate( minValue * ratio, maxValue * ratio );
            var i = _interpolate( 0.0, this.canvasHeight );
            return i(u(y * this.yAxisScale)) + pixelOffset;
        }.bind(this);
    },

    pan: function ( deltaPixelX, deltaPixelY ) {
        this.xAxisOffset += deltaPixelX;
        this.yAxisOffset += deltaPixelY;
    },

    xAxisScaleAt: function ( pixelX, scale ) {
        var oldValueX = this.pixelToValueH(pixelX);
        this.xAxisScale = Math.clamp( scale, this.hticks.minValueScale, this.hticks.maxValueScale );
        var newScreenX = this.valueToPixelH(oldValueX);
        this.pan( pixelX - newScreenX, 0 );
    },

    yAxisScaleAt: function ( pixelY, scale ) {
        var oldValueY = this.pixelToValueV(pixelY);
        this.yAxisScale = Math.clamp( scale, this.vticks.minValueScale, this.vticks.maxValueScale );
        var newScreenY = this.valueToPixelV(oldValueY);
        this.pan( 0, pixelY - newScreenY );
    },

    _onMouseWheel: function ( event ) {
        event.stopPropagation();

        var scale;
        var changeX = true;
        var changeY = true;

        if ( event.metaKey ) {
            changeX = true;
            changeY = false;
        }
        else if ( event.shiftKey ) {
            changeX = false;
            changeY = true;
        }

        var newScale;

        if ( changeX && this.hticks ) {
            newScale = Editor.Utils.smoothScale(this.xAxisScale, event.wheelDelta);
            this.xAxisScaleAt ( event.offsetX, newScale );

            // TODO
            // var curScale = this.xAxisScale;
            // var nextScale = scale;
            // var start = window.performance.now();
            // var duration = 300;
            // function animateScale ( time ) {
            //     var requestId = requestAnimationFrame ( animateScale.bind(this) );
            //     var cur = time - start;
            //     var ratio = cur/duration;
            //     if ( ratio >= 1.0 ) {
            //         this.xAxisScale = nextScale;
            //         cancelAnimationFrame(requestId);
            //     }
            //     else {
            //         this.xAxisScale = Math.lerp( curScale, nextScale, ratio );
            //     }
            //     this.repaint();
            // };
            // animateScale.call(this,start);
        }

        if ( changeY && this.vticks ) {
            newScale = Editor.Utils.smoothScale(this.yAxisScale, event.wheelDelta);
            this.yAxisScaleAt ( event.offsetY, newScale );
        }

        this.repaint();
    },

    resize: function ( w, h ) {
        if ( !w || !h ) {
            var rect = this.$.view.getBoundingClientRect();
            w = w || rect.width;
            h = h || rect.height;
        }

        // adjust xAxisOffset by anchor x
        if ( this.canvasWidth !== 0 ) {
            this.xAxisOffset += (w - this.canvasWidth) * (this.xAnchor + this._xAnchorOffset);
        }

        // adjust yAxisOffset by anchor y
        if ( this.canvasHeight !== 0 ) {
            this.yAxisOffset += (h - this.canvasHeight) * (this.yAnchor + this._yAnchorOffset);
        }

        this.canvasWidth = w;
        this.canvasHeight = h;

        this.renderer.resize( this.canvasWidth, this.canvasHeight );
    },

    repaint: function () {
        this._updateGrids();
        requestAnimationFrame( function () {
            this.renderer.render(this.stage);
        }.bind(this));
    },

    _updateGrids: function () {
        var lineColor = 0x555555;
        var i, j, ticks, ratio;
        var screen_x, screen_y;

        this.graphics.clear();
        this.graphics.beginFill(lineColor);

        // draw h ticks
        if ( this.hticks ) {
            var left = this.pixelToValueH(0);
            var right = this.pixelToValueH(this.canvasWidth);
            this.hticks.range( left, right, this.canvasWidth );

            for ( i = this.hticks.minTickLevel; i <= this.hticks.maxTickLevel; ++i ) {
                ratio = this.hticks.tickRatios[i];
                if ( ratio > 0 ) {
                    this.graphics.lineStyle(1, lineColor, ratio * 0.5);
                    ticks = this.hticks.ticksAtLevel(i,true);
                    for ( j = 0; j < ticks.length; ++j ) {
                        screen_x = this.valueToPixelH(ticks[j]);
                        this.graphics.moveTo( _snapPixel(screen_x), 0.0 );
                        this.graphics.lineTo( _snapPixel(screen_x), this.canvasHeight );
                    }
                }
            }
        }

        // draw v ticks
        if ( this.vticks ) {
            var top = this.pixelToValueV(0);
            var bottom = this.pixelToValueV(this.canvasHeight);
            this.vticks.range( top, bottom, this.canvasHeight );

            for ( i = this.vticks.minTickLevel; i <= this.vticks.maxTickLevel; ++i ) {
                ratio = this.vticks.tickRatios[i];
                if ( ratio > 0 ) {
                    this.graphics.lineStyle(1, lineColor, ratio * 0.5);
                    ticks = this.vticks.ticksAtLevel(i,true);
                    for ( j = 0; j < ticks.length; ++j ) {
                        screen_y = this.valueToPixelV( ticks[j] );
                        this.graphics.moveTo( 0.0, _snapPixel(screen_y) );
                        this.graphics.lineTo( this.canvasWidth, _snapPixel(screen_y) );
                    }
                }
            }
        }

        this.graphics.endFill();

        // draw label
        if ( this.showLabel ) {
            var minStep = 50, labelLevel, labelEL, tickValue;
            var decimals, fmt;

            this._resetLabelPool();

            // draw hlabel
            if ( this.hticks ) {
                labelLevel = this.hticks.levelForStep(minStep);
                ticks = this.hticks.ticksAtLevel(labelLevel,false);

                tickValue = this.hticks.ticks[labelLevel];
                decimals = Math.max( 0, -Math.floor(Math.log10(tickValue)) );
                fmt = '0,' + Number(0).toFixed(decimals);

                for ( j = 0; j < ticks.length; ++j ) {
                    screen_x = this.valueToPixelH(ticks[j]);
                    labelEL = this._requestLabel();
                    if ( this.hformat ) {
                        labelEL.innerText = this.hformat(ticks[j]);
                    }
                    else {
                        labelEL.innerText = numeral(ticks[j]).format(fmt);
                    }
                    labelEL.style.left = screen_x + 'px';
                    labelEL.style.bottom = '0px';
                    labelEL.style.right = '';
                    labelEL.style.top = '';
                    Polymer.dom(this.$.hlabels).appendChild(labelEL);
                }
            }

            // draw vlabel
            if ( this.vticks ) {
                labelLevel = this.vticks.levelForStep(minStep);
                ticks = this.vticks.ticksAtLevel(labelLevel,false);

                tickValue = this.vticks.ticks[labelLevel];
                decimals = Math.max( 0, -Math.floor(Math.log10(tickValue)) );
                fmt = '0,' + Number(0).toFixed(decimals);

                for ( j = 0; j < ticks.length; ++j ) {
                    screen_y = this.valueToPixelV(ticks[j]);
                    labelEL = this._requestLabel();
                    if ( this.vformat ) {
                        labelEL.innerText = this.vformat(ticks[j]);
                    }
                    else {
                        labelEL.innerText = numeral(ticks[j]).format(fmt);
                    }
                    labelEL.style.left = '0px';
                    labelEL.style.top = screen_y + 'px';
                    labelEL.style.bottom = '';
                    labelEL.style.right = '';
                    Polymer.dom(this.$.vlabels).appendChild(labelEL);
                }
            }

            //
            this._clearUnusedLabels();
        }

        // DEBUG
        if ( this.showDebugInfo ) {
            this.setPathValue('debugInfo.xAxisScale', this.xAxisScale.toFixed(3));
            this.setPathValue('debugInfo.xAxisOffset', this.xAxisOffset.toFixed(3));
            if ( this.hticks ) {
                this.setPathValue('debugInfo.xMinLevel', this.hticks.minTickLevel);
                this.setPathValue('debugInfo.xMaxLevel', this.hticks.maxTickLevel);
            }
            this.setPathValue('debugInfo.yAxisScale', this.yAxisScale.toFixed(3));
            this.setPathValue('debugInfo.yAxisOffset', this.yAxisOffset.toFixed(3));
            if ( this.vticks ) {
                this.setPathValue('debugInfo.yMinLevel', this.vticks.minTickLevel);
                this.setPathValue('debugInfo.yMaxLevel', this.vticks.maxTickLevel);
            }
        }
    },

    _resetLabelPool: function () {
        this.labelIdx = 0;
    },

    _requestLabel: function () {
        var el;
        if ( this.labelIdx < this.labels.length ) {
            el = this.labels[this.labelIdx];
            this.labelIdx += 1;
            return el;
        }

        el = document.createElement('div');
        el.classList.add('label');
        this.labels.push(el);
        this.labelIdx += 1;
        return el;
    },

    _clearUnusedLabels: function () {
        for ( var i = this.labelIdx; i < this.labels.length; ++i ) {
            var el = this.labels[i];
            Polymer.dom(Polymer.dom(el).parentNode).removeChild(el);
        }
        this.labels = this.labels.slice(0,this.labelIdx);
    },
});