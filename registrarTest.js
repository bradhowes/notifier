var config = require('./config');

process.env.AZURE_STORAGE_ACCOUNT = config.azure_storage_account;
process.env.AZURE_STORAGE_ACCESS_KEY = config.azure_storage_access_key;

var assert = require("assert");
var vows = require("vows");

var RegistrationStore = require("./registrationStore");
var Registrar = require("./registrar");
var store = null;
var registrar = null;

function Response(t, cb) {
    this.tag = t;
    this.cb = cb;
}

Response.prototype = {
    'send': function (a,b,c) { console.log(this.tag, 'err:', c); this.cb(undefined, c); this.cb = undefined; },
    'json': function (a) { console.log(this.tag, 'out:', a); this.cb(a, undefined); this.cb = undefined; }
};

vows.describe('registrar').addBatch({
    'create an empty table': {
        topic: function () {
            store = new RegistrationStore('registrationstest', this.callback);
        },
        'succeeds without error': function (err, created, response) {
            assert.equal(err, null);
            registrar = new Registrar(store);
        },
        'then add registration': {
            topic: function () {
                var req = {
                    'params': { 'userId': 'br.howes' },
                    'body': {
                        'registrationId': 'myregistration',
                        'templateVersion': '3.0',
                        'templateLanguage': 'en',
                        'contract': 'wns',
                        'routes': [ { 'name': '*', 'path': '123', 'secondsToLive': 86400 } ]
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
                assert.equal(out.contract, 'wns');
                assert.equal(out.routes.length, 1);
                assert.equal(out.routes[0].name, '*');
                assert.equal(out.routes[0].path, '123');
                assert.equal(out.routes[0].expiration, out.expiration);
            },
            'then delete registration': {
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
        },
        'then fetch registrations': {
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
            'matches input': function (out, err) {
                out = out.registrations[0];
                assert.equal(out.registrationId, 'myregistration');
                assert.equal(out.templateVersion, '3.0');
                assert.equal(out.templateLanguage, 'en');
                assert.equal(out.contract, 'wns');
                assert.equal(out.routes.length, 1);
                assert.equal(out.routes[0].name, '*');
                assert.equal(out.routes[0].path, '123');
                assert.equal(out.routes[0].expiration, out.expiration);
            }
        }
    }
}).run();
