"use strict";

var assert = require("assert");
var vows = require("vows");

var WNS = require('../WNS');
var wns = new WNS();

var suite = vows.describe('WNS');

suite.addBatch({
    'fetch access token': {
        topic: function () {
            wns.fetchAccessToken(this.callback);
        },
        'is not null': function (value) {
            assert.isNotNull(value);
        },
        'is string': function (value) {
            assert.isString(value);
        }
    }
});

suite.addBatch({
    'get access token': {
        topic: function() {
            wns.validateAccessToken(this.callback);
        },
        'is not null': function (a, b) {
            assert.isNotNull(b);
        },
        'is string': function (a, b) {
            assert.isString(b);
        }
    }
});

suite.addBatch({
    'then send notification': {
        topic: function() {
            var credential = 'https://db3.notify.windows.com/?token=AQQAAAC%2fsMpH5bFteWK56Lj4deymvLbruJe6FLrSedhklPSU21iRddDPUY3%2fRs9Nf5yEuO%2fz0KUrLfeeahzK2JeLfLdf2Fg6cfNr1DIhGCFB%2fpKQpFE57DLi3%2bENxqPes4SM6tM%3d';
            wns.sendNotification(credential,
                          JSON.stringify({'kind': 'wns/badge',
                                          'text': '<?xml version="1.0" encoding="utf-8"?><badge value="3"/>'}),
                          this.callback);
        },
        'delivered': function (a, b) {
            console.log(a);
            assert.isFalse(a.retry);
        },
        'invalid token': function (a, b) {
            console.log(a);
            assert.isTrue(a.invalidToken);
        }
    }
});

suite.export(module);
