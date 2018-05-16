exports.compress = function (data) {
    if (!Array.isArray(data) || (data.length < 2)) {
        return data;
    }

    const keys = Object.keys(data[0]);
    const length = keys.length;

    const rows = data.map((row) => {
        const values = new Array(length);
        for (let i = 0; i < length; ++i) {
            values[i] = row[keys[i]];
        }
        return values;
    });

    return {
        keys: keys,
        rows: rows
    };
}
