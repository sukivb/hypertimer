var assert = require('assert');
var freeport = require('freeport');
var hypertimer = require('../index');

describe('discreteSync', function () {

  it('should synchronize configuration with a master', function (done) {
    freeport(function (err, port) {
      var master = hypertimer({port: port, rate: 2, bootstrapFederateCount: 1});
      var slave = hypertimer({master: 'ws://localhost:' + port});
      slave.on('config', function (config) {
           assert.deepEqual(config, {
            paced: true,
            rate: 2,
            deterministic: true,
            time: null,
            port: null,  // should not be sent from the master
            master: 'ws://localhost:' + port,
            federateCount: config.federateCount,
             bootstrapFederateCount: 1
          });
          if (config.federateCount == 1)
           slave.destroy();
      });
      slave.on('destroy', function () {
        master.destroy();
        done();
      });
    }, 1000);
  });

  // TODO: extensively test discreteSync


  it('should run discrete events synchronized', function (done) {
    freeport(function (err, port) {
      var master = hypertimer({paced: false, port: port,  rate: 2, bootstrapFederateCount: 2});
      var slave1 = hypertimer({master: 'ws://localhost:' + port});
      slave1.on('config', function (config) {
        assert.deepEqual(config, {
          paced: false,
          rate: 2,
          deterministic: true,
          time: null,
          port: null,  // should not be sent from the master
          master: 'ws://localhost:' + port,
          federateCount:config.federateCount,
          bootstrapFederateCount: 2
        });
      });
      var slave2= hypertimer({master: 'ws://localhost:' + port});
      slave2.on('config', function (config) {
        assert.deepEqual(config, {
          paced: false,
          rate: 2,
          deterministic: true,
          time: null,
          port: null,  // should not be sent from the master
          master: 'ws://localhost:' + port,
          federateCount:config.federateCount,
          bootstrapFederateCount: 2
        });
        if (config.federateCount == 2)
          slave1.destroy();
      });

      slave1.on('destroy', function () {
        slave2.destroy();
      });

      slave2.on('destroy', function () {
        master.destroy();
        done();
      });


    }, 1000);
  });


});