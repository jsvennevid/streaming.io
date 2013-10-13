"use strict";

var redis = require('redis'),
    local = require('./local'),
    _ = require('underscore');

var Registry = function () {
}

Registry.prototype.create = function (options) {
    options = options || {};

    local.create(options);

    var subscriptionClient = this.subscriptionClient = redis.createClient(options.config.registry.redis.port, options.config.registry.redis.host);
    var commandClient = this.commandClient = redis.createClient(options.config.registry.redis.port, options.config.registry.redis.host);
    var prefix = this.prefix = options.config.registry.redis.prefix;

    subscriptionClient.on('subscribe', function (channel, count) {
        console.log("redis: subscribed to '" + channel + "' (" + count + " subscribers)");
    });

    subscriptionClient.on('unsubscribe', function (channel, count) {
        console.log("redis: unsubscribed from '" + channel + "'")
    });

    subscriptionClient.on('message', _.bind(this.onMessage, this));

    subscriptionClient.on('ready', function () {
        console.log("redis: subscription connection ready");
        subscriptionClient.subscribe(prefix + 'triggers');
    });

    commandClient.on('ready', function () {
        console.log("redis: command connection ready");
    });

    subscriptionClient.on('error', function (error) {
        console.log("redis: error in subscription connection: " + error);
    });

    commandClient.on('error', function (error) {
        console.log("redis: error in command connection: " + error);
    });
};

Registry.prototype.addSocket = function (socket) {
    local.addSocket(socket);
};

Registry.prototype.removeSocket = function (socket) {
    local.removeSocket(socket);
};

Registry.prototype.addSubscription = function (socket, url, data) {
    local.addSubscription(socket, url, data);
};

Registry.prototype.removeSubscription = function (socket, url) {
    local.removeSubscription(socket, url);
};

Registry.prototype.trigger = function (url) {
    if (!this.commandClient) {
        return;
    }

    this.commandClient.publish(this.prefix + 'triggers', url);
};

Registry.prototype.onMessage = function (channel, message) {
    local.trigger(message);
}

module.exports = new Registry();
