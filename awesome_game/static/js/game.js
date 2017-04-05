// Copyright (c) 2011, 2012, 2013, 2014, 2015, 2016 Jake Gordon and contributors

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

//=============================================================================
//
// We need some ECMAScript 5 methods but we need to implement them ourselves
// for older browsers (compatibility: http://kangax.github.com/es5-compat-table/)
//
//  Function.bind:        https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Function/bind
//  Object.create:        http://javascript.crockford.com/prototypal.html
//  Object.extend:        (defacto standard like jquery $.extend or prototype's Object.extend)
//
//  Object.construct:     our own wrapper around Object.create that ALSO calls
//                        an initialize constructor method if one exists
//
//=============================================================================

if (!Function.prototype.bind) {
  Function.prototype.bind = function(obj) {
    var slice = [].slice,
        args  = slice.call(arguments, 1),
        self  = this,
        nop   = function () {},
        bound = function () {
          return self.apply(this instanceof nop ? this : (obj || {}), args.concat(slice.call(arguments)));   
        };
    nop.prototype   = self.prototype;
    bound.prototype = new nop();
    return bound;
  };
}

if (!Object.create) {
  Object.create = function(base) {
    function F() {};
    F.prototype = base;
    return new F();
  }
}

if (!Object.construct) {
  Object.construct = function(base) {
    var instance = Object.create(base);
    if (instance.initialize)
      instance.initialize.apply(instance, [].slice.call(arguments, 1));
    return instance;
  }
}

if (!Object.extend) {
  Object.extend = function(destination, source) {
    for (var property in source) {
      if (source.hasOwnProperty(property))
        destination[property] = source[property];
    }
    return destination;
  };
}

function pad(a,b){return(1000+a+"").slice(-b)}

/* NOT READY FOR PRIME TIME
if (!window.requestAnimationFrame) {// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
  window.requestAnimationFrame = window.webkitRequestAnimationFrame || 
                                 window.mozRequestAnimationFrame    || 
                                 window.oRequestAnimationFrame      || 
                                 window.msRequestAnimationFrame     || 
                                 function(callback, element) {
                                   window.setTimeout(callback, 1000 / 60);
                                 }
}
*/

//=============================================================================
// GAME
//=============================================================================
var pong_object

