var assert = require("assert");
var vows = require("vows");
var PayloadGenerator =require("./payloadGenerator");
var pg = new PayloadGenerator();

vows.describe('payloadGenerator').addBatch({
    'handle missing values': {
        topic: function() {
            var subs = { "BAR": "bar" };
            return pg.transform("@@FOO@@ @@BAR@@", subs);
        },
        'missing FOO': function(topic) {
            assert.equal(topic, ' bar');
        }
    },
    'handle default values': {
        topic: function() {
            var subs = { "BAR": "bar" };
            return pg.transform("@@FOO=123@@ @@BAR@@", subs);
        },
        'missing FOO': function(topic) {
            assert.equal(topic, '123 bar');
        }
    },
    'handle normal values': {
        topic: function() {
            var subs = { 'FOO': 'foo', 'BAR': 'bar' };
            return pg.transform("@@FOO=123@@ @@BAR=456@@", subs);
        },
        'missing FOO': function(topic) {
            assert.equal(topic, 'foo bar');
        }
    }
}).run();
