"use strict";

function SourceMapper(source) {
    this._source = source;
    this._mapping = { };
}

SourceMapper.prototype.set = function(key, value, count) {
    this._mapping[key] = { value: value, count: (count || null) };
}

SourceMapper.prototype.clear = function(key) {
    delete this._mapping[key];
}

SourceMapper.prototype._getKeys = function() {
    let keys = { };
    function replacer(all, line, key, value) {
        keys[key] = true;
        return "";
    }
    this._source.replace(/(.*\/\*!Test:\s*([a-z0-9_]*)\s*=\s*"([^"]*)"\s*\*\/)/ig, replacer);
    return Object.keys(keys);
}

SourceMapper.prototype._getSource = function() {
    let source = this._source;
    let warnings = [ ];

    let counts = { };
    this.keys.forEach((key) => {
        counts[key] = 0;
    });

    Object.keys(this._mapping).forEach((key) => {
        if (counts[key] !== 0) {
            warnings.push({ line: `Unknown key: ${ key }`, type: "UNKNOWN_KEY", key: key });
        }
    });

    const replacer = (match, all, line, key, value) => {
        let mapping = this._mapping[key];

        if (mapping.value == null) {
            counts[key]++;
            return all;
        }

        if (!mapping) {
            warnings.push({ line: `Missing mapping: ${ key }`, type: "MISSING_MAPPING", key: key });
            return all;
        }

        let loc = line.indexOf(value);
        if (loc === -1) {
            throw new Error("Nothing to replace (expected: " + JSON.stringify(value) + ")");
        }

        counts[key]++;
        line = all.substring(0, loc) + mapping.value + all.substring(loc + value.length);

        return line;
    }
    source = source.replace(/((.*)\/\*!Test:\s*([a-z0-9_]*)\s*=\s*"([^"]*)"\s*\*\/)/ig, replacer);

    Object.keys(counts).forEach((key) => {
        if (counts[key] === 0) {
            warnings.push({ line: `Unused key: ${ key }`, type: "UNUSED_KEY", key: key });
        }
    });

    Object.keys(this._mapping).forEach((key) => {
        let count = this._mapping[key].count;
        if (count != null && count !== counts[key]) {
            throw new Error(`Mapping count mismatch: ${ key } (expected: ${ count }, found: ${ counts[key] })`);
        }
    });

    return { source: source, warnings: warnings }
}

Object.defineProperty(SourceMapper.prototype, "keys", {
    enumerable: true,
    get: function() { return this._getKeys(); }
});

Object.defineProperty(SourceMapper.prototype, "source", {
    enumerable: true,
    get: function() { return this._getSource().source; }
});

Object.defineProperty(SourceMapper.prototype, "warnings", {
    enumerable: true,
    get: function() { return this._getSource().warnings; }
});

module.exports.SourceMapper = SourceMapper;

