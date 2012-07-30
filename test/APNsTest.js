"use strict";

var assert = require("assert");
var vows = require("vows");

var APNs = require('../APNs');
var NotificationRequest = require('../notificationRequest');
var apns = new APNs();

var suite = vows.describe('APNs');

suite.addBatch({
    'send notification': {
        topic: function() {
            var nr = new NotificationRequest('123', '6aBSE3NLfNw9TwAEUgV+pHgeVU6eEWraSar9f4ycf98=',
                                             {content: {"aps":{"alert":"Hello, world!","badge":1,"sound":"default"}}},
                                             10);
            apns.sendNotification(nr, this.callback);
        },
        'delivered': function (a, b) {
            console.log(arguments);
//            assert.isFalse(a.retry);
        },
        'valid': function (a, b) {
            console.log(arguments);
//            assert.isFalse(b.invalidToken);
        }
    }
});

suite.export(module);
