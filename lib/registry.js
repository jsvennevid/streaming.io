const { RedisRegistry } = require('./registry/redis');
const { LocalRegistry } = require('./registry/local');

let __registry = undefined;

exports.configure = async function (options) {
    switch (options.config.registry.type) {
        case 'redis': {
            __registry = new RedisRegistry();
        } break;
        default: case 'local': {
            __registry = new LocalRegistry();
        } break;
    }

    return __registry.create(options);
};

exports.getRegistry = async function () {
    if (!__registry) {
        throw new Error("Registry not initialized");
    }
    return __registry;
}
