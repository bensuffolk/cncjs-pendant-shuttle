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

const Settings = class Setings  extends EventEmitter {

  constructor() {
    super();
    this._settings = {};
  }


  set settings(settings) {
    this._settings = settings;
    this.emit('updated');
  }
  
  
  get maxFeedX() { return this._getNumber('settings.$110'); }
  get maxFeedY() { return this._getNumber('settings.$111'); }
  get maxFeedZ() { return this._getNumber('settings.$112'); }


  get accelerationX() { return this._getNumber('settings.$120'); }
  get accelerationY() { return this._getNumber('settings.$121'); }
  get accelerationZ() { return this._getNumber('settings.$122'); }


  _getNumber(path) {
    return Number(get(this._settings, path, 0));
  }
 
 
}

module.exports = new Settings();
