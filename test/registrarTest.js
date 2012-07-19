'use strict';

var assert = require('assert');
var pact = require('pact');
var vows = require('vows');
var express = require('express');

var RegistrationStore = require('../registrationStore');
var Registrar = require('../registrar');
var Server = require('../server');

var suite = vows.describe('registrar API testing');

function createServer() {
    var server = new Server();
    server.templateManager = null;
    server.notifier = null;
    server.registrar = new Registrar(new RegistrationStore('registrationsTest'));
    return server.createServer();
}

var validRegistration = {
    registrationId: 'myregistration',
    templateVersion: '3.0',
    templateLanguage: 'en',
    service: 'wns',
    routes: [ { 'name': '*', 'token': '123', 'secondsToLive': 86400 } ]
};

suite.addBatch(
    {
        'Running against a registrar server': {
            topic: pact.httpify(createServer()),
            'when invalid registration is requested': {
                topic: pact.request(
                    {
                        url:'/registrations/br.howes',
                        method: 'POST',
                        headers: {'Content-Type':'application/json'},
                        data: JSON.stringify(
                            {
                                registrationId: 'myregistration',
                                templateLanguage: 'en',
                                service: 'wns',
                                routes: [ { 'name': '*', 'token': '123', 'secondsToLive': 86400 } ]
                            }
                        )
                    }
                ),
                'should fail': pact.code(400),
                'body should be empty': function (res) {
                    assert.isNull(res.body);
                }
            },
            'when valid registration is requested': {
                topic: pact.request(
                    {
                        url:'/registrations/br.howes',
                        method: 'POST',
                        headers: {'Content-Type':'application/json'},
                        data: JSON.stringify(validRegistration)
                    }
                ),
                'should succeed': pact.code(200),
                'body should contain json': function (res) {
                    var body = res.body;
                    assert.isObject(body);
                },
                'body should contain given registration': function (res) {
                    var body = res.body;
                    assert.strictEqual(body.registrationId, 'myregistration');
                    assert.strictEqual(body.templateVersion, '3.0');
                    assert.strictEqual(body.templateLanguage, 'en');
                    assert.strictEqual(body.service, 'wns');
                },
                'when fetching same user': {
                    topic: pact.request(
                        {
                            url:'/registrations/br.howes',
                            method: 'GET',
                            headers: {'Content-Type':'application/json'}
                        }
                    ),
                    'should succeed': pact.code(200),
                    'body should contain json object': function (res) {
                        assert.isObject(res.body);
                    },
                    'json object should contain array': function (res) {
                        assert.isArray(res.body.registrations);
                    },
                    'array should contain valid registration': function (res) {
                        var body = res.body.registrations[0];
                        assert.strictEqual(body.registrationId, 'myregistration');
                        assert.strictEqual(body.templateVersion, '3.0');
                        assert.strictEqual(body.templateLanguage, 'en');
                        assert.strictEqual(body.service, 'wns');
                    },
                    'when deleting same user': {
                        topic: pact.request(
                            {
                                url:'/registrations/br.howes',
                                method: 'DELETE',
                                headers: {'Content-Type':'application/json'}
                            }
                        ),
                        'should succeed': pact.code(204),
                        'body should be empty': function (res) {
                            assert.strictEqual(res.body, '');
                        },
                        'when fetching same user again': {
                            topic: pact.request(
                                {
                                    url:'/registrations/br.howes',
                                    method: 'GET',
                                    headers: {'Content-Type':'application/json'}
                                }
                            ),
                            'should fail': pact.code(404),
                            'body should contain be null': function (res) {
                                assert.isNull(res.body);
                            }
                        }
                    }
                }
            }
        }
    }
);

suite.export(module);
