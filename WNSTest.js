var assert = require("assert");
var vows = require("vows");

var WNS = require('./WNS');
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
        'is not null': function (value) {
            assert.isNotNull(value);
        },
        'is string': function (value) {
            assert.isString(value);
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
        'delivered': function (err, statusCode) {
            assert.isNull(err);
            // assert.equal(statusCode, 200, "Invalid status code");
        }
    }
});

suite.run();
