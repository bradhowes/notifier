var assert = require("assert");
var vows = require("vows");
var config = require('./config');

process.env.AZURE_STORAGE_ACCOUNT = config.azure_storage_account;
process.env.AZURE_STORAGE_ACCESS_KEY = config.aure_storage_access_key;

var RegistrationStore = require("./registrationStore");
var store = null;

vows.describe('registrationStore').addBatch({
    'create an empty table': {
        topic: function () {
            store = new RegistrationStore({
                'name': 'registrationstest',
                'callback': this.callback
            });
        },
        'succeeds without error': function (err, created, response) {
//            console.log('new RegistrationStore: err:', err, "created:", created);
            assert.equal(err, null);
        },
        'then add registration': {
            topic: function () {
                store.updateDeviceEntity('br.howes', 'mydevice', '1.0', 'en', 1,
                                         [{'context':'*',
                                           'credential':'123',
                                           'expiration':456}], this.callback);
            },
            'succeeds without error': function (err, entity) {
//                console.log('store.updateDeviceEntity: err:', err, "entity:", entity);
                assert.isNull(err);
            },
            'and returns the template entity': function (err, entity) {
                assert.isObject(entity);
            },
            'then fetch devices': {
                topic: function () {
                    store.getDevices('br.howes', this.callback);
                },
                'succeeds without error': function (err, found) {
//                    console.log('store.getDevices: err:', err, "found:", found);
                    assert.isNull(err);
                },
                'found 1 match': function (err, found) {
                    assert.equal(found.length, 1);
                },
                'match contains mydevice': function (err, found) {
                    var device = found[0];
                    assert.equal(device.deviceId, 'mydevice');
                    assert.equal(device.templateVersion, '1.0');
                    assert.equal(device.templateLanguage, 'en');
                    assert.equal(device.serviceType, 1);
                    var route = device.routes[0];
//                    console.log('route:', route);
                    assert.equal(route.context, '*');
                    assert.equal(route.credential, '123');
                    assert.equal(route.expiration, 456);
                },
                'then delete device': {
                    topic: function () {
                        store.deleteDeviceEntity('br.howes', 'mydevice', this.callback);
                    },
                    'succeeds without error': function (err, found) {
//                        console.log('store.deleteDeviceEntity: err:', err, "found:", found);
                        assert.isNull(err);
                    },
                    'then fetch non-existant device': {
                        topic: function () {
                            store.getDevices('br.howes', this.callback);
                        },
                       'succeeds without error': function (err, found) {
//                            console.log('store.getDevices: err:', err, "found:", found);
                            assert.isNull(err);
                        },
                        'found 0 matches': function (err, found) {
                            assert.equal(found.length, 0);
                        },
                    }
                }
            }
        }
    }
}).run();
