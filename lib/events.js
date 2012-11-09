var registry = require('./registry');

exports.connect = function connect(socket) {
    console.log("streaming:addsocket");
    registry.addSocket(socket);
};

exports.disconnect = function disconnect(socket) {
    console.log("streaming:removesocket");
    registry.removeSocket(socket);
};