const { Registry, Client } = require('./registry/base');
const { LocalRegistry } = require('./registry/local');
const { RedisRegistry } = require('./registry/redis');

exports.Registry = Registry;
exports.Client = Client;
exports.LocalRegistry = LocalRegistry;
exports.RedisRegistry = RedisRegistry;