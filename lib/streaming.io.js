var client = require('streaming.io-client'),
    Registry = require('./registry'),
    compress = require('./compress').compress,
    debug = require('debug')('streaming.io:server'),
    assert = require('assert'),
    _ = require('underscore');

exports = module.exports = Streaming;

function Streaming() {
}

Streaming.version = require('../package.json').version;
Streaming.clientVersion = client.version;

var registry;

function setupIo(io, service) {
    io.on('connection', function (socket) {
        socket.on('stream', function (message, callback) {
            try {
                assert(_.isObject(message), "message is not an object");
                assert(_.isString(message.url), "url not a string");
                assert(_.isFunction(callback), "no callback provided");
            } catch (e) {
                debug("socket(%s) - invalid stream message: %s", socket.id, e.message);
                _.isFunction(callback) && callback("Invalid request");
                return;
            }

            debug("socket(%s) - streaming '%s'", socket.id, message.url);

            var readMessage = {
                method: 'read',
                url: message.url,
                data: {}
            };

            service.sync(socket, readMessage, function (err, response) {
                if (err) {
                    debug('socket(%s) - failed streaming: %s', socket.id, err);
                    callback(err);
                    return;
                }

                registry.addSubscription(socket, message.url, message.hash, response, function (err, message) {
                    callback(err, message);
                });
            });
        });

        socket.on('unstream', function (message, callback) {
            try {
                assert(_.isObject(message), "message is not an object");
                assert(_.isString(message.url), "url not a string");
                assert(_.isFunction(callback), "no callback provided");
            } catch (e) {
                debug("socket(%s) - invalid unstream message: %s", socket.id, e.message);
                _.isFunction(callback) && callback("Invalid request");
                return;
            }

            registry.removeSubscription(socket, message.url);
            callback(null);
        });

        socket.on('sync', function (message, callback) {
            try {
                assert(_.isObject(message), "message is not an object");
                assert(_.isFunction(callback), "no callback provided");
            } catch (e) {
                debug("socket(%s) - invalid sync message: %s", socket.id, e.message);
                _.isFunction(callback) && callback("Invalid request");
                return;
            }

            debug("socket(%s) - op '%s' : %s", socket.id, message.method, message.url);
            service.sync(socket, message, function (err, response) {
                if (err) {
                    debug("socket(%s) - op '%s' failed: %s", socket.id, message.method, err);
                }
                callback(err, response);
            });
        });

        socket.on('disconnect', function (message, callback) {
            debug("socket(%s) - disconnected", socket.id);
            registry.removeSocket(socket);
        });

        debug("socket(%s) - connection from %s", socket.id, socket.handshake.address);
        registry.addSocket(socket);
    });
}

function setupApp(app) {
    app.get('/streaming.io/streaming.io.js', function (req, res) {
        client.build(function (err, data) {
            if (err) {
                res.writeHead(500, err);
                res.end();
                return;
            }

            res.writeHead(200, {
                'Content-Type': 'text/javascript',
                'Content-Length': data.length
            });

            res.write(data);
            res.end();
        });

    });
}

Streaming.listen = function (io, app, service, options, callback) {
    debug("setting up streaming.io");
    options = options || {};
    Registry.configure(options, function (err) {
        if (err) {
            debug("error while listening");
            callback(err);
            return;
        }

        debug("now listening for connections");

        registry = Registry.getRegistry();

        setupIo(io, service);
        setupApp(app);

        callback(null);
    });
};

Streaming.trigger = function (url) {
    registry.trigger(url);
};
