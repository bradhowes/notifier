"use strict";

/**
 * @fileOverview Defines some Logger utility methods.
 */
module.exports = LoggerUtils;

var log4js = require('log4js');
var slice = Array.prototype.slice;

/**
 * LoggerUtils constructor.
 *
 * @class
 *
 * Definition of helper methods that make working with Logger objects a little easier.
 */
function LoggerUtils() {
}

/**
 * LoggerUtils prototype.
 */
LoggerUtils.prototype = {

    /**
     * Create a new child logger whose name is derived from this one. Names are separated by '.' For instance, calling
     * this method on Logger object whose name is 'foo.bar' with the argument 'beep' will return a new or cached Logger
     * instance whose name is 'foo.bar.beep'.
     *
     * @param {String} name
     *   The name of the child
     *
     * @return {Logger} new or cached Logger instance with the given name
     */
    child: function(name) {
        return log4js.getLogger(this.category + '.' + name);
    },

    /**
     * Sugar method for the beginning of a block (eg. method). Emits log messages that start with the tag 'BEG'
     */
    BEGIN: function() {
        this.info.apply(this, ['BEG'].concat(slice.call(arguments)));
    },

    /**
     * Sugar method for the end of a code block (eg. method). Emits log messages that start with the tag 'END'
     */
    END: function() {
        this.info.apply(this, ['END'].concat(slice.call(arguments)));
    }
};

// Add the above extensions to all logger instances.

var root = log4js.getDefaultLogger();
var lu = LoggerUtils.prototype;

root.__proto__.child = lu.child;
root.__proto__.BEGIN = lu.BEGIN;
root.__proto__.END = lu.END;
