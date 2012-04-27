var config = require('./config');

process.env.AZURE_STORAGE_ACCOUNT = config.azure_storage_account;
process.env.AZURE_STORAGE_ACCESS_KEY = config.azure_storage_access_key;

var assert = require("assert");
var vows = require("vows");

var RegistrationStore = require("./registrationStore");
var store = null;

vows.describe('registrationStore').addBatch({
    'create an empty table': {
        topic: function () {
            store = new RegistrationStore('registrationstest', this.callback);
        },
        'succeeds without error': function (err, created, response) {
//            console.log('new RegistrationStore: err:', err, "created:", created);
            assert.equal(err, null);
        },
        'then add registration': {
            topic: function () {
                store.updateRegistrationEntity('br.howes', 'myregistration', '1.0', 'en', 'wns',
                                         [{'name':'*',
                                           'path':'123',
                                           'secondsToLive':86400}], this.callback);
            },
            'succeeds without error': function (err, entity) {
//                console.log('store.updateRegistrationEntity: err:', err, "entity:", entity);
                assert.isNull(err);
            },
            'and returns the registration entity': function (err, entity) {
                assert.isObject(entity);
            },
            'then fetch registrations': {
                topic: function () {
                    store.getRegistrations('br.howes', this.callback);
                },
                'succeeds without error': function (err, found) {
//                    console.log('store.getRegistrations: err:', err, "found:", found);
                    assert.isNull(err);
                },
                'found 1 match': function (err, found) {
                    assert.equal(found.length, 1);
                },
                'match contains myregistration': function (err, found) {
                    var registration = found[0];
//                    console.log('registration:', registration);
                    assert.equal(registration.registrationId, 'myregistration');
                    assert.equal(registration.templateVersion, '1.0');
                    assert.equal(registration.templateLanguage, 'en');
                    assert.equal(registration.contract, 'wns');
                    var route = registration.routes[0];
//                    console.log('route:', route);
                    assert.equal(route.name, '*');
                    assert.equal(route.path, '123');
//                    assert.equal(route.expiration, 456);
                },
                'then delete registration': {
                    topic: function () {
                        store.deleteRegistrationEntity('br.howes', 'myregistration', this.callback);
                    },
                    'succeeds without error': function (err, found) {
//                        console.log('store.deleteRegistrationEntity: err:', err, "found:", found);
                        assert.isNull(err);
                    },
                    'then fetch non-existant registration': {
                        topic: function () {
                            store.getRegistrations('br.howes', this.callback);
                        },
                       'succeeds without error': function (err, found) {
//                            console.log('store.getDevices: err:', err, "found:", found);
                            assert.isNull(err);
                        },
                        'found 0 matches': function (err, found) {
                            assert.equal(found.length, 0);
                        }
                    }
                }
            }
        }
    }
}).run();
