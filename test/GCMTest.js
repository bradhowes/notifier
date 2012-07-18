"use strict";

var assert = require("assert");
var vows = require("vows");

var WNS = require('../GCM');
var wns = new WNS();

var suite = vows.describe('GCM');

suite.addBatch({
    'send notification': {
        topic: function() {
            var credential = 'APA91bHun4MxP5egoKMwt2KZFBaFUH-1RYqx';
            wns.sendNotification(credential,
                                 JSON.stringify({'collapse_key': 'foobar',
                                                 'time_to_live': 108,
                                                 'delay_while_idle': true,
                                                 'data': {
                                                     'score': '4x8',
                                                     'time': '15:16.2342'
                                                 }}),
                                 this.callback);
        },
        'delivered': function (a, b) {
            console.log(a);
            assert.isFalse(a.retry);
        },
        'valid token': function (a, b) {
            console.log(a);
            assert.isFalse(a.invalidToken);
        }
    }
});

suite.export(module);
