var config = require('./config');

process.env.AZURE_STORAGE_ACCOUNT = config.azure_storage_account;
process.env.AZURE_STORAGE_ACCESS_KEY = config.azure_storage_access_key;

var assert = require("assert");
var vows = require("vows");

var TemplateStore = require("./templateStore");
var RegistrationStore = require("./registrationStore");
var PayloadGenerator = require("./payloadGenerator");
var Notifier = require("./notifier");

var templateStore = new TemplateStore('templatestest');
var registrationStore = new RegistrationStore('registrationstest');
var generator = new PayloadGenerator();
var senders = {
    'wns': null
};

var notifier = new Notifier(templateStore, registrationStore, generator, senders);

function Response(t, cb) {
    this.tag = t;
    this.cb = cb;
    this.path = null;
    this.content = null;
}

Response.prototype = {
    'sendNotification': function(a,b) { this.path = a; this.content = b;},
    'send': function (a,b,c) { this.cb(undefined, c, this); },
    'json': function (a) { this.cb(a, undefined, this); }
};

var suite = vows.describe('notifier');
suite.addBatch({
    'add registration': {
        topic: function () {
            registrationStore.updateRegistrationEntity('br.howes', 'myregistration', '1.0', 'en', 'wns',
                                                       [{'name':'*',
                                                         'path':'123',
                                                         'secondsToLive':86400}], this.callback);
        },
        'succeeds without error': function (err, entity) {
            assert.isNull(err);
        },
        'and returns the registration entity': function (err, entity) {
            assert.isObject(entity);
        }
    }
});

suite.addBatch({
    'add template': {
        topic: function () {
            templateStore.addTemplate(200, 2000, '*', '1.0', 'en', 'wns',
                                      JSON.stringify({
                                                         'kind': 'wns/badge',
                                                         'text': '<?xml version="1.0" encoding="utf-8"?><badge value="3"/>'
                                                     }), this.callback);
        },
        'succeeds without error': function (err, entity) {
            assert.isNull(err);
        },
        'and returns the template entity': function (err, entity) {
            assert.isObject(entity);
        }
    }
});

suite.addBatch({
    'post notification': {
        topic: function () {
            var req = {
                'params': {'userId':'br.howes'},
                'body': {
                    'eventId': 200,
                    'substitutions': {}
                } };
            var res = new Response('post notification', this.callback);
            senders['wns'] = res;
            notifier.postNotification(req, res);
        },
        'succeeds without error': function (out, err, res) {
            assert.strictEqual(err, 202);
            assert.strictEqual(out, null);
        }
    }
});
suite.run();
