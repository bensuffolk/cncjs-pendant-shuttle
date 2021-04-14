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

const settings = require('./settings');
const get = require('lodash/get');

// Feed rate is read from the machine, but can also be limited to a maximum value
const MAX_X_FEED = 1000;
const MAX_Y_FEED = 1000;
const MAX_Z_FEED = 250;

// Acceleration rate is read from the machine, but can also be limited to a maximum value
const MAX_X_ACC = 75;
const MAX_Y_ACC = 75;
const MAX_Z_ACC = 75;

/**
 *
 * For the jogging to feel resposive we need the latency to be as low as possible.
 * As soon as a jogCancel is issued Grlb will stop movement, however it needs to do
 * this gracefully so no steps are lost. This is based on the (de)acceleration
 * setting for the relevant axis and the current feed rate.
 *
 * This setting is the maximum number of seconds you are happy to wait for Grbl to
 * slow down from when it receives the jogCancel command. This setting therfore is
 * going to determin the maximum feed rate used for jogging. If you have a low
 * acceleration and a desire a low latency, then the max feedrate will be low.
 *
 * The lower this number, then more responsive jogging will feel. You can calculate
 * the max feed rate by multiplying acceleration * LATENCY * 60, e.g. If you machine
 * has an acceleration of 50mm/sec^2 and you want a latency of 0.2 the max feed rate
 * for jogging would be 600mm/min
 *
 **/
const LATENCY = 0.2;
const STOPPING_BONUS = 0.1;

const AXIS_X = 'X';
const AXIS_Y = 'Y';
const AXIS_Z = 'Z';

var storedAccel = {};

function maxFeedRate(axis) {
               
  var f = 0;
  var a = 0;
  
  // Get machine feed rates and acceleration (Capped / defaulted at MAX values)
  switch (axis) {
    case AXIS_X:
      f = Math.min(settings.maxFeedX, MAX_X_FEED);
      a = Math.min(settings.accelerationX, MAX_X_ACC);
      break;
    case AXIS_Y:
      f = Math.min(settings.maxFeedY, MAX_Y_FEED);
      a = Math.min(settings.accelerationY, MAX_Y_ACC);
      break;
  
    case AXIS_Z:
      f = Math.min(settings.maxFeedZ, MAX_Z_FEED);
      a = Math.min(settings.accelerationZ, MAX_Z_ACC);
      break;

    default:
      return 0;
  }

   // Save the acceleration for later
   storedAccel[axis] = a;

   // The Max rate is the minimum of the machine's settings or acceleration * LATENCY * 60
   return Math.min((a * LATENCY * 60), f);
 }


function calcFeedRate(axis) {

 var maxFeed = maxFeedRate(axis);

 // First 3 feed rates are fixed at 1, 2 & 3 mm per second (or maxFeed if its less)
 calculations.feedRates[axis][0] = 0;
 calculations.feedRates[axis][1] = Math.min(60, maxFeed);
 calculations.feedRates[axis][2] = Math.min(120, maxFeed);
 calculations.feedRates[axis][3] = Math.min(180, maxFeed);
 
 // Next 4 will be a linear progression upto maxFeed
 var feedInc = (maxFeed - calculations.feedRates.X[3]) / 4;
 for (let i=4; i<8; i++) {
  calculations.feedRates[axis][i] = calculations.feedRates[axis][i-1] + feedInc;
 }
}


function calcFeedRates() {
  calcFeedRate(AXIS_X);
  calcFeedRate(AXIS_Y);
  calcFeedRate(AXIS_Z);
}


function distanceForAcceleration(axis, f1, f2) {

 // Get the accelleratino setting used for axis
 var accel = storedAccel[axis];

 // For caculations we always assume it accelerating
 var f1s = (f1 < f2 ? f1:f2);
 var f2s = (f1 < f2 ? f2:f1);

 // Calculate the time to change velocity (using feed rates in mm/s)
 var time = (f2s - f1s) / accel;

 // Calculate distance in mm
 var distance = (f1s * time) + (0.5 * accel * time * time);
 
 return [distance, time];
}


settings.on('updated', function() {
  calcFeedRates();
});


const calculations = {

  X: AXIS_X,
  Y: AXIS_Y,
  Z: AXIS_Z,
  INTERVAL: LATENCY * 1000,
  
  feedRates: {X: [], Y: [], Z: []},
  
  
  shuttleDistance: function(axis, sCurrent, sTarget) {
    // Get the start and target feed rates based on the shuttle settings and convert to mm/sec
    var f1 = calculations.feedRates[axis][sCurrent] / 60;
    var f2 = calculations.feedRates[axis][sTarget] / 60;
    var distance = 0
    var time = 0;

    // If we are starting from 0, this must be the start of a shuttle, so we need to add enough extra
    // time (and distance) to comenstae for the planner wanting to start its deccelaration phase.
    // This means we can maintain our feed rate whilst jogging
    
    if (sCurrent == 0) {
     var [d,t] =  distanceForAcceleration(axis, f2, 0);
     distance += d;
    
     // A little extra to comensate for possible delays in pendant code execution
     distance += f2 * STOPPING_BONUS;
    }

    // (de)acceleration distance
    if (f1 != f2) {
      var [d,t] = distanceForAcceleration(axis, f1, f2);
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

    return distance;
   }
 }

// Set up the default feed rates
calcFeedRates();

module.exports = calculations;
