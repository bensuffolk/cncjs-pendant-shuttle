#!/usr/bin/env node

/**
 *
 * MIT License
 *
 * Copyright (c) 2021 Ben Suffolk
 *
 * Based on https://github.com/cncjs/cncjs-pendant-boilerplate by Cheton Wu
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

const fs = require('fs');
const path = require('path');
const io = require('socket.io-client');
const jwt = require('jsonwebtoken');
const get = require('lodash/get');

module.exports = function(options, callback) {

  // Use the config file specified in the path, or the default one
  const rcfile = path.resolve(options.configFile);

  // If no secret is passed on the command line, check the EVN var
  options.secret = get(options, 'secret', process.env['CNCJS_SECRET']);

  // If the secret is not specifid, try and read it from the config file
  if (!options.secret) {
    try {
      const config = JSON.parse(fs.readFileSync(rcfile, 'utf8'));
      options.secret = config.secret;
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  }

  // Port is required
  if(!options.port) {
    console.error('Error: you mst specify a Grbl port to connect to');
    process.exit(1);
  }
  
  // Build the token and url for the WebSocket
  const token = jwt.sign({ id: '', name: 'cncjs-pendant' }, options.secret, { expiresIn: options.accessTokenLifetime });
  const url = 'ws://' + options.socketAddress + ':' + options.socketPort;

  // Initiate a connection
  socket = io.connect(url, { 'query': 'token=' + token });

  // Set up some basic socket handlers
  socket.on('connect', () => {
    console.log('Connected to ' + url);

     // Open remote port to the Grbl controller. Note only Grbl is supported in this pendant
     socket.emit('open', options.port, {
       baudrate: Number(options.baudrate),
       controllerType: 'Grbl'
     });
    });


  socket.on('error', (err) => {
    if (options.verbosity) {
      console.error('Connection error.');
    }
    
    if (socket) {
      socket.destroy();
      socket = null;
    }

    callback(err);
  });


  socket.on('close', () => {
    if (options.verbosity) {
      console.log('Connection closed.');
    }
  });


  socket.on('serialport:open', function(portOptions) {
    if (options.verbosity) {
      console.log('Connected to port "' + portOptions.port + '" (Baud rate: ' + portOptions.baudrate + ')');
    }
    callback(null, socket);
  });


  socket.on('serialport:error', function(portOptions) {
    callback(new Error('Error opening serial port "' + portOptions.port + '"'));
  });
  
  
  process.on('SIGINT', function() {
    if (options.verbosity) {
      console.log('Terminating');
    }
    socket.close();
    
    setImmediate(() => {
      process.exit(1);
    });
  });

};
