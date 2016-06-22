var emitter = require('event-emitter');
var hasListeners = require('event-emitter/has-listeners');
var createMaster = require('./synchronization/master').createMaster;
var createSlave = require('./synchronization/slave').createSlave;
var util = require('./util');
var debug = require('./debug')('hypertimer:root');

// enum for type of timeout
var TYPE = {
  TIMEOUT: 0,
  INTERVAL: 1,
  TRIGGER: 2
};

/**
 * Create a new hypertimer
 * @param {Object} [options]  The following options are available:
 *                            deterministic: boolean
 *                                        If true (default), simultaneous events
 *                                        are executed in a deterministic order.
 *                            paced: boolean
 *                                        Mode for pacing of time. When paced,
 *                                        the time proceeds at a continuous,
 *                                        configurable rate, useful for
 *                                        animation purposes. When unpaced, the
 *                                        time jumps immediately from scheduled
 *                                        event to the next scheduled event.
 *                            rate: number
 *                                        The rate of progress of time with
 *                                        respect to real-time. Rate must be a
 *                                        positive number, and is 1 by default.
 *                                        For example when 2, the time of the
 *                                        hypertimer runs twice as fast as
 *                                        real-time.
 *                                        Only applicable when option paced=true.
 *                            time: number | Date | String
 *                                        Set a simulation time. If not provided,
 *                                        The timer is instantiated with the
 *                                        current system time.
 */
