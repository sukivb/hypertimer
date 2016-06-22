var hypertimer = require('../../dist/hypertimer');
var port =  8089;
var time = '2050-01-01T12:00:00';
var timer = hypertimer({
  paced:false,
  port: port,
  time: time,
  rate: 1,
  bootstrapFederateCount: 2
});

console.log('Master listening at ws://localhost:'+port);

timer.setInterval(function() {
    if (timer.getFederateCount() == 0) {
      console.log('done');
      timer.destroy();
    } else
      console.log("("+timer.now()+") master: "+timer.getTime());
}, 10000);