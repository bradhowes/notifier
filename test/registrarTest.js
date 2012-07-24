'use strict';

var assert = require('assert');
var pact = require('pact');
var vows = require('vows');

var Registrar = require('../registrar');
var RegistrationStore = require('../registrationStore');
var Server = require('../server');
var TemplateStore = require('../templateStore');
var TemplateManager = require('../templateManager');

var registrationStore = null;
var templateStore = null;
var server = null;

var validRegistration = {
    registrationId: 'myregistration',
    templateVersion: '3.0',
    templateLanguage: 'en',
    service: 'wns',
    routes: [ { 'name': '*', 'token': '123', 'secondsToLive': 60 } ]
};

var validTemplate = {
    eventId: 200,
    notificationId: 100,
    templateVersion: '3.0',
    templateLanguage: 'en-us',
    route: '*',
    service: 'wns',
    template: JSON.stringify(
        {
            kind: 'wns/badge',
            text: '<?xml version="1.0" encoding="utf-8"?><badge value="3"/>'
        }
    )
};

var validPost = {
    eventId: 200,
    substitutions: {}
};

var suite = vows.describe('REST API testing');

suite.addBatch(
    {
        'startup registration store': {
            topic: function () {
                registrationStore = new RegistrationStore('registrationsTest', this.callback);
            },
            'succeeds without error': function (err, created, response) {
                assert.strictEqual(err, null);
            }
        }
    }
);

suite.addBatch(
    {
        'startup template store': {
            topic: function () {
                templateStore = new TemplateStore('templatesTest', this.callback);
            },
            'succeeds without error': function (err, created, response) {
                assert.strictEqual(err, null);
            }
        }
    }
);

suite.addBatch(
    {
        'template manager testing': {
            topic: function () {
                var vows = this;
                server = new Server();
                server.templateManager = new TemplateManager(templateStore);
                server.registrar = new Registrar(registrationStore);
                var port = pact.getPort();
                server.createServer().listen(port, '127.0.0.1', function (err) {
                                                 vows.callback(err, port);
                                             });
            },
            'attempt to add invalid template': {
                topic: pact.request(
                    {
                        url:'/templates',
                        method: 'POST',
                        headers: {'Content-Type':'application/json'},
                        data: JSON.stringify(
                            {
                                eventId: 200,
                                notificationId: 100,
                                templateVersion: '3.0',
                                templateLanguage: 'en-us',
                                route: '*'
                            })
                    }
                ),
                'should fail': pact.code(400),
                'body should contain errors': function (res) {
                    var body = res.body;
                    assert.isObject(body);
                }
            }
        }
    }
);

suite.addBatch(
    {
        'after server is running': {
            topic: pact.httpify(createServer()),
            'when valid template is posted': {
                topic: pact.request(
                    {
                        url:'/post/br.howes',
                        method: 'POST',
                        headers: {'Content-Type':'application/json'},
                        data: JSON.stringify(validPost)
                    }
                ),
                'should succeed': pact.code(202),
                'body should be empty': function (res) {
                    assert.isNull(res.body);
                }
            }
        }
    }
);

suite.addBatch(
    {
        'after server is running': {
            topic: pact.httpify(createServer()),
            'when valid template is posted': {
                topic: pact.request(
                    {
                        url:'/post/br.howes',
                        method: 'POST',
                        headers: {'Content-Type':'application/json'},
                        data: JSON.stringify(validPost)
                    }
                ),
                'should succeed': pact.code(202),
                'body should be empty': function (res) {
                    assert.isNull(res.body);
                }
            }
        }
    }
);

suite.export(module);
