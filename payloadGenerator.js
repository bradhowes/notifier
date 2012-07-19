/**
 * @fileOverview Defines the PayloadGenerator prototype and its methods.
 */
module.exports = PayloadGenerator;

var XRegExp = require("xregexp").XRegExp;

/**
 * PayloadGenerator constructor.
 *
 * @class
 *
 * A PayloadGenerator transforms notification template into notification payloads, replacing any placeholdes with live
 * data.
 */
function PayloadGenerator() {
    this.log = require('./config').log('payloadGenerator');

    /**
     * The regular expression that matches a placeholder in a template.
     * @type XRegExp
     */
    this.regexp =  XRegExp("@@([A-Za-z0-9_]+)(=([^@]*))?@@");
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
     * @param {String} template the template to process
     *
     * @param {Object} substitutions mapping of placeholder names to substitution values
     *
     * @return {String} notification payload
     */
    transform: function(template, substitutions) {
        var log = this.log.child('transform');
        while (1) {
            var match = this.regexp.exec(template);
            if (match === null) break;
            log.debug('found', match[0]);
            var value = substitutions[match[1]];
            if (value === undefined) {
                log.debug('not in substitutions');
                value = match[3];
                if (value === undefined) {
                    log.debug('no default value defined');
                    value = "";
                }
            }
            log.debug('substituting with', value);
            template = template.replace(match[0], value);
        }
        return template;
    }
};
