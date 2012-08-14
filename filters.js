'use strict';

/**
 * @fileOverview Defines the Filters prototype and its methods.
 */
module.exports = Filters;

var XRegExp = require('xregexp').XRegExp;
var config = require('./config');

/**
 * Filters constructor.
 *
 * @class
 *
 * A Filter instance contains methods that provide for filtering of template placeholder data before it is used to fill
 * in the placeholder.
 */
function Filters() {
    this.log = config.log('Filters');

    /**
     * Regular expression for matching JSON characters that must be escaped before being introduced inside of a JSON
     * value.
     */
    this.escapeJSON_RE = /(^")|([^\\])"/g; // Don't match an already-escaped double-quote

    /**
     * Mapping of XML characters that must be translated into XML entities before being introduced inside of an XML
     * value.
     */
    this.escapeXMLMap = {
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;"
    };

    /**
     * Regular expression that matches characters which must be converted into XML entities before being introduced
     * inside of an XML value. Specail care taken to not match an '&' already part of an XML entity.
     */
    this.escapeXML_RE = /([<>'"])|(&(?![a-z0-9]+;))/g;

    /**
     * Regular expression that matches a squence of characters that must not be broken by a shortening due to the
     * enforceMaxByteSize method. If a cut point occurs within such a sequence, the cut point will move before it.
     */
    this.enforceMaxByteSize_RE = /(&[^;]+;)|(\\u[0-9A-F]{4})|(\\.)/g;

    /**
     * Mapping of available filters and their names as they appear in a placeholder filter chain.
     *
     * Example: @@FOO|default("bar")|escJSON|maxSize(8)@@
     */
    this.filters = {
        "default": this.defaultValue,
        "escJSON": this.escapeJSON,
        "escXML": this.escapeXML,
        "maxSize": this.enforceMaxByteSize
    };
}

/**
 * Filters prototype. Defines the methods availble to a Filters instance.
 */
Filters.prototype = {

    /**
     * Supply a default value when the given one is undefined or empty.
     *
     * @param {String} value the value to work with
     * @param {String} defaultValue the default value to supply if necessary
     * @return {String} the new value
     */
    defaultValue: function (value, defaultValue) {
        if (typeof defaultValue === 'undefined') defaultValue = '';
        if (typeof value === 'undefined' || value === null || value.length === 0) return defaultValue;
        return value;
    },

    /**
     * Escape certain characters within the given value so that the result may safely be added inside a JSON payload.
     *
     * @param {String} value the value to work with
     * @return {String} the new value
     */
    escapeJSON: function (value) {
        if (typeof value === 'undefined') return '';
        return value.replace(this.escapeJSON_RE, "$2\\\"");
    },

    /**
     * Escape certain characters within the given value so that the result may safely be added inside an XML payload.
     *
     * @param {String} value the value to work with
     * @return {String} the new value
     */
    escapeXML: function (value) {
        if (typeof value === 'undefined') return '';
        var re = this.escapeXML_RE;
        var map = this.escapeXMLMap;
        for (var match = re.exec(value); match; match = re.exec(value)) {
            value = value.slice(0, match.index) + map[match[0]] + value.slice(match.index + 1, value.length);
        }
        return value;
    },

    /**
     * Make sure the resulting value is no more than maxByteSize in length, when measured in bytes. If shortening is
     * necessary, do so in such a way that certain, important character runs are not broken, and add a tail to the
     * result to indicate that shortening took place.
     *
     * @param {String} value the value to work with
     * @param {Integer} maxByteSize the maximum number of bytes to return
     * @param {String} tail the value to append to the result to indicate a truncated value
     * @return {String} the new value
     */
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
                break;          // Found it
            }
            maxByteSize -= 1;   // Move back until we've stopped chopping at a multibyte sequence
        }

        return test + tail;
    }
};
