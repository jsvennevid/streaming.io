var amqp = require('amqp'),
    local = require('./local'),
    _ = require('underscore');

var Registry = function () {
    this.sockets = {};
    this.subscriptions = {};
}

Registry.prototype.create = function (options) {
    options = options || {};

    local.create(options);

    var connection = this.connection = amqp.createConnection({
        url: options.amqp
    });

    connection.on('ready', _.bind(function () {
        console.log("amqp - Connection ready");
        connection.exchange('triggers', {
            type: 'fanout'
        }, _.bind(function (exchange) {
            this.exchange = exchange;
            console.log('amqp - Exchange ' + exchange.name + ' is open');

            connection.queue('', {
                exclusive: true
            }, _.bind(function (queue) {
                this.queue = queue;
                console.log('amqp - Queue ' + queue.name + ' is open');

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
