'use strict';

var assert = require('assert');
var pact = require('pact');
var vows = require('vows');
var Server = require('../server.js');

function makeQuery(obj) {
    var args = [];
    for(var p in obj)
        args.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
    return args.join("&");
}

var validRegistration = {
    registrationId: 'myregistration',
    templateVersion: '3.0',
    templateLanguage: 'en-us',
    service: 'wns',
    routes: [ { 'name': '*', 'token': '123', 'secondsToLive': 60 } ]
};

var validTemplate = {
    eventId: 200,
    notificationId: 100,
    templateVersion: '3.0',
    templateLanguage: 'en',
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

var invalidPost = {
    eventId: 201,
    substitutions: {}
};

var server = null;
var suite = vows.describe('REST API testing');

suite.addBatch(
{
    'start server': {
        topic: function () {
            var server = new Server();
            server.registrationStoreName = 'serverTestRegistrations';
            server.templateStoreName = 'serverTestTemplates';
            server = server.initialize(this.callback);
        },
        'successfully': function (app, errors) {
            server = app;
            assert.isNull(errors);
            console.log(arguments);
        }
    }
});

// Make sure server has no entries
suite.addBatch(
    {
        'server has no entries': {
            topic: function () {
                var vows = this;
                server.listen(4465, '127.0.0.1', function (err) {
                                  vows.callback(err, 4465);
                                  });
                },
            'for a registration query': {
                topic: pact.request(
                    {
                        url:'/registrations/br.howes',
                        method: 'GET',
                        headers: {'Content-Type':'application/json'}
                    }
                ),
                'it should fail with NOT FOUND': pact.code(404)
            },
            'for a template query': {
                topic: pact.request(
                    {
                        url:'/templates?' + makeQuery(validTemplate),
                        method: 'GET',
                        headers: {'Content-Type':'application/json'}
                    }
                ),
                'it should fail with NOT FOUND': pact.code(404)
            }
        }
    }
);

// Make sure we can add entries to server
suite.addBatch(
    {
        'adding entries to server': {
            topic: function () {
                var vows = this;
                server.listen(4465, '127.0.0.1', function (err) {
                                  vows.callback(err, 4465);
                                  });
                },
            'new valid registration': {
                topic: pact.request(
                    {
                        url:'/registrations/br.howes',
                        method: 'POST',
                        headers: {'Content-Type':'application/json'},
                        data: JSON.stringify(validRegistration)
                    }
                ),
                'it should succeed with OK': pact.code(200)
            },
            'invalid registration with missing registrationId': {
                topic: pact.request(
                    {
                        url:'/registrations/br.howes',
                        method: 'POST',
                        headers: {'Content-Type':'application/json'},
                        data: JSON.stringify({
                                                 templateVersion: '3.0',
                                                 templateLanguage: 'en-us',
                                                 service: 'wns',
                                                 routes: [ { 'name': '*', 'token': '123', 'secondsToLive': 60 } ]
                                             })
                    }),
                'it should fail with BAD REQUEST': pact.code(400)
            },
            'invalid registration with missing templateVersion': {
                topic: pact.request(
                    {
                        url:'/registrations/br.howes',
                        method: 'POST',
                        headers: {'Content-Type':'application/json'},
                        data: JSON.stringify({
                                                 registrationId: '123',
                                                 templateLanguage: 'en-us',
                                                 service: 'wns',
                                                 routes: [ { 'name': '*', 'token': '123', 'secondsToLive': 60 } ]
                                             })
                    }),
                'it should fail with BAD REQUEST': pact.code(400)
            },
            'invalid registration with missing templateLanguage': {
                topic: pact.request(
                    {
                        url:'/registrations/br.howes',
                        method: 'POST',
                        headers: {'Content-Type':'application/json'},
                        data: JSON.stringify({
                                                 registrationId: '123',
                                                 templateVersion: '1.0',
                                                 service: 'wns',
                                                 routes: [ { 'name': '*', 'token': '123', 'secondsToLive': 60 } ]
                                             })
                    }),
                'it should fail with BAD REQUEST': pact.code(400)
            },
            'invalid registration with missing service': {
                topic: pact.request(
                    {
                        url:'/registrations/br.howes',
                        method: 'POST',
                        headers: {'Content-Type':'application/json'},
                        data: JSON.stringify({
                                                 registrationId: '123',
                                                 templateVersion: '1.0',
                                                 templateLanguage: 'en-us',
                                                 routes: [ { 'name': '*', 'token': '123', 'secondsToLive': 60 } ]
                                             })
                    }),
                'it should fail with BAD REQUEST': pact.code(400)
            },
            'invalid registration with missing route': {
                topic: pact.request(
                    {
                        url:'/registrations/br.howes',
                        method: 'POST',
                        headers: {'Content-Type':'application/json'},
                        data: JSON.stringify({
                                                 registrationId: '123',
                                                 templateVersion: '1.0',
                                                 templateLanguage: 'en-us',
                                                 service: 'wns'
                                             })
                    }),
                'it should fail with BAD REQUEST': pact.code(400)
            },
            'invalid registration with empty route': {
                topic: pact.request(
                    {
                        url:'/registrations/br.howes',
                        method: 'POST',
                        headers: {'Content-Type':'application/json'},
                        data: JSON.stringify({
                                                 registrationId: '123',
                                                 templateVersion: '1.0',
                                                 templateLanguage: 'en-us',
                                                 service: 'wns',
                                                 route: []
                                             })
                    }),
                'it should fail with BAD REQUEST': pact.code(400)
            },
            'invalid registration with invalid route': {
                topic: pact.request(
                    {
                        url:'/registrations/br.howes',
                        method: 'POST',
                        headers: {'Content-Type':'application/json'},
                        data: JSON.stringify({
                                                 registrationId: '123',
                                                 templateVersion: '1.0',
                                                 templateLanguage: 'en-us',
                                                 service: 'wns',
                                                 route: [{name: '', token: '', secondsToLive: 12345}]
                                             })
                    }),
                'it should fail with BAD REQUEST': pact.code(400)
            },
            'new valid template': {
                topic: pact.request(
                    {
                        url:'/templates',
                        method: 'POST',
                        headers: {'Content-Type':'application/json'},
                        data: JSON.stringify(validTemplate)
                    }
                ),
                'it should succeed with OK': pact.code(200)
            }
        }
    }
);

// Make sure we added entries to server
suite.addBatch(
    {
        'server has added entries': {
            topic: function () {
                var vows = this;
                server.listen(4465, '127.0.0.1', function (err) {
                                  vows.callback(err, 4465);
                                  });
                },
            'for a registration query': {
                topic: pact.request(
                    {
                        url:'/registrations/br.howes',
                        method: 'GET',
                        headers: {'Content-Type':'application/json'}
                    }
                ),
                'it should succeed with OK': pact.code(200)
            },
            'for a template query': {
                topic: pact.request(
                    {
                        url:'/templates?' + makeQuery(validTemplate),
                        method: 'GET',
                        headers: {'Content-Type':'application/json'}
                    }
                ),
                'it should succeed with OK': pact.code(200)
            }
        }
    }
);

// Make sure we can post to a registered user
suite.addBatch(
    {
        'posting notification request to server': {
            topic: function () {
                var vows = this;
                server.listen(4465, '127.0.0.1', function (err) {
                                  vows.callback(err, 4465);
                                  });
                },
            'a valid post request': {
                topic: pact.request(
                    {
                        url:'/post/br.howes',
                        method: 'POST',
                        headers: {'Content-Type':'application/json'},
                        data: JSON.stringify(validPost)
                    }
                ),
                'it should succeed with ACCEPTED': pact.code(202),

                'is should return 1 match': function (err, res) {
                    assert.isNull(err);
                    assert.isObject(res);
                    assert.equal(res.body.count, 1);
                }
            },
            'an invalid post request': {
                topic: pact.request(
                    {
                        url:'/post/br.howes',
                        method: 'POST',
                        headers: {'Content-Type':'application/json'},
                        data: JSON.stringify({})
                    }
                ),
                'it should fail with BAD REQUEST': pact.code(400)
            },
            'a missing post request': {
                topic: pact.request(
                    {
                        url:'/post/br.howes',
                        method: 'POST',
                        headers: {'Content-Type':'application/json'},
                        data: JSON.stringify(invalidPost)
                    }
                ),
                'it should succeed with ACCEPTED': pact.code(202),

                'is should return 0 matches': function (err, res) {
                    assert.isNull(err);
                    assert.isObject(res);
                    assert.equal(res.body.count, 0);
                }
            }
        }
    }
);

// Make sure we can delete entries from server
suite.addBatch(
    {
        'deleting entries from server': {
            topic: function () {
                var vows = this;
                server.listen(4465, '127.0.0.1', function (err) {
                                  vows.callback(err, 4465);
                                  });
                },
            'deleting previous registration': {
                topic: pact.request(
                    {
                        url:'/registrations/br.howes',
                        method: 'DELETE',
                        headers: {'Content-Type':'application/json'}
                    }
                ),
                'it should succeed with NO DATA': pact.code(204)
            },
            'deleting previous template': {
                topic: pact.request(
                    {
                        url:'/templates',
                        method: 'DELETE',
                        headers: {'Content-Type':'application/json'},
                        data: JSON.stringify(validTemplate)
                    }
                ),
                'it should succeed with NO DATA': pact.code(204)
            }
        }
    }
);

// Make sure we really deleted entries from server
suite.addBatch(
    {
        'server again has no entries': {
            topic: function () {
                var vows = this;
                server.listen(4465, '127.0.0.1', function (err) {
                                  vows.callback(err, 4465);
                                  });
                },
            'for a registration query': {
                topic: pact.request(
                    {
                        url:'/registrations/br.howes',
                        method: 'GET',
                        headers: {'Content-Type':'application/json'}
                    }
                ),
                'it should fail with NOT FOUND': pact.code(404)
            },
            'for a template query': {
                topic: pact.request(
                    {
                        url:'/templates?' + makeQuery(validTemplate),
                        method: 'GET',
                        headers: {'Content-Type':'application/json'}
                    }
                ),
                'it should fail with NOT FOUND': pact.code(404)
            }
        }
    }
);

suite.export(module);
