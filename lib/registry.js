var _ = require('underscore');

exports.configure = function (options) {
    if (options.amqp != "") {
        exports.__registry = require('./registry/amqp');
    } else {
        exports.__registry = require('./registry/local');
    }
    exports.__registry.create(options);

    return module.exports;
};

exports.getRegistry = function () {
    if (_.isUndefined(exports.__registry)) {
        throw "Registry not initialized";
    }
    return exports.__registry;
}
