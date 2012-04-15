var express = require('express');
var app = express.createServer();

var Registrar = require('registrar');
var Notifier = require('notifier');
var TemplateStore = require('templateStore');
var RegistrationStore = require('registrationStore');
var PayloadGenerator = require('payloadGenerator');

process.env.AZURE_STORAGE_ACCOUNT = 'brhregistrar';
process.env.AZURE_STORAGE_ACCESS_KEY = 'oJjX+h537iMYUjm4pHicPOuWTM+FlrVhK+d3jPFlNGzsm/xCp0Ha2I+WAAjCUk9/963IT1u6GCW7Z+tDMdf3QQ==';

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

var registrationStore = new RegistrationStore();
var registrar = new Registrar(registrationStore);
app.get('/registrations/:skypeId', registrar.getDevices.bind(registrar));
app.post('/registrations/:skypeId', registrar.addDevice.bind(registrar));
app.del('/registrations/:skypeId', registrar.deleteDevice.bind(registrar));

var templateStore = new TemplateStore();
var generator = new PayloadGenerator();
var notifier = new Notifier(templateStore, registrationStore, generator);
app.post("/postnotification:skypeId", notifier.postNotification.bind(notifier));

app.listen(process.env.port);
