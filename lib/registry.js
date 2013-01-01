"use strict";

var _ = require('underscore'),
    uuid = require('node-uuid'),
    crypto = require('crypto');

var Registry = function () {
    this.sockets = {};
    this.subscriptions = {};
};

// TODO: verify ACLs when subscribing

Registry.prototype.addSocket = function (socket) {
    this.sockets[socket.id] = { socket: socket, subscriptions: {}, cache: {} };
};

Registry.prototype.removeSocket = function (socket) {
    _.each(this.sockets[socket.id].subscriptions, function (url, id) {
        var clients = this.subscriptions[url];
        if (_.size(clients) == 0) return;

        var subscription = clients[socket.id];
        if (_.size(subscription) == 0) return;

        delete subscription[id];
        if (_.size(subscription) == 0) delete clients[socket.id];
        if (_.size(clients) == 0) delete this.subscriptions[url];
    }, this);

    delete this.sockets[socket.id];
};

Registry.prototype.addSubscription = function (socket, url) {
    if (!_.isUndefined(this.sockets[socket.id])) {
        var clients = this.subscriptions[url] = this.subscriptions[url] || {};
        var subscription = clients[socket.id] = clients[socket.id] || {};
        var id = uuid.v4();

        subscription[id] = true;
        this.sockets[socket.id].subscriptions[id] = url;
    }
};

Registry.prototype.removeSubscription = function (socket, url) {
    var clients = this.subscriptions[url];
    if (_.isUndefined(clients) || _.size(clients) == 0) return;

    var subscription = clients[socket.id];
    if (_.isUndefined(subscription) && _.size(subscription) == 0) return;

    var id = _.keys(subscription).shift();
    delete subscription[id];

    if (_.size(subscription) == 0) delete clients[socket.id];
    if (_.size(clients) == 0) delete this.subscriptions[url];

    delete this.sockets[socket.id].subscriptions[id];
};

Registry.prototype.trigger = function (url, read, emit) {
    this.subscribers(url, function (socket, cache) {
        read(url, {}, socket.handshake.session, function (err, data) {
            var message = {
                url: url,
                data: data
            };

            var hash = crypto.createHash('sha1');
            hash.update(JSON.stringify(data));
            var digest = hash.digest();

            if (digest == cache[url]) {
               return;
            }

            cache[url] = digest;

            emit(socket, message);
        });
    });
};

Registry.prototype.subscribers = function (url, callback) {
    var clients = this.subscriptions[url];
    if (_.isUndefined(clients)) return;

    _.each(clients, function (id, sid) {
        callback(this.sockets[sid].socket, this.sockets[sid].cache);
    }, this);
};

module.exports = new Registry();
