'use strict';

/**
 * @fileOverview Main nodejs server. Provides three kinds of services: a registrar, a template manager, and a notifier.
 */
module.exports = Server;

var express = require('express');

var config = require('./config');
var APNs = require('./APNs');
var GCM = require('./GCM');
var Notifier = require('./notifier');
var PayloadGenerator = require('./payloadGenerator');
var Registrar = require('./registrar');
var RegistrationStore = require('./registrationStore');
var TemplateManager = require('./templateManager');
var TemplateStore = require('./templateStore');
var WNS = require('./WNS');

/**
 * Server constructor.
 *
 * @class
 *
 * A Server object routes HTTP requests to appropriate services.
 */
function Server()
{
    this.log = config.log('server');
    this.registrationStoreName = config.registrations_table_name;
    this.templateStoreName = config.templates_table_name;
}

/**
 * Server prototype.
 *
 * Defines the methods available to a Server instance.
 */
Server.prototype = {

    /**
     * Initialize a Server instance with the necessary services.
     *
     * @param {Function} callback the function to invoke when the Server is initialized.
     */
    initialize: function(callback) {
        var log = this.log.child('initialize');
        var self = this;
        var awaiting = 0;
        var errors = null;
        var app = express.createServer();
        var registrationStore;
        var templateStore;

        var continuation = function(key, err) {
            var clog = log.child('continuation');
            clog.BEGIN(key, err);

            --awaiting;
            if (err !== null) {
                clog.error(key, 'error:', err);
                if (errors === null) {
                    errors = {};
                }
                errors[key] = err;
            }

            if (awaiting === 0) {
                clog.info('creating notifier');
                var senders = {'wns': new WNS(), 'apns': new APNs(), 'gcm': new GCM()};
                var generator = new PayloadGenerator();
                var service = new Notifier(templateStore, registrationStore, generator, senders);
                self.notifier = service;
                clog.info('adding bindings to notifier');
                app.post('/post/:userId', service.postNotification.bind(service));
                app.post('/logReceipt', service.logReceipt.bind(service));
                clog.END();
                callback(app, errors);
                return;
            }

            clog.END('awaiting:', awaiting);
        };

        log.BEGIN();

        app.configure(
            function () {
                app.use(express.bodyParser());
                app.use(app.router);
            });

        app.configure('development', function(){
                          app.use(express.errorHandler({dumpExceptions: true, showStack: true}));
                      });

        app.configure('production', function(){
                          app.use(express.errorHandler());
                      });

        ++awaiting;
        registrationStore = new RegistrationStore(this.registrationStoreName, function(err) {
                log.info('creating registrar');
                var service = self.registrar = new Registrar(registrationStore);
                log.info('adding bindings to registrar');
                app.get('/registrations/:userId', service.getRegistrations.bind(service));
                app.post('/registrations/:userId', service.addRegistration.bind(service));
                app.del('/registrations/:userId', service.deleteRegistration.bind(service));
                continuation('registrationStore', err);
            });

        ++awaiting;
        templateStore = new TemplateStore(this.templateStoreName, function(err) {
                log.info('creating template manager');
                var service = new TemplateManager(templateStore);
                log.info('adding bindings to template manager');
                app.get('/templates', service.getTemplates.bind(service));
                app.post('/templates', service.addTemplate.bind(service));
                app.del('/templates', service.deleteTemplate.bind(service));
                continuation('templateStore', err);
            });

        log.END();
    }
};

// Run if we are the main script
if (process.argv[1].indexOf('server.js') !== -1) {
    var log = config.log('main');
    var server = new Server();
    var port = process.env.PORT || 4465;
    server.initialize(
        function (app, errors) {
            if (errors !== null) {
                log.error('failed to start due to errors during initialization: ', errors);
            }
            else {
                log.info('starting server on port', port);
                app.listen(port);
            }
        }
    );
}
