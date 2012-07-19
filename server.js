'use strict';

/**
 * @fileOverview Main nodejs server. Provides three kinds of services: a registrar, a template manager, and a notifier.
 */
module.exports = Server;

var config = require('./config');

function Server()
{
    this.log = config.log('server');
}

Server.prototype = {

    createServer: function() {
        var log = this.log.child('createServer');
        log.BEGIN();

        var express = require('express');
        var app = express.createServer();

        // Configuration
        app.configure(
            function () {
                app.use(express.bodyParser());
                app.use(app.router);
            });

        app.configure('development', function(){
                          app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
                      });

        app.configure('production', function(){
                          app.use(express.errorHandler());
                      });

        var service = this.registrar;
        if (service === undefined) {
            log.info('creating stock registrar');
            var Registrar = require('./registrar');
            var RegistrationStore = require('./registrationStore');
            var registrationStore = new RegistrationStore(config.registrations_table_name);
            service = new Registrar(registrationStore);
            this.registrar = service;
        }

        if (service !== null) {
            log.info('binding registrar');
            app.get('/registrations/:userId', service.getRegistrations.bind(service));
            app.post('/registrations/:userId', service.addRegistration.bind(service));
            app.del('/registrations/:userId', service.deleteRegistration.bind(service));
        }

        service = this.templateManager;
        if (service === undefined) {
            log.info('creating stock template manager');
            var TemplateManager = require('./templateManager');
            var TemplateStore = require('./templateStore');
            var templateStore = new TemplateStore(config.templates_table_name);
            service = new TemplateManager(templateStore);
            this.templateManager = service;
        }

        if (service !== null) {
            log.info('binding templateManager');
            app.get('/templates', service.getTemplates.bind(service));
            app.post('/templates', service.addTemplate.bind(service));
            app.del('/templates', service.deleteTemplate.bind(service));
        }

        service = this.notifier;
        if (service === undefined) {
            log.info('creating stock notifier');
            var Notifier = require('./notifier');
            var PayloadGenerator = require('./payloadGenerator');
            var APNs = require('./APNs');
            var GCM = require('./GCM');
            var WNS = require('./WNS');
            var generator = new PayloadGenerator();
            var senders = {'wns': new WNS(), 'apns': new APNs(), 'gcm': new GCM()};
            service = new Notifier(this.templateManager.templateStore, this.registrar.registrationStore,
                                   generator, senders);
            this.notifier = service;
        }

        if (service != null) {
            log.info('binding notifier');
            app.post('/post/:userId', service.postNotification.bind(service));
        }

        log.END();
        return app;
    }
};

// Run if we are the main script
if (process.argv[1].indexOf('server.js') !== -1) {
    var server = new Server();
    var port = process.env.PORT || 4465;
    server.createServer().listen(port);
}
