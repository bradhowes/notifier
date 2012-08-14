'use strict';

/**
 * @fileOverview Defines a RegistrationFilter prototype and its methods.
 */
module.exports = RegistrationFilter;

/**
 * Filter constructor.
 *
 * @class
 *
 * A RegistrationFilter object determines which device registrations will be be used for notifications. A filter
 * contains one or more attributes names that correspond to attribute names found in a registration or registration
 * route. Each attribute name is associated with an array of allowed values. If a registration/route pair given to the
 * passed method does not have the required values, the registration/route will fail to pass the filter.
 *
 * @param {Object} init defines the attributes to filter against
 */
function RegistrationFilter(init) {
    this.log = require('./config').log('Filter');
    this.log.BEGIN(init);
    if (init === undefined || init === {}) {
        init = null;
    }
    this.filters = init;
}

/**
 * RegistrationFilter prototype.
 *
 * Defines the methods available to a RegistrationFilter instance.
 */
RegistrationFilter.prototype = {

    /**
     * Apply the filter to a registration and route defintion.
     *
     * @param {Object} registration a registration definition. See {@link Registrar#RegistrationModel} for the
     *                              definition.
     * @param {Object} route a registration route definition. See {@link Registrar#RouteModel} for the definition.
     * @return true if passes the filter, false otherwise.
     */
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
