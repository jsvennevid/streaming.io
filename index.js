const { Registry, Client } = require('./lib/registry/base');
const { LocalRegistry } = require('./lib/registry/local');
const { RedisRegistry } = require('./lib/registry/redis');

exports.Registry = Registry;
exports.Client = Client;
exports.LocalRegistry = LocalRegistry;
exports.RedisRegistry = RedisRegistry;