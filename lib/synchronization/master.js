var WebSocket = require('./WebSocket');
var emitter = require('./socket-emitter');
var debug = require('../debug')('hypertimer:master');


exports.createMaster = function (now, config, port) {
  var master = new WebSocket.Server({port: port});
  var queue = {};
  var timeCount = {};
  master.on('connection', function (ws) {
    debug('new connection');

    var _emitter = emitter(ws);
    // ping timesync messages (for the timesync module)
    _emitter.on('time', function (data, callback) {
      var time = now();
      var time_token = data;
      debug("timetoken: "+time_token);
      if (typeof timeCount[time_token] == 'undefined') {
        master.broadcast('pause',time_token);
        timeCount[time_token] = 1;
      } else {
        timeCount[time_token] = timeCount[time_token] + 1;
      }
      debug('federates done: ' +  timeCount[time_token] + ' of ' + sanitizedConfig().federateCount);

      debug('queued time ' + new Date(time).toISOString());
      if (typeof queue[time_token] == 'undefined') {
        queue[time_token] = [callback];
      } else {
        queue[time_token].push(callback);
      }
      if (timeCount[time_token] == sanitizedConfig().federateCount) {
        if (queue[time_token].length > 0) {
          for (var i = 0; i < queue[time_token].length; i++) {
          queue[time_token][i](time);
          debug('send time ' + new Date(time).toISOString());
        }
          master.broadcast('continue', time_token);
          delete queue[time_token];
          delete timeCount[time_token];
        }
      }
    });
    ws.on('close', function() {
      for (var i = 0; i < master.clients.length; i++) {
        if (master.clients[i] == ws) {
          master.clients.splice(i, 1);
          break;
        }
      }
    });


    ws.emitter = _emitter; // used by broadcast
    master.broadcastConfig();
  });


  master.broadcastConfig = function () {
    // send the masters config to the connected clients
    var conf = sanitizedConfig();
    debug('send config', conf);
    master.broadcast('config', conf);
  };

  master.broadcast = function (event, data) {
    debug('broadcast', event, data);
    master.clients.forEach(function (client) {
      client.emitter.send(event, data);
    });
    master.emit(event,data);
  };

  master.destroy = function() {
    master.close();
    debug('destroyed');
  };

  function sanitizedConfig() {
    var curr = config();
    delete curr.time;
    delete curr.master;
    delete curr.port;
    curr.federateCount = master.clients.length;
    return curr;
  }

  debug('listening at ws://localhost:' + port);

  return master;
};
