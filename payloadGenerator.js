module.exports = PayloadGenerator;

var XRegExp = require("xregexp");

function PayloadGenerator() {
    this.regexp =  XRegExp("@@([A-Za-z0-9_]+)(=([^@]*))?@@");
}

PayloadGenerator.prototype = {
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
