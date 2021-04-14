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

const shuttle = require('shuttle-control-usb');
const get = require('lodash/get');
const calc = require('./calculations');

const BUTTON_TIMEOUT = 1000;

const BUTTON_X = 2;
const BUTTON_Y = 3;
const BUTTON_Z = 4;
const BUTTON_STEP = 5;

const JOG_FEED = 120;


var lcd = null;
var socket = null;
var options = {};
var firstJog = true;
var lastShuttle = 0;
var currentShuttle = 0;
var store = {accel: {}, deviceInfo: {}};
var jogRepeat = null;
var currentAxis = calc.X;
var currentStepIndex = 0;
var buttonXTimer = null;
var buttonYTimer = null;
var buttonZTimer = null;
var activeState = '';

function setAxis(axis) {
  currentAxis = axis;
  
  if(lcd) {
    lcd.jogAxis = currentAxis;
  }
}


function nextStep(reset = false) {
  
  if(reset == true) {
    currentStepIndex = 0;
  } else {
    currentStepIndex++;
  }
  
  if (currentStepIndex >= options.stepDistance.length) {
    currentStepIndex = 0;
  }
  
  if(lcd) {
    lcd.jogStep = options.stepDistance[currentStepIndex];
  }
}


function jog(axis, distance, feed) {

  // Make sure we have a connection
  if(!socket || !options.port) {
    return;
  }

  // If distacnce is 0, then issue a jogCancel
  if(distance == 0) {
    socket.emit('command', options.port, 'jogCancel');
  } else {
    distance = distance.toFixed(3);
    socket.emit('command', options.port, 'gcode', `$J=G91 G21 ${axis}${distance} F${feed}`);
  }
}


function doShuttle() {

  // If the shuttle is off, mark repeat as off and send a jogCancel
  if (currentShuttle == 0) {
    jogRepeat = null;
    jog(currentAxis, 0, 0);
  } else {
    var direction = (currentShuttle > 0) ? 1 : -1;
    var distance = calc.shuttleDistance(currentAxis, Math.abs(lastShuttle), Math.abs(currentShuttle));

    jog(currentAxis, distance * direction, calc.feedRates[currentAxis][Math.abs(currentShuttle)]);
    
    // Start a repeat timer for the correct repeat interval
    jogRepeat = setTimeout(doShuttle, calc.INTERVAL);
  }
  
  // Keep the shuttle settings to calculate the next feed distance
  lastShuttle = currentShuttle;
}


function buttonHold(b) {

  switch (b) {

    case BUTTON_X:
      buttonXTimer  = null;
    
      // Zero out work X axis
      if(activeState === 'Idle') {
        socket.emit('command', options.port, 'gcode', `G10 L20 P1 X0`);
      }
      break;

    case BUTTON_Y:
      buttonYTimer  = null;

      // Zero out work Y axis
      if(activeState === 'Idle') {
        socket.emit('command', options.port, 'gcode', `G10 L20 P1 Y0`);
      }
      break;

    case BUTTON_Z:
      buttonZTimer  = null;

      // Zero out work Z axis
      if(activeState === 'Idle') {
        socket.emit('command', options.port, 'gcode', `G10 L20 P1 Z0`);
      }
      break;
  }
}


function setupShuttle() {

  shuttle.on('connected', (deviceInfo) => {
    store.deviceInfo = deviceInfo;
    
    if (options.verbose >= 1) {
      console.log('Connected to ' + deviceInfo.name);
    }
  });


  shuttle.on('disconnected', () => {
    if (options.verbose >= 1) {
      console.log(`${store.deviceInfo.name}: disconnected.`);
    }
  });


  // Butotn down Handler
  shuttle.on('buttondown', (b) => {

    if(activeState !== 'Idle') {
      if (options.verbose >= 2) {
        console.log(`${store.deviceInfo.name}: button down(${b}) whilst run mode is not Idle`);
      }
      return;
    } else if (options.verbose >= 2) {
      console.log(`${store.deviceInfo.name}: button down(${b})`);
    }

    switch (b) {

      case BUTTON_X:
        buttonXTimer = setTimeout(() => {buttonHold(b)}, BUTTON_TIMEOUT);
        break;

      case BUTTON_Y:
        buttonYTimer = setTimeout(() => {buttonHold(b)}, BUTTON_TIMEOUT);
        break;

      case BUTTON_Z:
        buttonZTimer = setTimeout(() => {buttonHold(b)}, BUTTON_TIMEOUT);
        break;

      case BUTTON_STEP:
        nextStep();
        break;
    }
  });


  // Butotn up Handler
  shuttle.on('buttonup', (b) => {

    if(activeState !== 'Idle') {
      if (options.verbose >= 2) {
        console.log(`${store.deviceInfo.name}: button up(${b}) whilst run mode is not Idle`);
      }
      return;
    } else if (options.verbose >= 2) {
      console.log(`${store.deviceInfo.name}: button up(${b})`);
    }


    switch (b) {

      case BUTTON_X:
        if (buttonXTimer) {
          clearTimeout(buttonXTimer);
          setAxis(calc.X);
        }
        break;

      case BUTTON_Y:
        if (buttonYTimer) {
          clearTimeout(buttonYTimer);
          setAxis(calc.Y);
        }
       break;

      case BUTTON_Z:
        if (buttonZTimer) {
          clearTimeout(buttonZTimer);
          setAxis(calc.Z);
        }
        break;
    }

  });

  
  // Shuttle Handler
  shuttle.on('shuttle', (value) => {

    if(activeState !== 'Idle' && activeState !== 'Jog') {
      if (options.verbose >= 2) {
        console.log(`${store.deviceInfo.name}: shuttle(${value}) whilst run mode is not Idle or Jog`);
      }
      return;
    } else if (options.verbose >= 2) {
      console.log(`${store.deviceInfo.name}: shuttle(${value})`);
    }

    currentShuttle = value;

    // If we are not already shutteling, start now
    if (!jogRepeat) {
      doShuttle();
    }
  });


  // Jog Handler
  shuttle.on('jog-dir', (d) => {

    // When the shuttle connects it fires a jog event, so we need to ignore it
    if (firstJog) {
      firstJog = false;
      return;
    }

    if(activeState !== 'Idle' && activeState !== 'Jog') {
      if (options.verbose >= 2) {
        console.log(`${store.deviceInfo.name}: jog(${d}) whilst run mode is not Idle or Jog`);
      }
      return;
    } else if (options.verbose >= 2) {
      console.log(`${store.deviceInfo.name}: jog(${d})`);
    }

    jog(currentAxis, Number(options.stepDistance[currentStepIndex]) * d, JOG_FEED);
  });


  // Start receiving shuttle events
  shuttle.start();

  process.on('SIGINT', function() {
    if (options.verbose >= 2) {
      console.log(`${store.deviceInfo.name}: stopping`);
    }
    shuttle.stop();
  });

}


module.exports = function(s, o, l = null) {

  // Save some globals
  socket = s;
  options = o;
  lcd = l;

  // Set up default jog axis
  setAxis(calc.X);
  
  // Setup Steps
  nextStep(true);
  
  // Set up the shuttle handler
  setupShuttle();

  socket.on('controller:state', function(controller, state) {
    if (options.verbose >= 3) {
      console.log(state);
    }
    
    lcd.state = state;
    activeState = state.status.activeState;
  });


};
