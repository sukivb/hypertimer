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
      if (typeof timeCount[data] == 'undefined') {
        master.broadcast('pause',data);
        timeCount[data] = 1;
      } else {
        timeCount[data] = timeCount[data] + 1;
      }
      debug('federates done: ' +  timeCount[data] + ' of ' + sanitizedConfig().federateCount);

      debug('queued time ' + new Date(time).toISOString());
      if (typeof queue[data] == 'undefined') {
        queue[data] = [callback];
      } else {
        queue[data].push(callback);
      }
      if (timeCount[data] == sanitizedConfig().federateCount) {
        for (var i = 0; i < queue[data].length; i++) {
          queue[data][i](time);
          debug('send time ' + new Date(time).toISOString());
        }
        delete queue[data];
        delete timeCount[data];
        master.broadcast('continue',data);
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
