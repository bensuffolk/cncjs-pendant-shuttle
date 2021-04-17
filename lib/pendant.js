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

require('socket.io-client');
const connection = require('../index');
const grbl = require('./grbl');
const lcd = require('./lcdController');
const logger = require('./logger');
const shuttle = require('shuttle-control-usb');
const Jogger = require('./jogger');

const BUTTON_X = 2;
const BUTTON_Y = 3;
const BUTTON_Z = 4;
const BUTTON_STEP = 5;
const BUTTON_TIMEOUT = 1000;

const Pendant = class Pendant   {

  constructor(options) {
    logger.options = options;
  
    this._options = options;
    this._deviceInfo = {};
    this._buttonXTimer = null;
    this._buttonYTimer = null;
    this._buttonZTimer = null;
    this._firstJog = true;

    // Set up the peripherals
    this._setupShuttle();
    
    if (options.lcd) {
      lcd.open(options);
    }
 
    this._jogger = new Jogger(options);
 
    // Start the WS connection to the server
    connection(options, (err, socket) => {
      // Log Error and exit
      if (err) {
        logger.error(JSON.stringify(err), 'pendant', 'connection');
        process.exit(1);
      }
      
      // We will be in this callback just once when the remote port to Grbl has been opened.
      // Its our opportunity to add any handlers to the webbsocket connection we might need

      // Set up the grbl object
      grbl.options = options;
      grbl.socket = socket;
      
      // If extra verbose log the serial port communications
      if (options.verbosity >= logger.level.DEBUG) {
        socket.on('serialport:read', function(data) {
          logger.log(logger.level.DEBUG, (data || '').trim(), 'Serial', 'read');
        });

        socket.on('serialport:write', function(data) {
          logger.log(logger.level.DEBUG, (data || '').trim(), 'Serial', 'write');
        });
      }
    });
  }
  
  
  _setupShuttle() {

    // Connection Handler
    shuttle.on('connected', (deviceInfo) => {
      this._deviceInfo = deviceInfo;
      logger.log(logger.level.INFO, this._deviceInfo.name, 'Pendant', 'shuttle->connected');
    });


    // Disconnection Handler
    shuttle.on('disconnected', () => {
      logger.log(logger.level.INFO, this._deviceInfo.name, 'Pendant', 'shuttle->disconnected');
    });

    
    // Butotn down Handler
    shuttle.on('buttondown', (b) => {
      if(grbl.state.activeState !== 'Idle') {
        logger.log(logger.level.DEBUG, `${this._deviceInfo.name}: ${b} whilst run mode is not Idle`, 'Pendant', 'shuttle->buttondown');
        return;
      }
      logger.log(logger.level.DEBUG, `${this._deviceInfo.name}: ${b}`, 'Pendant', 'shuttle->buttondown');

      switch (b) {
        case BUTTON_X:
          this._buttonXTimer = setTimeout(() => {this._buttonHold(b)}, BUTTON_TIMEOUT);
          break;

        case BUTTON_Y:
          this._buttonYTimer = setTimeout(() => {this._buttonHold(b)}, BUTTON_TIMEOUT);
          break;

        case BUTTON_Z:
          this._buttonZTimer = setTimeout(() => {this._buttonHold(b)}, BUTTON_TIMEOUT);
          break;

        case BUTTON_STEP:
          this._jogger.nextStep();
          break;
      }
    });


    // Butotn up Handler
    shuttle.on('buttonup', (b) => {
      if(grbl.state.activeState !== 'Idle') {
        logger.log(logger.level.DEBUG, `${this._deviceInfo.name}: ${b} whilst run mode is not Idle`, 'Pendant', 'shuttle->buttonup');
        return;
      }
      logger.log(logger.level.DEBUG, `${this._deviceInfo.name}: ${b}`, 'Pendant', 'shuttle->buttonup');

      switch (b) {
        case BUTTON_X:
          if (this._buttonXTimer) {
            clearTimeout(this._buttonXTimer);
            this._jogger.axis = 'X';
          }
          break;

        case BUTTON_Y:
          if (this._buttonYTimer) {
            clearTimeout(this._buttonYTimer);
            this._jogger.axis = 'Y';
          }
         break;

        case BUTTON_Z:
          if (this._buttonZTimer) {
            clearTimeout(this._buttonZTimer);
            this._jogger.axis = 'Z';
          }
          break;
      }

    });
    
    
    // Shuttle Handler
    shuttle.on('shuttle', (value) => {
      if(grbl.state.activeState !== 'Idle' && grbl.state.activeState !== 'Jog') {
        logger.log(logger.level.DEBUG, `${this._deviceInfo.name}: ${value} whilst run mode is not Idle / Jog`, 'Pendant', 'shuttle->shuttle');
        this._jogger.currentShuttle = 0;
        return;
      }
      logger.log(logger.level.DEBUG, `${this._deviceInfo.name}: ${value}`, 'Pendant', 'shuttle->shuttle');

      this._jogger.currentShuttle = value;
    });
  
    // Jog Direction Handler
    shuttle.on('jog-dir', (d) => {
      // Shuttle does a jog when first connected
      if (this._firstJog) {
        this._firstJog = false;
        return;
      }
    
      if(grbl.state.activeState !== 'Idle' && grbl.state.activeState !== 'Jog') {
        logger.log(logger.level.DEBUG, `${this._deviceInfo.name}: ${d} whilst run mode is not Idle / Jog`, 'Pendant', 'shuttle->jog-dir');
        return;
      }
      logger.log(logger.level.DEBUG, `${this._deviceInfo.name}: ${d}`, 'Pendant', 'shuttle->jog-dir');

      this._jogger.jog(d);
    });

    process.on('SIGINT', function() {
      if (this._deviceInfo) {
        logger.log(logger.level.INFO, `${this._deviceInfo.name}: requested to stop`, 'Pendant', 'process->SIGINT');
        shuttle.stop();
      }
    });


    // Start receiving shuttle events
    shuttle.start();
  }
  
  
  _buttonHold(b) {
    switch (b) {

      case BUTTON_X:
        buttonXTimer  = null;
      
        // Zero out work X axis
        if(grbl.state.activeState === 'Idle') {
          grbl.gcode(`G10 L20 P1 X0`);
        }
        break;

      case BUTTON_Y:
        buttonYTimer  = null;

        // Zero out work Y axis
        if(grbl.state.activeState === 'Idle') {
          grbl.gcode(`G10 L20 P1 Y0`);
        }
        break;

      case BUTTON_Z:
        buttonZTimer  = null;

        // Zero out work Z axis
        if(grbl.state.activeState === 'Idle') {
          grbl.gcode(`G10 L20 P1 Z0`);
        }
        break;
    }
  }

}


module.exports = Pendant;
