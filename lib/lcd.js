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

const pkg = require('../package.json');
const LCD = require('raspberrypi-liquid-crystal');
const Mutex = require('async-mutex').Mutex;
const state = require('./state');

const MODE_SPLASH = 0x01;
const MODE_STATE  = 0x02;

const pendantLCD = class pendantLCD  extends LCD {

  constructor(busNumber, address, cols, rows) {
    super(busNumber, address, cols, rows);
    
    this._mutex = new Mutex();
    this._initilised = false;
    this._inDisplay = false;
    this._needsDisplay = false;
    this._pos = {};
    this._activeState = '';
    this._jogAxis = 'X';
    this._jogStep = '0.01';
    this._displayJog = false;
    this._mode = MODE_SPLASH;

    // Connect to the LCD and clear the screen
    try {
      this.beginSync();
      this.clearSync();
      this.splash();
      this._initilised = true;
      
      // mpos won't change without wpos, so only need to watch wpos
      state.on('wposChanged', () => {
        this._needsDisplay = true;
        this._display();
      });


      state.on('activeStateChanged', state =>  {
        if (state === '' ) {
          this.splash('Waiting for Reset');
        } else {
          this._needsDisplay = true;
          this._display();
        }
        
      });


    } catch (e) {
      console.error('Unable to connect to LCD');
    }

  }
  

  set jogAxis(axis) {
    if (!this._initilised) {
      return;
    }
    
    this._jogAxis = axis;
    this._displayJog = true;
    this._needsDisplay = true;
    this._display();
  }


  set jogStep(step) {
    if (!this._initilised) {
      return;
    }
    
    this._jogStep = step;
    this._displayJog = true;
    this._needsDisplay = true;
    this._display();
  }

 
  async splash(reason = null) {
    await this._mutex.runExclusive(async () => {
      if (this._mode != MODE_SPLASH) {
        this._mode = MODE_SPLASH;
        await this.clear();
        console.log("Clear");
      }

      await this.printLine(0, "CNCJS GRBL Shuttle");
      await this.printLine(1, "Version: "+pkg.version);
      await this.printLine(2, "(c) "+pkg.author.name);

      if (reason == null) {
        await this.printLine(3, 'Waiting for Server..');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        await this.printLine(3, reason.padEnd(20, '.'));
      }

    });
  }


  async _display() {
    if (this._inDisplay) {
      return;
    }

    if (state.activeState == undefined || state.activeState === '') {
      return;
    }

    await this._mutex.runExclusive(async () => {
      this._inDisplay = true;
      
      while(this._needsDisplay) {
        this._needsDisplay = false;

        if (this._mode != MODE_STATE) {
          this._mode = MODE_STATE;
          await this.clear();
        }

        try {

          // See if WPOS is different from what we last displayed, so we only update if its changed
          if (state.wposX !== this._pos.x) {
            this._pos.x = state.wposX;
            await this.printLine(0, 'X: ' + this._format_position(state.mposX) + ' ' + this._format_position(state.wposX));
          }

          if (state.wposY !== this._pos.y) {
            this._pos.y = state.wposY;
            await this.printLine(1, 'Y: ' + this._format_position(state.mposY) + ' ' + this._format_position(state.wposY));
          }

          if (state.wposZ !== this._pos.z) {
            this._pos.z = state.wposZ;
            await this.printLine(2, 'Z: ' + this._format_position(state.mposZ) + ' ' + this._format_position(state.wposZ));
          }
          
          if (state.activeState !== this._activeState) {
            this._activeState = state.activeState;
            
            
            if(this._activeState !== 'Idle' && this._activeState !== 'Jog') {
              await this.printLine(3, this._activeState.padEnd(20, ' '));
            } else {
              await this.printLine(3, this._activeState.padEnd(9, ' '));
              this._displayJog = true;
            }
          }
        } catch (e) {
        }
    
        if(this._displayJog) {
          this._displayJog = false;
          await this.setCursor(8,3);
          await this.print(`Jog:${this._jogAxis}, ${Number(this._jogStep).toFixed(3)}`.padEnd(12, ' '));
        }
      }
      
      this._inDisplay = false;
    });
  }


  _format_position(num) {
    return num.toFixed(3).padStart(8, ' ');
  }

}

module.exports = pendantLCD;
