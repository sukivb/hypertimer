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
        myLog('Slave2: Error:', err);
    });

    timer.on('config', function (config) {
        myLog('Slave2: Config changed:', JSON.stringify(config));
    });

    timer.once('config', function (config) {
        timer.setTimeout(doStuff,0);
    });

    // initially, the system time is returned as we're not yet connected to the master
    myLog('Slave2: start', timer.getTime().toISOString());


    var doStuff = function () {

        /**
         * Get the current temperature in a specific place
         * Whether data is retrieved from http://openweathermap.org/
         * @param {String} where        For example 'rotterdam,nl'
         * @param {function} callback   Called as callback(err, temp)
         */
        function getTemperatureIn(where, callback) {
            setTimeout(function (){callback(null,(where =='rotterdam,nl') ? 12 : 24)},(where =='rotterdam,nl') ? 500 : 1000);
        }

// create an asynchronous timeout, having a callback parameter done
        timer.setTimeout(function (done) {
            myLog('Slave2: Timeout A');

            // perform an asynchronous action inside the timeout
            getTemperatureIn('maastricht,nl', function (err, temp) {
                if (err)
                    myLog('Slave2: got response from API: '+err);
                else
                    myLog('Slave2: The temperature in Maastricht is ' + temp + ' celsius');

                // create another timeout inside the asynchronous timeout
                timer.setTimeout(function () {
                    myLog('Slave2: Timeout C');
                    timer.setTimeout(function () {
                        myLog('Slave2: Timeout E (should be only slave2 after D)');
                        timer.setTimeout(function () {
                            myLog('Slave2: Timeout F (should be only slave2 after E)');
                            timer.destroy();
                        }, 40000,"->F.2<-");
                    }, 40000,"->E.2<-");
                }, 10000,"->C.2<-");

                // once we are done with our asynchronous event, call done()
                // so the hypertimer knows he can continue with a next event.
                done();
            });
        }, 10000,"->A.2<-");

// schedule two other events, where Timeout B occurs just after
// Timeout A, and Timeout D occurs just after Timeout C.
        timer.setTimeout(function () {
            myLog('Slave2: Timeout B (should be after temp info)');

            timer.setTimeout(function () {
                myLog('Slave2: Timeout D');
            }, 10000,"->D.2<-");
        }, 15000,"->B.2<-");
    };
})();