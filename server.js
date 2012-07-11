/**
 * @fileOverview Main nodejs server. Provides three kinds of services: a registrar, a template manager, and a notifier.
 */

"use strict";

var express = require('express');
var app = express.createServer();

var config = require('./config.js');
var Registrar = require('./registrar.js');
var Notifier = require('./notifier.js');
var TemplateManager = require('./templateManager.js');
var TemplateStore = require('./templateStore.js');
var RegistrationStore = require('./registrationStore.js');
var PayloadGenerator = require('./payloadGenerator.js');

process.env.AZURE_STORAGE_ACCOUNT = config.azure_storage_account;
process.env.AZURE_STORAGE_ACCESS_KEY = config.azure_storage_access_key;

// Configuration
app.configure(function(){
    app.use(express.bodyParser());
    app.use(app.router);
});

app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});
app.configure('production', function(){
    app.use(express.errorHandler());
});

// Registrar bindings
var registrationStore = new RegistrationStore(config.registrations_table_name);
var registrar = new Registrar(registrationStore);
app.get('/registrations/:userId', registrar.getRegistrations.bind(registrar));
app.post('/registrations/:userId', registrar.addRegistration.bind(registrar));
app.del('/registrations/:userId', registrar.deleteRegistration.bind(registrar));

// Template Manager bindings
var templateStore = new TemplateStore(config.templates_table_name);
var templateManager = new TemplateManager(templateStore);
app.get("/templates", templateManager.getTemplates.bind(templateManager));
app.post("/templates", templateManager.addTemplate.bind(templateManager));
app.del("/templates", templateManager.deleteTemplate.bind(templateManager));

// Notifier bindings
var generator = new PayloadGenerator();
var notifier = new Notifier(templateStore, registrationStore, generator);
app.post("/postnotification/:userId", notifier.postNotification.bind(notifier));

app.listen(process.env.PORT);
