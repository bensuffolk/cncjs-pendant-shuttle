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

const Grbl = class Grbl   {

  constructor() {
    this.settings = new Settings();
    this.state = new State();
    this._socket = null;
    this._options = {};
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
}


module.exports = new Grbl();
