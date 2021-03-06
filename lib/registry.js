var _ = require('underscore');

exports.configure = function (options, callback) {
    switch (options.config.registry.type) {
        case 'amqp': {
            exports.__registry = require('./registry/amqp');
        } break;
        case 'redis': {
            exports.__registry = require('./registry/redis');
        } break;
        default: case 'local': {
            exports.__registry = require('./registry/local');
        } break;
    }
    exports.__registry.create(options, callback);
};

exports.getRegistry = function () {
    if (_.isUndefined(exports.__registry)) {
        throw "Registry not initialized";
    }
    return exports.__registry;
}