Game = {

  compatible: function() {
    return Object.create &&
           Object.extend &&
           Function.bind &&
           document.addEventListener && // HTML5 standard, all modern browsers that support canvas should also support add/removeEventListener
           Game.ua.hasCanvas
  },

  start: function(id, game, cfg) {
    if (Game.compatible())
      return Object.construct(Game.Runner, id, game, cfg).game; // return the game instance, not the runner (caller can always get at the runner via game.runner)
  },

  ua: function() { // should avoid user agent sniffing... but sometimes you just gotta do what you gotta do
    var ua  = navigator.userAgent.toLowerCase();
    var key =        ((ua.indexOf("opera")   > -1) ? "opera"   : null);
        key = key || ((ua.indexOf("firefox") > -1) ? "firefox" : null);
        key = key || ((ua.indexOf("chrome")  > -1) ? "chrome"  : null);
        key = key || ((ua.indexOf("safari")  > -1) ? "safari"  : null);
        key = key || ((ua.indexOf("msie")    > -1) ? "ie"      : null);

    try {
      var re      = (key == "ie") ? "msie (\\d)" : key + "\\/(\\d\\.\\d)"
      var matches = ua.match(new RegExp(re, "i"));
      var version = matches ? parseFloat(matches[1]) : null;
    } catch (e) {}

    return {
      full:      ua, 
      name:      key + (version ? " " + version.toString() : ""),
      version:   version,
      isFirefox: (key == "firefox"),
      isChrome:  (key == "chrome"),
      isSafari:  (key == "safari"),
      isOpera:   (key == "opera"),
      isIE:      (key == "ie"),
      hasCanvas: (document.createElement('canvas').getContext),
      hasAudio:  (typeof(Audio) != 'undefined')
    }
  }(),

  addEvent:    function(obj, type, fn) { obj.addEventListener(type, fn, false);    },
  removeEvent: function(obj, type, fn) { obj.removeEventListener(type, fn, false); },

  ready: function(fn) {
    if (Game.compatible())
      Game.addEvent(document, 'DOMContentLoaded', fn);
  },

  createCanvas: function() {
    return document.createElement('canvas');
  },

  createAudio: function(src) {
    try {
      var a = new Audio(src);
      a.volume = 0.1; // lets be real quiet please
      return a;
    } catch (e) {
      return null;
    }
  },

  loadImages: function(sources, callback) { /* load multiple images and callback when ALL have finished loading */
    var images = {};
    var count = sources ? sources.length : 0;
    if (count == 0) {
      callback(images);
    }
    else {
      for(var n = 0 ; n < sources.length ; n++) {
        var source = sources[n];
        var image = document.createElement('img');
        images[source] = image;
        Game.addEvent(image, 'load', function() { if (--count == 0) callback(images); });
        image.src = source;
      }
    }
  },

  random: function(min, max) {
    return (min + (Math.random() * (max - min)));
  },

  timestamp: function() { 
    return new Date().getTime();
  },

  KEY: {
    BACKSPACE: 8,
    TAB:       9,
    RETURN:   13,
    ESC:      27,
    SPACE:    32,
    LEFT:     37,
    UP:       38,
    RIGHT:    39,
    DOWN:     40,
    DELETE:   46,
    HOME:     36,
    END:      35,
    PAGEUP:   33,
    PAGEDOWN: 34,
    INSERT:   45,
    ZERO:     48,
    ONE:      49,
    TWO:      50,
    A:        65,
    L:        76,
    P:        80,
    Q:        81,
    TILDA:    192
  },

  //-----------------------------------------------------------------------------

  Runner: {

    initialize: function(id, game, cfg) {
      this.cfg          = Object.extend(game.Defaults || {}, cfg || {}); // use game defaults (if any) and extend with custom cfg (if any)
      this.fps          = this.cfg.fps || 60;
      this.interval     = 1000.0 / this.fps;
      this.canvas       = document.getElementById(id);
      this.width        = this.cfg.width  || this.canvas.offsetWidth;
      this.height       = this.cfg.height || this.canvas.offsetHeight;
      this.front        = this.canvas;
      this.front.width  = this.width;
      this.front.height = this.height;
      this.back         = Game.createCanvas();
      this.back.width   = this.width;
      this.back.height  = this.height;
      this.front2d      = this.front.getContext('2d');
      this.back2d       = this.back.getContext('2d');
      this.addEvents();
      this.resetStats();

      this.game = Object.construct(game, this, this.cfg); // finally construct the game object itself
      pong_object = this.game
    },

    start: function() { // game instance should call runner.start() when its finished initializing and is ready to start the game loop
      this.lastFrame = Game.timestamp();
      this.timer     = setInterval(this.loop.bind(this), this.interval);
    },

    stop: function() {
      clearInterval(this.timer);
    },

    loop: function() {
      var start  = Game.timestamp(); this.update((start - this.lastFrame)/1000.0); // send dt as seconds
      var middle = Game.timestamp(); this.draw();
      var end    = Game.timestamp();
      this.updateStats(middle - start, end - middle);
      this.lastFrame = start;
    },

    update: function(dt) {
      this.game.update(dt);
    },

    draw: function() {
      this.back2d.clearRect(0, 0, this.width, this.height);
      this.game.draw(this.back2d);
      this.drawStats(this.back2d);
      this.front2d.clearRect(0, 0, this.width, this.height);
      this.front2d.drawImage(this.back, 0, 0);
    },

    resetStats: function() {
      this.stats = {
        count:  0,
        fps:    0,
        update: 0,
        draw:   0, 
        frame:  0  // update + draw
      };
    },

    updateStats: function(update, draw) {
      if (this.cfg.stats) {
        this.stats.update = Math.max(1, update);
        this.stats.draw   = Math.max(1, draw);
        this.stats.frame  = this.stats.update + this.stats.draw;
        this.stats.count  = this.stats.count == this.fps ? 0 : this.stats.count + 1;
        this.stats.fps    = Math.min(this.fps, 1000 / this.stats.frame);
      }
    },

    drawStats: function(ctx) {
      if (this.cfg.stats) {
        ctx.fillStyle = 'white';
        ctx.font = '7pt sans-serif';
        ctx.fillText("frame: "  + this.stats.count,         this.width - 100, this.height - 75);
        ctx.fillText("fps: "    + this.stats.fps,           this.width - 100, this.height - 60);
        ctx.fillText("update: " + this.stats.update + "ms", this.width - 100, this.height - 45);
        ctx.fillText("draw: "   + this.stats.draw   + "ms", this.width - 100, this.height - 30);
      }
    },

    addEvents: function() {
      Game.addEvent(document, 'keydown', this.onkeydown.bind(this));
      Game.addEvent(document, 'keyup',   this.onkeyup.bind(this));
    },

    onkeydown: function(ev) { if (this.game.onkeydown) this.game.onkeydown(ev.keyCode); },
    onkeyup:   function(ev) { if (this.game.onkeyup)   this.game.onkeyup(ev.keyCode);   },

    hideCursor: function() { this.canvas.style.cursor = 'none'; },
    showCursor: function() { this.canvas.style.cursor = 'auto'; },

    alert: function(msg) {
      this.stop(); // alert blocks thread, so need to stop game loop in order to avoid sending huge dt values to next update
      result = window.alert(msg);
      this.start();
      return result;
    },

    confirm: function(msg) {
      this.stop(); // alert blocks thread, so need to stop game loop in order to avoid sending huge dt values to next update
      result = window.confirm(msg);
      this.start();
      return result;
    }

    //-------------------------------------------------------------------------

  } // Game.Runner
} // Game





























//=============================================================================
// PONG
//=============================================================================

