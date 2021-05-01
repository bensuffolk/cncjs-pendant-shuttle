# cncjs-pendant-shuttle
A cncjs pendant to connect a Contour Design ShuttleXpress to the raspberry pi that is running cncjs.

Optionally if a 20 character x 4 line LCD is connected via the i2c bus then it will be used.

**This pendant uses grbl 1.1 jogging commands and so will only work with grbl controlled machines**

## Installation Prerequisite

You need to be running cncjs with the [cancelJog PR #512](https://github.com/cncjs/cncjs/pull/512) applied. This PR has not yet been merged, so in the mean time you can find a version of cncjs with this PR merged (and no other changes) at [https://github.com/bensuffolk/cncjs](https://github.com/bensuffolk/cncjs)

To upgrade make sure you have git installed 

```shell
sudo apt install git
```
Then download and build the modified version

```shell
git clone https://github.com/bensuffolk/cncjs
cd cncjs
npm install
```

Remove the current version and install the new one (make sure you are still in the cncjs directory from above)

```shell
sudo npm uninstall -g cncjs
sudo npm install -g --unsafe-perm
```

## Installation


```shell
git clone https://github.com/bensuffolk/cncjs-pendant-shuttle
cd cncjs-pendant-shuttle
```

We need to have udev development libraries / headers installed to build the node package.

```shell
sudo apt install libudev-dev
```

By default, the udev system adds ShuttleXpress as root only access. To fix this, you need to copy 99-Shuttle.rules to /etc/udev/rules.d and reboot

```shell
sudo cp 99-Shuttle.rules /etc/udev/rules.d
```

Now reboot and move onto the Installation of the pendant

```shell
sudo reboot
```
Pendant Install

```
cd cncjs-pendant-shuttle
npm install
sudo npm install -g --unsafe-perm
```

## Auto run on boot

Edit the cncjs-pendant-shuttle.service file to set the command line options you require.

```shell
sudo cp cncjs-pendant-shuttle.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable cncjs-pendant-shuttle
sudo systemctl start cncjs-pendant-shuttle
```

## Usage

```shell
bin/cncjs-pendant-shuttle -p port
```

If you have installed cncjs via the [cncjs/cncjs-pi-raspbian](https://github.com/cncjs/cncjs-pi-raspbian) script then you will need

```shell
bin/cncjs-pendant-shuttle -p port -c ~/.cncjs/cncrc.cfg
```

### Command line options

`-p` `--port` *port* **REQUIRED** The serial port on the cncjs server that is connected to Grbl. e.g. */dev/ttyS0*

`-s` `--secret` *secret* The cncjs authentication secret. Defaults to reading from the rc file

`-c` `--config` *rc file* The cncjs server rc file. Defaults to  *~./cncrc* 

`-b` `--baudrate` *baudrate* The baudrate of the connection to Grbl. Defaults to *115200*

`-v` `--verbose` Increase the ammount of loging. Can be specified multiple times, e.g. `-vvv`

`--socket-address` *address* The socket address of the cncjs server. Defaults to *localhost*

`--socket-port` *port* The socket port of the cncjs server. Defaults to *8000*

`--access-token-lifetime` *lifetime* The lenght of time the authentication token will last. Defaults to *30d*

`--no-lcd` Do not attempt to conect to an LCD

`--i2c-bus` *bus* The i2c bus that the LCD is connected to. Defaults to *1*

`--lcd-address` *address* The i2c address of the LCD. Defaults to *0x27*

`--step-distance` *distance* ... Set the Step distances to toggle between when pressing the *Change Step Distance* button. Defaults to *0.01 0.1 1*

`--reverse-x` Reverse the X axis jog direction.

`--reverse-y` Reverse the Y axis jog direction.

`--reverse-z` Reverse the Z axis jog direction.

`--button-x` *button* The button number for X. Defaults to 2

`--button-y` *button* The button number for Y. Defaults to 3

`--button-z` *button* The button number for Z. Defaults to 4

`--button-step` *button* The button number for Step. Defaults to 4

`--plate-height` *height* The height of the proble plate. Defaults to 20

`--probe-feedrate` *feedrate* The feedrate to use for probing. Defaults to 75


### Jogging


`Axis X button` Set X Axis (Default Axis on connection). See `--button-x`

`Axis Y button ` Set Y Axis See `--button-y`

`Axis Z button ` Set Z Axis. See `--button-z`

`Button Step` Change Step Distance (defaults to `0.01` `0.1` `1`). See `--step-distance`

Press an Axis button to change which Axis will be the target of the jog. If you press and hold an Axis button for 1 second it will zero the work coordinates to the current position. e.g. `G10 L20 P1 X0` for the X Axis

Turn the center jog dial and each increment will step the selected axis by the selected step distance.

Twist the outer shuttle ring the selected axis will continue to move in the twisted directino until released. Twising the ring further will increase the speed of movement.

The shuttle speed is automatically calculated based on the maximum feed rate and acceleration for the selected axis. If you have a machine with slow acceleration rate, then the shuttle will be naturally slower (in order to make sure the shuttle does not run on due to deceleration time)


### Probing

Probing is initialted by holding the `Probe Button` down for 1 second.

The probing sequence will being by lowering the Z axis using the feedrate specified in `--probe-feedrate` until it makes contact with the probe p[ate.

At this point it will raise the Z axis by 1mm, and being probing again at a lower rate of 20mm / Min.

Once it makes contact with the probe plate a second time it will zero out the Z axis work coordinates using the `--plate-height` which defaults to 20mm.

It will then return the Z axis to the position it was in before probing began.

If during probing you realise you have made a mistake, e.g. you forgot to attache the probe wire or put the plate in the right place, you can press the `Probe Button` again and probing will be immediatly stopped and the Z axis returned to the position it was in before probing began.