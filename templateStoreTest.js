"use strict";

var config = require('./config');

process.env.AZURE_STORAGE_ACCOUNT = config.azure_storage_account;
process.env.AZURE_STORAGE_ACCESS_KEY = config.azure_storage_access_key;

var assert = require("assert");
var vows = require("vows");

var TemplateStore = require("./templateStore");
var store = null;

var suite = vows.describe('templateStore');
suite.addBatch({
    'create an empty table': {
        topic: function () {
            store = new TemplateStore('templatetest', this.callback);
        },
        'succeeds without error': function (err, created, response) {
            assert.equal(err, null);
        }
    }
});

suite.addBatch({
    'add template': {
        topic: function () {
            store.addTemplate(200, 2000, '*', '1.0', 'en', 'wns',
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
    'find en-US template': {
        topic: function () {
            var reg = {
                'templateVersion':'1.0',
                'templateLanguage':'en-US',
                'contract':'wns',
                'routes':[{'name':'*', 'path':'http://a.b.c'}]
            };
            store.findTemplates(200, [reg], this.callback);
        },
        'succeeds without error': function (err, found) {
            assert.isNull(err);
        },
        'found 1 match': function (err, found) {
            assert.equal(found.length, 1);
        }
    },
    'find en template': {
        topic: function () {
            var reg = {
                'templateVersion':'1.0',
                'templateLanguage':'en',
                'contract':'wns',
                'routes':[{'name':'*', 'path':'http://a.b.c'}]
            };
            store.findTemplates(200, [reg], this.callback);
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
                'contract':'wns',
                'routes':[{'name':'*', 'path':'http://a.b.c'}]
            };
            store.findTemplates(200, [reg], this.callback);
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
                'contract':'wns',
                'routes':[{'name':'*', 'path':'http://a.b.c'}]
            };
            store.findTemplates(200, [reg], this.callback);
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
                'contract':'wns',
                'routes':[{'name':'*', 'path':'http://a.b.c'}]
            };
            store.findTemplates(201, [reg], this.callback);
        },
        'succeeds without error': function (err, found) {
            assert.isNull(err);
        },
        'found 1 match': function (err, found) {
            assert.equal(found.length, 0);
        }
    }
});

suite.run();