Pong = {

  Defaults: {
    /*
    width:        640 * 2,
    height:       480 * 2,
    wallWidth:    12 * 2,
    paddleWidth:  12 * 2,
    paddleHeight: 60 * 2,
    paddleSpeed:  2,     // should be able to cross court vertically   in 2 seconds
    ballSpeed:    4,     // should be able to cross court horizontally in 4 seconds, at starting speed ...
    ballAccel:    8,     // ... but accelerate as time passes
    ballRadius:   5 * 2,
    */
    width:        640,
    height:       480,
    wallWidth:    12,
    paddleWidth:  12,
    paddleHeight: 60,
    paddleSpeed:  2,     // should be able to cross court vertically   in 2 seconds
    ballSpeed:    4,     // should be able to cross court horizontally in 4 seconds, at starting speed ...
    ballAccel:    8,     // ... but accelerate as time passes
    ballRadius:   5,
    stats:        true,
    predictions:  true
  },

  Colors: {
    walls:           'white',
    ball:            'white',
    score:           'white',
    predictionGuess: 'yellow',
    predictionExact: 'red'
  },

  /*
  Images: [
    "static/images/pong/press1.png",
    "static/images/pong/press2.png",
    "static/images/pong/winner.png"
  ],
  */
  Levels: [
    {aiReaction: 0.2, aiError:  40}, // 0:  ai is losing by 8
    {aiReaction: 0.3, aiError:  50}, // 1:  ai is losing by 7
    {aiReaction: 0.4, aiError:  60}, // 2:  ai is losing by 6
    {aiReaction: 0.5, aiError:  70}, // 3:  ai is losing by 5
    {aiReaction: 0.6, aiError:  80}, // 4:  ai is losing by 4
    {aiReaction: 0.7, aiError:  90}, // 5:  ai is losing by 3
    {aiReaction: 0.8, aiError: 100}, // 6:  ai is losing by 2
    {aiReaction: 0.9, aiError: 110}, // 7:  ai is losing by 1
    {aiReaction: 1.0, aiError: 120}, // 8:  tie
    {aiReaction: 1.1, aiError: 130}, // 9:  ai is winning by 1
    {aiReaction: 1.2, aiError: 140}, // 10: ai is winning by 2
    {aiReaction: 1.3, aiError: 150}, // 11: ai is winning by 3
    {aiReaction: 1.4, aiError: 160}, // 12: ai is winning by 4
    {aiReaction: 1.5, aiError: 170}, // 13: ai is winning by 5
    {aiReaction: 1.6, aiError: 180}, // 14: ai is winning by 6
    {aiReaction: 1.7, aiError: 190}, // 15: ai is winning by 7
    {aiReaction: 1.8, aiError: 200}  // 16: ai is winning by 8
  ],

  //-----------------------------------------------------------------------------

  initialize: function(runner, cfg) {
    Game.loadImages(Pong.Images, function(images) {
      this.cfg         = cfg;
      this.runner      = runner;
      this.width       = runner.width;
      this.height      = runner.height;
      this.images      = images;
      this.playing     = false;
      this.scores      = [0, 0];
      this.menu        = Object.construct(Pong.Menu,   this);
      this.court       = Object.construct(Pong.Court,  this);
      this.leftPaddle  = Object.construct(Pong.Paddle, this);
      this.rightPaddle = Object.construct(Pong.Paddle, this, true);
      this.ball        = Object.construct(Pong.Ball,   this);
      this.runner.start();
    }.bind(this));
  },

  startDemo:         function() { this.start(0); },
  startSinglePlayer: function() { this.start(1); },
  startDoublePlayer: function() { this.start(2); },

  start: function(numPlayers) {
    if (!this.playing) {
      this.scores = [0, 0];
      this.playing = true;
      this.leftPaddle.setAuto(numPlayers < 1, this.level(0));
      this.rightPaddle.setAuto(numPlayers < 2, this.level(1));
      this.ball.reset();
      this.runner.hideCursor();
    }
  },

  stop: function(ask) {
    if (this.playing) {
      if (!ask || this.runner.confirm('Abandon game in progress ?')) {
        this.playing = false;
        this.leftPaddle.setAuto(false);
        this.rightPaddle.setAuto(false);
        this.runner.showCursor();
      }
    }
  },

  level: function(playerNo) {
    return 8 + (this.scores[playerNo] - this.scores[playerNo ? 0 : 1]);
  },

  goal: function(playerNo) {
    this.scores[playerNo] += 1;
    /* if (this.scores[playerNo] == 9) {
      this.menu.declareWinner(playerNo);
      this.stop();
    }*/
    //else {
    this.ball.reset(playerNo);
    this.leftPaddle.setLevel(this.level(0));
    this.rightPaddle.setLevel(this.level(1));
    //}
  },

  update: function(dt) {
    this.leftPaddle.update(dt, this.ball);
    this.rightPaddle.update(dt, this.ball);
    if (this.playing) {
      var dx = this.ball.dx;
      var dy = this.ball.dy;
      this.ball.update(dt, this.leftPaddle, this.rightPaddle);
      if (this.ball.left > this.width && this.cfg.rechts_of_links == 1) {
        this.goal(0)
        socket.emit("goal", {'score' : this.scores[0]})
      } else if (this.ball.right < 0 && this.cfg.rechts_of_links == 0) {
        this.goal(1)
        socket.emit("goal", {'score' : this.scores[1]})
      }
    }
  },

  draw: function(ctx) {
    this.court.draw(ctx, this.scores[0], this.scores[1]);
    this.leftPaddle.draw(ctx);
    this.rightPaddle.draw(ctx);
    if (this.playing)
      this.ball.draw(ctx)
    this.menu.draw(ctx);
  },

  onkeydown: function(keyCode) {
    switch(keyCode) {
//       case Game.KEY.ZERO: this.startDemo();            break;
//       case Game.KEY.ONE:  this.startSinglePlayer();    break;
//       case Game.KEY.TWO:  this.startDoublePlayer();    break;
      case Game.KEY.ESC:  this.stop(true);             break;
//       case Game.KEY.Q:    if (!this.leftPaddle.auto)  this.leftPaddle.moveUp();    break;
//       case Game.KEY.A:    if (!this.leftPaddle.auto)  this.leftPaddle.moveDown();  break;
//       case Game.KEY.P:    if (!this.rightPaddle.auto) this.rightPaddle.moveUp();   break;
//       case Game.KEY.L:    if (!this.rightPaddle.auto) this.rightPaddle.moveDown(); break;
    }
  },

  onkeyup: function(keyCode) {
    switch(keyCode) {
//       case Game.KEY.Q: if (!this.leftPaddle.auto)  this.leftPaddle.stopMovingUp();    break;
//       case Game.KEY.A: if (!this.leftPaddle.auto)  this.leftPaddle.stopMovingDown();  break;
//       case Game.KEY.P: if (!this.rightPaddle.auto) this.rightPaddle.stopMovingUp();   break;
//       case Game.KEY.L: if (!this.rightPaddle.auto) this.rightPaddle.stopMovingDown(); break;
    }
  },

  //=============================================================================
  // MENU
  //=============================================================================

  Menu: {

    initialize: function(pong) {
      /*
      var press1 = pong.images["static/images/pong/press1.png"];
      var press2 = pong.images["static/images/pong/press2.png"];
      var winner = pong.images["static/images/pong/winner.png"];
      
      this.press1  = { image: press1, x: 10,                                                 y: pong.cfg.wallWidth     };
      this.press2  = { image: press2, x: (pong.width - press2.width - 10),                   y: pong.cfg.wallWidth     };
      this.winner1 = { image: winner, x: (pong.width/2) - winner.width - pong.cfg.wallWidth, y: 6 * pong.cfg.wallWidth };
      this.winner2 = { image: winner, x: (pong.width/2)                + pong.cfg.wallWidth, y: 6 * pong.cfg.wallWidth };
      */
      this.nicknames = pong.cfg.nicknames
      this.countdown = 3
      this.nickname_font = pong.cfg.wallWidth * 1.25
      this.nickname1 = { nick: this.nicknames[0], x: (pong.width/2) - 1.5 * pong.cfg.wallWidth, y: 2.5 * pong.cfg.wallWidth };
      this.nickname2 = { nick: this.nicknames[1], x: (pong.width/2) + 1.5 * pong.cfg.wallWidth, y: 2.5 * pong.cfg.wallWidth };
      this.countdownPos = { x: (pong.width/2), y: (pong.height/2), size: pong.cfg.wallWidth * 10, padding: pong.cfg.wallWidth }
      this.winner_text = { x: (pong.width/2), y: (pong.height/2), size: pong.cfg.wallWidth * 2, padding: pong.cfg.wallWidth }
    },

    declareWinner: function(winner, min, sec, punten) {
      console.log('declare winner', winner)
      this.winner = winner;
      this.min = min
      this.sec = sec
      this.punten = punten
      /*
      if (this.winner == 0) {
        this.nickname1.nick = 'Winner'
        this.nickname2.nick = '...'
      } else if (this.winner ==1) {
        this.nickname1.nick = '...'
        this.nickname2.nick = 'Winner'
      }*/
    },

    draw: function(ctx) {
      /*
      ctx.drawImage(this.press1.image, this.press1.x, this.press1.y);
      ctx.drawImage(this.press2.image, this.press2.x, this.press2.y);
      if (this.winner == 0)
        ctx.drawImage(this.winner1.image, this.winner1.x, this.winner1.y);
      else if (this.winner == 1)
        ctx.drawImage(this.winner2.image, this.winner2.x, this.winner2.y);
      */
      ctx.fillStyle = 'white'
      ctx.font = this.nickname_font + 'pt monospace'
      var txt_width = ctx.measureText(this.nickname1.nick).width;
      ctx.fillText(this.nickname1.nick, this.nickname1.x - txt_width, this.nickname1.y);
      ctx.fillText(this.nickname2.nick, this.nickname2.x, this.nickname2.y);
      if (this.countdown) {
        ctx.font = this.countdownPos.size + 'pt monospace'
        txt_width = ctx.measureText(this.countdown).width;
        ctx.fillStyle = '#000'
        ctx.fillRect(this.countdownPos.x - 0.5 * txt_width, this.countdownPos.y - this.countdownPos.size / 2 - this.countdownPos.padding, txt_width, this.countdownPos.size + 2*this.countdownPos.padding)
        ctx.fillStyle = '#fff'
        ctx.fillText(this.countdown, this.countdownPos.x - 0.5 * txt_width, this.countdownPos.y + this.countdownPos.size / 2);
      }
      if ('winner' in this && this.winner != null) {
        ctx.font = this.nickname_font * 2 + 'pt monospace'
        var text
        if (this.winner == rechts_of_links) {
          text = 'Gewonnen met ' + this.punten + ' punten'
        } else if (this.winner == (1-rechts_of_links)) {
          text = 'Je hebt verloren'
        } else if (this.winner == -1) {
          text = 'Gelijkspel'
        } else {
          console.log('error winner')
        }
        ctx.font = this.winner_text.size + 'pt monospace'
        txt_width = ctx.measureText(text).width;
        ctx.fillStyle = '#000'
        ctx.fillRect(this.winner_text.x - 0.5 * txt_width, this.winner_text.y - this.winner_text.size / 2 - this.winner_text.padding, txt_width, this.winner_text.size + 2*this.winner_text.padding)
        ctx.fillStyle = '#fff'
        ctx.fillText(text, this.winner_text.x - 0.5 * txt_width, this.winner_text.y + this.winner_text.size / 2);      
      }
    }
  
  },

  //=============================================================================
  // COURT
  //=============================================================================

  Court: {

    initialize: function(pong) {
      this.pong = pong
      
      var w  = pong.width;
      var h  = pong.height;
      var ww = pong.cfg.wallWidth;

      this.ww    = ww;
      this.walls = [];
      this.walls.push({x: 0, y: 0,      width: w, height: ww});
      this.walls.push({x: 0, y: h - ww, width: w, height: ww});
      var nMax = (h / (ww*2));
      for(var n = 0 ; n < nMax ; n++) { // draw dashed halfway line
        this.walls.push({x: (w / 2) - (ww / 2), 
                         y: (ww / 2) + (ww * 2 * n), 
                         width: ww, height: ww});
      }

      var sw = 3*ww;
      var sh = 4*ww;
      this.score1 = {x: 0.5 + (w/2) - 1.5*ww - sw, y: 3*ww, w: sw, h: sh};
      this.score2 = {x: 0.5 + (w/2) + 1.5*ww,      y: 3*ww, w: sw, h: sh};
      
      this.timer = { x: 2*ww , y: pong.height - 2*ww, size: ww * 1 }
    },

    draw: function(ctx, scorePlayer1, scorePlayer2) {
      ctx.fillStyle = Pong.Colors.walls;
      for(var n = 0 ; n < this.walls.length ; n++)
        ctx.fillRect(this.walls[n].x, this.walls[n].y, this.walls[n].width, this.walls[n].height);
      this.drawDigit(ctx, Math.floor(0.1*scorePlayer1), this.score1.x - this.score1.w - this.ww, this.score1.y, this.score1.w, this.score1.h);
      this.drawDigit(ctx, (scorePlayer1 % 10),          this.score1.x, this.score1.y, this.score1.w, this.score1.h);
      
      this.drawDigit(ctx, Math.floor(0.1*scorePlayer2), this.score2.x, this.score2.y, this.score2.w, this.score2.h);
      this.drawDigit(ctx, (scorePlayer2 % 10),          this.score2.x + this.score2.w + this.ww, this.score2.y, this.score2.w, this.score2.h);
      
      if (this.pong.playing) {
        ctx.font = this.timer.size + 'pt monospace'
        var time, ms, sec, min
        time = performance.now() - start_time
        min = Math.floor(time / 60000)
        ms = time % 1000
        sec = (time - min*60000 - ms) / 1000
        time = pad(min,2) + ':' + pad(sec,2) + '.' + pad(Math.floor(ms/10),2)
        ctx.fillText(time, this.timer.x, this.timer.y)
      }
    },

    drawDigit: function(ctx, n, x, y, w, h) {
      ctx.fillStyle = Pong.Colors.score;
      var dw = dh = this.ww*4/5;
      var blocks = Pong.Court.DIGITS[n];
      if (blocks[0])
        ctx.fillRect(x, y, w, dh);
      if (blocks[1])
        ctx.fillRect(x, y, dw, h/2);
      if (blocks[2])
        ctx.fillRect(x+w-dw, y, dw, h/2);
      if (blocks[3])
        ctx.fillRect(x, y + h/2 - dh/2, w, dh);
      if (blocks[4])
        ctx.fillRect(x, y + h/2, dw, h/2);
      if (blocks[5])
        ctx.fillRect(x+w-dw, y + h/2, dw, h/2);
      if (blocks[6])
        ctx.fillRect(x, y+h-dh, w, dh);
    },

    DIGITS: [
      [1, 1, 1, 0, 1, 1, 1], // 0
      [0, 0, 1, 0, 0, 1, 0], // 1
      [1, 0, 1, 1, 1, 0, 1], // 2
      [1, 0, 1, 1, 0, 1, 1], // 3
      [0, 1, 1, 1, 0, 1, 0], // 4
      [1, 1, 0, 1, 0, 1, 1], // 5
      [1, 1, 0, 1, 1, 1, 1], // 6
      [1, 0, 1, 0, 0, 1, 0], // 7
      [1, 1, 1, 1, 1, 1, 1], // 8
      [1, 1, 1, 1, 0, 1, 0]  // 9
    ]

  },

  //=============================================================================
  // PADDLE
  //=============================================================================

  Paddle: {

    initialize: function(pong, rhs) {
      this.pong   = pong;
      this.width  = pong.cfg.paddleWidth;
      this.height = pong.cfg.paddleHeight;
      this.minY   = pong.cfg.wallWidth;
      this.maxY   = pong.height - pong.cfg.wallWidth - this.height;
      this.speed  = (this.maxY - this.minY) / pong.cfg.paddleSpeed;
      this.setpos(rhs ? pong.width - this.width : 0, this.minY + (this.maxY - this.minY)/2);
      this.setdir(0);
    },

    setpos: function(x, y) {
      this.x      = x;
      this.y      = y;
      this.left   = this.x;
      this.right  = this.left + this.width;
      this.top    = this.y;
      this.bottom = this.y + this.height;
    },

    setdir: function(dy) {
      this.up   = (dy < 0 ? -dy : 0);
      this.down = (dy > 0 ?  dy : 0);
    },

    setAuto: function(on, level) {
      if (on && !this.auto) {
        this.auto = true;
        this.setLevel(level);
      }
      else if (!on && this.auto) {
        this.auto = false;
        this.setdir(0);
      }
    },

    setLevel: function(level) {
      if (this.auto)
        this.level = Pong.Levels[level];
    },

    update: function(dt, ball) {
      if (this.auto)
        this.ai(dt, ball);

      var amount = this.down - this.up;
      if (amount != 0) {
        var y = this.y + (amount * dt * this.speed);
        if (y < this.minY)
          y = this.minY;
        else if (y > this.maxY)
          y = this.maxY;
        this.setpos(this.x, y);
      }
    },

    ai: function(dt, ball) {
      if (((ball.x < this.left) && (ball.dx < 0)) ||
          ((ball.x > this.right) && (ball.dx > 0))) {
        this.stopMovingUp();
        this.stopMovingDown();
        return;
      }

      this.predict(ball, dt);

      if (this.prediction) {
        if (this.prediction.y < (this.top + this.height/2 - 5)) {
          this.stopMovingDown();
          this.moveUp();
        }
        else if (this.prediction.y > (this.bottom - this.height/2 + 5)) {
          this.stopMovingUp();
          this.moveDown();
        }
        else {
          this.stopMovingUp();
          this.stopMovingDown();
        }
      }
    },

    predict: function(ball, dt) {
      // only re-predict if the ball changed direction, or its been some amount of time since last prediction
      if (this.prediction &&
          ((this.prediction.dx * ball.dx) > 0) &&
          ((this.prediction.dy * ball.dy) > 0) &&
          (this.prediction.since < this.level.aiReaction)) {
        this.prediction.since += dt;
        return;
      }

      var pt  = Pong.Helper.ballIntercept(ball, {left: this.left, right: this.right, top: -10000, bottom: 10000}, ball.dx * 10, ball.dy * 10);
      if (pt) {
        var t = this.minY + ball.radius;
        var b = this.maxY + this.height - ball.radius;

        while ((pt.y < t) || (pt.y > b)) {
          if (pt.y < t) {
            pt.y = t + (t - pt.y);
          }
          else if (pt.y > b) {
            pt.y = t + (b - t) - (pt.y - b);
          }
        }
        this.prediction = pt;
      }
      else {
        this.prediction = null;
      }

      if (this.prediction) {
        this.prediction.since = 0;
        this.prediction.dx = ball.dx;
        this.prediction.dy = ball.dy;
        this.prediction.radius = ball.radius;
        this.prediction.exactX = this.prediction.x;
        this.prediction.exactY = this.prediction.y;
        var closeness = (ball.dx < 0 ? ball.x - this.right : this.left - ball.x) / this.pong.width;
        var error = this.level.aiError * closeness;
        this.prediction.y = this.prediction.y + Game.random(-error, error);
      }
    },

    draw: function(ctx) {
      ctx.fillStyle = Pong.Colors.walls;
      ctx.fillRect(this.x, this.y, this.width, this.height);
      if (this.prediction && this.pong.cfg.predictions) {
        ctx.strokeStyle = Pong.Colors.predictionExact;
        ctx.strokeRect(this.prediction.x - this.prediction.radius, this.prediction.exactY - this.prediction.radius, this.prediction.radius*2, this.prediction.radius*2);
        ctx.strokeStyle = Pong.Colors.predictionGuess;
        ctx.strokeRect(this.prediction.x - this.prediction.radius, this.prediction.y - this.prediction.radius, this.prediction.radius*2, this.prediction.radius*2);
      }
    },

    moveUp:         function() { this.up   = 1; },
    moveDown:       function() { this.down = 1; },
    stopMovingUp:   function() { this.up   = 0; },
    stopMovingDown: function() { this.down = 0; }

  },

  //=============================================================================
  // BALL
  //=============================================================================

  Ball: {

    initialize: function(pong) {
      this.pong    = pong;
      this.radius  = pong.cfg.ballRadius;
      this.minX    = this.radius;
      this.maxX    = pong.width - this.radius;
      this.minY    = pong.cfg.wallWidth + this.radius;
      this.maxY    = pong.height - pong.cfg.wallWidth - this.radius;
      this.speed   = (this.maxX - this.minX) / pong.cfg.ballSpeed;
      this.accel   = pong.cfg.ballAccel;
    },

    reset: function(playerNo) {
      this.setpos(playerNo == 1 ?   this.maxX : this.minX,  Game.random(this.minY, this.maxY));
      this.setdir(playerNo == 1 ? -this.speed : this.speed, this.speed);
    },

    setpos: function(x, y) {
      this.x      = x;
      this.y      = y;
      this.left   = this.x - this.radius;
      this.top    = this.y - this.radius;
      this.right  = this.x + this.radius;
      this.bottom = this.y + this.radius;
    },

    setdir: function(dx, dy) {
      this.dx = dx;
      this.dy = dy;
    },

    update: function(dt, leftPaddle, rightPaddle) {

      pos = Pong.Helper.accelerate(this.x, this.y, this.dx, this.dy, this.accel, dt);

      if ((pos.dy > 0) && (pos.y > this.maxY)) {
        pos.y = this.maxY;
        pos.dy = -pos.dy;
      }
      else if ((pos.dy < 0) && (pos.y < this.minY)) {
        pos.y = this.minY;
        pos.dy = -pos.dy;
      }

      var paddle = (pos.dx < 0) ? leftPaddle : rightPaddle;
      
      var pt     = Pong.Helper.ballIntercept(this, paddle, pos.nx, pos.ny);

      if (pt) {
        switch(pt.d) {
          case 'left':
          case 'right':
            pos.x = pt.x;
            pos.dx = -pos.dx;
            break;
          case 'top':
          case 'bottom':
            pos.y = pt.y;
            pos.dy = -pos.dy;
            break;
        }

        // add/remove spin based on paddle direction
        if (paddle.up)
          pos.dy = pos.dy * (pos.dy < 0 ? 0.5 : 1.5);
        else if (paddle.down)
          pos.dy = pos.dy * (pos.dy > 0 ? 0.5 : 1.5);
      }

      this.setpos(pos.x,  pos.y);
      this.setdir(pos.dx, pos.dy);
      
      // Sync with other player
      pos = Pong.Helper.accelerate(this.x, this.y, this.dx, this.dy, this.accel, dt);
      if (Math.abs(paddle.x + 0.5 * paddle.width - pos.x) < 0.5 * paddle.width + this.radius) {
        if (paddle === andereSpelerPaddle) {
          this.pong.runner.stop()
          final_position = true
          set_final_position()
        } else if (paddle === beginSpelerPaddle) {
          var dir = 0
          if (paddle.up)
            dir = 'up'
          if (paddle.down)
            dir = 'down'
          socket.emit('final_position', {
            key: dir,
            paddle: paddle.y,
            ball: {
              x:  this.x,
              y:  this.y,
              dx: this.dx,
              dy: this.dy
            }
          })
        }
      }
    },

    draw: function(ctx) {
      var w = h = this.radius * 2;
      ctx.fillStyle = Pong.Colors.ball;
      ctx.fillRect(this.x - this.radius, this.y - this.radius, w, h);
    }

  },

  //=============================================================================
  // HELPER
  //=============================================================================

  Helper: {

    accelerate: function(x, y, dx, dy, accel, dt) {
      var x2  = x + (dt * dx) + (accel * dt * dt * 0.5);
      var y2  = y + (dt * dy) + (accel * dt * dt * 0.5);
      var dx2 = dx + (accel * dt) * (dx > 0 ? 1 : -1);
      var dy2 = dy + (accel * dt) * (dy > 0 ? 1 : -1);
      return { nx: (x2-x), ny: (y2-y), x: x2, y: y2, dx: dx2, dy: dy2 };
    },

    intercept: function(x1, y1, x2, y2, x3, y3, x4, y4, d) {
      var denom = ((y4-y3) * (x2-x1)) - ((x4-x3) * (y2-y1));
      if (denom != 0) {
        var ua = (((x4-x3) * (y1-y3)) - ((y4-y3) * (x1-x3))) / denom;
        if ((ua >= 0) && (ua <= 1)) {
          var ub = (((x2-x1) * (y1-y3)) - ((y2-y1) * (x1-x3))) / denom;
          if ((ub >= 0) && (ub <= 1)) {
            var x = x1 + (ua * (x2-x1));
            var y = y1 + (ua * (y2-y1));
            return { x: x, y: y, d: d};
          }
        }
      }
      return null;
    },

    ballIntercept: function(ball, rect, nx, ny) {
      var pt;
      if (nx < 0) {
        pt = Pong.Helper.intercept(ball.x, ball.y, ball.x + nx, ball.y + ny, 
                                   rect.right  + ball.radius, 
                                   rect.top    - ball.radius, 
                                   rect.right  + ball.radius, 
                                   rect.bottom + ball.radius, 
                                   "right");
      }
      else if (nx > 0) {
        pt = Pong.Helper.intercept(ball.x, ball.y, ball.x + nx, ball.y + ny, 
                                   rect.left   - ball.radius, 
                                   rect.top    - ball.radius, 
                                   rect.left   - ball.radius, 
                                   rect.bottom + ball.radius,
                                   "left");
      }
      if (!pt) {
        if (ny < 0) {
          pt = Pong.Helper.intercept(ball.x, ball.y, ball.x + nx, ball.y + ny, 
                                     rect.left   - ball.radius, 
                                     rect.bottom + ball.radius, 
                                     rect.right  + ball.radius, 
                                     rect.bottom + ball.radius,
                                     "bottom");
        }
        else if (ny > 0) {
          pt = Pong.Helper.intercept(ball.x, ball.y, ball.x + nx, ball.y + ny, 
                                     rect.left   - ball.radius, 
                                     rect.top    - ball.radius, 
                                     rect.right  + ball.radius, 
                                     rect.top    - ball.radius,
                                     "top");
        }
      }
      return pt;
    }

  }

  //=============================================================================

}; // Pong












