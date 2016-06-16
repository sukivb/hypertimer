var debug = require('../debug')('hypertimer:phaser');
module.exports = function() {
    var phase = 'schedule';
    function getPhase() {
        return phase;
    }

    function setPhase(p) {
        debug('Switched to phase: '+p)
        phase = p;
    }


    function transitPhase() {
        switch (getPhase()) {
            case "schedule" :
            {
                setPhase('call');
                break;
            }
            case "call" :
            {
                setPhase('confirm');
                break;
            }
            case "confirm" :
            {
                setPhase('schedule');
                break;
            }
        }
    }

    function broadcastPhase() {
        debug('phase: ' + master.getPhase());
    };

};