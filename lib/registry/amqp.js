"use strict";

var amqp = require('amqp'),
    local = require('./local'),
    _ = require('underscore'),
    debug = require('debug')("streaming.io:registry");

var Registry = function () {
}

Registry.prototype.create = function (options) {
    options = options || {};

    local.create(options);

    var connection = this.connection = amqp.createConnection({
        url: options.config.registry.amqp.url
    });

    connection.on('ready', _.bind(function () {
        debug("amqp - connection ready");
        connection.exchange('triggers', {
            type: 'fanout'
        }, _.bind(function (exchange) {
            this.exchange = exchange;
            debug("exchange '%s' opened", exchange.name);

            connection.queue('', {
                exclusive: true
            }, _.bind(function (queue) {
                this.queue = queue;
                debug("queue '%s' opened", queue.name);

                queue.bind('triggers', '#');
                queue.subscribe(_.bind(function (message) {
                    this.onMessage(message);
                }, this));
            }, this));
        }, this));
    }, this));
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
    if (!this.exchange) {
        return;
    }

    this.exchange.publish('#', {
        type: 'trigger',
        url: url
    });
};

Registry.prototype.onMessage = function (message) {
    switch (message.type) {
        case 'trigger': {
            local.trigger(message.url);
        } break;
    }
}

module.exports = new Registry();