/*
 ========================  WEBSOCKET CONNECTION =======================
*/
socket.on('connect', function() {
  console.log('WS connected, ws_id (sid): '+socket.id)
  $('#connection-status').text('Wachten op andere speler...')
  //socket.emit('connect ', {data: 'test'})
});
// socket.emit('echo', {data: 'test'})
socket.on('log', function(msg) {
  console.log('log', msg)
  $('#ws-log').append("\nlog " + JSON.stringify(msg,null,2))
});

var beginSpelerPaddle, andereSpelerPaddle, rechts_of_links
var start_time
socket.on('room created', function(msg) {
  console.log('room_created', msg)
  var users = $.map(msg.users, function(value, index) {
      if (index != socket.id)
        return [value];
  })
  console.log(users)
  andere_speler = users[0]
  $('#connection-status').text('Je speelt tegen '+andere_speler.nickname)
  var nicknames = [msg.users[msg.links].nickname, msg.users[msg.rechts].nickname]
  console.log(nicknames)
  rechts_of_links = (msg.rechts == socket.id ? 1 : 0)
  console.log('Starting game...')
  Game.random = function(min, max) {
    return (min + (msg.random * (max - min)));
  }
  Game.start('game-canvas', Pong, {
    nicknames : nicknames,
    rechts_of_links : rechts_of_links,
  })
  countdown(3)
  start_time = performance.now()
  if (msg.rechts == socket.id) {
    beginSpelerPaddle = pong_object.rightPaddle
    andereSpelerPaddle = pong_object.leftPaddle
  } else {
    beginSpelerPaddle = pong_object.leftPaddle
    andereSpelerPaddle = pong_object.rightPaddle
  }
  $('html, body').stop().animate({
      scrollTop: $("#game-canvas").offset().top
  }, 500);
})

