var client = require('streaming.io-client'),
    events = require('./events');

var sio;

exports.version = require('../package.json').version;
exports.clientVersion = client.version;

exports.listen = function listen(io, app) {
    sio = io;

    console.log("streaming:listen");

    sio.on('connection', function (socket) {
        console.log("streaming:connection");

        socket.on('stream', function (message, callback) {
            callback("stream: Not implemented");
        });

        socket.on('unstream', function (message, callback) {
            callback("unstream: Not implemented");
        });

        socket.on('sync', function (message, callback) {
            callback("sync: Not implemented");
        });

        socket.on('disconnect', function (message, callback) {
            events.disconnect(socket);
        });

        events.connect(socket);
    });

    app.get('/streaming.io/streaming.io.js', function (req, res) {
        client.build(function (err, data) {
            if (err) {
                res.writeHead(500);
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
