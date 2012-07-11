var config = require('../config');

process.env.AZURE_STORAGE_ACCOUNT = config.azure_storage_account;
process.env.AZURE_STORAGE_ACCESS_KEY = config.azure_storage_access_key;

var assert = require("assert");
var vows = require("vows");

var RegistrationStore = require("../registrationStore");
var Registrar = require("../registrar");
var store = null;
var registrar = null;

function Response(t, cb) {
    this.tag = t;
    this.cb = cb;
}

Response.prototype = {
    'send': function (a,b,c) { this.cb(undefined, c); this.cb = undefined; },
    'json': function (a) { this.cb(a, undefined); this.cb = undefined; }
};

var suite = vows.describe('register');
suite.addBatch({
    'create an empty table': {
        topic: function () {
            store = new RegistrationStore('registrationstest', this.callback);
        },
        'succeeds without error': function (err, created, response) {
            assert.equal(err, null);
            registrar = new Registrar(store);
        }
    }
});

suite.addBatch({
    'add registration': {
        topic: function () {
            var req = {
                'params': { 'userId': 'br.howes' },
                'body': {
                    'registrationId': 'myregistration',
                    'templateVersion': '3.0',
                    'templateLanguage': 'en',
                    'service': 'wns',
                    'routes': [ { 'name': '*', 'token': '123', 'secondsToLive': 86400 } ]
                } };
            registrar.addRegistration(req, new Response('addRegistration', this.callback));
        },
        'succeeds without error': function (out, err) {
            assert.strictEqual(err, undefined);
            assert.isObject(out);
        },
        'matches input': function (out, err) {
            assert.equal(out.registrationId, 'myregistration');
            assert.equal(out.templateVersion, '3.0');
            assert.equal(out.templateLanguage, 'en');
            assert.equal(out.service, 'wns');
            assert.equal(out.routes.length, 1);
            assert.equal(out.routes[0].name, '*');
            assert.equal(out.routes[0].token, '123');
            assert.equal(out.routes[0].expiration, out.expiration);
        }
    }
});

suite.addBatch({
    'fetch registrations': {
        topic: function () {
            var req = {
                'params': { 'userId': 'br.howes' }
            };
            registrar.getRegistrations(req, new Response('getRegistrations', this.callback));
        },
        'succeeds without error': function (out, err) {
            assert.strictEqual(err, undefined);
            assert.isObject(out);
        },
        'matches registration': function (out, err) {
            out = out.registrations[0];
            assert.equal(out.registrationId, 'myregistration');
            assert.equal(out.templateVersion, '3.0');
            assert.equal(out.templateLanguage, 'en');
            assert.equal(out.service, 'wns');
            assert.equal(out.routes.length, 1);
            assert.equal(out.routes[0].name, '*');
            assert.equal(out.routes[0].token, '123');
            assert.equal(out.routes[0].expiration, out.expiration);
        }
    }
});

suite.addBatch({
    'delete registration': {
        topic: function () {
            var req = {
                'params': { 'userId': 'br.howes' },
                'body': { 'registrationId': 'myregistration'}
            };
            registrar.deleteRegistration(req, new Response('deleteRegistration', this.callback));
        },
        'succeeds without error': function (out, err) {
            assert.strictEqual(out, null);
            assert.strictEqual(err, 204);
        }
    }
});

suite.addBatch({
    'fetch after deletion': {
        topic: function () {
            var req = {
                'params': { 'userId': 'br.howes' }
            };
            registrar.getRegistrations(req, new Response('getRegistrations', this.callback));
        },
        'succeeds without error': function (out, err) {
            assert.strictEqual(out, null);
            assert.strictEqual(err, 404);
        }
    }
});

suite.export(module);
