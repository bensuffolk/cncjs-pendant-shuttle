# cncjs-pendant-shuttle
A cncjs pendant to connect a Contour Design ShuttleXpress to the raspberry pi that is running cncjs.

Optionally if a 20 character x 4 line LCD is connected via the i2c bus then it will be used.

**This pendant uses grbl 1.1 jogging commands and so will only work with grbl controlled machines**

## To Do
Basica functionality exists and works, but this file needs writing to document things properly and other things to do include:

* Document how to make the pendant auto start
* Re-mappable buttons.
* Z Axis Probe
* Per Axis direction reverse configuration
* Configurable step distances

## Installation Prerequisite

You need to be running cncjs with the [cancelJog PR #512](https://github.com/cncjs/cncjs/pull/512) applied. This PR has not yet been merged, so in the mean time you can find a version of cncjs with this PR merged (and no other changes) at [https://github.com/bensuffolk/cncjs](https://github.com/bensuffolk/cncjs)

To upgrade make sure you have git installed 

```
sudo apt install git
```
Then download and build the modified version

```
git clone https://github.com/bensuffolk/cncjs
cd cncjs
npm install
```

Remove the current version and install the new one (make sure you are still in the cncjs directory from above)

```
sudo npm uninstall -g cncjs
sudo npm install -g --unsafe-perm
```

By default, the udev system adds ShuttleXpress as root only access. To fix this, you need to copy 99-Shuttle.rules to /etc/udev/rules.d and reboot

```
sudo cp 99-Shuttle.rules /etc/udev/rules.d
```
Now reboot and move onto the Installation of the pendant

```
sudo reboot
```

## Installation

```
npm install
```

## Usage

```
bin/cncjs-pendant-shuttle -p port
```

If you have installed cncjs via the [cncjs/cncjs-pi-raspbian](https://github.com/cncjs/cncjs-pi-raspbian) script then you will need

```
bin/cncjs-pendant-shuttle -p port -c ~/.cncjs/cncrc.cfg
```

### Command line options:

`-p` `--port` *port* **REQUIRED** The serial port on the cncjs server that is connected to Grbl. e.g. */dev/ttyS0*

`-s` `--secret` *secret* The cncjs authentication secret. Defaults to reading from the rc file

`-c` `--config` *rc file* The cncjs server rc file. Defaults to  *~./cncrc* 

`-b` `--baudrate` *baudrate* The baudrate of the connection to Grbl. Defaults to *115200*

`-v` `--verbose` Increase the ammount of loging. Can be specified multiple times, e.g. `-vvv`

`--socket-address` *address* The socket address of the cncjs server. Defaults to *localhost*

`--socket-port` *port* The socket port of the cncjs server. Defaults to *8000*

`--access-token-lifetime` *lifetime* The lenght of time the authentication token will last. Defaults to *30d*

`--i2c-bus` *bus* The i2c bus that the LCD is connected to. Defaults to *1*

`--lcd-address` *address* The i2c address of the LCD. Defaults to *0x27*



### Operation:


`Button 1` Currently does nothing, but will be used for Z Probing

`Button 2` Set X Axis (Default)

`Button 3` Set Y Axis

`Button 4` Set Z Axis

`Button 5` Change Step Distance `0.01` `0.1` `1`

Press an Axis button to change which Axis will be the target of the jog. If you press and hold an Axis button for 1 second it will zero the work coordinates to the current position. e.g. `G10 L20 P1 X0` for the X Axis

Turn the center jog dial and each increment will step the selected axis by the selected step distance.

Twist the outer shuttle ring the selected axis will continue to move in the twisted directino until released. Twising the ring further will increase the speed of movement.

The shuttle speed is automatically calculated based on the maximum feed rate and acceleration for the selected axis. If you have a machine with slow acceleration rate, then the shuttle will be naturally slower (in order to make sure the shuttle does not run on due to deceleration time)