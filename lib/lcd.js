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

const pendantLCD = class pendantLCD  extends LCD {

  constructor(busNumber, address, cols, rows) {
    super(busNumber, address, cols, rows);
    
    this._initilised = false;
    this._inDisplay = false;
    this._needsDisplay = false;
    this._pos = {x: 0, y: 0, z: 0};
    this._activeState = '';
    this._state = {stats: {}};
    this._jogAxis = 'X';
    this._jogStep = '0.01';
    this._displayJog = false;

    // Connect to the LCD and clear the screen
    try {
      this.beginSync();
      this.clearSync();
      this._initilised = true;
    } catch (e) {
      this._i2c.closeSync();
      console.error('Unable to connect to LCD');
    }

  }
  
  set state(newState) {
    if (!this._initilised) {
      return;
    }
    
    this._state = newState;
    this._needsDisplay = true;
    this._display();
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


  async _display() {
    if (this._inDisplay) {
      return;
    }
    
    this._inDisplay = true;
    
    while(this._needsDisplay) {
      this._needsDisplay = false;
      
      try {

        // See if WPOS is different from what we last displayed, so we only update if its changed
        if (this._state.status.wpos.x !== this._pos.x) {
          this._pos.x = this._state.status.wpos.x;
          await this.printLine(0, 'X: ' + this._format_position(this._state.status.mpos.x) + ' ' + this._format_position(this._state.status.wpos.x));
        }

        if (this._state.status.wpos.y !== this._pos.y) {
          this._pos.y = this._state.status.wpos.y;
          await this.printLine(1, 'Y: ' + this._format_position(this._state.status.mpos.y) + ' ' + this._format_position(this._state.status.wpos.y));
        }

        if (this._state.status.wpos.z !== this._pos.z) {
          this._pos.z = this._state.status.wpos.z;
          await this.printLine(2, 'Z: ' + this._format_position(this._state.status.mpos.z) + ' ' + this._format_position(this._state.status.wpos.z));
        }
        
        if (this._state.status.activeState !== this._activeState) {
          this._activeState = this._state.status.activeState;
          
          
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
        await this.setCursor(9,3);
        await this.print(`Jog:${this._jogAxis}, ${this._jogStep}`.padEnd(11, ' '));
      }
    }
    
    this._inDisplay = false;
  }


  _format_position(num) {
    var str = Number(num).toFixed(3);
    return str.padStart(8, ' ');
  }

}


// Create a connection to a 20 x 4 line LCD on I2C port 1 address 0x27
// TODO: Make this an command line option
const lcd = new LCD( 1, 0x27, 20, 4 );

// Connect to and clear the screen



module.exports = pendantLCD;
