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

const get = require('lodash/get');
const grbl = require('./grbl');

const Prober = class Prober {
  constructor(options) {
    this._options = options;
    this._inProbe = false;
    this._startingZ = 0;
  }


  async probe() {
 
    // Make sure we know where we are
    if (grbl.state.mpos === undefined) {
      return;
    }
    
    if (this._inProbe) {
      return;
    }
    
    this._inProbe = true;
 
    this._startingZ = grbl.state.mposZ;
    var zTravel = grbl.settings.travelZ || 50;
    var plateHeight = Number(this._options.plateHeight);
    var feed = Number(this._options.probeFeedrate);

    // Make sure we can't probe beyond the limit of the machine
    zTravel += grbl.state.mposZ;

    // Is homing enabled
    if (grbl.settings.homingEnabled) {

     // If a pull off was set remove that from the travel distacnce to stay away from the limit switches
     zTravel -= grbl.settings.homingPulloff;
    }

    // Make sure we are in Relative Mode
    grbl.gcode(`G91`);

    // Fast Probe
    grbl.gcode(`G38.2 Z-${Number(zTravel).toFixed(3)} F${feed}`);

    // Lift by 1mm
    grbl.gcode(`G0 Z1`);
  
    // Slower Probe for improved accuracy
    grbl.gcode(`G38.2 Z-2 F20`);

    // Set the work position
    grbl.gcode(`G10 L20 P1 Z${plateHeight}`);

    // 250ms pause to help the arduino wirte to the EEPROM
    grbl.gcode(`G4 P0.25`);

    // Return to pre probe location
    grbl.gcode(`G53 G0 Z${this._startingZ}`);

    // Make sure we are in Absolute Mode
    grbl.gcode(`G90`);

    // Wait until all movement is finished
    await grbl.wait();

    this._inProbe = false;
  }
  
  
  async halt() {
    if (this._inProbe) {
      grbl.feedhold();
      await grbl.waitForActiveState("Hold");
      grbl.reset();
      await grbl.waitForActiveState("Idle");
      
      // Return to pre probe location
      grbl.gcode(`G53 G0 Z${this._startingZ}`);
    }
  }

}


module.exports = Prober;
