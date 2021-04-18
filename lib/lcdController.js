/**
 *
 * MIT License
 *
 * Copyright (c) 2021 Ben Suffolk
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 **/

const LCD = require('raspberrypi-liquid-crystal');
const Mutex = require('async-mutex').Mutex;
const pkg = require('../package.json');
const grbl = require('./grbl');
const logger = require('./logger');

const mode = {
  NONE: "none",
  SPLASH: "splash",
  STATE: "state",
}


const LCDController = class LCDController {

  constructor() {
    this._lcd = null;
    this._displayMutex = new Mutex();
    this.mode = mode.NONE;
    this._needStateDisplay = false;
    this._needJogDisplay = false;
    this._inStateDisplay = false;
    this._wpos = {};
    this._activeState = '';
    this._jogAxis = 'X';
    this._jogStep = '0.01';
  }


  open(options) {
    if (this._lcd) {
      this.close();
    }

    try {
      this._lcd = new LCD(Number(options.i2cBus), Number(options.lcdAddress), 20, 4);
      this._lcd.beginSync();
      this.mode = mode.NONE;
      this.displaySplash();

      // If wpos changes we will need a display update. mpos won't change wihtout wpos changing
      grbl.state.on('wposChanged', () => {
        this.needStateDisplay = true;
      });
      
      
      grbl.state.on('activeStateChanged', state =>  {
        if (state === '' ) {
          this.displaySplash('Waiting for Reset');
        } else if (state === 'Alarm:Home' ) {
          this.displaySplash('Homing Required');
        } else if (state === 'Home' ) {
          this.displaySplash('Machine is Homing');
        } else {
          this.needStateDisplay = true;
        }
      });

    } catch (e) {
      logger.error(JSON.stringify(e), 'lcdController', 'open');
      this.close();
      this._lcd = null;
    }

    process.on('SIGTERM', () => {
      this._lcd.clearSync();
      setImmediate(() => {
        process.exit(1);
      });
    });
  }
 
 
  close() {
    if (this._lcd) {
      try {
        this._lcd.closeSync();
      } catch (e) {
        logger.error(JSON.stringify(e), 'lcdController', 'close');
      } finally {
        this._lcd = null;
      }
    }
  }
  
  
  set jogAxis(axis) {
    this._jogAxis = axis;
    this.needJogDisplay = true;
  }


  set jogStep(step) {
    this._jogStep = Number(step).toFixed(3);
    this.needJogDisplay = true;
  }

  
  set needStateDisplay(flag) {
    this._needStateDisplay = flag;
    if (this._needStateDisplay) {
      this.displayState();
    }
  }


  set needJogDisplay(flag) {
    this._needJogDisplay = flag;
    if (this._needJogDisplay) {
      this.needStateDisplay = true;
    }
  }

  
  async displaySplash(reason = null) {
    if (!this._lcd) {
      return;
    }
  
    await this._displayMutex.runExclusive(async () => {

      try {
        // If were in another mode, clear the screen
        if (this.mode != mode.SPLASH) {
          this.mode = mode.SPLASH;
          await this._lcd.clear();
        }

        await this._lcd.printLine(0, 'CNCJS GRBL Shuttle');
        await this._lcd.printLine(1, 'Version: '+pkg.version);
        await this._lcd.printLine(2, '(c) '+pkg.author.name);

        if (reason == null) {
          await this._lcd.printLine(3, 'Waiting for Server..');
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          await this._lcd.printLine(3, reason.padEnd(20, '.'));
        }
      } catch (e) {
        logger.error(JSON.stringify(e), 'lcdController', 'displaySplash');
      }
    });
  }
  
  
  async displayState() {
    if (!this._lcd || this._inStateDisplay) {
      return;
    }

    if (grbl.state.activeState == undefined ||
        grbl.state.activeState === 'Alarm:Home' ||
        grbl.state.activeState === 'Home' ||
        grbl.state.activeState === '') {
      return;
    }
    
    this._displayMutex.runExclusive(async () => {
      this._inStateDisplay = true;

      // We might have been requested to display again whilst we were in this display method
      while(this._needStateDisplay) {
        this._needStateDisplay = false;
        
        try {
          // If were in another mode, clear the screen
          if (this.mode != mode.STATE) {
            this.mode = mode.STATE;
            this._wpos = {};
            this._activeState = '';
            await this._lcd.clear();
          }

          // See if we need to display anything
          if (grbl.state.wposX !== this._wpos.x) {
            this._wpos.x = grbl.state.wposX;
            await this._lcd.printLine(0, 'X: ' + this._format_position(grbl.state.mposX) + ' ' + this._format_position(grbl.state.wposX));
          }

          // See if we need to display anything
          if (grbl.state.wposY !== this._wpos.y) {
            this._wpos.y = grbl.state.wposY;
            await this._lcd.printLine(1, 'Y: ' + this._format_position(grbl.state.mposY) + ' ' + this._format_position(grbl.state.wposY));
          }

          // See if we need to display anything
          if (grbl.state.wposZ !== this._wpos.z) {
            this._wpos.z = grbl.state.wposZ;
            await this._lcd.printLine(2, 'Z: ' + this._format_position(grbl.state.mposZ) + ' ' + this._format_position(grbl.state.wposZ));
          }

          // See if we need to display state
          if (grbl.state.activeState !== this._activeState) {
            this._activeState = grbl.state.activeState;
            
            // If its an Idle of Jog state we also need to display the jog details
            if(this._activeState === 'Idle' || this._activeState === 'Jog') {
              await this._lcd.printLine(3, this._activeState.padEnd(9, ' '));
              this._needJogDisplay = true;
            } else {
              await this._lcd.printLine(3, this._activeState.padEnd(20, ' '));
              this._needJogDisplay = false;
            }
          }

          // See if we need to display jog details
          if (this._needJogDisplay) {
            this._needJogDisplay = false;
            await this._lcd.setCursor(8,3);
            await this._lcd.print(`Jog:${this._jogAxis}, ${this._jogStep}`.padEnd(12, ' '));
          }

        } catch (e) {
          logger.error(JSON.stringify(e), 'lcdController', 'displayState');
        }
      }
      
      this._inStateDisplay = false;
    });
  }


  _format_position(num) {
    return num.toFixed(3).padStart(8, ' ');
  }
}

module.exports = new LCDController();
