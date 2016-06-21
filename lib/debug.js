var Debug = typeof window !== 'undefined' ? window.Debug : require('debug');

module.exports = Debug || function () {
  // empty stub when in the browser
      var moduleName = arguments[0];
  return function () {
    var logger = (typeof log == 'undefined') ? console.log : log;
    var message = moduleName + " "+ arguments[0];
    if (typeof arguments[1] != 'undefined')
        message += " " + JSON.stringify(arguments[1]);
    logger(message);
  };
};
