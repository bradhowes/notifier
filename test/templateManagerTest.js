"use strict";

var config = require('./config');

process.env.AZURE_STORAGE_ACCOUNT = config.azure_storage_account;
process.env.AZURE_STORAGE_ACCESS_KEY = config.azure_storage_access_key;

var assert = require("assert");
var vows = require("vows");

var TemplateStore = require("./templateStore");
var TemplateManager = require("./templateManager");
var store = null;
var templateManager = null;

function RequestParam(name, defaultValue) {
    if (this.body && undefined !== this.body[name])
        return this.body[name];
    if (this.params && this.params.hasOwnProperty(name) && undefined !== this.params[name])
        return this.params[name];
    if (undefined !== this.query[name])
        return this.query[name];
    return defaultValue;
};

function Response(t, cb) {
    this.tag = t;
    this.cb = cb;
}

Response.prototype = {
    'send': function (a,b,c) { this.cb(undefined, c); this.cb = undefined; },
    'json': function (a) { this.cb(a, undefined); this.cb = undefined; }
};

var suite = vows.describe('templateManager');
suite.addBatch({
    'create an empty table': {
        topic: function () {
            store = new TemplateStore('templateManagerTest', this.callback);
        },
        'succeeds without error': function (err, created, response) {
            assert.equal(err, null);
            templateManager = new TemplateManager(store);
        }
    }
});

suite.addBatch({
    'add template': {
        topic: function () {
            var req = {
                'query': {},
                'params': {},
                'body': {
                    'eventId': 200,
                    'notificationId': 2000,
                    'routeName': '*',
                    'templateVersion': '1.0',
                    'templateLanguage': 'en',
                    'service': 'wns',
                    'content': JSON.stringify({'kind': 'wns/badge',
                                               'text': '<?xml version="1.0" encoding="utf-8"?><badge value="3"/>'})
                } };
            req.param = RequestParam;
            templateManager.addTemplate(req, new Response('addTemplate', this.callback));
        },
        'succeeds without error': function (out, err) {
            assert.strictEqual(err, undefined);
            assert.isObject(out);
        }
    }
});

suite.addBatch({
    'get templates': {
        topic: function () {
            var req = {
                'body': {},
                'params': {},
                'query': {
                    'eventId': 200,
                    'routeName': '*',
                    'templateVersion': '1.0',
                    'templateLanguage': 'en-US',
                    'service': 'wns'
                } };
            req.param = RequestParam;
            templateManager.getTemplates(req, new Response('addTemplate', this.callback));
        },
        'succeeds without error': function (out, err) {
            assert.strictEqual(err, undefined);
            assert.isObject(out);
        },
        'has one template': function (out, err) {
            out = out.templates;
            assert.strictEqual(out.length, 1);
        }
    },
    'get default en template': {
        topic: function () {
            var req = {
                'body': {},
                'params': {},
                'query': {
                    'eventId': 200,
                    'routeName': '*',
                    'templateVersion': '1.0',
                    'templateLanguage': 'de-GR',
                    'service': 'wns'
                } };
            req.param = RequestParam;
            templateManager.getTemplates(req, new Response('addTemplate', this.callback));
        },
        'succeeds without error': function (out, err) {
            assert.strictEqual(err, undefined);
            assert.isObject(out);
        },
        'has one template': function (out, err) {
            out = out.templates;
            assert.strictEqual(out.length, 1);
        }
    },
    'no match': {
        topic: function () {
            var req = {
                'body': {},
                'params': {},
                'query': {
                    'eventId': 200,
                    'routeName': '*',
                    'templateVersion': '1.1',
                    'templateLanguage': 'de-GR',
                    'service': 'wns'
                } };
            req.param = RequestParam;
            templateManager.getTemplates(req, new Response('getTemplates', this.callback));
        },
        'raises 404 Not Found error': function (out, err) {
            assert.strictEqual(err, 404);
            assert.strictEqual(out, null);
        }
    }
});

suite.addBatch({
    'delete non-existant template': {
        topic: function () {
            var req = {
                'body': {},
                'params': {},
                'query': {
                    'eventId': 200,
                    'notificationId': 2000,
                    'routeName': '*',
                    'templateVersion': '1.0',
                    'templateLanguage': 'en-US',
                    'service': 'wns'
                } };
            req.param = RequestParam;
            templateManager.deleteTemplate(req, new Response('deleteTemplate', this.callback));
        },
        'returns 404 Not Found': function (out, err) {
            assert.strictEqual(err, 404);
            assert.strictEqual(out, null);
        }
    }
});

suite.addBatch({
    'delete template': {
        topic: function () {
            var req = {
                'params': {},
                'body': {
                    'eventId': 200,
                    'notificationId': 2000,
                    'routeName': '*',
                    'templateVersion': '1.0',
                    'templateLanguage': 'en',
                    'service': 'wns'
                } };
            req.param = RequestParam;
            templateManager.deleteTemplate(req, new Response('deleteTemplate', this.callback));
        },
        'returns 204 No Content': function (out, err) {
            assert.strictEqual(err, 204);
            assert.strictEqual(out, null);
        }
    }
});

suite.addBatch({
    'delete template again': {
        topic: function () {
            var req = {
                'body': {},
                'params': {},
                'query': {
                    'eventId': 200,
                    'notificationId': 2000,
                    'routeName': '*',
                    'templateVersion': '1.0',
                    'templateLanguage': 'en',
                    'service': 'wns'
                } };
            req.param = RequestParam;
            templateManager.deleteTemplate(req, new Response('deleteTemplate', this.callback));
        },
        'returns 404 Not Found': function (out, err) {
            assert.strictEqual(err, 404);
            assert.strictEqual(out, null);
        }
    }
});

suite.run();
