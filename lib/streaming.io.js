var client = require('streaming.io-client'),
    events = require('./events'),
    registry = require('./registry');

var sio;

exports.version = require('../package.json').version;
exports.clientVersion = client.version;

exports.listen = function listen(io, app, service) {
    sio = io;

    console.log("streaming:listen");

    sio.on('connection', function (socket) {
        console.log("streaming:connection");

        socket.on('stream', function (message, callback) {
            console.log("streaming:stream");
            service.stream(socket, message.url, function (err, response) {
                callback(err, response);
            });
        });

        socket.on('unstream', function (message, callback) {
            console.log("streaming:unstream");
            service.unstream(socket, message.url, function (err) {
                callback(err);
            });
        });

        socket.on('sync', function (message, callback) {
            console.log("streaming:sync");
            service.sync(socket, message, function (err, response) {
                callback(err, response);
            });
        });

        socket.on('disconnect', function (message, callback) {
            console.log("streaming:disconnect");
            events.disconnect(socket);
        });

        events.connect(socket);
    });

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
};

exports.trigger = function (url, read, emit) {
    registry.trigger(url, read, emit);
};

