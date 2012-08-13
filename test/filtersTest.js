var assert = require("assert");
var vows = require("vows");

var Filters =require("../filters.js");
var filters = new Filters();

var bs = '\\';
var sq = "'";
var dq = '"';

vows.describe('filters')
    .addBatch({

        // defaultValue tests

        'check defaultValue(undefined, undefined)': {
            topic: filters.defaultValue(),
            'returns ""': function(topic) {
                assert.equal(topic, '');
            }
        },
        'check defaultValue(undefined, "")': {
            topic: filters.defaultValue(filters.foo, ''),
            'should return empty string': function(topic) {
                assert.equal(topic, '');
            }
        },
        'check that defaultValue(undefined, "blah")': {
            topic: filters.defaultValue(filters.foo, 'blah'),
            'returns blah': function(topic) {
                assert.equal(topic, 'blah');
            }
        },
        'check that defaultValue("", "blah")': {
            topic: filters.defaultValue(filters.foo, 'blah'),
            'returns blah': function(topic) {
                assert.equal(topic, 'blah');
            }
        },
        'check that defaultValue("foo", "blah")': {
            topic: filters.defaultValue('foo', 'blah'),
            'returns foo': function(topic) {
                assert.equal(topic, 'foo');
            }
        },
        'check that defaultValue(0, 1)': {
            topic: filters.defaultValue(0, 1),
            'returns 0': function(topic) {
                assert.equal(topic, 0);
            }
        },
        'check that defaultValue(undefined, 1)': {
            topic: filters.defaultValue(filters.foo, 1),
            'return 1': function(topic) {
                assert.equal(topic, 1);
            }
        },

        // escapeJSON tests

        'given an undefined value': {
            topic: filters.escapeJSON(filters.foo),
            'escapeJSON return an empty string': function(topic) {
                assert.equal(topic, '');
            }
        },
        'given an empty string': {
            topic: filters.escapeJSON(''),
            'escapeJSON returns an empty string': function(topic) {
                assert.equal(topic, '');
            }
        },
        'given the text foo': {
            topic: filters.escapeJSON('foo'),
            'escapeJSON returns foo': function(topic) {
                assert.equal(topic, 'foo');
            }
        },
        'given the text "foo"': {
            topic: filters.escapeJSON(dq + 'foo' + dq),
            'escapeJSON returns \"foo\"': function(topic) {
                assert.equal(topic, '\\"foo\\"');
            }
        },
        'check the text \"foo"': {
            topic: filters.escapeJSON(bs + dq + 'foo' + dq),
            'escapeJSON returns \"foo\"': function(topic) {
                assert.equal(topic, '\\"foo\\"');
            }
        },
        'given the text "foo\"': {
            topic: filters.escapeJSON(dq + 'foo' + bs + dq),
            'escapeJSON returns \"foo\"': function(topic) {
                assert.equal(topic, '\\"foo\\"');
            }
        },
        'given the text "\""\"': {
            topic: filters.escapeJSON(dq + bs + dq + dq + bs + dq),
            'escapeJSON returns \"\"\"\"': function(topic) {
                assert.equal(topic, '\\"\\"\\"\\"');
            }
        },

        // escapeXML tests

        'given an undefined value': {
            topic: filters.escapeXML(filters.foo),
            'escapeXML returns empty string': function(topic) {
                assert.equal(topic, '');
            }
        },
        'given an empty string': {
            topic: filters.escapeXML(''),
            'escapeXML returns empty string': function(topic) {
                assert.equal(topic, '');
            }
        },
        'given the characters <>&"': {
            topic: filters.escapeXML('<>&"' + sq),
            'escapeXML returns appropriate XML entities': function(topic) {
                assert.equal(topic, '&lt;&gt;&amp;&quot;&apos;');
            }
        },
        'given an existing XML entity': {
            topic: filters.escapeXML('&&lt;&'),
            'excapeXML leaves it alone': function(topic) {
                assert.equal(topic, '&amp;&lt;&amp;');
            }
        },
        'given random text': {
            topic: filters.escapeXML('this is a test of the emergency broadcasting system'),
            'excapeXML leaves it alone': function(topic) {
                assert.equal(topic, 'this is a test of the emergency broadcasting system');
            }
        },

        // enforceMaxByteSize

        'given an undefined value': {
            topic: filters.enforceMaxByteSize(),
            'enforceMaxByteSize returns empty string': function(topic) {
                assert.equal(topic, '');
            }
        },
        'given an empty string': {
            topic: filters.enforceMaxByteSize(''),
            'enforceMaxByteSize returns empty string': function(topic) {
                assert.equal(topic, '');
            }
        },
        'given maxByteSize == the string size': {
            topic: filters.enforceMaxByteSize('123456', 6),
            'enforceMaxByteSize returns the given string': function(topic) {
                assert.equal(topic, '123456');
            }
        },
        'given maxByteSize < the string size and no tail': {
            topic: filters.enforceMaxByteSize('123456', 1, ''),
            'enforceMaxByteSize returns a string of maxByteSize size': function(topic) {
                assert.equal(topic, '1');
            }
        },
        'given maxByteSize < the string size + a tail': {
            topic: filters.enforceMaxByteSize('123456', 2, 'A'),
            'enforceMaxByteSize returns the given string': function(topic) {
                assert.equal(topic, '1A');
            }
        },
        'given a string with an XML entity and maxByteSize not big enough for it': {
            topic: filters.enforceMaxByteSize('*&amp;*', 5, ''),
            'enforceMaxByteSize shortens before it': function(topic) {
                assert.equal(topic, '*');
            }
        },
        'given a string with an XML entity and maxByteSize big enough for it': {
            topic: filters.enforceMaxByteSize('*&amp;*', 6, ''),
            'enforceMaxByteSize includes it': function(topic) {
                assert.equal(topic, '*&amp;');
            }
        },
        'given a string with a \u12AB sequence and maxByteSize not big enough for it': {
            topic: filters.enforceMaxByteSize('*' + bs + 'u12AB*', 6, ''),
            'enforceMaxByteSize shortens before it': function(topic) {
                assert.equal(topic, '*');
            }
        },
        'given a string with a \u12AB sequence and maxByteSize big enough for it': {
            topic: filters.enforceMaxByteSize('*' + bs + 'u12AB*', 7, ''),
            'enforceMaxByteSize includes it': function(topic) {
                assert.equal(topic, '*' + bs + 'u12AB');
            }
        },
        'given a string with a \r sequence and maxByteSize not big enough for it': {
            topic: filters.enforceMaxByteSize('*' + bs + 'r*', 2, ''),
            'enforceMaxByteSize shortens before it': function(topic) {
                assert.equal(topic, '*');
            }
        },
        'given a string with \r sequence and maxByteSize big enough for it': {
            topic: filters.enforceMaxByteSize('*' + bs + 'r*;', 3, ''),
            'enforceMaxByteSize shortens before it': function(topic) {
                assert.equal(topic, '*' + bs + 'r');
            }
        }
    })
    .export(module);
