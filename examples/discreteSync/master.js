var hypertimer = require('../../dist/hypertimer');
var port =  8089;
var time = '2050-01-01T12:00:00';
var timer = hypertimer({
  paced:false,
  port: port,
  time: time,
  rate: 1
});

console.log('Master listening at ws://localhost:'+port);



// set an interval. as soon as the timer is connected to the master timer,
// time and rate will jump to the masters configuration.
var interval = 1000; // milliseconds
timer.pause();
timer.setInterval(function (done) {
  console.log('Master: time', timer.getTime().toISOString());
  done();
}, interval, time);
