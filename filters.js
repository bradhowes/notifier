'use strict';

module.exports = Filters;

var XRegExp = require('xregexp').XRegExp;
var config = require('./config');

function Filters() {
    this.log = config.log('Filters');

    this.escapeJSON_RE = XRegExp('(^")|([^\\\\])"'); // Don't match an already-escaped double-quote

    this.escapeXMLMap = {
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;"
    };

    // Match keys in above escapeXMLMap, but do not match '&' that is already part of an entity
    this.escapeXML_RE = XRegExp('([<>\'"])|(&(?![a-z0-9]+;))');

    // Match: any XML entities (eg &amp;)
    // this.enforceMaxByteSize_RE = XRegExp('(\\(u[0-9A-F]{4})|.)|(&[^;]+;)|(\\.)');
    this.enforceMaxByteSize_RE = XRegExp('(&[^;]+;)|(\\\\u[0-9A-F]{4})|(\\.)');

    // Available filters
    this.filters = {
        "default": this.defaultValue,
        "escJSON": this.escapeJSON,
        "escXML": this.escapeXML,
        "maxSize": this.enforceMaxByteSize
    };
}

Filters.prototype = {

    defaultValue: function (value, defaultValue) {
        if (typeof defaultValue === 'undefined') defaultValue = '';
        if (typeof value === 'undefined' || value === null || value.length === 0) return defaultValue;
        return value;
    },

    escapeJSON: function (value) {
        if (typeof value === 'undefined') return '';
        return value.replace(this.escapeJSON_RE, "$2\\\"");
    },

    escapeXML: function (value) {
        if (typeof value === 'undefined') return '';
        var re = this.escapeXML_RE;
        var map = this.escapeXMLMap;
        for (var match = re.exec(value); match; match = re.exec(value)) {
            value = value.slice(0, match.index) + map[match[0]] + value.slice(match.index + 1, value.length);
        }
        return value;
    },

    enforceMaxByteSize: function (value, maxByteSize, tail) {

        if (typeof value === 'undefined') return '';
        if (typeof tail === 'undefined') tail = "…"; // UNICODE ellipsis
        if (typeof maxByteSize == 'undefined') maxByteSize = value.length;

        var re = this.enforceMaxByteSize_RE;
        var byteLength = Buffer.byteLength;

        if (byteLength(value) <= maxByteSize) {
            return value;       // String byte count is within limits
        }

        // Since we will be truncating the string at some point, account for the addition of the tail string
        maxByteSize -= byteLength(tail);

        // Visit any unbreakable sequences to see if there is one that spans our current cut point
        for (var match = re.exec(value); match; match = re.exec(value)) {

            var pos = byteLength(value.slice(0, match.index));
            if (pos >= maxByteSize) {
                break;          // Match is beyond the cut point - no worries
            }
            else if (pos + byteLength(match[0]) - 1 >= maxByteSize) {
                maxByteSize = pos; // Put the cut point before the match
                break;
            }
        }

        // Now maxByteSize is a candiate cut point, but need to check that we don't truncate a multibyte character.
        while (true) {
            var test = new Buffer(value).slice(0, maxByteSize);
            if (value.indexOf(test) === 0) {
                return test + tail; // Found it
            }
            maxByteSize -= 1;   // Move back until we've stopped chopping at a multibyte sequence
        }
    }
};
