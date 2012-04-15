module.exports = Notifier;

function Notifier(templateStore, registrationStore, generator, senders) {
    this.templateStore = templateStore;
    this.registrationStore = registrationStore;
    this.generator = generator;
    this.senders = senders;
}

Notifier.prototype = {
    postNotification = function(req, res) {
        var self = this;
        var skypeId = req.params.skypeId;
        this.registrationStore.getDevices(req.params.skypeId, function(err, devices) {
            if (err !== null) {
                res.send(null, null, 500);
            }

            if (devices.length == 0) {
                res.send(null, null, 202);
            }
            
            var body = req.body;
            var eventId = body.eventId;
            var substitutions = body.substitutions;
            for (var index1 in devices) {
                var device = devices[index1];
                self.emit(device, eventId, substitutions);
            }
            res.send(null, null, 200);
        });
    },

    emit: function(device, eventId, substitutions) {
        for (var index in device.routes) {
            var route = device.routes[index];
            this.emitOne(device, eventId, substitutions, route);
        }
    },

    emitOne: function(device, eventId, substitutions, route) {
        var self = this;
        self.locate(eventId, route.name, device.templateVersion, 
            device.templateLanguage, function(err, templates) {
                if (err !== null) {
                    console.log(err);
                }
                else if (templates.length !== 0) {
                    for (var index in templates) {
                        var content = self.generator.transform(templates[index],
                            substitutions);
                        self.deliver(device.serviceType, content, 
                            route.credential);
                    }
                }
        });
    },

    deliver: function(serviceType, content, credential) {
        this.senders[serviceType].send(content, credential);
    }
}