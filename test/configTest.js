"use strict";

var assert = require("assert");
var vows = require("vows");
var config = require("../config");

var suite = vows.describe('config');

suite.addBatch({
    'We can see values': {
        topic: config.wns_package_sid,
            'wns_host is defined': function (topic) {
                assert.isString(topic);
            },
            'wns_host is not empty': function (topic) {
                assert.notEqual(topic.length, 0);
            }
    }
});

suite.export(module);
