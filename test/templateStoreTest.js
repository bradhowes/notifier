"use strict";

var config = require('../config');

process.env.AZURE_STORAGE_ACCOUNT = config.azure_storage_account;
process.env.AZURE_STORAGE_ACCESS_KEY = config.azure_storage_access_key;

var assert = require("assert");
var vows = require("vows");

var TemplateStore = require("../templateStore");
var store = null;

var suite = vows.describe('templateStore');

suite.addBatch({
    'create an empty table': {
        topic: function () {
            store = new TemplateStore('templateStoreTest', this.callback);
        },
        'succeeds without error': function (err, created, response) {
            console.log('*** 1 *** ');
            assert.equal(err, null);
        }
    }
});

suite.addBatch({
    'add template': {
        topic: function () {
            store.add(
                {
                    eventId:200,
                    notificationId: 2000,
                    route:'*',
                    templateVersion:'1.0',
                    templateLanguage:'en',
                    service:'wns',
                    template: {
                        'kind': 'wns/badge',
                        'content': '<?xml version="1.0" encoding="utf-8"?><badge value="@@COUNT@@"/>'
                    }
                },
                this.callback);
        },
        'succeeds without error': function (err, entity) {
            console.log('*** 2 *** ');
            assert.isNull(err);
        },
        'and returns the template entity': function (err, entity) {
            assert.isObject(entity);
        }
    }
});

suite.addBatch({
    'find en-US template': {
        topic: function () {
            var reg = {
                'templateVersion':'1.0',
                'templateLanguage':'en-us',
                'service':'wns',
                'routes':[{'name':'*', 'token':'http://a.b.c'}]
            };
            store.find(200, [reg], this.callback);
        },
        'succeeds without error': function (err, found) {
            assert.isNull(err);
        },
        'found 1 match': function (err, found) {
            assert.equal(found.length, 1);
        },
        'generated text matches': function (err, found) {
            var text = found[0].template.content({COUNT:3});
            assert.equal('<?xml version="1.0" encoding="utf-8"?><badge value="3"/>', text);
        }
    },
    'find en template': {
        topic: function () {
            var reg = {
                'templateVersion':'1.0',
                'templateLanguage':'en',
                'service':'wns',
                'routes':[{'name':'*', 'token':'http://a.b.c'}]
            };
            store.find(200, [reg], this.callback);
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
            var reg = {
                'templateVersion':'1.1',
                'templateLanguage':'en',
                'service':'wns',
                'routes':[{'name':'*', 'token':'http://a.b.c'}]
            };
            store.find(200, [reg], this.callback);
        },
        'succeeds without error': function (err, found) {
            assert.isNull(err);
        },
        'found 1 match': function (err, found) {
            assert.equal(found.length, 0);
        }
    },
    'find en template as default for de one': {
        topic: function () {
            var reg = {
                'templateVersion':'1.0',
                'templateLanguage':'de-AU',
                'service':'wns',
                'routes':[{'name':'*', 'token':'http://a.b.c'}]
            };
            store.find(200, [reg], this.callback);
        },
        'succeeds without error': function (err, found) {
            assert.isNull(err);
        },
        'found 1 match': function (err, found) {
            assert.equal(found.length, 1);
        }
    },
    'fail to locate 201 template': {
        topic: function () {
            var reg = {
                'templateVersion':'1.0',
                'templateLanguage':'en',
                'service':'wns',
                'routes':[{'name':'*', 'token':'http://a.b.c'}]
            };
            store.find(201, [reg], this.callback);
        },
        'succeeds without error': function (err, found) {
            assert.isNull(err);
        },
        'found 1 match': function (err, found) {
            assert.equal(found.length, 0);
        }
    }
});

suite.addBatch({
    'delete template': {
        topic: function () {
            store.del(
                {
                    eventId:200,
                    notificationId:2000,
                    route:'*',
                    templateVersion:'1.0',
                    templateLanguage:'en',
                    service:'wns'
                },
                this.callback);
        },
        'succeeds without error': function (err, entity) {
            assert.isNull(err);
        },
        'delete template again': {
            topic: function () {
                store.del(
                    {
                        eventId:200,
                        notificationId:2000,
                        route:'*',
                        templateVersion:'1.0',
                        templateLanguage:'en',
                        service:'wns'
                    },
                    this.callback);
            },
            'fails with error': function (err, entity) {
                console.log(err, entity);
                assert.isNotNull(err);
                assert.equal(err.code, "ResourceNotFound");
            }
        }
    }
});

suite.addBatch({
    'find template after deletion': {
        topic: function () {
            var reg = {
                'templateVersion':'1.0',
                'templateLanguage':'en-us',
                'service':'wns',
                'routes':[{'name':'*', 'token':'http://a.b.c'}]
            };
            store.find(200, [reg], this.callback);
        },
        'succeeds without error': function (err, found) {
            assert.isNull(err);
        },
        'found 0 matches': function (err, found) {
            assert.equal(found.length, 0);
        }
    }
});

suite.export(module);
