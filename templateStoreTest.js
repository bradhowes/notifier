var assert = require("assert");
var vows = require("vows");
var config = require('./config');

process.env.AZURE_STORAGE_ACCOUNT = config.azure_storage_account;
process.env.AZURE_STORAGE_ACCESS_KEY = config.aure_storage_access_key;

var TemplateStore = require("./templateStore");
var store = null;

vows.describe('templateStore').addBatch({
    'create an empty table': {
        topic: function () {
            store = new TemplateStore({
                'name': 'templatetest',
                'callback': this.callback
            });
        },
        'succeeds without error': function (err, created, response) {
            assert.equal(err, null);
        },
        'then add template': {
            topic: function () {
                store.addTemplate(200, 2000, '*', '1.0', 'en',
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
            },
            'then find en-US template': {
                topic: function () {
                    store.locate(200, '*', '1.0', 'en-US', this.callback);
                },
                'succeeds without error': function (err, found) {
                    assert.isNull(err);
                },
                'found 1 match': function (err, found) {
                    assert.equal(found.length, 1);
                }
            },
            'then find en template': {
                topic: function () {
                    store.locate(200, '*', '1.0', 'en', this.callback);
                },
                'succeeds without error': function (err, found) {
                    assert.isNull(err);
                },
                'found 1 match': function (err, found) {
                    assert.equal(found.length, 1);
                }
            },
            'fail to locate 1.1 template': {
                topic: function () {
                    store.locate(200, '*', '1.1', 'en', this.callback);
                },
                'succeeds without error': function (err, found) {
                    assert.isNull(err);
                },
                'found 1 match': function (err, found) {
                    assert.equal(found.length, 0);
                }
            },
            'fail to locate de template': {
                topic: function () {
                    store.locate(200, '*', '1.0', 'de', this.callback);
                },
                'succeeds without error': function (err, found) {
                    assert.isNull(err);
                },
                'found 1 match': function (err, found) {
                    assert.equal(found.length, 0);
                }
            },
            'fail to locate 201 template': {
                topic: function () {
                    store.locate(201, '*', '1.0', 'en', this.callback);
                },
                'succeeds without error': function (err, found) {
                    assert.isNull(err);
                },
                'found 1 match': function (err, found) {
                    assert.equal(found.length, 0);
                }
            }
        }
    }
}).run();
