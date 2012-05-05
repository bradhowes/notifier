var config = require('./config');

process.env.AZURE_STORAGE_ACCOUNT = config.azure_storage_account;
process.env.AZURE_STORAGE_ACCESS_KEY = config.azure_storage_access_key;

var assert = require("assert");
var vows = require("vows");

var RegistrationStore = require("./registrationStore");
var store = null;

var suite = vows.describe('registrationStore');
suite.addBatch({
    'create an empty table': {
        topic: function () {
            store = new RegistrationStore('registrationstest', this.callback);
        },
        'succeeds without error': function (err, created, response) {
            assert.equal(err, null);
        }
    }
});

suite.addBatch({
    'add registration': {
        topic: function () {
            store.updateRegistrationEntity('br.howes', 'myregistration', '1.0', 'en', 'wns',
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
    'fetch registrations': {
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
            assert.equal(registration.registrationId, 'myregistration');
            assert.equal(registration.templateVersion, '1.0');
            assert.equal(registration.templateLanguage, 'en');
            assert.equal(registration.contract, 'wns');
            var route = registration.routes[0];
            assert.equal(route.name, '*');
            assert.equal(route.path, '123');
        }
    }
});

suite.addBatch({
    'delete registration': {
        topic: function () {
            store.deleteRegistrationEntity('br.howes', 'myregistration', this.callback);
        },
        'succeeds without error': function (err, found) {
            assert.isNull(err);
        }
    }
});

suite.addBatch({
    'then fetch non-existant registration': {
        topic: function () {
            store.getRegistrations('br.howes', this.callback);
        },
        'succeeds without error': function (err, found) {
            assert.isNull(err);
        },
        'found 0 matches': function (err, found) {
            assert.equal(found.length, 0);
        }
    }
});

suite.run();
