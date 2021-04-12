# cncjs-pendant-shuttle
A cncjs pendant to connect a Contour Design ShuttleXpress to the raspberry pi that is running cncjs.

Optionally if a 20 character x 4 line LCD is connected via the i2c bus then it will be used.

**This pendant uses grbl 1.1 jogging commands and so will only work with grbl controlled machines**

## To Do
Basica functionality exists and works, but this file needs writing to document things properly, and so at this stage I suggest this pendant is **only used by people who know how to install software and upgrade software on linux.**

Other things to do include:

* Command line option to change LCD address and bus.
* Re-mappable buttons.
* Z Axis Probe
* Per Axis direction reverse configuration
* Configurable step distances

## Installation

**Prerequisite**

You need to be running cncjs with the [cancelJog PR #512](https://github.com/cncjs/cncjs/pull/512) applied. This PR has not yet been merged, so in the mean time you can find a version of cncjs with this PR merged (and not other changes) at [https://github.com/bensuffolk/cncjs](https://github.com/bensuffolk/cncjs)

Future documentation will provide details about how to upgrade an existing cncjs, for the moment this pendant is only recommended for people who know how to do this.

By default, the udev system adds ShuttleXpress as root only access. To fix this, you need to copy 99-Shuttle.rules to /etc/udev/rules.d and reboot

```
sudo cp 99-Shuttle.rules /etc/udev/rules.d
sudo reboot
```

Install pendant

```
npm install
```

## Usage

Bare minimum usage, where `port` should be substituted with the actual port in use by Grbl, e.g. /dev/ttyAMA0

```
bin/cncjs-pendant-shuttle -p port
```

The secret will be read from the default server rc file which is normally `~/.cncrc` but if you have installed cncjs via the  [cncjs/cncjs-pi-raspbian](https://github.com/cncjs/cncjs-pi-raspbian) script then you will need to specify it with `-c ~/.cncjs/cncrc.cfg`

`Button 1` Currently does nothing, but will be used for Z Probing

`Button 2` Set X Axis (Default)

`Button 3` Set Y Axis

`Button 4` Set Z Axis

`Button 5` Change Step Distance `0.01` `0.1` `1`

Press an Axis button to change which Axis will be the target of the jog. If you press and hold an Axis button for 1 second it will zero the work coordinates to the current position. e.g. `G10 L20 P1 X0` for the X Axis

Turn the center jog dial and each increment will step the selected axis by the selected step distance.

Twist the outer shuttle ring the selected axis will continue to move in the twisted directino until released. Twising the ring further will increase the speed of movement.

The shuttle speed is automatically calculated based on the maximum feed rate and acceleration for the selected axis. If you have a machine with slow acceleration rate, then the shuttle will be naturally slower (in order to make sure the shuttle does not run on due to deceleration time)