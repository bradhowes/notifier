/**
 * @fileOverview Defines the PayloadGenerator prototype and its methods.
 */
module.exports = PayloadGenerator;

var XRegExp = require("xregexp").XRegExp;

/**
 * Initializes a new PayloadGenerator object. A PayloadGenerator transforms notification template into notification
 * payloads, replacing any placeholdes with live data.
 *
 * @class PayloadGenerator
 */
function PayloadGenerator() {

    /**
     * The regular expression that matches a placeholder in a template.
     * @type XRegExp
     */
    this.regexp =  XRegExp("@@([A-Za-z0-9_]+)(=([^@]*))?@@");
}

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
        while (1) {
            var match = this.regexp.exec(template);
            if (match === null) break;
            var value = substitutions[match[1]];
            if (value === undefined) {
                value = match[3];
                if (value === undefined) {
                    value = "";
                }
            }
            template = template.replace(match[0], value);
        }
        return template;
    }
};
