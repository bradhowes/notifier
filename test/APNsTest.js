"use strict";

var assert = require("assert");
var vows = require("vows");

var APNs = require('../APNs');
var apns = new APNs();

var suite = vows.describe('APNs');

suite.addBatch({
    'send notification': {
        topic: function() {
            var token = '6aBSE3NLfNw9TwAEUgV+pHgeVU6eEWraSar9f4ycf98=';
            var content = JSON.stringify({"aps":{"alert":"Hello, world!","badge":1,"sound":"default"}});
            apns.sendNotification(token, content, this.callback);
        },
        'delivered': function (result, dummy) {
            assert.isFalse(result.retry);
        },
        'valid': function (result, dummy) {
            assert.isFalse(result.invalidToken);
        }
    }
});

suite.export(module);
