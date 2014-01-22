var _ = require('underscore');

exports.compress = function (data) {
    if (!_.isArray(data) || (data.length < 2)) {
        return data;
    }

    var keys = _.keys(data[0]);
    var length = keys.length;

    var rows = _.map(data, function (row) {
        var values = new Array(length);
        for (var i = 0; i < length; ++i) {
            values[i] = row[keys[i]];
        }
        return values;
    });

    var compressed = {
        keys: keys,
        rows: rows
    };

    return compressed;
}
