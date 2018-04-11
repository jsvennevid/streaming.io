const { BaseRegistry } = require('./lib/registry/base');
const { LocalRegistry } = require('./lib/registry/local');
const { RedisRegistry } = require('./lib/registry/redis');

exports.BaseRegistry = BaseRegistry;
exports.LocalRegistry = LocalRegistry;
exports.RedisRegistry = RedisRegistry;