var countdown = function (n) {
  console.log('Countdown: '+n)
  pong_object.menu.countdown = n
  if (n != 0)
    setTimeout(countdown.bind(null, --n), 1000)
  else
    pong_object.start(2)
}

// ----- Pijltjestoetsen triggers ------
function arrow_press(key) {
  if (pong_object != null && pong_object.playing) {
    if (key == 'up') {
      socket.emit('arrow_press_send', {key: 'up', pos: beginSpelerPaddle.y})
      beginSpelerPaddle.stopMovingDown()
      beginSpelerPaddle.moveUp()
      //console.log('up')
    } else if (key == 'down') {
      socket.emit('arrow_press_send', {key: 'down', pos: beginSpelerPaddle.y})
      beginSpelerPaddle.stopMovingUp()
      beginSpelerPaddle.moveDown()
      //console.log('down')
    } else if (key == 0) {
      socket.emit('arrow_press_send', {key: 0, pos: beginSpelerPaddle.y})
      beginSpelerPaddle.stopMovingDown()
      beginSpelerPaddle.stopMovingUp()
      //console.log('released')
    }
  }
}
var arrow_up = 0
var arrow_down = 0
$(document).keydown(function(e){
  if (e.which ==38 || e.which == 40) {
    e.preventDefault()
  }
  if (e.which == 38 && arrow_up == 0) {
    arrow_press("up")
    arrow_up = 1
  } else if (e.which == 40 && arrow_down == 0) {
    arrow_press("down")
    arrow_down = 1
  }
})
$(document).keyup(function(e){
  if (e.which == 38) { 
    e.preventDefault()
    arrow_up = 0
  } else if (e.which == 40) {
    e.preventDefault()
    arrow_down = 0
  }
  if ((e.which == 38 || e.which == 40) && arrow_up == 0 && arrow_down ==0) {
    arrow_press(0)
  }
})

