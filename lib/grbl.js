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

const Settings = require('./settings');
const State = require('./state');
const logger = require('./logger');
const get = require('lodash/get');
const pEvent = require('p-event');

const Grbl = class Grbl   {

  constructor() {
    this.settings = new Settings();
    this.state = new State();
    this._socket = null;
    this._options = {};
    this._needsReset = false;
    this._needsHoming = false;
    this._homing = false;
  }


  set options(options) {
    this._options = options;
  }


  set socket(socket) {
    
    if (socket) {
      this._socket = socket;

      this._socket.on('controller:settings', (controller, grblSettings) => {
        logger.log(logger.level.DEBUG, JSON.stringify(grblSettings), 'grbl', 'controller->settings');
        this.settings.settings = grblSettings;
      });


      this._socket.on('controller:state', (controller, grblState) => {
        logger.log(logger.level.DEBUG, JSON.stringify(grblState), 'grbl', 'controller->state');
    
        // Work out if the machine has been homed
        if (get(grblState, 'status.activeState') === '') {
          this._needsReset = true;
        } else if (this._needsReset) {
          this._needsReset = false;
          if (this.settings.homingEnabled && get(grblState, 'status.activeState') === 'Alarm') {
            this._needsHoming = true;
          }
        }
    
        if (this._needsHoming && !this._homing) {
          if (get(grblState, 'status.activeState') === 'Idle') {
            this._needsHoming = false;
          } else {
            grblState.status.activeState = 'Alarm:Home';
          }
        }
    
    
        // If we are homing, hide the Idle / Alarm sate that often comes from CNCJS at the start of Homing
        // and look for the Home state that come at the end of Homing just before the next Idle
        if (this._homing) {
          if (get(grblState, 'status.activeState') === 'Home') {
            this._homing = false;
          } else if (get(grblState, 'status.activeState') === 'Idle' || get(grblState, 'status.activeState') === 'Alarm') {
            grblState.status.activeState = 'Home';
          } else {
            this._homing = false;
          }
        }

        this.state.state = grblState;
      });


      // CNCJS hides the Home state from pendants during Homeing, and only shows it after homing
      // is done and then instantly repalces it with Idle. So we this detects when it starts.
      this._socket.on('serialport:write', (data) => {
        if (data.trim() === '$H') {
          this._homing = true;
          
          var grblState = this.state.state;
          grblState.status.activeState = 'Home';
          this.state.state = grblState;
        }
      });

     this._socket.on('serialport:close', () => {
       this._needsReset = true;
       var grblState = this.state.state;
       grblState.status.activeState = '';
       this.state.state = grblState;
     });

    }
  }

  
  gcode(code) {
    // Make sure we have a connection
    if(!this._socket || !this._options.port) {
      return;
    }

    this._socket.emit('command', this._options.port, 'gcode', code);
  }


  feedhold() {
    // Make sure we have a connection
    if(!this._socket || !this._options.port) {
      return;
    }

    this._socket.emit('command', this._options.port, 'feedhold');
  }


  reset() {
    // Make sure we have a connection
    if(!this._socket || !this._options.port) {
      return;
    }

    this._socket.emit('command', this._options.port, 'reset');
  }


  async waitForActiveState(activeState) {
    while (activeState !== this.state.activeState) {
      await pEvent(this.state, 'activeStateChanged');
    }
  }

  
  async wait() {

    // WAit for run state (as typically wait will get called before we even see Run state)
    await this.waitForActiveState('Run');
    
    // Wait for Idle state
    await this.waitForActiveState('Idle');

    // Make sure the planner is empty
    while (this.state.planner < 15) {
      await pEvent(this.state, 'statusChanged');
    }

    // Send a Dwell
    this.gcode(`G4 P0.5`);
    
    // Wait for OK
    await this._waitForOK();
  }


  jog(axis, distance, feed) {
    logger.log(logger.level.DEBUG, `${axis}, ${distance}, ${feed}`, 'grbl', 'jog');

    // If distacnce is 0, then issue a jogCancel
    if(distance == 0) {
      this.jogCancel()
    } else {
      this.gcode(`$J=G91 G21 ${axis}${distance.toFixed(3)} F${feed}`);
    }
  }


  jogCancel() {
    // Make sure we have a connection
    if(!this._socket || !this._options.port) {
      return;
    }

    logger.log(logger.level.DEBUG, '', 'grbl', 'jogCancel');
    this._socket.emit('command', this._options.port, 'jogCancel');
  }


  async _waitForOK() {
    var result = await pEvent(this._socket, 'serialport:read');

    while(result.trim() !== 'ok') {
      result = await pEvent(this._socket, 'serialport:read');
    }
  }

}


module.exports = new Grbl();
