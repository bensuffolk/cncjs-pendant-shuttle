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
const LCD = require('./lcd');
const jogger = require('./jogger');

module.exports = function(options) {

  // Connect to the LCD and blank it
  const lcd = new LCD(options.i2cBus, options.lcdAddress, 20, 4);

  connection(options, function(err, socket) {
  
    // Log Error and exit
    if (err) {
      console.error(err);
      process.exit(1);
    }

    // We will be in this callback from the initial server connection just once when the remote port to Grbl has been opened.
    // Its our opportunity to add any handlers to the webbsocket connection we might need

    if (options.verbosity >= 2) {
      socket.on('serialport:read', function(data) {
        console.log('> ' + (data || '').trim());
      });

      socket.on('serialport:write', function(data) {
        console.log('< ' + (data || '').trim());
      });
    }
   
    
    // Start the jogger
    jogger(socket, options, lcd);

  });
}