function hypertimer(options) {
  debug("A timer is instantiated with options: "+JSON.stringify(options));
  // options
  var paced = true;
  var rate = 1;             // number of milliseconds per milliseconds
  var deterministic = true; // run simultaneous events in a deterministic order
  var configuredTime = null;// only used for returning the configured time on .config()
  var master = null;        // url of master, will run as slave
  var port = null;          // port to serve as master
  var federateCount = 0;    // number of timers registered to master
  var bootstrapFederateCount = 0; // number of timers that have to be registered to the master to start the timer.
  // properties
  var running = false;              // true when running
  var startTime = null;             // timestamp. the moment in real-time when hyperTime was set
  var hyperTime = util.systemNow(); // timestamp. the start time in hyper-time
  var timeouts = [];                // array with all running timeouts
  var current = {};                 // the timeouts currently in progress (callback is being executed)
  var timeoutId = null;             // currently running timer
  var idSeq = 0;                    // counter for unique timeout id's
  var server = null;
  var client = null;

  // exported timer object with public functions and variables
  // add event-emitter mixin
  var timer = emitter({});

  /**
   * Change configuration options of the hypertimer, or retrieve current
   * configuration.
   * @param {Object} [options]  The following options are available:
   *                            deterministic: boolean
   *                                        If true (default), simultaneous events
   *                                        are executed in a deterministic order.
   *                            paced: boolean
   *                                        Mode for pacing of time. When paced,
   *                                        the time proceeds at a continuous,
   *                                        configurable rate, useful for
   *                                        animation purposes. When unpaced, the
   *                                        time jumps immediately from scheduled
   *                                        event to the next scheduled event.
   *                            rate: number
   *                                        The rate of progress of time with
   *                                        respect to real-time. Rate must be a
   *                                        positive number, and is 1 by default.
   *                                        For example when 2, the time of the
   *                                        hypertimer runs twice as fast as
   *                                        real-time.
   *                                        Only applicable when option paced=true.
   *                            time: number | Date | String
   *                                        Set a simulation time.
   * @return {Object} Returns the applied configuration
   */
  timer.config = function(options) {
    if (options) {
      _validateConfig(options);
      _setConfig(options);
    }

    // return a copy of the configuration options
    return _getConfig();
  };

  /**
   * Returns the current time of the timer as a number.
   * See also getTime().
   * @return {number} The time
   */
  timer.now = function () {
    if (paced) {
      if (running) {
        // TODO: implement performance.now() / process.hrtime(time) for high precision calculation of time interval
        var realInterval = util.systemNow() - startTime;
        var hyperInterval = realInterval * rate;
        return hyperTime + hyperInterval;
      }
      else {
        return hyperTime;
      }
    }
    else {
      return hyperTime;
    }
  };

  /**
   * Continue the timer.
   */
  timer['continue'] = function() {
    startTime = util.systemNow();
    debug('continued at: '+timer.getTime());
    timer.emit('continue', timer.getTime());
    running = true;

    // reschedule running timeouts
    _schedule();
  };

  /**
   * Pause the timer. The timer can be continued again with `continue()`
   */
  timer.pause = function() {
    hyperTime = timer.now();
    debug('paused at: '+timer.getTime());
    timer.emit('pause', timer.getTime());
    startTime = null;
    running = false;

    // reschedule running timeouts (pauses them)
    _schedule();
  };

  /**
   * Returns the current time of the timer as Date.
   * See also now().
   * @return {Date} The time
   */
  timer.getTime = function() {
    return new Date(timer.now());
  };

  /**
   * Get the value of the hypertimer. This function returns the result of getTime().
   * @return {Date} current time
   */
  timer.valueOf = timer.getTime;

  /**
   * Return a string representation of the current hyper-time.
   * @returns {string} String representation
   */
  timer.toString = function () {
    return timer.getTime().toString();
  };

  /**
   * Set a timeout, which is triggered when the timeout occurs in hyper-time.
   * See also setTrigger.
   * @param {Function} callback   Function executed when delay is exceeded.
   * @param {number} delay        The delay in milliseconds. When the delay is
   *                              smaller or equal to zero, the callback is
   *                              triggered immediately.
   * @return {number} Returns a timeoutId which can be used to cancel the
   *                  timeout using clearTimeout().
   */
  timer.setTimeout = function(callback, delay) {
    var id = idSeq++;
    var timestamp = timer.now() + delay;
    if (isNaN(timestamp)) {
      throw new TypeError('delay must be a number');
    }

    // add a new timeout to the queue
    _queueTimeout({
      id: id,
      type: TYPE.TIMEOUT,
      time: timestamp,
      callback: callback
    });

    // reschedule the timeouts
    _schedule();

    return id;
  };

  /**
   * Set a trigger, which is triggered when the timeout occurs in hyper-time.
   * See also getTimeout.
   * @param {Function} callback   Function executed when timeout occurs.
   * @param {Date | number | string } time
   *                              An absolute moment in time (Date) when the
   *                              callback will be triggered. When the date is
   *                              a Date in the past, the callback is triggered
   *                              immediately.
   * @return {number} Returns a triggerId which can be used to cancel the
   *                  trigger using clearTrigger().
   */
  timer.setTrigger = function (callback, time) {
    var id = idSeq++;
    var timestamp = toTimestamp(time);

    // add a new timeout to the queue
    _queueTimeout({
      id: id,
      type: TYPE.TRIGGER,
      time: timestamp,
      callback: callback
    });

    // reschedule the timeouts
    _schedule();

    return id;
  };


  /**
   * Trigger a callback every interval. Optionally, a start date can be provided
   * to specify the first time the callback must be triggered.
   * See also setTimeout and setTrigger.
   * @param {Function} callback         Function executed when delay is exceeded.
   * @param {number} interval           Interval in milliseconds. When interval
   *                                    is smaller than zero or is infinity, the
   *                                    interval will be set to zero and triggered
   *                                    with a maximum rate.
   * @param {Date | number | string} [firstTime]
   *                                    An absolute moment in time (Date) when the
   *                                    callback will be triggered the first time.
   *                                    By default, firstTime = now() + interval.
   * @return {number} Returns a intervalId which can be used to cancel the
   *                  trigger using clearInterval().
   */
  timer.setInterval = function(callback, interval, firstTime) {
    var id = idSeq++;

    var _interval = Number(interval);
    if (isNaN(_interval)) {
      throw new TypeError('interval must be a number');
    }
    if (_interval < 0 || !isFinite(_interval)) {
      _interval = 0;
    }

    var _firstTime = (firstTime != undefined) ?
        toTimestamp(firstTime) :
        null;

    var now = timer.now();
    var _time = (_firstTime != null) ? _firstTime : (now + _interval);

    var timeout = {
      id: id,
      type: TYPE.INTERVAL,
      interval: _interval,
      time: _time,
      firstTime: _firstTime != null ? _firstTime : _time,
      occurrence: 0,
      callback: callback
    };

    if (_time < now) {
      // update schedule when in the past
      _rescheduleInterval(timeout, now);
    }

    // add a new timeout to the queue
    _queueTimeout(timeout);

    // reschedule the timeouts
    _schedule();

    return id;
  };

  /**
   * Cancel a timeout
   * @param {number} timeoutId   The id of a timeout
   */
  timer.clearTimeout = function(timeoutId) {
    // test whether timeout is currently being executed
    if (current[timeoutId]) {
      delete current[timeoutId];
      return;
    }

    // find the timeout in the queue
    for (var i = 0; i < timeouts.length; i++) {
      if (timeouts[i].id === timeoutId) {
        // remove this timeout from the queue
        timeouts.splice(i, 1);

        // reschedule timeouts
        _schedule();
        break;
      }
    }
  };

  /**
   * Cancel a trigger
   * @param {number} triggerId   The id of a trigger
   */
  timer.clearTrigger = timer.clearTimeout;

  timer.clearInterval = timer.clearTimeout;

  /**
   * Returns a list with the id's of all timeouts
   * @returns {number[]} Timeout id's
   */
  timer.list = function () {
    return timeouts.map(function (timeout) {
      return timeout.id;
    });
  };

  /**
   * Clear all timeouts
   */
  timer.clear = function () {
    // empty the queue
    current = {};
    timeouts = [];

    // reschedule
    _schedule();
  };

  /**
   * Destroy the timer. This will clear all timeouts, and close connections
   * to a master or to slave timers.
   */
  timer.destroy = function () {
    timer.emit('beforeDestroy');
    timer.clear();
    if (client) client.destroy();
    if (server) server.destroy();
    timer.emit('destroy');
  };

  /**
   * Get the current configuration
   * @returns {{paced: boolean, rate: number, deterministic: boolean, time: *, master: *}}
   *                Returns a copy of the current configuration
   * @private
   */
  function _getConfig () {
    return {
      paced: paced,
      rate: rate,
      deterministic: deterministic,
      time: configuredTime,
      master: master,
      port: port,
      federateCount: federateCount,
      bootstrapFederateCount: bootstrapFederateCount
    }
  }

  /**
   * Validate configuration, depending on the current mode: slave or normal
   * @param {Object} options
   * @private
   */
  function _validateConfig (options) {
    // validate writable options
    if (client || options.master) {
      // when we are a slave, we can't adjust the config, except for
      // changing the master url or becoming a master itself (port configured)
      for (var prop in options) {
        if (prop !== 'master' && prop !== 'slave') {
          throw new Error('Cannot apply configuration option "'  + prop +'", timer is configured as slave.');
        }
      }
    }
  }

  timer.setFederateCount = function (count) {
    federateCount = count;
  };
  /**
   * Change configuration
   * @param {{paced: boolean, rate: number, deterministic: boolean, time: *, master: *}} options
   * @private
   */
  function _setConfig(options) {
    if ('deterministic' in options) {
      deterministic = options.deterministic ? true : false;
    }

    if ('federateCount' in options) {
      federateCount = options.federateCount;
    } else {
      federateCount = 0;
    }

    if ('paced' in options) {
      paced = options.paced ? true : false;
    }

    // important: apply time before rate
    if ('time' in options) {
      hyperTime = toTimestamp(options.time);
      startTime = util.systemNow();

      // update intervals
      _rescheduleIntervals(hyperTime);

      configuredTime = new Date(hyperTime).toISOString();
    }

    if ('rate' in options) {
      var newRate = Number(options.rate);
      if (isNaN(newRate) || newRate <= 0) {
        throw new TypeError('Invalid rate ' + JSON.stringify(options.rate) + '. Rate must be a positive number');
      }

      // important: first get the new hyperTime, then adjust the startTime
      hyperTime = timer.now();
      startTime = util.systemNow();
      rate = newRate;
    }

    if ('bootstrapFederateCount' in options) {
      bootstrapFederateCount = options['bootstrapFederateCount'];
    }


    function applyPause(time) {
      timer.pause();
    }

    function applyContinue(time) {
      timer.continue();
    }

    if ('master' in options) {
      // create a timesync slave, connect to master via a websocket
      if (client) {
        client.destroy();
        client = null;
      }




      master = options.master;
      if (options.master != null) {
        client = createSlave(options.master);

        function applyConfig(config) {
          var prev = _getConfig();
          _setConfig(config);
          var curr = _getConfig();
          timer.emit('config', curr, prev);
        }


        client.on('change', function (time)   { applyConfig({time: time}) });
        client.on('config', function (config) { applyConfig(config) });
        client.on('pause', function (time) { applyPause(time) });
        client.on('continue', function (time) {applyContinue(time) });
        client.on('error',  function (err)    { timer.emit('error', err) });
      }
    }

    // create a master
    if ('port' in options) {
      if (server) {
        server.destroy();
        server = null;
      }

      port = options.port;
      if (options.port) {
        server = createMaster(timer.now, timer.config, options.port);
        function unRegisterFederate(count) {
          debug("Removing federate "+count);
          timer.setFederateCount(count-1);
        }
        function registerFederate(count) {
          debug("Adding federate "+count);
          timer.setFederateCount(count);
        }
        server.on('federate_on', function(count){ registerFederate(count)});
        server.on('pause', function (time) { applyPause(time) });
        server.on('federate_gone', function(count){ unRegisterFederate(count)});
        server.on('continue', function (time) {applyContinue(time) });
        server.on('error', function (err) { timer.emit('error', err) });
      }
    }

    // reschedule running timeouts
    _schedule();

    if (server) {
      // broadcast changed config
      server.broadcastConfig();
    }
  }

  /**
   * Reschedule all intervals after a new time has been set.
   * @param {number} now
   * @private
   */
  function _rescheduleIntervals(now) {
    for (var i = 0; i < timeouts.length; i++) {
      var timeout = timeouts[i];
      if (timeout.type === TYPE.INTERVAL) {
        _rescheduleInterval(timeout, now);
      }
    }
  }

  /**
   * Reschedule the intervals after a new time has been set.
   * @param {Object} timeout
   * @param {number} now
   * @private
   */
  function _rescheduleInterval(timeout, now) {
    timeout.occurrence = Math.round((now - timeout.firstTime) / timeout.interval);
    timeout.time = timeout.firstTime + timeout.occurrence * timeout.interval;
  }

  timer.getFederateCount = function () {
    return federateCount;
  }


  timer.getBootstrapFederateCount = function () {
    return _getConfig().bootstrapFederateCount;
  }

  /**
   * Add a timeout to the queue. After the queue has been changed, the queue
   * must be rescheduled by executing _reschedule()
   * @param {{id: number, type: number, time: number, callback: Function}} timeout
   * @private
   */
  function _queueTimeout(timeout) {
    // insert the new timeout at the right place in the array, sorted by time
    if (timeouts.length > 0) {
      var i = timeouts.length - 1;
      while (i >= 0 && timeouts[i].time > timeout.time) {
        i--;
      }

      // insert the new timeout in the queue. Note that the timeout is
      // inserted *after* existing timeouts with the exact *same* time,
      // so the order in which they are executed is deterministic
      timeouts.splice(i + 1, 0, timeout);
    }
    else {
      // queue is empty, append the new timeout
      timeouts.push(timeout);
    }
  }
  /**
   * Execute a timeout
   * @param {{id: number, type: number, time: number, callback: function}} timeout
   * @param {function} [callback]
   *             The callback is executed when the timeout's callback is
   *             finished. Called without parameters
   * @private
   */
  function _execTimeout(timeout, callback) {
    // store the timeout in the queue with timeouts in progress
    // it can be cleared when a clearTimeout is executed inside the callback
    current[timeout.id] = timeout;
    function finish() {
      // in case of an interval we have to reschedule on next cycle
      // interval must not be cleared while executing the callback
      if (timeout.type === TYPE.INTERVAL && current[timeout.id]) {
        timeout.occurrence++;
        timeout.time = timeout.firstTime + timeout.occurrence * timeout.interval;
        _queueTimeout(timeout);
        //console.log('queue timeout', timer.getTime().toISOString(), new Date(timeout.time).toISOString(), timeout.occurrence) // TODO: cleanup
      }

      // remove the timeout from the queue with timeouts in progress
      delete current[timeout.id];

      callback && callback();
    }

    // execute the callback
    try {
     
      if (timeout.callback.length == 0) {
        // synchronous timeout,  like `timer.setTimeout(function () {...}, delay)`
        timeout.callback();
        finish();
      } else {
        // asynchronous timeout, like `timer.setTimeout(function (done) {...; done(); }, delay)`
        timeout.callback(finish);
      }
    } catch (err) {
      // emit or log the error
      if (hasListeners(timer, 'error')) {
        timer.emit('error', err);
      }
      else {
        console.log('Error', err);
      }

      finish();
    }
  }

  /**
   * Remove all timeouts occurring before or on the provided time from the
   * queue and return them.
   * @param {number} time    A timestamp
   * @returns {Array} returns an array containing all expired timeouts
   * @private
   */
  function _getExpiredTimeouts(time) {
    var i = 0;
    while (i < timeouts.length && ((timeouts[i].time <= time) || !isFinite(timeouts[i].time))) {
      i++;
    }
    var expired = timeouts.splice(0, i);

    if (deterministic == false) {
      // the array with expired timeouts is in deterministic order
      // shuffle them
      util.shuffle(expired);
    }

    return expired;
  }

  /**
   * Reschedule all queued timeouts
   * @private
   */
  function _schedule() {
    // do not _schedule when there are timeouts in progress
    // this can be the case with async timeouts in non-paced mode.
    // _schedule will be executed again when all async timeouts are finished.
    if (!paced && Object.keys(current).length > 0) {
      return;
    }

    var next = timeouts[0];

    // cancel timer when running
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (running && next) {
      // schedule next timeout
      var time = next.time;
      var delay = time - timer.now();
      var realDelay = paced ? delay / rate : 0;

      function onTimeout() {
        // when running in non-paced mode, update the hyperTime to
        // adjust the time of the current event
        if (!paced) {
          hyperTime = (time > hyperTime && isFinite(time)) ? time : hyperTime;
        }

        // grab all expired timeouts from the queue
        var expired = _getExpiredTimeouts(time);
        // note: expired.length can never be zero (on every change of the queue, we reschedule)

        // execute all expired timeouts
        if (paced) {
          // in paced mode, we fire all timeouts in parallel,
          // and don't await their completion (they can do async operations)
          expired.forEach(function (timeout) {
            _execTimeout(timeout);
          });

          // schedule the next round
          _schedule();
        }
        else {
          // in non-paced mode, we execute all expired timeouts serially,
          // and wait for their completion in order to guarantee deterministic
          // order of execution
          function next() {
            var timeout = expired.shift();
            if (timeout) {
              _execTimeout(timeout, next);
            }
            else {
              // schedule the next round
              _schedule();
            }
          }
          next();
        }
      }

      timeoutId = setTimeout(onTimeout, Math.round(realDelay));
      // Note: Math.round(realDelay) is to defeat a bug in node.js v0.10.30,
      //       see https://github.com/joyent/node/issues/8065
    }
  }

  /**
   * Convert a Date, number, or ISOString to a number timestamp,
   * and validate whether it's a valid Date. The number Infinity is also
   * accepted as a valid timestamp
   * @param {Date | number | string} date
   * @return {number} Returns a unix timestamp, a number
   */
  function toTimestamp(date) {
    var value =
        (typeof date === 'number') ? date :           // number
        (date instanceof Date)     ? date.valueOf() : // Date
        new Date(date).valueOf();                     // ISOString, momentjs, ...

    if (isNaN(value)) {
      throw new TypeError('Invalid date ' + JSON.stringify(date) + '. ' +
          'Date, number, or ISOString expected');
    }

    return value;
  }

  Object.defineProperty(timer, 'running', {
    get: function () {
      return running;
    }
  });

  timer.config(options);  // apply options
  if (!client && timer.getBootstrapFederateCount() == timer.getFederateCount())
    timer.continue();       // start the timer

  return timer;
}

module.exports = hypertimer;
