'use strict';

/**
 * @fileOverview Defines the PayloadGenerator prototype and its methods.
 */
module.exports = PayloadGenerator;

var XRegExp = require('xregexp').XRegExp;
var config = require('./config');
var filters = require('./filters');

/**
 * PayloadGenerator constructor.
 *
 * @class
 *
 * A PayloadGenerator transforms notification template into notification payloads, replacing any placeholdes with live
 * data.
 */
function PayloadGenerator() {
    this.log = config.log('PayloadGenerator');

    /**
     * The regular expression that matches a placeholder in a template.
     * @type XRegExp
     */
    this.regexp =  XRegExp(config.templates_placeholder_re);
    this.filters = filters;
}

/**
 * PayloadGenerator prototype.
 *
 * Defines the methods available to a PayloadGenerator instance.
 */
PayloadGenerator.prototype = {

    /**
     * Transform a notification template into a payload by substitution placeholders with given substitution values.
     *
     * @param {Object} content the template to process
     *
     * @param {Object} substitutions mapping of placeholder names to substitution values
     */
    transform: function(content, substitutions) {
        var log = this.log.child('transform');
        log.BEGIN(content, substitutions);

        if (! substitutions) {
            substitutions = {};
        }

        while (1) {
            var match = this.regexp.exec(content);
            if (match === null) break;
            log.debug('found', match);
            var value = substitutions[match[1]];
            if (typeof value === 'undefined') {
                value = match[3];
                if (typeof value === 'undefined') {
                    log.debug('no default value defined');
                    value = '';
                }
            }
            log.debug('substituting with', value);
            content = content.replace(match[0], value);
        }

        return content;
    }
};
