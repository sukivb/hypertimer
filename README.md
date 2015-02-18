hypertimer
==========

Hypertimer offers time control for simulations. With simulations, it's important to be able to manipulate the time. There are a number of different categories of simulations:

-   [Continuous simulation](http://en.wikipedia.org/wiki/Continuous_simulation), used for simulating any system with continuous phenomena. From Wikipedia:

    > Continuous Simulation refers to a computer model of a physical system that continuously tracks system response according to a set of equations typically involving differential equations.

-   [Discrete simulation](http://en.wikipedia.org/wiki/Continuous_simulation#Dissociation), relying upon countable phenomena. From Wikipedia:

    > Discrete simulation relies upon countable phenomena like the number of individuals in a group, the number of darts thrown, or the number of nodes in a Directed graph.
    > [...]
    > Discrete simulations may be applied to represent continuous phenomena, but the resulting simulations produce approximate results.

-   [Discrete event simulation](http://en.wikipedia.org/wiki/Discrete_event_simulation), used for event-based simulations. From Wikipedia:

    > A discrete-event simulation (DES), models the operation of a system as a discrete sequence of events in time. Each event occurs at a particular instant in time and marks a change of state in the system. Between consecutive events, no change in the system is assumed to occur; thus the simulation can directly jump in time from one event to the next.

`hypertimer` makes it possible to run in "[hypertime](http://en.wikipedia.org/wiki/Hypertime)". It can be used for *discrete simulations*, *discrete event simulations*, and *animations*. It allows to run a timer at a faster or slower pace than real-time, or run a discrete event simulation jumping from event to event.

Hypertimer offers basic functionality to control time:

- Configure rate and time on construction or via the function `config()`.
- Get simulated time using functions `getTime()` or `now()`.
- Schedule events using functions `setTimeout()`, `setInterval()`, and `setTrigger()`.

These functions are compatible with JavaScript's built-in functions `Date.now()`, `setTimeout()`, and `setInterval()`, with the difference that they can use a simulated time rather than the system time.

Hypertimer enables writing code which can be used interchangeably in simulations as well as for real-time applications. For example, a process could predict its future state by running a simulation of itself, given a current state, its own behavior, and a model of the surrounding world.

Hypertimer runs on node.js and on any modern browser (Chrome, FireFox, Opera, Safari, IE9+).


## Install

Install via npm:

    npm install hypertimer

Install via bower:

    bower install hypertimer

## Load

### node.js

```js
var hypertimer = require('hypertimer');

var timer = hypertimer({
  rate: 1,
  time: new Date(2014, 0, 1)
});
```

### browser

```html
<!doctype html>
<html>
<head>
  <script src="./dist/hypertimer.min.js"></script>
</head>
<body>
  <script>
    var timer = hypertimer({
      rate: 1,
      time: new Date(2014, 0, 1)
    });
  </script>
</body>
</html>
```

## Use

### Configuring a hypertimer

A hypertimer can run in two modes:

- Run at a continuous rate, at a faster, slower, or the same pace as real-time.
- Run discrete events, jumping from event to event.

The mode of a hypertimer can be configured via the option `rate`, which can be a positive number to run in at a continuous pace, or the string `'discrete-event'` to run discrete events.

```js
// create a hypertimer running ten times faster than real-time
var timer1 = hypertimer({rate: 10});

// retrieve the current configuration
console.log(timer1.config());  // returns an Object {rate: 10}

// create a hypertimer with the default rate (1 by default)
var timer2 = hypertimer();

// adjust the rate later on
timer2.config({rate: 1/2});

// create a hypertimer running discrete events
// (time will jump from scheduled event to scheduled event)
var timer3 = hypertimer({rate: 'discrete-event'});

// create a hypertimer running discrete events with non-deterministic behavior
var timer4 = hypertimer({rate: 'discrete-event', deterministic: false});
```

### Getting and setting time

Hypertimer offers functions to get and set time:

```js
// create a hypertimer with the initial time at 14st of February 2015
var timer = hypertimer({
  time: new Date(2015, 1, 14, 12, 0, 0)
});

// change the time to the 1st of January 2050
timer.config({time: new Date(2050, 0, 1, 12, 0, 0)});

// get the time as Date
console.log(timer.getTime());  // Returns a date, Sat Jan 01 2050 12:00:00 GMT+0100 (CET)

// get the time as timestamp
console.log(timer.now());      // Returns a number, 2524647600000
```

### Pausing the time

The time in a hypertimer can be paused. All scheduled timeouts will be paused
as well, and are automatically continued when the timer is running again.

```js
var timer = hypertimer();

// pause the timer
timer.pause();

// time stands still here...
console.log(timer.running);  // false

// continue again
timer.continue();

// time is running again
console.log(timer.running);  // true
```

### Schedule events

Hypertimer has three functions to schedule events:

- `setTimeout(callback, delay)`  
  Schedule a callback after a delay in milliseconds.
- `setTrigger(callback, time)`  
  Schedule a callback at a specific time. Time can be a Date or a number (timestamp).
- `setInterval(callback, interval [, firstTime])`  
  Schedule a callback to be triggered once every interval. `interval` is a number in milliseconds. Optionally, a `firstTime` can be provided.

On creation, the trigger time of the events is calculated from the `delay`, `interval`, and/or `firstTime`, and the event is scheduled to occur at that moment in time. When the time of the hypertimer is changed via configuration, trigger time of running timeouts will not be adjusted.

The functions `setTimeout()`, `setTrigger()`, and `setInterval()` return a timeout id, which can be used to cancel a timeout using the functions `clearTimeout()`, `clearTrigger()`, and `clearInterval()` respectively. To cancel all scheduled events at once, the function `clear()` can be called.

```js
// create a hypertimer running ten times faster than real-time,
// start the timer at 1st of January 2050
var timer = hypertimer({
  rate: 10,
  time: new Date(2050, 0, 1, 12, 0, 0)
});

console.log('start', timer.getTime());      // start Sat Jan 01 2050 12:00:00 GMT+0100 (CET)

// set a timeout after a delay
var delay = 10000; // milliseconds (hyper-time)
var id1 = timer.setTimeout(function () {
  console.log('timeout', timer.getTime());  // timeout Sat Jan 01 2050 12:00:10 GMT+0100 (CET)
}, delay);

// set a timeout at a specific time
var time = new Date(2050, 0, 1, 12, 0, 20); // time (hyper-time)
var id2 = timer.setTrigger(function () {
  console.log('trigger', timer.getTime());  // trigger Sat Jan 01 2050 12:00:20 GMT+0100 (CET)
}, time);

// set an interval
var interval = 5000; // milliseconds (hyper-time)
var firstTime = new Date(2050, 0, 1, 12, 0, 30); // optional first time (hyper-time)
var counter = 0;
var id3 = timer.setInterval(function () {
  console.log('interval', timer.getTime()); // interval, 12:00:30, 12:00:35, 12:00:40, etc ...
  
  // cancel the interval after 10 times 
  counter++;
  if (counter > 10) {
    timer.clearInterval(id3);
  }
}, interval, firstTime);
```

### Discrete event simulation

When running at a continuous rate, scheduled events are triggered at their scheduled (simulated) time. Between events, the timer is just waiting until the clock reaches the time of the next event. When the state of the system does not change between events, there is no need to wait. It is much faster to jump from event to the first next event. This is called a *discrete event simulation*.

To create a hypertimer running discrete events, configure `rate: 'discrete-event'`. Hypertimer ensures that all scheduled events are executed in a deterministic order.

In the example below, the application will immediately output 'done!' and not after a delay of 10 seconds, because the timer is running discrete events and immediately jumps to the first next event.

```js
// create a hypertimer running discrete events,
var timer = hypertimer({rate: 'discrete-event'});

var delay = 10000;
timer.setTimeout(function () {
  console.log('Timeout A');
  
  timer.setTimeout(function () {
    console.log('Timeout B');
  }, delay);
}, delay);

// Will immediately output:
//   Timeout A
//   Timeout B
```

When performing asynchronous tasks inside a timeout, one needs to create an asynchronous timeout, which calls `done()` when all asynchronous actions are finished. This is required in order to guarantee a deterministic order of execution. When non-deterministic order is desired, the configuration option `deterministic` can be set to `false`.

```js
// asynchronous timeout
timer.setTimeout(function (done) {
  // ... do something
  done(); // call done when done
}, delay);
```
An example of using an asynchronous timeout:

```js
// create a hypertimer running discrete events,
// jumping from event to the next event.
var timer = hypertimer({rate: 'discrete-event'});

// create an asynchronous timeout, having a callback parameter done
timer.setTimeout(function (done) {
  console.log('Timeout A');

  // perform an asynchronous action inside the timeout
  someAsyncAction(param, function (err, result) {
    timer.setTimeout(function () {
      console.log('Timeout B');
    }, 10000);

    // once we are done with our asynchronous event, call done()
    // so the hypertimer knows it can continue with the next event.
    done();
  });
}, 10000);

// Output:
//   Timeout A
//   (async action is executed here)
//   Timeout B
```


## API

### Construction

A hypertimer is constructed as:

```js
hypertimer([options])
```

By default, a new hypertimer runs with real-time speed and time.

Available options:

Name          | Type                          | Default | Description
------------- | ----------------------------- | ------- | -----------
deterministic | boolean                       | `true`  | If true, (default) events taking place at the same time are executed in a deterministic order: in the same order they where created. If false, they are executed in a randomized order.
rate          | number or `'discrete-event'`  | `1`     | The rate (in milliseconds per millisecond) at which the timer runs, with respect to real-time speed. Can be a positive number, or the string `'discrete-event'` to run discrete events.
time          | number or Date                | `null`  | Sets the simulation time. If not configured, a hypertimer is instantiated with the system time.

Example:

```js
var timer = hypertimer({rate: 10});
```

### Properties

-   `running`

    True when the timer is running, false when paused. See also functions `pause()` and `continue()`.

### Methods

-   **`clear()`**

    Clear all running timeouts.

-   **`clearTimeout(timeoutId: number)`**

    Cancel a timeout.

-   **`clearInterval(intervalId: number)`**

    Cancel an interval.

-   **`clearTrigger(triggerId: number)`**

    Cancel a trigger.

-   **`config([options: Object]): Object`**

    Change the configuration options of the hypertimer, and/or retrieve the current configuration. Available options:

    -   `deterministic: boolean`

        If true (default), events taking place at the same time are executed in a deterministic order: in the same order they where created. If false, they are executed in a randomized order.

    -   `rate: number | 'discrete-event'`

        The rate (in milliseconds per millisecond) at which the timer runs, with respect to real-time speed. Can be a positive number, or the string `'discrete-event'` to run discrete events. By default, rate is 1.

    -   `time: number | Date`

        Set a simulation time.


-   **`continue()`**

    Continue the timer when paused. The state of the timer can be retrieved via the property `running`. See also `pause()`.

-   **`getTime(): Date`**

    Returns the current time of the hypertimer as Date. See also `now()`.
    The time can be set using `config({time: ...})`.

-   **`list()`**

    Returns a list with the id's of all running timeouts.
  
-   **`now() : number`**

    Returns the current time of the timer as a number. See also `getTime()`.

-   **`pause()`**

    Pause the timer. The state of the timer can be retrieved via the property `running`. See also `continue()`.

-   **`setInterval(callback: Function, interval: number [, firstTime: Date | number])`**

    Trigger a callback every interval. Optionally, a start date can be provided
    to specify the first time the callback must be triggered. The function returns an intervalId which can be used to cancel the trigger using `clearInterval()`. See also `setTimeout` and `setTrigger`. Parameters:
  
    -   `callback: Function`

        Function executed when delay is exceeded.

    -   `interval: number`

        Interval in milliseconds. When interval is smaller than zero or is infinity, the interval will be set to zero and triggered with a maximum rate.

    -   `[firstTime: Date | number]`

        An optional absolute moment in time (Date) when the callback will be triggered the first time. By default, `firstTime = now() + interval`.

-   **`setTimeout(callback: Function, delay: number) : number`**

    Set a timeout, which is triggered when the timeout occurs in hyper-time. See also `setTrigger` and `setInterval`. The function returns a   timeoutId, which can be used to cancel the timeout using `clearTimeout(timeoutId)`. The parameters are:
  
    -   `callback: Function`

        Function executed when the delay is exceeded

    -   `delay: number`

        The delay in milliseconds. When the delay is smaller or equal to zero, the callback is triggered immediately.

-   **`setTrigger(callback: Function, time: Date | number) : number`**

    Set a trigger, which is triggered when the timeout occurs in hyper-time. See also `getTimeout`. The function returns a triggerId which can be used to cancel the trigger using `clearTrigger()`. The parameters are:

  -   `callback: Function`

      Function executed when delay is exceeded.
    
  -   `time: Date | number`

      An absolute moment in time (Date) when the callback will be triggered. When the date is a Date in the past, the callback is triggered immediately.
    
-   **`toString() : String`**

    Return a string representation of the current hyper-time, equal to `timer.getTime().toString()`.
  
-   **`valueOf() : Date`**

    Get the value of the hypertimer, returns the current time of the timer as Date.


## Examples

Examples can be found here:

https://github.com/enmasseio/hypertimer/tree/master/examples


## Roadmap

- Implement a scalable solution to synchronize hypertimers running in different processes.
- Use high precision timers and time functions.


## Build

To build the library from source, clone the project from github

    git clone git://github.com/enmasseio/hypertimer.git

To install all dependencies and build the library, run `npm install` in the 
root of the project.

    cd hypertimer
    npm install

Then, the project can be build running:

    npm run build

This generates the files `./dist/hypertimer.js` and `./dist/hypertimer.min.js`,
which can be used in the browser.

To automatically rebuild on changes in the source files, once can use

    npm run watch


## Test

To execute tests for the library, install the project dependencies once:

    npm install

Then, the tests can be executed:

    npm test

To test code coverage of the tests:

    npm run coverage

To see the coverage results, open the generated report in your browser:

    ./coverage/lcov-report/index.html


## License

Copyright (C) 2014-2015 Almende B.V., http://almende.com

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.



