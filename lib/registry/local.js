"use strict";

var _ = require('underscore'),
    uuid = require('uuid'),
    crypto = require('crypto'),
    compress = require('../compress').compress,
    debug = require('debug')('streaming.io:registry');

var Registry = function () {
    this.sockets = {};
    this.subscriptions = {};
};

Registry.prototype.create = function (options, callback) {
    options = options || {};

    this.__read = options.read || function () {
        throw "No read defined";
    };
    this.__invalidate = options.invalidate || function (callback) { callback(); };

    callback(null);
}

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

Registry.prototype.addSubscription = function (socket, url, remoteDigest, data, callback) {
    debug('socket(%s) - subscribe to %s', socket.id, url);
    if (!_.isUndefined(this.sockets[socket.id])) {
        var clients = this.subscriptions[url] = this.subscriptions[url] || {};
        var subscription = clients[socket.id] = clients[socket.id] || {};
        var id = uuid.v4();

        subscription[id] = true;
        this.sockets[socket.id].subscriptions[id] = url;

        var message = {
            url: url
        };

        if (data) {
            var hash = crypto.createHash('sha1');
            hash.update(JSON.stringify(data));
            var digest = hash.digest().toString('base64');

            message.hash = digest;

            if (_.isUndefined(remoteDigest) || (digest != remoteDigest)) {
                message.data = compress(data);
            }

            this.sockets[socket.id].cache[url] = digest;
        }

        callback(null, message);
    }
};

Registry.prototype.removeSubscription = function (socket, url) {
    debug('socket(%s) - unsubscribe from %s', socket.id, url);

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

Registry.prototype.trigger = function (url) {
    debug("trigger '%s'", url);
    this.__invalidate(url, _.bind(function () {
        this.subscribers(url, _.bind(function (socket, cache) {
            var info = {
                address: socket.handshake.address
            };

            this.__read(url, {}, socket.request.session, function (err, data) {
                if (err) {
                    return;
                }

                var message = {
                    url: url,
                    data: compress(data)
                };

                var hash = crypto.createHash('sha1');
                hash.update(JSON.stringify(data));
                var digest = hash.digest().toString('base64');

                if (digest == cache[url]) {
                    return;
                }

                cache[url] = digest;
                message.hash = digest;

                socket.emit('stream', message);
            }, info);
        }, this));
    }, this));
};

Registry.prototype.subscribers = function (url, callback) {
    var clients = this.subscriptions[url];
    if (_.isUndefined(clients)) return;

    _.each(clients, function (id, sid) {
        callback(this.sockets[sid].socket, this.sockets[sid].cache);
    }, this);
};

module.exports = new Registry();
