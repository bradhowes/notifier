'use strict';

/**
 * @fileOverview Defines a Filter prototype and its methods.
 */
module.exports = Filter;

/**
 * Filter constructor.
 *
 * @class Filter
 */
function Filter(init) {
    this.log = require('./config').log('Filter');
    this.log.BEGIN(init);
    if (init === undefined || init === {}) {
        init = null;
    }
    this.filters = init;
}

/**
 * Filter prototype.
 *
 * Defines the methods available to a Filter instance.
 */
Filter.prototype = {

    passed: function(registration, route) {
        var log = this.log.child('passed');
        log.BEGIN(registration, route);
        if (this.definition === null) {
            log.END('true');
            return true;
        }

        for (var key in this.filters) {
            var validValues = this.filters[key];
            var value = registration[key];
            if (typeof value !== 'undefined') {
                if (validValues.indexOf(value) === -1) {
                    log.END('false');
                    return false;
                }
            }

            value = route[key];
            if (typeof value !== 'undefined') {
                if (validValues.indexOf(value) === -1) {
                    log.END('false');
                    return false;
                }
            }
        }

        log.END('true');
        return true;
    }
}
