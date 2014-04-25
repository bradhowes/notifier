// -*- Mode: js -*-

{
    var Filters = require('../../../filters');
    var __filters__ = new Filters();
}

/** Top rule. Successful parse if this returns a TEMPLATE instance.
*/
start
    = template:TEMPLATE { return template; }

/** TEMPLATE rule. A template consists of spans of text interrupted by zero or more PLACEHOLDER elements. During
 * payload generations, the PLACEHOLDER elements receive a runtime substitution value
 */
TEMPLATE
    = text:TEXT suffix:(PLACEHOLDER TEXT)* {
        return function (subs) {
            // Iterate over all of the found placeholders and supply them values from the given 'subs' map
            var value = text;
            for (var i in suffix) {
                value = value + suffix[i][0](subs) + suffix[i][1];
            }
            return value;
        };
    }

/** TEXT rule defines a span of text before or after a PLACEHOLDER instance.
 */
TEXT
    = text:TEXT_CHAR* { return text.join(''); }

/** The magic character to use to delimit PLACEHOLDER instances.
 * NOTE: if TAG_CHAR is changed, one must also change the '/' clause below under TEXT_CHAR
 */
TAG_CHAR
    = "@"

/** TEXT_CHAR rule defines the production of one valid character in a TEXT span. 
 */
TEXT_CHAR
    = tagChar:TAG_CHAR (! TAG_CHAR) { return tagChar; } // Match a solitary '@' character
    / [^@]                                              // Match anything but a '@' character

/** PLACEHOLDER rule defines the constituent parts of a template placeholder. Each one has a 'name' that will be used
 * as a key in the 'subs' lookup at runtime. the placeholder may have one or more filters applied to the value from
 * 'subs'.
 */
PLACEHOLDER
    = (TAG_CHAR TAG_CHAR) name:IDENT filters:(_ "|" _ FILTER)* (TAG_CHAR TAG_CHAR) {
        return function (subs) {
            // Fetch the runtime value from subs, then apply filters on it.
            var value = subs[name];
            for (var i in filters) {
                value = filters[i][3](value);
            }
            return value;
        };
    }

/** FILTER rule defines the constituent parts of a filter that may follow a placeholder name. Some filters have
 * parameters that may be provided within the template. If a value is not given in the template, it will have the
 * Javascript value 'undefined' at runtime.
 */
FILTER
    = filter:NAME _ "(" _ params:PARAMS? _ ")" { // Match filter with one or more params
        return function (value) {
            return filter.apply(__filters__, [value].concat(params));
        };
    }
    / filter:NAME {
        return function (value) {
            return filter.call(__filters__, value);
        };
    }

/** NAME rule produces a filter object for the given name value.
 */
NAME
    = name:IDENT { 
        return __filters__.filters[name];
    }

/** IDENT rule defines the characters allowed in a filter name
 */
IDENT
    = chars:[a-zA-Z0-9_]+ {
        return chars.join(""); 
    }

/** PARAMS rule defines a sequence of one or more filter parameter values. Produces an array of parameter values.
 */
PARAMS
    = first:PARAM rest:(_ "," _ PARAM)* {
        var params = [first];
        for (var i in rest.length) {
            params.push(rest[i][1]);
        }
        return params;
    }

/** PARAM rule defines the valid parameter types. Currently supported are string, floating-point, and integer.
 */
PARAM
    = value:INTEGER { return value; }
    / value:FLOAT { return value; }
    / value:STRING { return value; }

/** INTEGER rule produces a valid Javascript integer value
 */
INTEGER
    = digits:[0-9]+ { 
        return parseInt(digits.join("")); 
    }

/** FLOAT rule produces a valid Javascript floating-point value
 */
FLOAT
    = before:[0-9]* "." after:[0-9]+ { 
        return parseFloat(before.join("") + "." + after.join("")); 
    }

/** STRING rule produces a valid Javascript string value/
 */
STRING
    = STRING1
    / STRING2

HEX
    = [0-9a-fA-F]

NL
    = "\n"
    / "\r\n"
    / "\r"
    / "\f"

UNICODE
    = "\\" h1:HEX h2:HEX? h3:HEX? h4:HEX? h5:HEX? h6:HEX? ("\r\n" / [ \t\r\n\f])? {
        return String.fromCharCode(parseInt("0x" + h1 + h2 + h3 + h4 + h5 + h6));
    }

ESCAPE
    = UNICODE
    / "\\" chr:[^\r\n\f0-9a-fA-F] { return chr; }

STRING1
    = '"' chars:([^\n\r\f\\\"] / "\\" nl:NL { return nl; } / ESCAPE)* '"' {
        return chars.join("");
    }

STRING2
    = "'" chars:([^\n\r\f\\\'] / "\\" nl:NL { return nl; } / ESCAPE)* "'" {
        return chars.join("");
    }

_
  = [ ]*                        // whitespace
