"use strict";

var config = require('../config');

process.env.AZURE_STORAGE_ACCOUNT = config.azure_storage_account;
process.env.AZURE_STORAGE_ACCESS_KEY = config.azure_storage_access_key;

var assert = require("assert");
var vows = require("vows");

var RegistrationStore = require("../registrationStore");
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
            store.updateRegistration({userId:'br.howes', registrationId:'myregistration', templateVersion:'1.0',
                                      templateLanguage:'en-us', service:'wns',
                                      routes:[{'name':'*',
                                               'token':'123',
                                               'secondsToLive':86400}]}, this.callback);
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
            store.getRegistrations('br.howes', null, this.callback);
        },
        'succeeds without error': function (err, found) {
            assert.isNull(err);
        },
        'found 1 match': function (err, found) {
            assert.equal(found.length, 1);
        },
        'match contains myregistration': function (err, found) {
            var registration = found[0];
            assert.equal(registration.registrationId, 'myregistration');
            assert.equal(registration.templateVersion, '1.0');
            assert.equal(registration.templateLanguage, 'en-us');
            assert.equal(registration.service, 'wns');
            var route = registration.routes[0];
            assert.equal(route.name, '*');
            assert.equal(route.token, '123');
        }
    }
});

suite.addBatch({
    'delete registration': {
        topic: function () {
            store.deleteRegistration('br.howes', 'myregistration', this.callback);
        },
        'succeeds without error': function (err, found) {
            assert.isNull(err);
        }
    }
});

suite.addBatch({
    'then fetch non-existant registration': {
        topic: function () {
            store.getRegistrations('br.howes', null, this.callback);
        },
        'succeeds without error': function (err, found) {
            assert.isNull(err);
        },
        'found 0 matches': function (err, found) {
            console.log('@@@', found);
            assert.equal(found.length, 0);
        }
    }
});

suite.export(module);