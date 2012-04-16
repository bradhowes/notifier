var assert = require("assert");
var vows = require("vows");
var config = require("./config");

vows.describe('config').addBatch({
    'We can see values': {
        topic: config.wns_host,
            'wns_host is defined': function (topic) {
                assert.isString(topic);
            },
            'wns_host is not empty': function (topic) {
                assert.notEqual(topic.length, 0);
            }
    }
}).run();
