// create a hypertimer slave, connect to a master
// all configuration and the current time will be retrieved from the master
// hypertimer
(function () {
    var timer = hypertimer({
        master: 'ws://localhost:' + port
    });


    function myLog () {
        var args = [];
        for (var i = 0; i < arguments.length; i++) {
            var arg = arguments[i];
            args[i] = ((typeof arg === 'string') ? arg : JSON.stringify(arg)) + ' ';
        }
        log('('+timer.now()+') slave 2 :: '+args.join(' '));
    }

    timer.on('error', function (err) {
        myLog('Slave1: Error:', err);
    });

    timer.on('config', function (config) {
        myLog('Slave1: Config changed:', JSON.stringify(config));
    });

    timer.once('config', function (config) {
        timer.setTimeout(doStuff,0);
    });

// initially, the system time is returned as we're not yet connected to the master
    myLog('Slave1: start', timer.getTime().toISOString());

    var doStuff = function () {

        /**
         * Get the current temperature in a specific place
         * Whether data is retrieved from http://openweathermap.org/
         * @param {String} where        For example 'rotterdam,nl'
         * @param {function} callback   Called as callback(err, temp)
         */
        function getTemperatureIn(where, callback) {
           setTimeout(function (){callback(null,(where =='rotterdam,nl') ? 12 : 24)},1000);
        }

// create an asynchronous timeout, having a callback parameter done
        timer.setTimeout(function (done) {
            myLog('Slave1: Timeout A');

            // perform an asynchronous action inside the timeout
            getTemperatureIn('rotterdam,nl', function (err, temp) {
                if (err)
                    myLog('Slave1: got response from API: '+err);
                else
                    myLog('Slave1: The temperature in Rotterdam is ' + temp + ' celsius');

                // create another timeout inside the asynchronous timeout
                timer.setTimeout(function () {
                    myLog('Slave1: Timeout C');
                }, 10000,"->C.1<-");

                // once we are done with our asynchronous event, call done()
                // so the hypertimer knows he can continue with a next event.
                done();
            });
        }, 10000,"->A.1<-");

// schedule two other events, where Timeout B occurs just after
// Timeout A, and Timeout D occurs just after Timeout C.
        timer.setTimeout(function () {
            myLog('Slave1: Timeout B (should be after temp info)');

            timer.setTimeout(function () {
                myLog('Slave1: Timeout D');
                timer.setTimeout(function () {
                    myLog('Slave1: Timeout G (should be only slave1 after F)');
                    timer.destroy();
                }, 90000,"->G.1<-");
            }, 10000,"->D.1<-");
        }, 15000,"->B.1<-");
    };
})();