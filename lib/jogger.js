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

const grbl = require('./grbl');
const lcd = require('./lcdController');
const logger = require('./logger');

const JOG_FEED = 120;

// Feed rate is read from the machine, but can also be limited to a maximum value
const MAX_X_FEED = 1000;
const MAX_Y_FEED = 1000;
const MAX_Z_FEED = 250;

// Acceleration rate is read from the machine, but can also be limited to a maximum value
const MAX_X_ACC = 75;
const MAX_Y_ACC = 75;
const MAX_Z_ACC = 75;

const LATENCY = 0.2;
const INTERVAL = LATENCY * 1000;
const STOPPING_BONUS = 0.1;

const Jogger = class Jogger {
  
  constructor(options) {
    this._options = options;

    this._feedRates = {};
    this._feedRates['X'] = [];
    this._feedRates['Y'] = [];
    this._feedRates['Z'] = [];

    this._accel = {};
    this._accel['X'] = 0;
    this._accel['Y'] = 0;
    this._accel['Z'] = 0;

    this._currentStepIndex = 0;
    this._currentShuttle = 0;
    this._lastShuttle = 0;
    this._shuttleRepeat = null;
    this._currentAxis = 'X';
    
    this._calcFeedRates();

    grbl.settings.on('updated', () => {
      this._calcFeedRates();
    });
  }


  nextStep(reset = false) {
    if(reset == true) {
      this._currentStepIndex = 0;
    } else {
      this._currentStepIndex++;
    }
    
    if (this._currentStepIndex >= this._options.stepDistance.length) {
      this._currentStepIndex = 0;
    }
    
    lcd.jogStep = this._options.stepDistance[this._currentStepIndex];
  }

  
  set axis(newAxis) {
    if (grbl.state.activeState === 'Idle') {
      this._currentAxis = newAxis;
      lcd.jogAxis = this._currentAxis;
    }
  }
 
  
  set currentShuttle(value) {
    if (this._currentShuttle == value) {
      return;
    }
    
    logger.log(logger.level.DEBUG, value, 'jogger', 'setCurrentShuttle');
    this._currentShuttle = value;

    // If we are not already shutteling, start now
    if (!this._shuttleRepeat) {
      this._doShuttle();
    }
  }


  jog(direction) {
    if (this._currentAxis === 'X' && this._options.reverseX) {
      direction *= -1;
    } else if (this._currentAxis === 'Y' && this._options.reverseY) {
      direction *= -1;
    } else if (this._currentAxis === 'Z' && this._options.reverseZ) {
      direction *= -1;
    }

    grbl.jog(this._currentAxis, this._options.stepDistance[this._currentStepIndex] * direction, this._feedRates[this._currentAxis][7]);
  }


  _maxFeedRate(axis) {
    var f = 0;
    var a = 0;
    
    // Get machine feed rates and acceleration (Capped / defaulted at MAX values)
    switch (axis) {
      case 'X':
        f = Math.min(grbl.settings.maxFeedX, MAX_X_FEED);
        a = Math.min(grbl.settings.accelerationX, MAX_X_ACC);
        break;
      case 'Y':
        f = Math.min(grbl.settings.maxFeedY, MAX_Y_FEED);
        a = Math.min(grbl.settings.accelerationY, MAX_Y_ACC);
        break;
    
      case 'Z':
        f = Math.min(grbl.settings.maxFeedZ, MAX_Z_FEED);
        a = Math.min(grbl.settings.accelerationZ, MAX_Z_ACC);
        break;

      default:
        return 0;
    }

     // Save the acceleration for later
     this._accel[axis] = a;

     // The Max rate is the minimum of the machine's grbl.settings or acceleration * LATENCY * 60
     return Math.min((a * LATENCY * 60), f);
   }


  _calcFeedRates() {
    this._calcFeedRate('X');
    this._calcFeedRate('Y');
    this._calcFeedRate('Z');
    
    logger.log(logger.level.DEBUG, JSON.stringify(this._feedRates), 'jogger', '_calcFeedRates');
  }


  _calcFeedRate(axis) {
    var maxFeed = this._maxFeedRate(axis);

    // First 3 feed rates are fixed at 1, 2 & 3 mm per second (or maxFeed if its less)
    this._feedRates[axis][0] = 0;
    this._feedRates[axis][1] = Math.min(60, maxFeed);
    this._feedRates[axis][2] = Math.min(120, maxFeed);
    this._feedRates[axis][3] = Math.min(180, maxFeed);
 
    // Next 4 will be a linear progression upto maxFeed
    var feedInc = (maxFeed - this._feedRates[axis][3]) / 4;
    for (let i=4; i<8; i++) {
     this._feedRates[axis][i] = this._feedRates[axis][i-1] + feedInc;
    }
   }
  

  _distanceForAcceleration(axis, f1, f2) {

   // Get the accelleratino setting used for axis
   var accel = this._accel[axis];

   // For caculations we always assume it accelerating
   var f1s = (f1 < f2 ? f1:f2);
   var f2s = (f1 < f2 ? f2:f1);

   // Calculate the time to change velocity (using feed rates in mm/s)
   var time = (f2s - f1s) / accel;

   // Calculate distance in mm
   var distance = (f1s * time) + (0.5 * accel * time * time);
   
   return [distance, time];
  }


  _shuttleDistance(axis, sCurrent, sTarget) {
    // Get the start and target feed rates based on the shuttle grbl.settings and convert to mm/sec
    var f1 = this._feedRates[axis][sCurrent] / 60;
    var f2 = this._feedRates[axis][sTarget] / 60;
    var distance = 0
    var time = 0;

    // If we are starting from 0, this must be the start of a shuttle, so we need to add enough extra
    // time (and distance) to comenstae for the planner wanting to start its deccelaration phase.
    // This means we can maintain our feed rate whilst jogging
    
    if (sCurrent == 0) {
     var [d,t] =  this._distanceForAcceleration(axis, f2, 0);
     distance += d;
    
     // A little extra to comensate for possible delays in pendant code execution
     distance += f2 * STOPPING_BONUS;
    }

    // (de)acceleration distance
    if (f1 != f2) {
      var [d,t] = this._distanceForAcceleration(axis, f1, f2);
      distance += d;
      time += t;

     // If are going faster, increase the stopping distance, otherwise decrease it
     if(f1 < f2) {
       distance += (d + ((f2-f1) * STOPPING_BONUS));
     } else {
       distance -= (d + ((f1-f2) * STOPPING_BONUS));
     }
    }

    // Use up the rest of the latency as a constant feed
    if (LATENCY - time > 0) {
     distance += f2 * (LATENCY - time);
    }

    return distance.toFixed(3);
   }
  
  
  _doShuttle() {

    // If the shuttle is off, mark repeat as off and send a jogCancel
    if (this._currentShuttle == 0) {
      this._shuttleRepeat = null;
      grbl.jogCancel();
    } else {
      var direction = (this._currentShuttle > 0) ? 1 : -1;
      var distance = this._shuttleDistance(this._currentAxis, Math.abs(this._lastShuttle), Math.abs(this._currentShuttle));

      if (this._currentAxis === 'X' && this._options.reverseX) {
        direction *= -1;
      } else if (this._currentAxis === 'Y' && this._options.reverseY) {
        direction *= -1;
      } else if (this._currentAxis === 'Z' && this._options.reverseZ) {
        direction *= -1;
      }

      grbl.jog(this._currentAxis, distance * direction, this._feedRates[this._currentAxis][Math.abs(this._currentShuttle)]);

      // Start a repeat timer for the correct repeat interval
      this._shuttleRepeat = setTimeout(() => { this._doShuttle() }, INTERVAL);
    }
    
    // Keep the shuttle settings to calculate the next feed distance
    this._lastShuttle = this._currentShuttle;
  }
}

module.exports = Jogger;
