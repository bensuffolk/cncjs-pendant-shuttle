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

const EventEmitter = require("events");
const get = require('lodash/get');
const isDeepEqual = require('deep-equal');

const State = class State  extends EventEmitter {

  constructor() {
    super();
    this._state = {};
    this._oldState = {};
  }


  set state(state) {
    this._state = state;
    
    var statusChanged = false;
    var parserStateChanged = false;
    
    // See if the active state changed
    if (get(this._oldState, 'status.activeState') !== this.activeState) {
      this.emit('activeStateChanged', this.activeState);
      statusChanged = true;
    }


    if (!isDeepEqual(get(this._oldState, 'status.mpos'), this.mpos)) {
      this.emit('mposChanged', this.mpos);
      statusChanged = true;
    }


    if (!isDeepEqual(get(this._oldState, 'status.wpos'), this.wpos)) {
      this.emit('wposChanged', this.wpos);
      statusChanged = true;
    }


    if (statusChanged || !isDeepEqual(get(this._oldState, 'status'), this.status)) {
      this.emit('statusChanged', this.status);
      statusChanged = true;
    }


    if (!isDeepEqual(get(this._oldState, 'parserstate'), this.parserState)) {
      this.emit('parserStateChanged', this.parserState);
      parserStateChanged = true;
    }


    if(statusChanged || parserStateChanged) {
      this.emit('changed');
      this._oldState = this._state;
    }
  }


  get status() { return get(this._state, 'status'); }
  get activeState() { return get(this._state, 'status.activeState'); }

  get mpos() { return get(this._state, 'status.mpos'); }
  get mposX() { return this._getNumber('status.mpos.x'); }
  get mposY() { return this._getNumber('status.mpos.y'); }
  get mposZ() { return this._getNumber('status.mpos.z'); }

  get wpos() { return get(this._state, 'status.wpos'); }
  get wposX() { return this._getNumber('status.wpos.x'); }
  get wposY() { return this._getNumber('status.wpos.y'); }
  get wposZ() { return this._getNumber('status.wpos.z'); }

  get parserState() { return get(this._state, 'parserstate'); }


  _getNumber(path) {
    return Number(get(this._state, path, 0));
  }
}

module.exports = new State();
