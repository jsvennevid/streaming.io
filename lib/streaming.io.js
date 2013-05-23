var client = require('streaming.io-client'),
    registry = require('./registry');

exports = module.exports = Streaming;

function Streaming() {
}

Streaming.version = require('../package.json').version;
Streaming.clientVersion = client.version;

function setupIo(io, service) {
    io.on('connection', function (socket) {
        console.log("streaming:connection");

        socket.on('stream', function (message, callback) {
            console.log("streaming:stream");

            var readMessage = {
                method: 'read',
                url: message.url,
                data: {}
            };

            service.sync(socket, readMessage, function (err, response) {
                if (err) {
                    callback(err);
                    return;
                }

                registry.addSubscription(socket, message.url, response);
                callback(err, response);
            });
        });

        socket.on('unstream', function (message, callback) {
            console.log("streaming:unstream");
            registry.removeSubscription(socket, message.url);
            callback(null);
        });

        socket.on('sync', function (message, callback) {
            console.log("streaming:sync");
            service.sync(socket, message, function (err, response) {
                callback(err, response);
            });
        });

        socket.on('disconnect', function (message, callback) {
            console.log("streaming:disconnect");
            registry.removeSocket(socket);
        });

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

Streaming.listen = function (io, app, service, options) {
    options = options || {};
    registry = registry.configure(options).getRegistry();

    console.log("streaming:listen");

    setupIo(io, service);
    setupApp(app);
};

Streaming.trigger = function (url) {
    registry.trigger(url);
};