socket.on('arrow_press', function(msg) {
  //console.log('arrow_press', msg['key'], msg.pos)
  //$('#ws-log').append("\narrow_press " + msg['key'])
  andereSpelerPaddle.setpos(andereSpelerPaddle.x, msg.pos)
  set_paddle_dir(msg.key)
})

var final_position_msg = null
var final_position = false
socket.on('final_position', function(msg) {
  //console.log('final_position', msg.key, msg.pos)
  //$('#ws-log').append("\nfinal_position " + msg['key'])
  final_position_msg = msg
  set_final_position()
})

function set_final_position() {
  if (!(final_position_msg && final_position))
      return
  var msg = final_position_msg
  pong_object.ball.setpos(msg.ball.x, msg.ball.y)
  pong_object.ball.setdir(msg.ball.dx, msg.ball.dy)
  andereSpelerPaddle.setpos(andereSpelerPaddle.x, msg.paddle)
  set_paddle_dir(msg.key)
  pong_object.runner.start()
  final_position = false
  final_position_msg = false
}

socket.on('goal', function(msg) {
  pong_object.goal(rechts_of_links)
})

socket.on('game over', function(msg) {
  pong_object.menu.declareWinner(msg.winner, msg.minutes, msg.seconds, msg.punten);
  pong_object.stop();
})

function set_paddle_dir(key) {
  if (key == 'up') {
    andereSpelerPaddle.stopMovingDown()
    andereSpelerPaddle.moveUp()
  } else if (key == 'down') {
    andereSpelerPaddle.stopMovingUp()
    andereSpelerPaddle.moveDown()
  } else if (key == 0) {
    andereSpelerPaddle.stopMovingDown()
    andereSpelerPaddle.stopMovingUp()
  }
}